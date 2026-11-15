---
# One-line feature summary (e.g. "Admin user sign-up")
feature_goal: "테스트 데이터 시드 + AWS 미설정 개발 모드 — SEED_SAMPLE_DATA=1 이면 업체 10곳 · 객실 · 업체 총관리자 10명 · 이용자 1명을 고정 ID 로 넣고(사진은 게이트웨이 /sample/), AWS_S3_BUCKET 이 비면 파일을 게이트웨이 내부 파일 저장소(/files)에, AWS 키가 비면 SMS 를 보내지 않고 로그에 남긴다"

# Domain/module name (see AGENTS.md for the project directory structure)
domain: "seed — libs/database/src/seeder(샘플 시드), libs/integration(저장소 포트 — 내부 파일 저장소 어댑터 · S3 어댑터의 sample/ 키, SMS 어댑터의 생략), apps/gateway(정적 경로 /sample/ · 내부 파일 저장소 경로 /files · 샘플 PNG), scripts(PNG 생성기 · Docker 공용 볼륨), Docker(공유 볼륨 · Dockerfile), 문서(README · AGENTS.md · docs · .env.example · 프론트 안내 · 메모리)"

# Roadmap phase this feature belongs to (number), when a roadmap exists — the spec board uses it to show
#   "지금 작업 중" (in-progress / Next up phase) and to mark the feature 배포 once the phase is done. Empty if none.
roadmap_phase: ""

# Entry-point method/endpoint. Record the entry-point identifier this project actually uses,
#   derived from code evidence (path:line), in the project's own naming. Do not assume a
#   particular position's syntax. (key name "api_method" stays as-is)
api_method: "user-service 부팅 시드(SAMPLE_SEED_TARGETS) · 게이트웨이 GET /sample/<파일>.png · 내부 파일 저장소 PUT /files/upload · GET /files/download · GET /files/<키> · STORAGE_GATEWAY(LocalStorageGateway | S3StorageGateway) · SMS_SENDER(SnsSmsSender 생략 분기)"

# Path/signature (e.g. "/api/v1/user/admin/sign")
#   Record the path or signature this project actually uses, from code evidence (path:line),
#   in the project's own naming. (key name "api_path" stays as-is)
api_path: "SAMPLE_SEED_TARGETS · {GATEWAY_PUBLIC_URL}/sample/{파일} · {GATEWAY_PUBLIC_URL}/files/upload?key&expires&signature (PUT, Content-Type 서명) · /files/download?key&expires&signature · /files/{공개 키}"

# Affected state — write/persist targets. Basis for sizing the test cases. (key name "affected_data" stays as-is)
#   Record the state this project actually writes/persists, derived from code evidence (path:line),
#   in the project's own naming. Read-only reads are not "write" but are still data. Leave empty if none.
affected_data:
  - "샘플 시드(SEED_SAMPLE_DATA=1 일 때만) — t_store 10 · t_store_hour 28 · t_store_break 1 · t_room_plan 30 · t_store_file 20 · t_user 11 · t_user_setting 11 · t_room_group 25 · t_room_group_image 50 · t_room_group_plan 75 · t_room 96 — insert 만(이미 있는 PK 는 건너뜀)"
  - "저장소 파일 — apps/gateway/src/assets/sample/*.png 70개(커밋), 내부 파일 저장소 폴더 FILE_STORAGE_DIR(기본 storage/files — Docker 공유 볼륨 roomless-files, git 제외)에 업로드 파일 쓰기 · 지우기"
  - "DB 스키마 변경 없음 — 파일 행(t_store_file · t_room_group_image)의 키 모양은 S3 와 같다"
---

## Feature Description

AWS 없이도 개발 · 포트폴리오 시연이 되게 한다 — `AWS_S3_BUCKET` 이 비면 파일은 게이트웨이의 내부 파일 저장소(서명된 업로드 주소로 PUT · 공유 폴더 · `/files` 로 제공)에, AWS 키가 비면 SMS 는 보내지 않고 받는 번호 · 본문을 서버 로그에 남긴다(사용자 결정 2026-11-15 — 값을 채우면 지금처럼 S3 · SNS).
`.env` 의 `SEED_SAMPLE_DATA=1` 이면 user-service 부팅 시드가 서울 업체 10곳(객실 그룹 · 호실 · 사진 · 업체 총관리자)과 이용자 1명을 고정 ID 로 넣고, 사진은 저장소에 넣은 PNG 를 게이트웨이 `/sample/` 로 내준다.
공개 API 의 요청 · 응답 모양은 그대로다(업로드 주소 · 사진 주소의 호스트만 게이트웨이가 된다) — 계정 · 업체코드 · 테스트 로그인 · 사진 호스트는 가이드와 프론트 안내 문서에 싣는다.

## API Spec
- Method: 부팅 시드(user-service) + 게이트웨이 파일 경로 + 저장소 · SMS 포트 어댑터
- Path:
  - 시드 — `SEED_TARGETS`(libs/database/src/seeder/seeder.targets.ts:197) 끝에 `...SAMPLE_SEED_TARGETS`
  - `GET /sample/<파일>.png` — 샘플 사진(게이트웨이 `assets/sample/`, 항상)
  - 내부 파일 저장소(게이트웨이, `AWS_S3_BUCKET` 이 빌 때만 — 아니면 경로 없음 404)
    - `PUT /files/upload?key=<키>&expires=<unix 초>&signature=<hex>` — 본문 = 파일, `Content-Type` 은 주소를 받을 때의 것과 같아야 한다(서명에 들어 있다) · 10MB 까지
    - `GET /files/download?key=<private/ 키>&expires=…&signature=…` — 비공개 파일(사업자등록증) 열람, 10분
    - `GET /files/<공개 키>` — 공개 파일(업체 · 그룹 사진), `private/` 키는 이 경로로 열리지 않는다(404)
- Request: 업로드는 S3 presigned 와 같은 방식 — 업로드 주소 API(기존)가 준 `upload_url` 로 같은 `Content-Type` 헤더를 붙여 PUT
- Response:
  - 업로드 200(본문 없음) / 403 서명 틀림 · 만료 · Content-Type 다름 / 413 10MB 초과 / 503 쓰기 실패 — 실패 본문은 공통 모양 `{message, validation_errors: null}`
  - 열람 200 파일 / 403 서명 / 404 없음 · 공개 경로 200 파일 / 404(Nest 기본)
  - 공개 API 의 사진 주소 필드 — 내부 저장소면 `{GATEWAY_PUBLIC_URL}/files/<키>`, 샘플이면 `{GATEWAY_PUBLIC_URL}/sample/<파일>`, 비공개 열람 주소는 `/files/download?…`

## Business Rules
- **저장소 어댑터 고르기**: `StorageModule` 이 `AWS_S3_BUCKET` 이 있으면 `S3StorageGateway`, 비면 `LocalStorageGateway`(같은 `STORAGE_GATEWAY` 포트 — 서비스 코드는 그대로). 게이트웨이도 같은 값으로 `/files` 경로를 열지 정한다(env_file 로 같은 .env)
- **내부 파일 저장소**(LocalStorageGateway — 실제로 저장 · 제공하는 저장소, 가짜 아님)
  - 키 · DB 행 모양은 S3 와 같다(키는 지금처럼 도메인 util 이 만든다 — store.util.ts:104 · room.util.ts:67, 공개 `store/` · 비공개 `private/`)
  - 업로드 주소: `GATEWAY_PUBLIC_URL/files/upload?key&expires&signature` — HMAC-SHA256(`INTERNAL_API_TOKEN`, `PUT\n키\nContent-Type\n만료`), 10분(STORAGE_UPLOAD_URL_TTL_SECONDS). `GATEWAY_PUBLIC_URL` · `INTERNAL_API_TOKEN` 이 비면 503 STORAGE_UNAVAILABLE_MESSAGE(인터페이스 계약 그대로)
  - `exists` = 폴더에 파일이 있는지, `remove` = 파일 삭제(없어도 성공, 샘플 키는 건너뜀), `getPublicUrl` = `GATEWAY_PUBLIC_URL/files/<키>`(샘플 키는 `/sample/…` — 비면 500 STORAGE_PUBLIC_URL_MISSING_MESSAGE), `createDownloadUrl` = 서명된 `/files/download?…`(10분)
  - 폴더 `FILE_STORAGE_DIR`(기본 `storage/files` — 실행 위치 기준: 로컬은 저장소 루트, Docker 는 `/app`). 게이트웨이(받기 · 내주기) · user-service · admin-service(확인 · 삭제)가 같은 폴더를 본다 — Docker 는 공용 볼륨 `roomless-files`(external — `npm run docker:network` 가 네트워크와 함께 만든다)를 세 앱에 `/app/storage/files` 로 붙인다. 이미지에 그 폴더를 `node` 소유로 만들어 둔다(빈 볼륨이 소유자를 물려받는다)
  - 키 → 경로는 폴더 밖으로 나갈 수 없다(`..` · 절대 경로 · 역슬래시 거부). 쓰기는 임시 파일 → 이름 바꾸기(받다 끊기면 반쪽 파일이 남지 않는다)
  - S3 를 나중에 켜면 내부 저장소에 올린 파일은 S3 에 없다(옮기지 않는다 — 가이드에 적음)
- **게이트웨이 `/files` 경로**(인프라 모듈 `modules/local-file/` — 문 소켓처럼 HttpAdapterHost 로 HTTP 앱에 직접 붙인다, 공개 API · Swagger 가 아니다): `onModuleInit` 에 붙여 Nest 라우트 뒤 · 404 처리 앞. CORS(CORS_ORIGINS — PUT 허용)와 API 로그 미들웨어는 그대로 걸린다. 서명은 시간차 안전 비교, 만료는 dayjs 로
- **SMS 생략**(SnsSmsSender): `AWS_ACCESS_KEY_ID` 또는 `AWS_SECRET_ACCESS_KEY` 가 비면 SNS 를 부르지 않고 `SMS 생략(AWS 키 미설정) — <번호>: <본문>` 경고 로그(인증번호 · 임시 비밀번호 포함 — 로그에서 보고 시험한다, 사용자 결정 2026-11-15) 후 성공으로 끝난다. 부팅 때 한 번 안내. 키가 있으면 지금처럼 SNS(실패 503). IAM 역할만으로 돌리는 배포는 키가 비어 SMS 가 생략된다 — SMS 를 보내려면 키를 넣는다(가이드)
- **샘플 시드**(이전 결정 그대로): `SEED_SAMPLE_DATA === '1'` 일 때만 · PK 멱등(SeederService.seedEntity — seeder.service.ts:50) · 고정 ID `5a3e` + 종류 2자리 + 번호 26자리 · `new XEntity()` + 할당(buildSuperAdminSeed — seeder.targets.ts:162) · 업체 10곳(24시간 6 · 영업시간 4 — 휴무 · 브레이크 · 판매 종류 다양) · 그룹 25 · 호실 96 · 업체 총관리자(업체코드 + `manager` / `1234`) · 이용자(KAKAO · `sample-user-01` · 휴대폰 인증 완료) · 모든 계정 회원 설정
- **샘플 사진 키** `sample/<파일>.png` — 두 어댑터 모두 공개 주소는 `GATEWAY_PUBLIC_URL/sample/…`, 삭제는 건너뜀(파일은 저장소 assets). API 로는 등록할 수 없다(업로드 키 검사 isStoreFileKey · isRoomGroupImageKey — store.util.ts:117, room.util.ts:80)
- **게이트웨이 `/sample/`**: `assets/sample/` 정적 경로(항상), nest-cli `assets` 가 dist 로 복사, `useStaticAssets` 는 API 로그 미들웨어보다 앞
- PNG 70개는 `scripts/sample-images.mjs`(외부 패키지 없음)가 그리고 커밋한다 — `npm run sample:images`

## TDD Cases
- 테스트 생략(위임형): 샘플 시드 데이터 · 만드는 함수(libs/database), 내부 파일 저장소 어댑터 · 서명 · 경로 util · S3 어댑터 분기 · SMS 생략 분기(libs/integration), 게이트웨이 `/sample/` · `/files` 경로(gateway 인프라), PNG 생성기 · 볼륨 스크립트(scripts) — AGENTS.md Testing 이 라이브러리 · 게이트웨이 인프라 · util 단위 spec 을 두지 않는다. 바뀌는 service · repository 없음(서비스 spec 은 STORAGE_GATEWAY · SMS_SENDER 를 mock 한다)
- 확인은 build 에서: `npm run typecheck` · `npm run lint` · `npm run build:gateway`(dist 에 PNG 70개) · 시드 데이터 제약 점검 · 서명 · 경로 util 점검(빌드 결과를 node 로 불러 — 맞는 서명 통과 · 키 · Content-Type · 만료 바꾸면 거부 · `../` · 절대 경로 거부) — scratchpad 일회성 스크립트

## Notes
- 실행은 사용자 몫: `.env` 에 `GATEWAY_PUBLIC_URL`(필수 — 내부 저장소 · 샘플 사진 주소) · `SEED_SAMPLE_DATA=1`(테스트 데이터) → `npm run docker:network`(공용 볼륨) → 서버 기동. Claude 는 서버 · Docker 를 띄우지 않는다
- 공개 API 는 바뀌지 않는다 — 업로드 주소 · 사진 주소의 호스트가 게이트웨이가 될 수 있다는 것(next/image `remotePatterns`, 업로드 PUT 은 CORS_ORIGINS 의 프론트 주소에서)을 프론트 안내 문서에 싣는다
- 로드맵 해당 없음(Phase 에 없는 개발 지원 작업)

## Proposals (Codebase-Based)
- [x] 기존 시드 틀(SeederService · SEED_TARGETS · 만드는 함수 data)을 그대로 쓴다 — 새 실행기 · 명령 없음(seeder.service.ts:28, seeder.targets.ts:22)
- [x] 저장소는 포트(STORAGE_GATEWAY — integration.interface.ts StorageGatewayInterface) 뒤에서 어댑터만 바꾼다 — 서비스 · 업로드 주소 API · 프론트 업로드 방식(presigned PUT)이 그대로다
- [x] 게이트웨이 경로는 문 소켓과 같은 방식(HttpAdapterHost — door-socket.server.ts:60-70)의 인프라 모듈 — 공개 API 폴더(`api/v1/…`)에 두지 않는다
- [x] 서명 비밀값은 이미 세 앱(gateway · user-service · admin-service)에 있는 `INTERNAL_API_TOKEN` 을 쓴다 — 새 비밀값 없음(.env 를 늘리지 않음)
- [x] Docker 공용 볼륨은 공용 네트워크와 같은 방식(external — scripts/docker-network.mjs)으로 만든다

## Decisions
- [x] 넣는 방식 — `.env` 플래그(`SEED_SAMPLE_DATA=1`)로 user-service 부팅 시드(사용자 결정 2026-11-13)
- [x] 샘플 사진 — S3 를 쓰지 않고 저장소 PNG + 게이트웨이 `/sample/`(사용자 요청 2026-11-13)
- [x] 이용자 테스트 계정 1개 · 업체 관리자는 업체마다 1명(사용자 요청 2026-11-13)
- [x] AWS S3 가 설정되지 않았으면(`AWS_S3_BUCKET` 빔) 내부 파일 저장소로 올린다 — 샘플 사진처럼 백엔드 주소로(사용자 요청 2026-11-15 — 포트폴리오용, AWS 세팅 생략)
- [x] AWS 키가 비면 SMS 는 보내지 않고 받는 번호 · 본문을 로그에 남긴 뒤 성공(사용자 결정 2026-11-15 — "로그에 남기고 넘어감", 인증번호 · 임시 비밀번호를 로그로 본다)
- [x] 기존 규칙과의 관계 — "mock · 가짜 어댑터 없이, 세팅 전에는 요청만 실패" 를 사용자 결정으로 바꾼다: 내부 파일 저장소는 실제로 저장 · 제공하는 두 번째 어댑터(가짜 아님), SMS 생략은 명시적 예외. "파일 본문은 게이트웨이를 거치지 않는다" 는 S3 일 때만 — 내부 저장소면 게이트웨이가 저장소다(브로커 · 서비스는 여전히 거치지 않음). AGENTS.md · docs · 메모리(no-mock-adapters)를 같은 변경에서 고친다

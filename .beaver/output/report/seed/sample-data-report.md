# Report — 테스트 데이터 시드 + AWS 미설정 개발 모드(sample-data)

## Feature Summary
- **Feature**: ① 테스트 데이터 시드 — `SEED_SAMPLE_DATA=1` 이면 user-service 부팅 시드가 서울 업체 10곳 · 객실 그룹 25개 · 호실 96개 · 업체 총관리자 10명 · 이용자 1명을 고정 ID 로 멱등 입력, 사진은 저장소 PNG 70개를 게이트웨이 `/sample/` 로 내준다. ② AWS 미설정 개발 모드(사용자 결정 2026-11-15) — `AWS_S3_BUCKET` 이 비면 파일은 게이트웨이 내부 파일 저장소(`/files` — 서명된 업로드 · 공유 폴더 · Docker 공용 볼륨), AWS 키가 비면 SMS 를 보내지 않고 받는 번호 · 본문을 로그에 남긴다
- **Entry point**: `user-service 부팅 시드(SAMPLE_SEED_TARGETS)` · `GET /sample/<파일>.png` · `PUT /files/upload` · `GET /files/download` · `GET /files/<키>` · `STORAGE_GATEWAY(LocalStorageGateway | S3StorageGateway)` · `SMS_SENDER(SnsSmsSender)`
- **Domain**: seed — spec [sample-data-spec.md](../../spec/seed/sample-data-spec.md) · plan [sample-data-plan.md](../../plan/seed/sample-data-plan.md)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `libs/database/src/seeder/sample-seed.data.ts` | created | 샘플 업체 10곳 · 그룹 · 호실 · 요금 · 계정 값(선언), 고정 ID 종류 · 상품 기본값(입점 승인과 같음) |
| `libs/database/src/seeder/sample-seed.targets.ts` | created | 엔티티 만드는 함수 12개 + `SAMPLE_SEED_TARGETS`(플래그가 꺼지면 만드는 함수를 부르지 않음) |
| `libs/database/src/seeder/seeder.util.ts` | modified | `isSampleSeedEnabled` · `sampleId` · `sampleNo` · `sampleRooms` · `sampleHours` |
| `libs/database/src/seeder/seeder.targets.ts` | modified | `SEED_TARGETS` 끝에 `...SAMPLE_SEED_TARGETS` |
| `libs/integration/src/integration.constants.ts` | modified | `SAMPLE_FILE_KEY_PREFIX` · `PRIVATE_FILE_KEY_PREFIX` · `LOCAL_FILE_*`(경로 · 폴더 · 10MB · 메시지 3개) |
| `libs/integration/src/integration.util.ts` | modified | `isSampleFileKey` · `isS3StorageConfigured` · `isAwsKeyConfigured` · `gatewayPublicUrl` |
| `libs/integration/src/storage/local-storage.util.ts` | created | 폴더 · HMAC 서명 · 시간차 안전 확인 · 키 → 경로(폴더 밖 거부) |
| `libs/integration/src/storage/local-storage.gateway.ts` | created | 내부 파일 저장소 어댑터 — 서명 업로드 · 열람 주소, 폴더 확인 · 삭제, 공개 주소(샘플 키 `/sample/`) |
| `libs/integration/src/storage/storage.module.ts` | modified | `AWS_S3_BUCKET` 으로 S3 · 내부 저장소 어댑터를 고르는 useFactory |
| `libs/integration/src/storage/s3-storage.gateway.ts` | modified | 샘플 키 공개 주소(`GATEWAY_PUBLIC_URL`) · 삭제 건너뜀, 부팅 경고 조건(버킷 제외) |
| `libs/integration/src/sms/sns-sms.sender.ts` · `sms.module.ts` | modified | AWS 키가 비면 `SMS 생략(AWS 키 미설정) — 번호: 본문` 경고 로그 후 성공, 부팅 안내 |
| `libs/integration/src/interfaces/integration.interface.ts` | modified | SMS · 저장소 포트 주석(생략 · 내부 저장소) |
| `apps/gateway/src/modules/local-file/{local-file.server,local-file.util,local-file.module}.ts` | created | `/files` — 서명 업로드 받기(임시 파일 → 이름 바꾸기 · 10MB) · 비공개 서명 열람 · 공개 파일(private/ 제외), S3 면 경로 없음 |
| `apps/gateway/src/gateway.module.ts` | modified | `LocalFileModule` |
| `apps/gateway/src/modules/api-log/{api-log.util,api-log.middleware}.ts` | modified | 바이너리 응답 본문은 모으지 않고 null(ship 리뷰 수정) |
| `apps/gateway/src/config/sample-image.config.ts` | created | `/sample/` 정적 폴더(`import.meta.url` 기준) · 옵션 |
| `apps/gateway/src/main.ts` | modified | `useStaticAssets(/sample/)` |
| `apps/gateway/src/assets/sample/*.png` | created | 70개(업체 20 · 그룹 50, 404KB) — 생성기 결과 |
| `nest-cli.json` | modified | gateway `assets`(PNG → dist) |
| `scripts/sample-images.mjs` | created | PNG 생성기(node:zlib — 외부 패키지 없음) |
| `scripts/docker-network.mjs` | modified | 공용 볼륨 `deskless-files` 도 만든다 |
| `compose.gateway.yml` · `compose.user-service.yml` · `compose.admin-service.yml` | modified | 공용 볼륨 `/app/storage/files` · `FILE_STORAGE_DIR` 고정 |
| `Dockerfile` | modified | `/app/storage/files` 를 `node` 소유로(빈 볼륨이 물려받음) |
| `.gitignore` | modified | `/storage` |
| `package.json` | modified | `sample:images` |
| `.env.example` | modified | AWS 절(비우면 개발 모드) · `FILE_STORAGE_DIR` · `GATEWAY_PUBLIC_URL` · `SEED_SAMPLE_DATA` + **로컬 실행용 기본값**(사용자 요청 2026-11-15 — 비밀값 · 브로커 계정 · `GATEWAY_PUBLIC_URL=http://localhost:3000` · `USER_WEB_URL=http://localhost:3001` · `SEED_SAMPLE_DATA=1`, 머리 주석에 서버에서 바꿀 값) — README "1. 준비" 표도 "서버에서 바꿀 값" 으로 |
| `docs/guides/sample-data.md` | created | 켜는 법 · 넣는 것 · 계정 · 업체코드 · 사진 |
| `docs/guides/aws-setup.md` · `docs/integration.md` · `docs/architecture.md` | modified | "AWS 없이 돌리기" · 개발 모드 예외 · 내부 저장소 · 샘플 키 · 볼륨 · 게이트웨이 인프라 · 시드 |
| `README.md` · `AGENTS.md` | modified | 외부 연동(개발 모드 예외 · 파일 본문 규칙) · 환경 값 · 구조 · Docker 볼륨 · 명령 · 시드 · Checklist |
| `.beaver/output/frontend/changes/2026-11-13-sample-data.md` · `changes/README.md` | created · modified | 프론트 안내 — 테스트 로그인 · 업체코드 · 사진 · 업로드 호스트 · 인증번호는 로그 |
| 사용자 메모리 `no-mock-adapters.md` · `MEMORY.md` | modified | AWS 미설정 개발 모드 예외(기획 때 반영) |

## Tests Written
- 없음 — plan 의 `테스트 생략(위임형)` 그대로: 바뀐 것이 라이브러리(libs/database · libs/integration) · 게이트웨이 인프라 · scripts 뿐이고 AGENTS.md Testing 이 그 spec 을 두지 않는다. 새 · 바뀐 service · repository · 입력 DTO 없음. 기존 spec 중 바뀐 모듈 · 시드를 직접 쓰는 것 없음(grep — 서비스 spec 은 포트 토큰을 mock).

## Verification
- `npm run typecheck` 통과 · `oxlint apps/ libs/` 통과 · prettier(바꾼 파일) 통과 — 남은 경고 1건 `apps/scheduler/src/user/test/user.repository.spec.ts` 는 이번에 건드리지 않은 기존 파일.
- `npm run build`(네 앱) 통과 — `dist/apps/gateway/apps/gateway/src/assets/sample/` 에 PNG 70개, `config/sample-image.config.js` 옆 `../assets/sample/` 경로와 맞다.
- `docker compose -f <gateway|user-service|admin-service> config --quiet --no-interpolate` 형식 통과(값 출력 없음 — .env 를 보지 않음).
- scratchpad 점검 1(빌드 결과를 node 로 — 전부 통과): 행 수(업체 10 · 영업시간 28 · 브레이크 1 · 업체 상품 30 · 업체 사진 20 · 계정 11 · 회원 설정 11 · 그룹 25 · 그룹 사진 50 · 그룹 상품 75 · 호실 96), 플래그 꺼짐이면 0건, 엔티티 인스턴스, PK 겹침 없음 · 32자 hex, FK 가 실제 행, 업체 안 그룹명 · 호실명 유일, CHK_RoomPlan · CHK_StoreHour 조합, 그룹 상품 요금 ↔ 판매 · 업체가 안 파는 종류 판매 없음, 업체 총관리자 업체마다 1명(bcrypt), 이용자(KAKAO · sample-user-01 · 인증 완료), 사진 키 70개 = assets 파일 70개, 서명(맞음 통과 · 키 · Content-Type · 만료 · 메서드 · 비밀값 · hex 바꾸면 거부), 경로(`../` · `store/../../` · 절대 · 역슬래시 · NUL 거부), 내부 저장소 어댑터(업로드 주소 · 서명 일치 · exists · 공개 · 샘플 · 열람 주소 · 삭제 · 기준 없음 500/503), 어댑터 고르기 · AWS 키 판단, SMS 생략 로그(번호 · 본문 포함).
- scratchpad 점검 2(빌드된 LocalFileServer 를 임시 express 에 붙여 — 앱 기동 아님, 전부 통과): 업로드 200 · 내용 · 임시 파일 안 남음, Content-Type 다름 · 만료 · 폴더 밖 403(공통 실패 본문), 10MB 초과 413 · 파일 없음, 공개 파일 200(하루 캐시) · 없는 파일 다음 처리 404, 비공개 키 공개 경로 404 · 인코딩된 상위 경로 404, 서명 열람 200(`private, no-store`) · 만료 403 · 없음 404, 업로드 서명으로 열람 403, 다른 메서드 다음 처리.
- 계획과 대조: plan 의 새 파일 블록은 그대로 꺼내 썼고(추출 스크립트), 생성기는 시험본과 같다. `npm run db:check` 는 엔티티 · 마이그레이션 변경이 없어 해당 없음. 공식 실행은 ship 뒤 `/beaver:test`.

- ship 리뷰 중 API 로그 고침(Medium): `modules/api-log` 가 모든 응답 본문을 모아 `t_api_log` 에 넣는데 `/files` 사진(바이너리)까지 모았다 — 파일 크기만큼 메모리, NUL 바이트로 적재 실패. 글 응답(JSON · SSE · text/* · 형식 없음)만 모으고 바이너리는 본문 null(`isApiLogTextContentType` — api-log.util.ts · middleware). 임시 express 점검: 사진 본문 null · JSON 본문 유지. docs/architecture.md 트리 한 줄.
- ship 리뷰 중 한 곳 고침: `local-file.server.ts` 업로드 실패 catch 의 임시 파일 정리(`rm`)가 실패해도 처리 안 된 예외가 되지 않게 `.catch(() => undefined)` — plan 코드와 이 한 줄이 다르다. 고친 뒤 typecheck · lint · `build:gateway` · `/files` 점검 다시 통과.
- 포트 체계 변경(ship 커밋 확인 때 사용자 요청 2026-11-15): 게이트웨이 3000 · user-service 4001→3010 · admin-service 4002→3020 · 프론트 3001→5000 — 서비스 `main.ts` listen 기본값 · `internal-http.client.ts` 기본 주소 · `cors.config.ts` 주석 · compose 3개(`*_SERVICE_PORT` · expose · 게이트웨이의 `*-lb` 주소) · nginx `user-service.conf` · `admin-service.conf`(upstream · listen) · `.env.example` · README · docs/architecture · aws-setup(S3 CORS 예시) · 로드맵 진입점(뷰 다시 생성) · 프론트 안내. compose 형식 · typecheck · lint · 네 앱 빌드 다시 통과.

## Remaining Issues
- 실제 기동 확인은 사용자 몫 — `cp .env.example .env`(로컬 기본값 — 이미 `.env` 가 있으면 포트 · 주소(`USER_SERVICE_PORT=3010` · `ADMIN_SERVICE_PORT=3020` · `USER_SERVICE_URL` · `ADMIN_SERVICE_URL` · `CORS_ORIGINS` · `USER_WEB_URL`) · `GATEWAY_PUBLIC_URL` · `SEED_SAMPLE_DATA=1` 을 맞춘다) → `npm run docker:network`(볼륨) → `npm run docker:up`(이미지 다시 빌드 — Dockerfile 폴더 소유자 · assets · nginx 포트 포함).
- 이미 Docker 로 띄운 적 있는 환경은 `docker:network` 를 한 번 더 돌려야 볼륨이 생긴다(없으면 compose 가 external 볼륨이 없다고 띄우지 않는다).
- 나중에 S3 를 켜면 내부 저장소에 올린 파일은 S3 에 없다(옮기지 않음) · IAM 역할만으로 돌리면 SMS 는 생략된다 — 가이드에 적음.

## Modification - 261118-1

### Change summary
S3 로 바꾼 뒤에도 내부 파일 저장소에 올린 사진을 계속 연다(사용자 결정 2026-11-18 — 파일 테이블에 구분값). 파일 행(`t_store_file` · `t_room_group_image`)에 올릴 때의 저장소 `file_storage`(`S3` · `LOCAL`, 기본 `LOCAL`)를 적고, 저장소 포트 `STORAGE_GATEWAY` 를 `RoutingStorageGateway` 하나로 — 업로드 주소 · 업로드 확인은 지금 업로드 저장소, 공개 주소 · 열람 주소 · 삭제는 파일 행의 저장소로 보낸다. 샘플 키(`sample/`) 분기는 두 어댑터에서 빼 라우터 한 곳으로. 게이트웨이 `/files` 는 늘 붙이고 S3 모드에서는 읽기만(업로드 404). 공개 API 모양은 그대로(프론트 수정 요청 문서 대상 아님).

### Changed files
| File | Change Type | Description |
|------|-----------|------|
| `libs/database/src/entities/store/store-file.entity.ts` · `entities/room/room-group-image.entity.ts` | modified | `file_storage` varchar(10) NOT NULL DEFAULT `'LOCAL'` + 주석 |
| `libs/database/src/migrations/1794961426515-FileStorage.ts` · `migrations.ts` | created · modified | `npm run db:generate -- FileStorage` 결과(두 테이블 ADD COLUMN · COMMENT) — 기존 행은 기본값으로 `LOCAL`. 적용은 사용자 |
| `libs/database/src/seeder/sample-seed.targets.ts` | modified | 업체 사진 · 그룹 사진 시드 행 `file_storage = 'LOCAL'` |
| `libs/integration/src/integration.constants.ts` | modified | `FILE_STORAGE` |
| `libs/integration/src/interfaces/integration.interface.ts` | modified | `FileStorage` · `StoredFile` · 포트(`getUploadStorage` · 행을 받는 세 메서드) · 어댑터용 `StorageBackendInterface` |
| `libs/integration/src/storage/routing-storage.gateway.ts` | created | `RoutingStorageGateway` — 두 어댑터를 들고 나눠 보냄 · 샘플 키 · 업로드 저장소 어댑터만 부팅 안내 |
| `libs/integration/src/storage/s3-storage.gateway.ts` · `local-storage.gateway.ts` | modified | `StorageBackendInterface` 구현, 샘플 키 분기 삭제 · 주석 |
| `libs/integration/src/storage/storage.module.ts` | modified | `useClass: RoutingStorageGateway`(`useFactory` 삭제) |
| `apps/gateway/src/modules/local-file/local-file.server.ts` · `local-file.module.ts` · `gateway.module.ts` | modified | 경로 늘 붙임 · S3 모드 업로드는 다음 처리(404) · 시작 로그 "읽기만" · 주석 |
| `apps/admin-service/src/room/room.service.ts` · `repositories/room.repository.ts` · `interfaces/room.repository.interface.ts` | modified | 대표 사진 `{file_key, file_storage}` · 사진 행 그대로 넘김 · 등록 `getUploadStorage()` · `cover_file_storage` 하위 쿼리 · `RoomGroupRow` |
| `apps/admin-service/src/store/store.service.ts` · `repositories/store.repository.ts` · `interfaces/store.repository.interface.ts` | modified | 열람 · 공개 주소 · 삭제에 행 · 등록 `getUploadStorage()` · 파일 행 select `file_storage` · `StoreFileRow` |
| `apps/user-service/src/discovery/discovery.service.ts` · `repositories/discovery.repository.ts` · `interfaces/discovery.repository.interface.ts` | modified | 반경 업체 대표 사진 · 업체 · 그룹 사진에 행 · `cover_file_storage` 하위 쿼리 · `DiscoveryStoreRow` |
| `apps/user-service/src/store/store.service.ts` · `repositories/store.repository.ts` · `interfaces/store.repository.interface.ts` | modified | 내 신청 열람 · 공개 주소 · 파일 삭제 · 신청 취소에 행 · 등록 `getUploadStorage()` · 파일 행 select `file_storage` · `StoreFileRow` |
| `docs/guides/aws-setup.md` · `docs/integration.md` · `docs/architecture.md` · `docs/data-layer.md` · `AGENTS.md` · `README.md` | modified | S3 로 바꿔도 옛 사진은 그대로 열림 · 옮기는 법(볼륨 → 버킷 + UPDATE) · 라우터 · `/files` 읽기 · 룩업 없는 코드 값 컬럼 · 체크리스트 |

### Tests written
- 도우미 4곳(`room` · admin `store` · user `store` · `discovery` `*.test-helper.ts`): 저장소 mock 에 `getUploadStorage`(기본 `'LOCAL'`), `getPublicUrl` · `createDownloadUrl` mock 은 파일 행을 받아 `file_key` 로 주소를 만든다(응답 주소 값은 예전과 같다), 행 생성 함수에 `file_storage` · `cover_file_storage`.
- service spec: 저장소 호출 단언을 키 문자열 → 파일 행(`expect.objectContaining({file_key, file_storage: 'LOCAL'})`, 대표 사진은 `{file_key, file_storage}` 그대로) — 신청 상세 · 내 업체 · 내 신청 · 업체 사진 삭제 · 신청 파일 삭제 · 신청 취소 · 그룹 상세 · 그룹 목록 · 그룹 사진 삭제 · 그룹 삭제 · 반경 업체. 등록 3곳(그룹 사진 · 업체 사진 · 신청 파일) insert 엔티티에 `file_storage: 'LOCAL'`.
- **[SUCCESS] 업로드 저장소가 S3 면 등록 행에 S3 를 적는다** — `room-group-image.spec.ts` 1건(새 사례).
- repository spec(Data-Access Smoke): 객실 그룹 목록 · 반경 업체의 `cover_file_storage` 하위 쿼리 SQL · 행 키 목록, 그룹 사진 엔티티 select 에 `i_file_storage`, 두 store 파일 행 select 에 `file_storage` · 별칭 목록.
- 라우터 · 두 어댑터 · 게이트웨이 `/files` 는 spec 없음(revision 의 테스트 생략(위임형) — libs · 게이트웨이 인프라) → scratchpad 점검으로 확인.

### Verification
- `npm run typecheck` · `npm run lint` 통과, prettier(바꾼 파일) 통과 — 남은 경고는 이번에 건드리지 않은 기존 파일(`apps/*/tsconfig.app.json` 4개 · `apps/scheduler/src/user/test/user.repository.spec.ts`).
- `npm run db:check` — 엔티티와 마이그레이션 일치. `npm run build`(네 앱) 통과.
- `npm test` — 123 파일 · 1,355건 통과(이번 회차 실행 — AGENTS.md 가 Claude 실행을 허용).
- scratchpad `check-routing.mjs`(빌드 결과 — 앱 기동 아님, 전부 통과): 버킷 없음 → 업로드 `LOCAL` · 게이트웨이 업로드 주소 · `LOCAL` 공개 주소 · 샘플 `/sample/` · 구분 없는 행은 내부. 버킷 있음 → 업로드 `S3` · S3 presigned 업로드 주소 · `S3` 행 CDN 주소 · **`LOCAL` 행은 계속 게이트웨이 주소 · 서명 열람** · `S3` 행 S3 presigned 열람, 삭제는 `LOCAL` 행 → 폴더 파일 지움(S3 호출 없음) · `S3` 행 → `DeleteObject` · 샘플 건너뜀, 업로드 확인 → `HeadObject`. 게이트웨이 S3 모드 → 시작 로그 "읽기만" · 업로드 404 · 저장 안 함 · 옛 공개 파일 200 · 옛 비공개 서명 열람 200. 시드 업체 사진 · 그룹 사진 행 모두 `LOCAL`.
- 기존 점검 `check-local-file.mjs` 통과, `check-sample.mjs` 는 샘플 공개 주소 확인을 어댑터 → 라우터로 옮겨(어댑터는 샘플을 가르지 않음도 확인) 통과.

### Remaining issues
- 마이그레이션 적용은 사용자 몫 — `npm run docker:user-service`(migrate 컨테이너가 `FileStorage` 를 적용, 기존 행은 `LOCAL`) → 나머지 앱 이미지 다시 빌드(`npm run docker:up`). 로컬 실행이면 `npm run db:migrate`.
- 옛 사진을 S3 로 옮기는 일(볼륨 → 버킷 + `UPDATE … file_storage = 'S3'`)은 자동으로 하지 않는다 — aws-setup.md 에 방법만 적음. 옮기기 전까지 볼륨 `deskless-files` 를 지우지 않는다.

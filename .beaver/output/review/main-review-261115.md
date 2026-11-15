# Review — main(direct) — 261115

> 머지 전 코드 리뷰. 쌓인 변경을 메모리 규칙 · AGENTS.md 규약 · plan/spec 의도에 대어 본다.

## Target
- stick: `main`(direct 모드) → origin: `main`
- 포함 기능: 테스트 데이터 시드(sample-data) + AWS 미설정 개발 모드(내부 파일 저장소 · SMS 로그 — 사용자 결정 2026-11-15) + `.env.example` 로컬 실행 기본값(사용자 요청 2026-11-15) + 포트 체계 변경(사용자 요청 2026-11-15 — 게이트웨이 3000 · user-service 4001→3010 · admin-service 4002→3020, 프론트 3001→5000)
- 변경 범위: 코드(libs/database seeder 4 · libs/integration 9 · gateway modules/local-file 3 · config 1 · main · gateway.module · api-log 2), 자산(PNG 70 · scripts 2), Docker(compose 3 · Dockerfile · docker-network), 설정(.env.example · .gitignore · nest-cli · package.json), 문서(README · AGENTS.md · docs 4 · 가이드 1 새로), beaver(spec · plan · report · 프론트 수정 요청)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 인프라 `<kebab>.<role>.ts`(local-storage.gateway · local-file.server · sample-image.config), util `local-storage.util` · `local-file.util`, 시드 `sample-seed.data/targets`, 상수 `*_MESSAGE` · `LOCAL_FILE_*` |
| Structure & layering | pass | 저장소는 포트(STORAGE_GATEWAY) 뒤 두 번째 어댑터 — service 변경 없음. 게이트웨이 `/files` 는 인프라 `modules/local-file`(문 소켓과 같은 HttpAdapterHost 방식, 공개 API · Swagger 밖), 설정 함수 `config/`. 시드는 기존 SeederService · SEED_TARGETS 틀 그대로 |
| Shared logic extraction | pass | 순수 함수는 util(seeder.util · integration.util · local-storage.util · local-file.util), 파일 전용 헬퍼는 인프라 · util 파일에만(buildSignedUrl · isMissing · toUnavailable · sampleTarget). 날짜는 dayjs(`unix()` · `add`) |
| Errors & responses | pass | 어댑터 실패 계약은 S3 형제와 같다(주소 발급 · 확인 · 삭제 503 `STORAGE_UNAVAILABLE_MESSAGE`, 공개 주소 기준 없음 500 `STORAGE_PUBLIC_URL_MISSING_MESSAGE`), `/files` 실패 본문은 공통 모양 `{message, validation_errors: null}`(403 · 413 · 404 · 503 메시지 상수) |
| Entities | pass | `new XEntity()` + 할당(훅이 돈다), CHECK(`CHK_RoomPlan_*` · `CHK_StoreHour_OpenCloseTime`) 조합 · 부분 유니크(업체 안 그룹명 · 호실명 · 매니저 아이디 · 휴대폰) 지킴 — 점검 스크립트로 확인. 스키마 변경 없음 |
| Logging | pass | 로그는 인프라 클래스만(LocalStorageGateway · LocalFileServer · SnsSmsSender · S3StorageGateway), 도메인 계층 로그 없음 |
| Docker · .env | pass | compose 는 서버 구성(`FILE_STORAGE_DIR` 컨테이너 경로 · 볼륨)만 고정, 환경 값은 .env 그대로. 공용 볼륨은 네트워크와 같은 external 방식. `.env.example` 로컬 기본값은 머리 주석 · README 에 서버에서 바꿀 값 명시 |
| Test strength | pass(대상 없음) | 바뀐 곳이 라이브러리 · 게이트웨이 인프라 · scripts 뿐 — AGENTS.md Testing 이 spec 을 두지 않는다. service · repository · 입력 DTO 변경 없음, 매핑 민감 쿼리 없음(Smoke 대상 없음). 대신 빌드 결과 점검 스크립트 3개(scratchpad — 시드 제약 · 서명 · 경로 · 어댑터 · SMS · `/files` 동작 · API 로그) |
| README · docs | pass | README(외부 연동 · 준비 표 · Docker 볼륨 · 명령 · 구조), AGENTS.md(구조 · 개발 모드 예외 · 파일 본문 규칙 · 시드 · Docker · Checklist), docs(aws-setup "AWS 없이 돌리기" · integration · architecture · 가이드 sample-data) |
| 프론트 연계 | pass | 공개 API 변경 없음 — 개발 환경 안내로 `changes/2026-11-13-sample-data.md` + 목록 한 줄(테스트 로그인 · 업체코드 · 사진 · 업로드 호스트 · 인증번호는 로그) |

## Intended Behavior Check (against plan/spec)
- 시드: plan 대로 업체 10 · 영업시간 28 · 브레이크 1 · 업체 상품 30 · 업체 사진 20 · 계정 11 · 회원 설정 11 · 그룹 25 · 그룹 사진 50 · 그룹 상품 75 · 호실 96, 플래그가 꺼지면 0건(만드는 함수를 부르지 않음), 사진 키 70개 = assets 파일 70개.
- 내부 파일 저장소: `AWS_S3_BUCKET` 으로 어댑터 고르기, 서명(Content-Type 포함 · 10분) · 10MB · 임시 파일 → 이름 바꾸기 · private/ 공개 차단 · 서명 열람 — 임시 express 점검 통과. S3 모드면 `/files` 경로 없음.
- SMS: 키가 비면 `SMS 생략(AWS 키 미설정) — 번호: 본문` 경고 후 성공(사용자 결정 "로그에 남기고 넘어감").
- plan 과 다른 점(리뷰 수정 2건 — 아래 Findings 1 · 2, report 에 기록).
- 포트 변경(커밋 확인 때 사용자 요청): 서비스 `main.ts` listen 기본값 · 게이트웨이 내부 HTTP 기본 주소 · compose(`*_SERVICE_PORT` · expose · 게이트웨이의 `*-lb` 주소) · nginx(`user-service.conf` · `admin-service.conf` upstream · listen) · `.env.example` · README · docs/architecture · aws-setup(S3 CORS 예시) · 로드맵 진입점 · 프론트 안내 — 남은 4001 · 4002 · 3001 은 지난 기획 · 리포트 기록뿐(고치지 않음). compose 형식 · typecheck · lint · 네 앱 빌드 다시 통과.

## Memory reconcile
- beaver 메모리(git · api-log · cache · frontend) — 미반영 항목 없음. api-log("평문 적재 의도")에 따라 `/files` 서명 주소가 API 로그 query 에 남는 것은 finding 으로 올리지 않는다(10분 만료). frontend 규칙 — 수정 요청 문서 작성됨.
- 사용자 메모리 `no-mock-adapters` — 기획 때 사용자 결정 2026-11-15 예외로 갱신, AGENTS.md · docs/integration.md 원칙에 같은 예외를 적었다.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Medium(고침) | apps/gateway/src/modules/api-log/api-log.middleware.ts · api-log.util.ts | API 로그 미들웨어가 모든 응답 본문을 모아 `t_api_log` 에 넣는데, 새 `/files` 사진(바이너리)까지 모았다 — 파일 크기(최대 10MB)만큼 메모리, NUL 바이트로 적재 실패 | 글 응답(JSON · SSE · text/* · 형식 없음)만 모으고 바이너리는 본문 null — `isApiLogTextContentType` 로 고침, 임시 express 로 확인(사진 null · JSON 유지). `/sample/` 은 미들웨어 앞이라 해당 없음 |
| 2 | Low(고침) | apps/gateway/src/modules/local-file/local-file.server.ts upload catch | 업로드 실패 처리 중 임시 파일 정리(`rm`)가 실패하면 처리 안 된 예외가 될 수 있었다 | `.catch(() => undefined)` — 남는 `.uploading` 파일은 공개 키와 겹치지 않는다 |
| 3 | Low | .env.example | 로컬 실행용 비밀값 기본값이 들어가 서버에 그대로 복사하면 약한 비밀값으로 뜬다(사용자 요청) | 머리 주석 · README 준비 표에 서버에서 바꿀 값(비밀값 · `SEED_SAMPLE_DATA=0` · 주소) 명시 — 그대로 둔다 |
| 4 | Low | libs/integration/src/sms/sns-sms.sender.ts | IAM 역할만으로 돌리는 배포는 키가 비어 SMS 가 생략된다(사용자 결정의 결과) | 가이드 · .env.example 에 적음 — 그대로 둔다 |

## Verdict
Pass — 막는 문제 없음(Finding 1 · 2 는 이 리뷰에서 고치고 typecheck · lint · build:gateway · 점검 스크립트를 다시 통과). 테스트 실행은 ship 뒤 `/beaver:test`.

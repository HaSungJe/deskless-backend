# backend 요청 — `.env.example` 을 앱 · 기능 단위로 묶고 주석 줄이기

- 보낸 곳: deskless (2026-11-24)
- 받는 곳: [deskless-backend](https://github.com/HaSungJe/deskless-backend)
- 기준 커밋: `43abf2d`
- 공개 API · 사용자 동작 · 코드 변화: 없음 — `.env.example` 의 줄 순서 · 절 · 주석만. **키 이름 · 기본값은 그대로**(deskless 는 키 이름으로 읽는다 — 순서와 무관)

## 왜

deskless 의 `.env.example` 을 앱 · 기능 단위로 다시 묶었다(사용자 결정 2026-11-24 — 커밋 `6eccfc8` 다음). 지금 백엔드 `.env.example` 은 대체로 앱별이지만 한 앱의 값이 흩어져 있다.

- gateway 의 공개 주소(`GATEWAY_PUBLIC_URL` — `.env.example:106`)가 따로 떨어진 절에, 지표 포트 4개(`:126-129`)가 앱 절이 아닌 "지표 · 헬스 체크 포트" 절에 모여 있다.
- `SMS_VERIFICATION_DAILY_LIMIT`(`:43` — SMS 기능)이 user-service 절에, SMS 링크 주소 `USER_WEB_URL`(`:116`)이 따로 있다.
- 주석이 길다(여러 줄 설명) — 자세한 뜻은 `docs/architecture.md` "설정" 이 맡고, 예시 파일은 키 묶음당 한 줄로.

### 정해진 것 (사용자 결정 2026-11-24)
- **절은 앱 · 기능 단위** — 그 앱 · 기능의 포트 · 바인딩 · 지표 포트 · 주소 · 계정 · 한도를 한 절에. 어느 앱에도 묶이지 않는 값만 "공통" 절.
- **주석은 키 묶음당 한 줄**(필요하면 두 줄) — `(필수)` 표시 · 비우면 어떻게 되는지 · 세팅 가이드 경로 정도만. 긴 설명은 `docs/architecture.md` "설정" 으로 옮긴다(이미 있으면 지운다).
- 키 이름 · 기본값 · `(필수)` 여부는 바꾸지 않는다.

## 1. 지우는 것

없음(키는 그대로 — 긴 주석 줄만 줄인다).

## 2. 더하는 것

없음.

## 3. 고치는 것 — `.env.example` 절 구성(제안)

| 절 | 키(이 순서) | 한 줄 주석 방향 |
|---|---|---|
| 머리 | — | 3줄 이내: 로컬 실행이 그대로 쓴다 · 쿠버네티스는 deskless 가 같은 키로 · 운영은 비밀값 새로 · `SEED_SAMPLE_DATA=0` · 주소 실제 값 |
| 공통 | `NODE_ENV` · `INTERNAL_API_TOKEN` · `INTERNAL_HTTP_TIMEOUT_MS` · `METRICS_HOST` | 실행 환경 / (필수) 게이트웨이 ↔ 서비스 내부 비밀값 · 대기 / 지표 · 헬스 체크 바인딩(앱별 포트는 각 앱 절) |
| gateway | `GATEWAY_PORT` · `GATEWAY_METRICS_PORT` · `GATEWAY_PUBLIC_URL` · `CORS_ORIGINS` · `TRUST_PROXY` · `COMMAND_STREAM_TIMEOUT_MS` · `GATEWAY_INSTANCE_ID` · `SWAGGER_TITLE` · `SWAGGER_PATH` · `USER_SERVICE_URL` · `ADMIN_SERVICE_URL` | 포트 · 지표 포트 / 공개 주소(파일 · 사진 주소의 기준) / 허용 프론트 주소 / 앞단 프록시 수 / SSE 대기 / 인스턴스 ID / Swagger / 서비스 주소(로컬용) |
| user-service | `USER_SERVICE_PORT` · `USER_SERVICE_HOST` · `USER_SERVICE_METRICS_PORT` · `SEED_SAMPLE_DATA` | 포트 · 바인딩 · 지표 포트 / 테스트 데이터(user-service 가 부팅 때 넣는다 — 운영 0) |
| admin-service | `ADMIN_SERVICE_PORT` · `ADMIN_SERVICE_HOST` · `ADMIN_SERVICE_METRICS_PORT` | 포트 · 바인딩 · 지표 포트 |
| scheduler | `SCHEDULER_METRICS_PORT` | 지표 포트(들어오는 연결은 이것뿐) |
| PostgreSQL | `DATABASE_URL` · `DATABASE_POOL_SIZE` · `DATABASE_CONNECTION_TIMEOUT_MS` | (필수) 주소 / 풀 크기 · 연결 대기 |
| RabbitMQ | `RABBITMQ_HOST` · `RABBITMQ_PORT` · `RABBITMQ_USER` · `RABBITMQ_PASSWORD` · `RABBITMQ_GATEWAY_PASSWORD` · `RABBITMQ_USER_SERVICE_PASSWORD` · `RABBITMQ_ADMIN_SERVICE_PASSWORD` | (필수) 주소 / 관리자(`broker:check` 전용) / (필수) 앱 계정 비밀번호(deskless 와 같은 값 · 큰따옴표 · 역슬래시 금지) |
| Redis(문 정보) | `REDIS_URL` | (필수) 주소(비밀번호의 `@ : /` 는 인코딩) — `docs/guides/redis-setup.md` |
| 로그인 · 암호화 | `JWT_SECRET` · `BCRYPT_CODE` · `BCRYPT_ROUNDS` · `TOKEN_CIPHER_KEY` | (필수) 토큰 서명 / 비밀번호 pepper(가입 시작 뒤 바꾸지 않는다) · 라운드 4 ~ 31 / (필수) refresh 암호화 hex 64자(만드는 명령 한 줄) |
| AWS 공통 | `AWS_REGION` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` | 비우면 AWS 없이(SMS 는 로그 · 파일은 내부 저장소) — `docs/guides/aws-setup.md` |
| SMS | `SMS_VERIFICATION_DAILY_LIMIT` · `USER_WEB_URL` | 같은 번호 하루 인증 SMS 수 / SMS 링크의 이용자 웹 주소(비면 QR 링크 안 보냄 · 이용 중 취소 요청 503) |
| 파일 저장 | `AWS_S3_BUCKET` · `AWS_S3_PUBLIC_URL` · `FILE_STORAGE_DIR` | 버킷(비우면 내부 파일 저장소) / CDN 주소 / 내부 저장소 폴더(쿠버네티스는 deskless 차트) |
| 결제(토스) | `TOSS_SECRET_KEY` | 시크릿 키(비면 예약 · 결제 확인 · 환불만 503) — `docs/guides/toss-setup.md` |

- 위 배치는 제안이다 — 백엔드 규약(앱 · 도메인 이름 · 가이드 경로)에 더 맞는 묶음이 있으면 그쪽으로. 원칙(앱 · 기능 단위 · 한 줄 주석 · 키 그대로)만 지킨다.

## 4. 그대로 두는 것

- 키 이름 · 기본값 · `(필수)` 표시 · 코드(`process.env` 읽는 곳) · deskless 차트.

## 5. 영향 전수 확인 · 정리 (이 요청에 포함)

- 찾는 법: `git grep -n -I -E '\.env\.example|"설정"|설정 —|절\)' -- . ':!.beaver/output' ':!package-lock.json'` — `.env.example` 의 절 이름 · 줄 번호를 가리키는 곳(예: `docs/architecture.md:204-206` "설정 — `.env`", 가이드의 "`.env.example` 의 … 절")을 새 절 이름으로.
- 긴 주석에서 줄인 설명이 `docs/architecture.md` "설정" · `docs/guides/*` 에 없으면 그쪽에 옮긴다(정보를 잃지 않게).
- 범위: `.env.example` · `AGENTS.md` · `README.md` · `docs/**` · `.beaver/memory/` · 작업 세션의 Claude 프로젝트 메모리.
- 확인: 키 · 값 목록이 전과 같다 — `diff <(git show HEAD:.env.example | grep -E '^[A-Z_]+=' | sort) <(grep -E '^[A-Z_]+=' .env.example | sort)` 가 비어 있어야 한다.

## 6. 끝난 상태

- [ ] `.env.example` 이 앱 · 기능 단위 절로 묶였고, 주석은 키 묶음당 한 줄(길어도 두 줄)
- [ ] 키 · 기본값 목록이 전과 같다(5절 확인 명령)
- [ ] 줄인 설명이 `docs/architecture.md` "설정" · 가이드에 남아 있다
- [ ] 5절 검색 결과가 모두 고쳐졌거나 그대로 둔 이유가 있다 — 결과 요약을 deskless 에 전달

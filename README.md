# deskless-backend

무인 객실 대여 서비스의 백엔드. 이용자는 지도에서 업체를 찾아 객실을 예약 · 결제하고 QR 로 문을 연다. 업체 관리자는 객실 · 예약을 운영하고, 총관리자는 입점 · 업체 · 이용자를 관리한다.

NestJS 12 모노레포(MSA) — 앱 4개를 따로 빌드 · 배포한다.

## 소개

| 앱 | 포트 | 하는 일 |
|---|---|---|
| **gateway** | 3000 | 유일한 외부 진입점 — 로그인 그룹별 JWT 인증 · 입력 검증 후 서비스로 전달, Swagger(`/swagger`), 문 소켓(`/ws/v1/door`), 내부 파일 저장소(`/files`), API 로그 적재 |
| **user-service** | 3010 (내부) | 이용자 기능 — SNS 가입 · 로그인, 업체 둘러보기, 예약 · 결제 · 취소 · 연장 · QR, 입점 신청, 문 소켓 QR 확인. DB 를 소유한다(마이그레이션 · 시드) |
| **admin-service** | 3020 (내부) | 업체 관리자 · 관리자 기능 — 로그인 · 계정 관리, 입점 승인 · 업체 관리, 내 업체 설정, 객실 · 상품 · 호실 · 바로 열기, 업체 예약, 이용자 관리, 통계 |
| **scheduler** | — | crontab 전용 — 결제 대기 만료 · 환불 · 이용 시작 · 종료 전환 · QR 동기화 · QR 링크 SMS · 탈퇴 처리 · API 로그 파티션 |

- **요청 흐름** — 공개 경로는 `/api/v1/<서비스>/<도메인>/…`. 조회 · 로그인은 게이트웨이 → 서비스 내부 HTTP(동기), 상태를 바꾸는 요청은 RabbitMQ 명령으로 처리하고 결과를 요청 단위 SSE(`accepted` → `done` · `failed` · `pending`)로 돌려준다.
- **로그인 그룹 3개** — 이용자(SNS) · 매니저(업체코드 + 아이디) · 관리자(아이디). 그룹마다 경로 · 토큰 · 가드가 따로다.
- **외부 연동** — SMS(Amazon SNS) · 파일(S3 + CloudFront) · 결제(토스페이먼츠) · 문 정보(Redis). AWS 값을 비우면 AWS 없이 돈다 — SMS 는 로그로, 파일은 게이트웨이 내부 저장소로.
- **문 소켓** — 문 쪽 타 업체 프로그램이 업체 단위로 붙는 표준 WebSocket. 문이 읽은 QR 을 서버가 확인하고, 업체 관리자의 바로 열기 명령을 내려 보낸다 — 규격 [docs/realtime.md](docs/realtime.md).
- **지표 · 헬스 체크** — 앱마다 전용 포트에 `/metrics` · `/health/live` · `/health/ready` — [docs/monitoring.md](docs/monitoring.md).
- **API 목록** — 실행 중 Swagger `http://localhost:3000/swagger`, 화면별 정리는 [.beaver/output/frontend/api.md](.beaver/output/frontend/api.md).

**관련 저장소**
- [deskless](https://github.com/HaSungJe/deskless) — 백엔드 · 프론트를 쿠버네티스(k3s · Helm)로 엮어 띄운다. 배포 · 인프라 · 지표 수집이 모두 거기 있다. 그쪽이 보내는 수정 요청은 [changes/](changes/README.md) 에 받는다.
- [deskless-frontend](https://github.com/HaSungJe/deskless-frontend) — Next.js(이용자 `/` · 업체 관리자 `/manager` · 관리자 `/admin`). 인계 자료와 수정 요청은 [.beaver/output/frontend/](.beaver/output/frontend/README.md).

스택: Node.js 24 LTS · NestJS 12 (ESM) · TypeORM 1.x + PostgreSQL 17 · RabbitMQ 4 · Redis 8 · AWS SDK v3 · 토스페이먼츠 · Vitest 5 · oxlint

## 구조

```
apps/
  gateway/         # 진입점 — api/v1/<서비스>/<도메인>(공개 라우트) · guards · modules(전송 · 문 소켓 · 파일 · API 로그)
  user-service/    # 도메인 user · reservation · discovery · store · door · inquiry + migrate.ts
  admin-service/   # 도메인 manager · admin · user · store · room · reservation · stats · inquiry
  scheduler/       # 도메인별 crontab — user · reservation · api-log
libs/
  contracts/       # 게이트웨이 ↔ 서비스 규격(DTO · 명령 · 내부 경로)
  database/        # 엔티티 · 마이그레이션 · 시드
  integration/     # 외부 연동(SMS · 파일 · Redis · 문 정보 · 결제)
  messaging/       # RabbitMQ
  monitoring/      # 지표 · 헬스 체크
  account/ common/ # 계정 · 공통 util
scripts/           # 마이그레이션 생성 · 검사, 브로커 권한 점검, 테스트 데이터 사진
docs/              # 규약 · 세팅 가이드(docs/guides)
changes/           # deskless 가 보낸 수정 요청
Dockerfile         # 앱 이미지 — APP 빌드 인자로 네 앱
```

- 도메인 안은 `controllers/`(내부 HTTP · 큐) → `service` → `repositories/`.
- 규약 전체는 [AGENTS.md](AGENTS.md), 주제별 상세는 [docs/](docs/) — 구성 · 설정 [architecture](docs/architecture.md) · 코딩 [conventions](docs/conventions.md) · 데이터 [data-layer](docs/data-layer.md) · 메시징 [messaging](docs/messaging.md) · 오류 [error-handling](docs/error-handling.md) · 외부 연동 [integration](docs/integration.md) · 테스트 [testing](docs/testing.md).

## 설치 · 실행

### 1. 준비

```bash
node -v                 # v24.22.1 이상
npm install
cp .env.example .env    # 로컬 기본값 — 그대로 뜬다(AWS 없이 · 테스트 데이터 포함)
```

- PostgreSQL · RabbitMQ(앱별 계정 포함) · Redis 는 deskless 로컬 클러스터가 `localhost` 5432 · 5672 · 6379 에 열어 준다 — 띄우는 법은 deskless README.
- 키마다의 뜻은 [docs/architecture.md](docs/architecture.md) "설정" 표.

### 2. 로컬 실행

```bash
npm run db:migrate
npm run start:user-service    # :3010
npm run start:admin-service   # :3020
npm run start:gateway         # :3000 — Swagger http://localhost:3000/swagger
npm run start:scheduler
```

- 첫 총관리자는 `admin` / `1234`(user-service 가 부팅 때 넣는다 — 로그인 후 바로 바꾼다). 테스트 데이터 계정 · 업체코드는 [docs/guides/sample-data.md](docs/guides/sample-data.md).
- AWS · 토스 키가 비어도 뜬다 — AWS 가 비면 인증번호는 DB `t_sms_verification.code`(또는 서버 로그), 임시 비밀번호는 서버 로그에서 보고 파일은 게이트웨이 내부 저장소에 올라가며, 토스 키가 비면 예약 생성 · 결제 확인 · 환불만 503 이다. 실제로 붙이려면 [aws-setup](docs/guides/aws-setup.md) · [toss-setup](docs/guides/toss-setup.md) · [redis-setup](docs/guides/redis-setup.md).

### 3. 배포 · 운영

- 배포는 deskless(쿠버네티스)가 한다. 이미지는 [Dockerfile](Dockerfile) 하나를 `APP` 빌드 인자로 만들고, 앱이 배포에 기대하는 값(포트 · 바인딩 · 파일 볼륨 · 프로브 · 마이그레이션 · 브로커 권한 등)은 [docs/architecture.md](docs/architecture.md) "실행 · 배포" 표에 있다.
- 운영 `.env` 는 `NODE_ENV=production` · `SEED_SAMPLE_DATA=0`, 비밀값(`INTERNAL_API_TOKEN` · `JWT_SECRET` · `BCRYPT_CODE` · `TOKEN_CIPHER_KEY` · 브로커 · DB · Redis 비밀번호)은 모두 새로, 주소(`CORS_ORIGINS` · `GATEWAY_PUBLIC_URL` · `USER_WEB_URL`)와 `TRUST_PROXY` 는 실제 값으로.
- 마이그레이션 적용 · 배포는 사용자가 직접 실행한다.

## 명령

| 명령 | 내용 |
|---|---|
| `npm run start:<app>` · `start:prod:<app>` | 앱 하나 실행(watch) · 빌드 산출물 실행 — gateway · user-service · admin-service · scheduler |
| `npm run build` | 네 앱 빌드 → `dist/apps/<app>/apps/<app>/src/main.js` |
| `npm test` · `npm run typecheck` | 전체 테스트(Vitest) · 타입 검사 |
| `npm run lint` · `npm run format` | oxlint · Prettier |
| `npm run db:migrate` · `db:revert` | 마이그레이션 적용 · 마지막 1건 되돌리기(실제 DB) |
| `npm run db:generate -- <Name>` · `db:check` | 엔티티 변경분 마이그레이션 생성 · 일치 검사(DB 없이 PGlite) |
| `npm run broker:check` | 브로커 계정 권한 점검(gateway 만 명령 발행 · user_id 위조 거부) |
| `npm run sample:images` | 테스트 데이터 사진 다시 그리기 |

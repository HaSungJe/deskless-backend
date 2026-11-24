# Architecture

NestJS 12 모노레포(ESM) · TypeORM 1.x(PostgreSQL) · RabbitMQ · nestjs-cls 트랜잭션 · passport-jwt · Swagger · `@nestjs/schedule` · Vitest.
설계 배경(왜 게이트웨이 + RabbitMQ + 요청 단위 SSE 인가)은 구상 문서 [Deskless MSA 구상](https://claude.ai/artifact/JzyUD3QVHa4wb2rUBcDaDX) 에 있고, 이 문서는 **지금 코드가 따르는 규칙**을 적는다. 둘이 다르면 이 문서가 맞다.

## 앱 구성

```
클라이언트(Next.js)
      │  HTTPS
      ▼
┌──────────────┐  내부 HTTP (동기)      ┌────────────────┐
│   gateway    │ ─────────────────────▶ │  user-service  │ ──▶ PostgreSQL
│  :3000       │                        │  :3010 (내부)  │
│              │  deskless.cmd (명령)   │                │
│              │ ──▶ RabbitMQ ────────▶ │ q.user.cmd     │
│              │ ◀── q.gw.result.<id> ◀ │ deskless.event │
└──────────────┘  결과 → 요청 단위 SSE   └────────────────┘
```

| 앱 | 역할 | 외부 노출 |
|---|---|---|
| `apps/gateway` | 유일한 진입점. JWT · DTO 검증, 경로 선택(동기 / 큐 / 스트림), 요청 단위 SSE, 내부 HTTP 스트리밍(AI 대화 — [streaming.md](streaming.md)), Swagger, 문 소켓(`/ws/v1/door` — 문 쪽 타 업체 프로그램, [realtime.md](realtime.md)), API 로그(모든 HTTP 요청 → 로그 전용 연결로 `t_api_log`) | O (GATEWAY_PORT) |
| `apps/user-service` | 이용자 서버(이용자가 쓰는 기능) — `user`(회원) · `store`(입점 신청 · 취소 · 업체 정보 파일 · 내 신청) · `chat`(AI 대화형 업체 검색 — 대화 보기 · 남은 질문 수 · 메시지 스트림 · 대화 초기화, Gemini · 업체 검색 벡터 · Redis 대화) · `door`(문 소켓 접속 확인 · QR 확인 · 잠금 — 게이트웨이 문 소켓의 내부 HTTP) · `discovery`(업체 둘러보기 — 반경 업체 · 업체 이름 검색(문의할 업체 고르기) · 업체 상세 · 객실 그룹 목록, 로그인 없음 · 공유 DB 읽기만) · `inquiry`(문의 — 카테고리 목록(로그인 없음) · 등록 · 내 문의 목록 · 상세) · `reservation`(예약 — 공유 DB 의 업체 · 객실 · 상품 · 영업시간을 읽는다, 그룹 → 시간대 → 호수 예약 가능 시간 · 지금 바로, 내 예약 QR — 이력은 `t_room_qr` · 현재 QR 은 Redis). DB(PostgreSQL) 소유, 룩업 시드 · 마이그레이션 | X (내부망, INTERNAL_API_TOKEN) |
| `apps/admin-service` | 업체 관리자 · 업체 총관리자 · 관리자 · 총관리자 전용 기능 — 매니저(`manager`) · 관리자(`admin`) · 업체(`store` — 입점 신청 관리 · 승인 · 업체 관리 · 내 업체 설정 · 문 소켓 시크릿) · 객실(`room` — 상품 · 그룹 · 호실 · 문을 마지막으로 연 시각 · 바로 열기) · 업체 예약(`reservation` — 예약 현황 · 업체 취소 · 호실 이동) · 이용자 관리(`user` — 총관리자 · 관리자의 이용자 목록 · 상세 · 예약 이력 · 이용 제한) · 통계(`stats` — 총관리자 · 관리자 전체 · 업체별, 업체 관리자 내 업체, 조회만) · 문의 관리(`inquiry` — 업체 관리자는 소속 업체 문의, 관리자는 바로방 문의 — 목록 · 상세 · 답변 · 블라인드 · 해제) 도메인. 공유 DB 를 직접 쓴다(마이그레이션 · 시드는 user-service 묶음) | X (내부망, INTERNAL_API_TOKEN) |
| `apps/scheduler` | crontab 전용(`store` 업체 검색 벡터 갱신 — Gemini 임베딩 · 1시간마다, `chat` 지난 AI 대화 지우기 — Redis · 7일, `user` 탈퇴 자동처리 · `reservation` 결제 대기 만료 · 늦은 승인 재확인 · 환불 — 토스, 이용 시작 · 종료 전환 · QR 동기화 — Redis, QR 확인 링크 — SNS). 들어오는 연결 없음 — listen · 큐 소비 · 컨트롤러가 없고 DB · Redis · 토스 · SNS 에만 붙는다(지표 · 헬스 체크 전용 포트만 예외 — [monitoring.md](monitoring.md)) | X (연결을 받지 않음) |

- **기능은 쓰는 사람(행위자)으로 서버를 고른다** — 이용자 기능은 user-service, 관리자 쪽 기능은 admin-service. 같은 데이터라도 행위자가 다르면 그 서버에 같은 이름 도메인을 따로 둔다(`store` · `reservation` · `user` 가 두 서비스에 있다 — 사용자 결정 2026-11-07).
- **서버 안 도메인은 권한이 아니라 기능 대상으로 나눈다** — 같은 대상을 다루는 기능은 권한이 달라도 한 도메인에 두고 라우트마다 그 그룹의 가드로 가른다(admin-service: 관리자 계정 `admin` · 매니저 계정 `manager`(업체 총관리자의 업체 관리자 관리 + 총관리자의 업체 관리자 관리) · 이용자 `user` · 업체 `store` · 객실 `room` · 예약 `reservation` — 사용자 결정 2026-11-09).
- **모노레포 ≠ 모놀리스** — `nest build gateway` · `nest build user-service` · `nest build admin-service` · `nest build scheduler` 로 따로 빌드되고 독립 프로세스로 뜬다. 트래픽이 몰리는 앱만 인스턴스를 늘린다. 산출물: `dist/apps/<app>/apps/<app>/src/main.js`.
- 게이트웨이는 DB 를 쓰지 않는다 — 예외는 API 로그 적재 하나(`modules/api-log` 의 `ApiLogWriter` — 로그 전용 DataSource, `t_api_log` 만 · 풀 5 · 처음 쓸 때 연결, 사용자 결정 2026-11-10). 로그인 회원의 상태도 그 그룹의 서비스(이용자 → user-service, 매니저 · 관리자 → admin-service)에 내부 HTTP 로 묻는다.
- 공유 DB 단계다. 엔티티는 [libs/database/src/entities/](../libs/database/src/entities/) 에서 소유 도메인 폴더별로 관리하고, 서비스별 DB 분리는 서비스 경계가 안정된 뒤 검토한다(그때 도메인 폴더째 담당 앱으로 옮긴다 — [data-layer.md](data-layer.md)).

## 라이브러리

| lib | 내용 | 쓰는 곳 |
|---|---|---|
| `libs/account` | 계정 공통 — `issueAccessAndRefresh`(utils/token) · SMS 인증번호 생성 · 상태 검사 · 기록 엔티티 · 본문 · 하루 한도(utils/sms-verification) · 임시 비밀번호(utils/password) · `account.constants.ts`(SMS 용도 · 한도 · 공통 메시지) | user-service · admin-service |
| `libs/common` | `ApiFailResultDto` · `toFailResult` · `CustomErrorFilter` · `validationExceptionFactory` · `PaginationDto`/`PaginationResultDto` · 순수 util(bcrypt/hash/cipher/jwt/validation/fail-result/retry/pagination/env/id/dayjs/search/sse — SSE 직렬화 · 스트림 이어 쓰기) · `InternalAuthGuard` · `@ClientIp` · `@InternalActor`(서비스 내부 HTTP 의 로그인 회원 — `@InternalActor('user_id')`) | 모든 앱 |
| `libs/contracts` | 게이트웨이↔서비스 공유 규격: 요청/응답 DTO, 명령 type · 큐 이름 · 내부 경로 상수, 메시지 봉투, `Actor`, 내부 헤더, SSE 이벤트 이름 | 모든 앱 |
| `libs/database` | `entities/<domain>/` · `entities.ts`(ENTITIES) · `migrations/` · `migrations.ts`(MIGRATIONS) · `typeorm.config.ts` · `DatabaseModule`(TypeORM + 트랜잭션, 전역) · `JobLockService`(`job-lock/`) · `isUniqueViolation`/`isForeignKeyViolation` · `notDeleted`(소프트 삭제 조건) · seeder · `data-source`(마이그레이션 실행용) | DB 소유 서비스 |
| `libs/integration` | 외부 연동 포트 `AI_GATEWAY`(Google Gemini — 정해진 JSON 응답 · 글 스트리밍 · 임베딩) · `CONVERSATION_STORE`(Redis — AI 대화 이력 · 하루 질문 수 한 줄 · 답하는 중 잠금) · `SMS_SENDER`(Amazon SNS) · `STORAGE_GATEWAY`(Amazon S3, presigned URL) · `DOOR_STORE`(Redis — 현재 QR · 문을 마지막으로 연 시각 · 바로 열기 · 연결 끊기 명령 채널, 열림 · 닫힘 상태는 두지 않는다) · `PAYMENT_GATEWAY`(토스페이먼츠 — 조회 검증 · 환불) · `SmsModule` · `StorageModule` · `RedisModule` · `DoorStoreModule` · `PaymentModule`(전역) — [integration.md](integration.md) · [guides/aws-setup.md](guides/aws-setup.md) · [guides/redis-setup.md](guides/redis-setup.md) · [guides/toss-setup.md](guides/toss-setup.md) | 포트를 쓰는 서비스(SMS: user-service 휴대폰 인증 · 아이디 찾기, admin-service 매니저 아이디 찾기 · 비밀번호 초기화 · 입점 승인 · 업체 취소 · 호실 이동 · 이용 중 취소 요청 안내, scheduler QR 확인 링크 / 파일: user-service 입점 신청 업체 정보 파일 · 업체 둘러보기 공개 주소, admin-service 업체 정보 파일 · 객실 그룹 사진 / 문 정보: gateway 명령 구독 · user-service 문 소켓 QR 확인 · 잠금 · 내 예약 QR · 취소 때 QR 지우기 · admin-service 문 상태 · 바로 열기 · scheduler 이용 시작 · QR 동기화 / 결제: user-service 예약 · scheduler 결제 대기 만료 · 환불) |
| `libs/messaging` | `RabbitMqConnection` · 명령 발행 · 결과 구독 · 명령 소비 · `@OnCommand` · `CommandDispatcher` · `MessagingModule.forGateway()/forService()`(둘 다 전역) | 게이트웨이 · 서비스 |
| `libs/monitoring` | `MonitoringModule.forRoot`(전역 — 앱마다 지표 · 헬스 체크 전용 포트 `/metrics` · `/health/live` · `/health/ready`) · `MetricsService`(레지스트리 · gauge · histogram — 부품이 `@Optional` 로) · `HttpMetricsMiddleware` · `MetricsServer` · `toRouteLabel` · `toMonitoringOptions` — [monitoring.md](monitoring.md) | 모든 앱 |

- import 는 `@app/<lib>/<경로>.js` (barrel 없음). 앱 · 도메인 내부는 상대경로. 라이브러리 안의 import 방식은 [conventions.md](conventions.md).
- 라이브러리 의존 방향: `messaging` → `contracts` · `common`, `common` → `contracts`, `contracts` 는 외부 패키지만, `database` → `common`(시더의 bcrypt — 첫 총관리자 비밀번호 해시 · typeorm.config 의 env 파서 `readPositiveInt`), `integration` 은 다른 lib 를 쓰지 않는다, `account` → `common` · `database`(SMS 인증 기록 엔티티). 앱끼리는 서로 import 하지 않고(0건), 게이트웨이는 `@app/database` · `@app/account` 를 쓰지 않는다.

## 전달 경로 — 동기 · 큐 · 스트림

모든 외부 요청은 예외 없이 게이트웨이를 거친다. 게이트웨이가 라우트마다 경로를 고르고, 경로별로 controller 파일을 나눈다 — 동기 `controllers/<domain>.controller.ts`, 큐 `controllers/<domain>.controller.queue.ts`, 스트림 `controllers/<domain>.controller.stream.ts`(서비스도 같은 이름으로 나눈다).

| 경로 | 언제 | 게이트웨이 | 서비스 | 클라이언트가 받는 것 |
|---|---|---|---|---|
| **동기** | 즉시 결과가 필요하고 몰리지 않는 요청(조회 · 로그인 · 토큰 재발급) | `InternalHttpClient.request()` | 내부 controller (`/internal/v1/...`) | 일반 JSON 응답 |
| **큐** | 상태를 바꾸는 쓰기, 버스트 · 경합 · 후속 알림이 있는 작업(가입 · 탈퇴 · 비밀번호 변경 · 이후 예약 · 사물 제어) | `CommandStreamService.dispatch()` | 큐 컨트롤러 `@OnCommand` | `text/event-stream`: accepted → done \| failed \| pending |
| **스트림** | 답을 조각으로 흘려야 하는 긴 요청(AI 대화 — 사용자 결정 2026-11-24) — "쓰기는 큐" 의 예외 | `InternalHttpClient.stream()` | 스트림 컨트롤러 + `writeSseStream`(service 는 이벤트 async generator) | `text/event-stream`: 도메인 이벤트(예: progress → stores → delta … → done \| failed) — 시작 전 실패는 일반 HTTP 상태 · 실패 본문 · [streaming.md](streaming.md) |

공개 라우트는 로그인 그룹(`t_user.login_scope`)마다 도메인 · 서비스 · 접두가 따로다 — 이용자 `/api/v1/user-service/user`(user-service, SNS 가입 · 로그인만), 매니저 `/api/v1/admin-service/manager`(admin-service, 총매니저 · 매니저), 관리자 `/api/v1/admin-service/admin`(admin-service, 총관리자 · 관리자). 경로 규칙: 공개 `/api/v1/<service>/<domain>/<action>` · 내부 `/internal/v1/<service>/<domain>/<action>` — service 는 서비스 앱(`user-service` · `admin-service`), domain 은 그 앱의 도메인 폴더. 로그인 그룹은 경로가 아니라 게이트웨이 가드로 가른다.

| API | 경로 |
|---|---|
| `POST /api/v1/user-service/user/login` · `/api/v1/admin-service/{manager,admin}/login` · 각 `/token-refresh` | 동기 (`/internal/v1/user-service/user/*` → user-service, `/internal/v1/admin-service/{manager,admin}/*` → admin-service) |
| `POST /api/v1/user-service/user/sign` · `DELETE · PATCH /api/v1/user-service/user/leave` · `POST /api/v1/user-service/user/phone-verification(+/confirm)` · `/find-login-id(+/confirm)` | 큐 (`user.member.*` → `q.user.cmd`) |
| `GET /api/v1/admin-service/manager/staff(/:user_id)` | 동기 (`/internal/v1/admin-service/manager/staff*` → admin-service, 업체 총관리자만 — RolesGuard) |
| `PATCH /api/v1/admin-service/manager/password` · `POST /api/v1/admin-service/manager/find-login-id(+/confirm)` · `/password-reset(+/confirm)` · `POST /staff` · `PATCH /staff/:user_id(/password-reset · /state)` · `DELETE /staff/:user_id` | 큐 (`admin.manager.*` → `q.admin.cmd`) |
| `PATCH /api/v1/admin-service/admin/password` | 큐 (`admin.admin.password` → `q.admin.cmd`) |
| `GET /api/v1/admin-service/user(/:user_id(/reservation))` · `GET /api/v1/admin-service/manager/account(/:user_id)` | 동기 (`/internal/v1/admin-service/{user,manager/account}*` → admin-service, 관리자 가드) |
| `PATCH /api/v1/admin-service/user/:user_id/state` · `PATCH /api/v1/admin-service/manager/account/:user_id/password-reset` | 큐 (`admin.user.state` · `admin.manager.account-password-reset` → `q.admin.cmd`, 관리자 가드) |
| `GET /api/v1/admin-service/stats` · `GET /api/v1/admin-service/stats/mine` | 동기 (`/internal/v1/admin-service/stats(/mine)` → admin-service, 전체는 관리자 가드 · `/mine` 은 매니저 가드 — 조회만이라 큐 없음) |
| `GET /api/v1/user-service/inquiry/category` · `GET /api/v1/user-service/inquiry(/:inquiry_id)` · `GET /api/v1/user-service/discovery/store-search` | 동기 (`/internal/v1/user-service/{inquiry,discovery}/*` → user-service, 카테고리 목록 · 업체 이름 검색은 가드 없음 · 내 문의는 이용자 가드) |
| `POST /api/v1/user-service/inquiry` | 큐 (`user.inquiry.create` → `q.user.cmd`, 이용자 가드) |
| `GET /api/v1/user-service/chat` · `GET /api/v1/user-service/chat/quota` | 동기 (`/internal/v1/user-service/chat(/quota)` → user-service, 이용자 가드) |
| `POST /api/v1/user-service/chat/message` | 스트림 (`/internal/v1/user-service/chat/message` → user-service SSE 를 그대로 흘린다, 이용자 가드) |
| `DELETE /api/v1/user-service/chat` | 큐 (`user.chat.clear` → `q.user.cmd`, 이용자 가드) |
| `GET /api/v1/admin-service/inquiry/mine(/:inquiry_id)` · `GET /api/v1/admin-service/inquiry(/:inquiry_id)` | 동기 (`/internal/v1/admin-service/inquiry*` → admin-service, `/mine` 은 매니저 가드 · 그 밖 관리자 가드) |
| `PUT …/inquiry(/mine)/:inquiry_id/answer` · `PATCH …/inquiry(/mine)/:inquiry_id/blind · /unblind` | 큐 (`admin.inquiry.*` → `q.admin.cmd`, `/mine` 은 매니저 가드 · 그 밖 관리자 가드) |
| `GET /api/v1/user-service/store/application/mine(/:id)` · `POST …/application/mine/:id/file/upload-url` | 동기 (`/internal/v1/user-service/store/*` → user-service, 이용자 가드) |
| `POST /api/v1/user-service/store/application` · `DELETE …/application/mine/:id` · `POST · DELETE …/application/mine/:id/file(/:file_id)` | 큐 (`user.store.application*` → `q.user.cmd`) |
| `GET /api/v1/admin-service/store/application(/:id)` · `/` · `/:store_id` | 동기 (`/internal/v1/admin-service/store/*` → admin-service) |
| `PATCH /api/v1/admin-service/store/application/:id/{approve,reject}` · `PATCH /:store_id(/state)` | 큐 (`admin.store.*` → `q.admin.cmd`) |
| `GET /api/v1/admin-service/reservation/store` | 동기 (`/internal/v1/admin-service/reservation/store` → admin-service, 매니저 가드) |
| `PATCH /api/v1/admin-service/reservation/:id/store-cancel` · `/:id/room` · `POST /:id/use-cancel-request` | 큐 (`admin.reservation.*` → `q.admin.cmd`, 매니저 가드) |

그룹 표 · 그룹별 인증 가드: [api.md](api.md) "로그인 그룹(도메인) · 인증 가드".

상세 흐름 · 토폴로지 · 실패 처리: [messaging.md](messaging.md)

## 헥사고날 경계 (포트 · 어댑터)

```
 인바운드 어댑터                         아웃바운드 포트 → 어댑터
 ┌─────────────────────────┐            ┌────────────────────────────────────────┐
 │ UserController (내부HTTP)│──┐      ┌─▶│ USER_REPOSITORY → UserRepository(TypeORM)│
 │ UserQueueController (MQ) │──┴─▶ UserService                                      │
 │ (scheduler) crontabs (시간)│──────────▶│ USER_REPOSITORY (scheduler 의 repository)  │
 └─────────────────────────┘            │ (게이트웨이) COMMAND_PUBLISHER → RabbitMQ │
                                        └────────────────────────────────────────┘
```

- **인바운드 어댑터** controller(내부 HTTP · 큐)는 입력을 꺼내 service 로 위임만 한다. 로직 0.
- **crontab 은 예외** — scheduler 앱에만 두고, API 가 아니므로 service 없이 scheduler 안의 repository 포트를 직접 주입해 배치를 처리한다(대상 조회 · 엔티티 조립 · 건별 update, apps/scheduler/src/user/crontabs/user-leave-cleanup.crontab.ts). `@Transactional()` 없이 건별로 처리하고 건별 실패는 건너뛴다. 운영 가드(`NODE_ENV === 'production'`)와 `JobLockService` 는 아래 스케줄러 절.
- **service** 는 아웃바운드 포트(Symbol 토큰 + `import type` 인터페이스)와 프레임워크 서비스(`JwtService` — user.service.ts:43)를 안다. 전송 계층 객체(Request/Response/AMQP 채널)를 받지 않는다. 그래서 같은 `UserService.leave()` 를 HTTP · RabbitMQ 어느 쪽에서 불러도 된다.
- **아웃바운드 어댑터**(repository · publisher)만 TypeORM 쿼리 · amqplib 를 쓴다.
- 의도적으로 하지 않는 것: 순수 도메인 객체 ↔ TypeORM 엔티티 분리, DTO → 도메인 명령 재매핑, 도메인 예외 ↔ HTTP 예외 분리. service 는 TypeORM 엔티티 클래스와 Nest HTTP 예외를 직접 쓴다(매핑 코드가 두 배가 되는 비용에 비해 이 규모에서 얻는 것이 없다). HTTP 예외는 `toFailResult()` 가 전송 중립 실패로 바꾸므로 큐 경로에서도 그대로 쓸 수 있다.

## 레이어 경계 (adapter → service → repository, 단방향)

- **controller** — 라우팅 · guard · Swagger(공개만) · 위임만.
- **crontab** — 시간 트리거 · 운영 가드 · `JobLockService` · repository 포트 직접 호출.
- **service** — 비즈니스 로직 + 트랜잭션 경계(`@Transactional()`). 엔티티를 `new XEntity()` + 할당으로, WHERE 를 `FindOptionsWhere<XEntity>` 로 만들고, 규칙 위반 시 HTTP 예외 throw.
- **repository** — 유일하게 `txHost.tx`(TypeORM EntityManager)를 쓰는 곳. 모든 IO + DB 오류 변환.

## 도메인 간 데이터 접근

다른 도메인의 테이블이 필요하면 **소유 도메인의 repository 가 그 엔티티를 직접 다룬다**(service→service 호출 ❌).

- 소유 도메인은 API 경로가 정한다(`/api/v1/admin-service/store/...` 면 store 도메인).
- 메서드명은 소유 도메인 어휘 — 예: `t_user` 를 다뤄도 store 에서는 `findApplicant` · `insertHeadManager` · `updateStoreManagers`(apps/admin-service/src/store/repositories/store.repository.ts).
- 앱 간에는 서로의 DB 에 기대지 않는 방향으로 간다: 다른 서비스의 데이터가 필요하면 내부 HTTP 또는 이벤트로 받는다(공유 DB 단계에서도 다른 앱의 repository 를 import 하지 않는다).

## 모듈 · 부트스트랩

전역 모듈 — `TransportModule`(`@Global`) · `DatabaseModule`(`@Global`, `JobLockService` export) · `SmsModule` · `StorageModule`(`@Global`, `SMS_SENDER` · `STORAGE_GATEWAY` export) · `RedisModule`(`@Global`, `RedisConnection` export) · `DoorStoreModule`(`@Global`, `DOOR_STORE` export — RedisModule 포함) · `MessagingModule.forGateway()/forService()`(`global: true`, forService 는 `exports: []`). 그래서 도메인 모듈은 이것들을 import 하지 않고 주입받는다.

**gateway** — `GatewayModule` = `MessagingModule.forGateway()`(`BROKER_ACCOUNT='gateway'` · `RabbitMqConnection` · `GATEWAY_INSTANCE_ID` · `COMMAND_PUBLISHER` · `RESULT_SUBSCRIBER`) + `TransportModule`(`modules/transport`: InternalHttpClient · CommandStreamService) + `PassportJwtAuthModule`(`guards/passport.jwt.auth`, 그룹별 JWT 전략 3개) + `DoorStoreModule`(Redis — 문 소켓이 바로 열기 명령 채널 `door-commands` 를 구독) + 도메인 라우트 모듈(`UserModule` · `ReservationModule` · `DiscoveryModule` · `UserStoreModule` · `UserInquiryModule` — `api/v1/user-service/{user,reservation,discovery,store,inquiry}`(둘러보기 · 예약 가능 시간 · 문의 카테고리 목록은 가드 없음), `ManagerModule` · `AdminModule` · `StoreModule` · `RoomModule` · `AdminReservationModule` · `AdminUserModule` · `StatsModule` · `InquiryModule` — `api/v1/admin-service/{manager,admin,store,room,reservation,user,stats,inquiry}` — 이름이 겹치는 도메인 모듈은 별칭으로 들인다) + `ApiLogModule`(`modules/api-log` — 모든 경로에 `ApiLogMiddleware` 를 건다(`configure` · `forRoutes('*')` — 가드보다 먼저), 로그 전용 연결로 `t_api_log` 적재) + `DoorSocketModule`(`modules/door-socket` — 문 소켓 `/ws/v1/door`, HTTP 서버 `upgrade` 를 직접 받는 표준 WebSocket) + `LocalFileModule`(`modules/local-file` — `/files`(서명된 업로드 받기 · 비공개 열람 · 공개 파일)를 HTTP 앱에 직접 붙인다 — 문 소켓과 같은 HttpAdapterHost 방식, Swagger 밖. 읽기는 늘 열고(S3 로 바꾼 뒤에도 `file_storage` 가 `LOCAL` 인 행의 파일), 받기는 `AWS_S3_BUCKET` 이 빌 때만). `main.ts` 는 샘플 사진 정적 경로 `/sample/`(`assets/sample/` — config/sample-image.config.ts)를 건다. APP_GUARD 없음(인증은 핸들러의 그룹 가드, 문 소켓은 접속 헤더의 업체 ID + 시크릿).

```
apps/gateway/src/
├── api/v1/user-service/user/      # 이용자 도메인 라우트(/api/v1/user-service/user) — controllers/(user.controller.ts 동기 · user.controller.queue.ts 큐) · user.module.ts
├── api/v1/admin-service/manager/  # 매니저 도메인 라우트(/api/v1/admin-service/manager — 매니저 가드, /account… 는 관리자 가드) — controllers/(manager.controller.ts · manager.controller.queue.ts) · manager.module.ts
├── api/v1/admin-service/admin/    # 관리자 도메인 라우트(/api/v1/admin-service/admin) — controllers/(admin.controller.ts · admin.controller.queue.ts) · admin.module.ts
├── api/v1/user-service/discovery/    # 업체 둘러보기 라우트(/api/v1/user-service/discovery — 가드 없음) — controllers/(discovery.controller.ts 동기만) · discovery.module.ts
├── api/v1/user-service/inquiry/      # 이용자 문의 라우트(/api/v1/user-service/inquiry — 카테고리 목록은 가드 없음, 그 밖 이용자 가드) — controllers/(inquiry.controller.ts · inquiry.controller.queue.ts) · inquiry.module.ts
├── api/v1/user-service/chat/         # AI 대화형 업체 검색 라우트(/api/v1/user-service/chat — 이용자 가드) — controllers/(chat.controller.ts 동기 · chat.controller.queue.ts 큐 · chat.controller.stream.ts 스트림) · chat.module.ts
├── api/v1/user-service/reservation/  # 예약 도메인 라우트(/api/v1/user-service/reservation — 이용자) — controllers/(reservation.controller.ts · reservation.controller.queue.ts) · reservation.module.ts
├── api/v1/user-service/store/        # 입점 신청 라우트(/api/v1/user-service/store — 이용자 가드) — controllers/(store.controller.ts · store.controller.queue.ts) · store.module.ts
├── api/v1/admin-service/store/    # 업체 도메인 라우트(/api/v1/admin-service/store — 관리자 · 매니저 가드) — controllers/(store.controller.ts · store.controller.queue.ts) · store.module.ts
├── api/v1/admin-service/room/     # 객실 도메인 라우트(/api/v1/admin-service/room — 매니저 가드) — controllers/(room.controller.ts · room.controller.queue.ts) · room.module.ts
├── api/v1/admin-service/reservation/  # 업체 예약 라우트(/api/v1/admin-service/reservation — 매니저 가드) — controllers/(reservation.controller.ts · reservation.controller.queue.ts) · reservation.module.ts
├── api/v1/admin-service/user/     # 이용자 관리 라우트(/api/v1/admin-service/user — 관리자 가드) — controllers/(user.controller.ts · user.controller.queue.ts) · user.module.ts
├── api/v1/admin-service/stats/    # 통계 라우트(/api/v1/admin-service/stats — 관리자 가드, /mine 은 매니저 가드) — controllers/(stats.controller.ts 동기만) · stats.module.ts
├── api/v1/admin-service/inquiry/  # 문의 관리 라우트(/api/v1/admin-service/inquiry — 관리자 가드, /mine 은 매니저 가드) — controllers/(inquiry.controller.ts · inquiry.controller.queue.ts) · inquiry.module.ts
├── guards/
│   ├── passport.jwt.auth/  # 그룹별 strategy · guard(auth=이용자 · manager · admin) · util(공통 옵션 · 회원 조회 · 401) · decorator(@PassportUser · @PassportActor) · module
│   └── roles/              # roles.guard.ts · roles.decorator.ts(@Roles — 그룹 안 권한, 사용 0)
├── modules/transport/      # internal-http.client(동기 · 스트림 — stream() 이 서비스 SSE 를 그대로 흘린다) · command-stream.service · transport.util
├── modules/api-log/        # api-log.middleware(모든 HTTP 요청 — 글 응답 조각 모으기(바이너리 — /files 사진은 본문 null) · finish/close 1번) · api-log.writer(로그 전용 DataSource insert) · api-log.util(라우트 패턴 · 응답 본문 · SSE 마지막 이벤트) · api-log.module
├── modules/door-socket/    # door-socket.server(upgrade 수신 · 인증 · 메시지 · 명령 구독 · ping) · door-socket.util · door-socket.module
├── modules/local-file/     # 내부 파일 저장소 경로(/files — 받기는 AWS_S3_BUCKET 이 빌 때만, 읽기는 늘) — local-file.server(업로드 받기 · 비공개 열람 · 공개 파일) · local-file.util · local-file.module
├── assets/sample/          # 샘플 사진 PNG 450개(테스트 데이터 시드 — scripts/sample-images.mjs 가 그림, nest-cli assets 로 dist 복사)
├── config/                 # cors.config.ts(buildCorsOptions) · trust-proxy.config.ts(parseTrustProxy) · sample-image.config.ts(/sample/ 정적 경로) · swagger.config.ts(buildSwaggerCustomOptions — Swagger 도메인 선택 상자)
├── gateway.module.ts
└── main.ts
```
`main.ts`: `dotenv/config` → trust proxy(`TRUST_PROXY`, 값이 없으면 설정하지 않음) → 전역 `CustomErrorFilter` → 전역 ValidationPipe → CORS(`CORS_ORIGINS`) → Swagger(`SWAGGER_TITLE` · `SWAGGER_PATH` 기본 `swagger`, bearer, 도메인 선택 상자 — config/swagger.config.ts) → 종료 훅 → `listen(GATEWAY_PORT ?? 3000)`.

**user-service** — `UserServiceModule` = `DatabaseModule`(TypeORM + ClsModule `TransactionalAdapterTypeOrm`) + `MessagingModule.forService({queue: USER_COMMAND_QUEUE, binding_keys: [USER_COMMAND_BINDING], broker_user: BROKER_USER.USER_SERVICE})`(`broker_user` 필수, 큐 · 바인딩은 contracts 상수) + `SmsModule` + `DoorStoreModule`(문 정보 포트 `DOOR_STORE` — Redis 연결 `RedisModule` 포함) + `PaymentModule` + `StorageModule`(입점 신청 업체 정보 파일 · 업체 둘러보기의 사진 공개 주소) + `UserModule` · `ReservationModule`(예약 — 내 예약 QR · 결제 확인 QR 은 `DOOR_STORE` 로 호실의 현재 QR 을 쓴다) · `DiscoveryModule`(업체 둘러보기 — 내부 HTTP 5개, 큐 없음) · `InquiryModule`(문의 — 내부 HTTP 3개 · 큐 1개) · `StoreModule`(입점 신청 — 내부 HTTP 3개 · 큐 4개) · `DoorModule`(문 소켓 처리 — 내부 HTTP 3개, 큐 없음) + providers `{provide: APP_GUARD, useClass: InternalAuthGuard}` · `{provide: APP_INTERCEPTOR, useClass: ReturnedExceptionInterceptor}`(반환된 예외 → 실패 응답) · `SeederService`. crontab 이 없다(scheduler).

**admin-service** — `AdminServiceModule` = `DatabaseModule`(user-service 와 같은 DB · 엔티티) + `MessagingModule.forService({queue: ADMIN_COMMAND_QUEUE, binding_keys: [ADMIN_COMMAND_BINDING], broker_user: BROKER_USER.ADMIN_SERVICE})`(`q.admin.cmd` ← `admin.#`) + `SmsModule` · `StorageModule` · `DoorStoreModule` + `ManagerModule` · `AdminModule` · `StoreModule` · `RoomModule`(객실 — 업체 관리자) · `ReservationModule`(업체 예약 — 예약 현황 · 업체 취소 · 호실 이동, SMS · DOOR_STORE) · `UserModule`(이용자 관리 — 총관리자 · 관리자) · `StatsModule`(통계 — 조회만, 내부 HTTP 컨트롤러 하나) · `InquiryModule`(문의 관리 — 내부 HTTP 4개 · 큐 6개) + providers `{provide: APP_GUARD, useClass: InternalAuthGuard}` · `{provide: APP_INTERCEPTOR, useClass: ReturnedExceptionInterceptor}`. migrate · `SeederService` 가 없다(user-service 몫). `main.ts` 는 user-service 와 같은 모양 — `listen(ADMIN_SERVICE_PORT ?? 3020, ADMIN_SERVICE_HOST || '127.0.0.1')`.

**scheduler** — `SchedulerModule` = `DatabaseModule` + `ScheduleModule.forRoot()` + `PaymentModule` · `DoorStoreModule` · `SmsModule` + `UserModule`(crontab + scheduler 의 회원 repository) · `ReservationModule`(결제 대기 만료 · 늦은 승인 · 환불 · QR 동기화 · 이용 전환 · QR 확인 링크 SMS crontab + scheduler 의 예약 repository) · `ApiLogModule`(t_api_log 월 파티션 미리 만들기 crontab + DDL repository) + `MonitoringModule.forRoot`(지표 · 헬스 체크 포트만 — HTTP 지표 없음). APP_GUARD · MessagingModule · 컨트롤러 · 시드가 없다. 모든 앱 루트 모듈이 `MonitoringModule.forRoot` 를 들인다(monitoring.md).
`main.ts`: `dotenv/config` → `NestFactory.createApplicationContext(SchedulerModule)`(listen 하지 않는다) → 종료 훅. 등록된 `@Cron` 타이머가 프로세스를 살려 둔다.
`main.ts`: `dotenv/config` → 전역 필터 → 전역 ValidationPipe → 종료 훅 → `listen(USER_SERVICE_PORT ?? 3010, USER_SERVICE_HOST || '127.0.0.1')`. CORS · Swagger 없음.
`migrate.ts`(별도 진입점): `retry` 로 DB 연결을 기다린 뒤(30회 × 2초) `runMigrations` 또는 `revert` 인자면 `undoLastMigration`, 둘 다 `{transaction: 'each'}`. DataSource 설정은 앱과 같다(`synchronize: false`, 목록 테이블 `t_migration`).

**수명주기 순서** — ① `onModuleInit`: 결과 수신기 · 명령 소비자가 `connection.register(setup)`, `CommandHandlerRegistry` 가 앱 전체 provider 를 스캔 ② `onApplicationBootstrap`: RabbitMQ 연결(등록된 setup 실행) · 시드 입력 ③ `onModuleDestroy`: 브로커 연결 종료, 게이트웨이는 남은 SSE 스트림에 pending 을 쓰고 닫는다.

## 기본 데이터 시드

`SeederService`(libs/database, `OnApplicationBootstrap`)가 [seeder.targets.ts](../libs/database/src/seeder/seeder.targets.ts) 의 `SEED_TARGETS` 를 순서대로 처리한다 — PK 기준으로 없는 행만 insert(`pickMissingRows`). 대상별 실패는 경고 로그만 남기고 부팅을 막지 않는다. DB 를 소유한 서비스 한 곳에서만 등록한다.

테스트 데이터(샘플 시드)는 `SEED_TARGETS` 끝의 `SAMPLE_SEED_TARGETS`([sample-seed.targets.ts](../libs/database/src/seeder/sample-seed.targets.ts) · 값은 sample-seed.data.ts — 전국 업체는 sample-seed.region.data.ts)다 — `SEED_SAMPLE_DATA=1` 일 때만 업체 71곳(서울 10 · 전국 61) · 객실 그룹 · 호실 · 업체 총관리자 · 이용자 · 문의를 고정 ID(`sampleId` — `5a3e` + 종류 + 번호)로 넣고, 꺼져 있으면 만드는 함수를 부르지 않는다. 사진은 게이트웨이 `assets/sample/` 의 PNG(`/sample/` 정적 경로 — config/sample-image.config.ts). 켜는 법 · 계정: [guides/sample-data.md](guides/sample-data.md).

## 스케줄러

crontab 은 scheduler 앱(`apps/scheduler`)의 도메인 `crontabs/` 폴더에 `<domain>-<feature>.crontab.ts`(`@Cron`)로 두고 도메인 모듈 providers 에 등록한다. 서비스 앱에는 `ScheduleModule` · crontab 을 두지 않는다 — 요청 처리와 배치가 같은 프로세스 · DB 연결 풀을 나눠 쓰지 않게 한다. `ScheduleModule.forRoot()` 는 scheduler 루트 모듈에 1회.
- `apps/scheduler/src/store/crontabs/store-embedding.crontab.ts`(업체 검색 벡터 — 매시 30분 · 바뀐 업체만 Gemini 임베딩) · `apps/scheduler/src/chat/crontabs/chat-purge.crontab.ts`(지난 AI 대화 — 매시 정각 · Redis 에서 7일 지난 것) — 운영 데이터(업체 · 예약)를 바꾸지 않는 검색 색인 · 대화 정리라 개발 환경에서도 돈다(운영 가드 없음 — 개발 DB 에서 AI 검색을 시험할 수 있게).
- `apps/scheduler/src/user/crontabs/user-leave-cleanup.crontab.ts` — `@Cron(CronExpression.EVERY_HOUR)`, 운영(`NODE_ENV === 'production'`)이 아니면 바로 return, 탈퇴 예약 경과자를 LEAVE 로 전환. 잠금 키는 파일 상수 `USER_LEAVE_CLEANUP_LOCK`.
- scheduler 도 여러 대일 수 있고(인스턴스 수는 deskless 차트) 배포 중 두 대가 겹칠 수 있어 crontab 이 인스턴스마다 깨어날 수 있다. 본문은 `JobLockService.runExclusive('<domain>.<작업>', ...)`(libs/database, PostgreSQL advisory lock)로 감싸 회차마다 1대만 실행한다. 잠금은 동시 실행만 막으므로, 대상은 상태 조건으로 골라 두 번 돌아도 결과가 같게 한다.

## 서비스(user-service · admin-service)는 게이트웨이를 거친 요청만 받는다

| 수신 경로 | 막는 방법 |
|---|---|
| 내부 HTTP | ① 서비스 루트 모듈의 전역 `InternalAuthGuard`(APP_GUARD) — `x-internal-token` 이 INTERNAL_API_TOKEN 과 같아야 한다(시간차 안전 비교, 미설정이면 전부 거부) ② 바인딩 `USER_SERVICE_HOST` · `ADMIN_SERVICE_HOST` 기본 127.0.0.1 ③ 쿠버네티스에서는 서비스를 밖에 열지 않고(Ingress 없음) NetworkPolicy 로 gateway 파드만 닿게 한다(deskless 차트) |
| RabbitMQ 명령 | ① 앱별 브로커 계정 — `deskless.cmd` 에 쓸 수 있는 계정은 gateway 뿐(user-service · admin-service 계정은 쓸 수 없다) ② 모든 발행 메시지에 접속 계정을 `user_id` 로 붙이고 브로커가 대조 ③ 서비스는 `user_id` 가 gateway 가 아닌 명령을 처리 · 회신 없이 DLQ 로 보낸다 |

- 관리자 계정(관리 화면)도 `user_id` 를 gateway 로 위조할 수 없다 — RabbitMQ 는 impersonator 태그가 없는 계정의 위조를 거절한다. gateway 비밀번호만 지키면 된다.
- CORS 는 브라우저만 지키는 규칙이라 서버 간 호출을 막지 못한다. 서비스에는 CORS 를 두지 않고, 게이트웨이에만 `CORS_ORIGINS`(허용할 프론트 주소, 비우면 다른 출처를 모두 차단)로 건다 — [cors.config.ts](../apps/gateway/src/config/cors.config.ts).

## 실행 · 배포 — deskless 저장소(쿠버네티스)

**배포는 deskless 저장소가 맡는다**(쿠버네티스 — k3s · Helm, 사용자 결정 2026-11-23). 인스턴스 수 · 로드밸런싱(Service · Ingress) · 네트워크 격리(NetworkPolicy) · 인프라(PostgreSQL · RabbitMQ 와 그 계정 · 권한 · Redis) · 마이그레이션 Job · 공용 파일 볼륨 · 지표 수집(Prometheus · Grafana) · 환경 값 주입이 모두 거기 있다. 이 저장소는 앱 코드와 이미지([Dockerfile](../Dockerfile))만 갖는다. Docker compose 로 띄우던 시절의 구성(compose · nginx · 공용 네트워크 · 브로커 계정 초기화)은 커밋 `3125886` 에 남아 있다.

- 이미지: [Dockerfile](../Dockerfile) 하나를 `APP` 빌드 인자로 나눠 `deskless/gateway` · `deskless/user-service` · `deskless/admin-service` · `deskless/scheduler` 를 만든다. Node 24 LTS slim — `node:24.22.3-slim`(패치까지 고정 — 보안 패치가 나오면 Dockerfile `NODE_IMAGE` 와 package.json `engines` 하한을 같이 올린다, bcrypt 가 glibc prebuild 만 제공), 빌드 단계에서 `nest build <APP>`, 실행 단계는 운영 의존성 + `dist/apps/<APP>` 만. `node` 사용자로 실행. 이미지를 만드는 `docker build` 는 Claude 도 해도 된다(컨테이너를 띄우지 않는다).

### 앱이 배포에 기대하는 것 (deskless 가 맞춘다)

| 항목 | 값 |
|---|---|
| 컨테이너 안 포트 | gateway 3000 · user-service 3010 · admin-service 3020(`GATEWAY_PORT` · `USER_SERVICE_PORT` · `ADMIN_SERVICE_PORT`), 지표 · 헬스 체크 9464(`*_METRICS_PORT`) |
| 바인딩 | `USER_SERVICE_HOST` · `ADMIN_SERVICE_HOST` · `METRICS_HOST` = `0.0.0.0`(기본 127.0.0.1 — 파드 밖에서 닿게) |
| 서비스 주소 | `USER_SERVICE_URL` · `ADMIN_SERVICE_URL` = 각 서비스의 Service 주소 |
| 인스턴스 ID | `GATEWAY_INSTANCE_ID` 비움 → `gw-<호스트명 = 파드 이름>-<pid>`(영숫자 · `-` 외 문자는 `-` — messaging.util.ts) — 결과 큐가 겹치지 않는다 |
| 앞단 프록시 | `TRUST_PROXY` = 믿을 앞단 단 수(Ingress 1단이면 1) — [trust-proxy.config.ts](../apps/gateway/src/config/trust-proxy.config.ts) |
| 내부 파일 저장소 | `AWS_S3_BUCKET` 이 빌 때 gateway · user-service · admin-service 가 같은 폴더를 봐야 한다 — 공용 볼륨을 `/app/storage/files` 에 붙이고 `FILE_STORAGE_DIR` 로 넘긴다(이미지가 그 폴더를 `node` 소유로 만들어 두어 빈 볼륨이 소유자를 물려받는다). 노드가 여러 대면 S3 모드 |
| 게이트웨이 앞단(Ingress) | 요청 본문 한도 10MB(`LOCAL_FILE_MAX_BYTES` — integration.constants.ts) · SSE 응답 버퍼링 끔(게이트웨이가 `X-Accel-Buffering: no` 를 보낸다) · 문 소켓 `/ws/` WebSocket 업그레이드 · 읽기 대기 120초([realtime.md](realtime.md)) · AI 대화 스트림 `POST /api/v1/user-service/chat/message` 도 버퍼링 끔 · 읽기 대기 120초(답 조각이 계속 오지만 웹 검색 단계는 조각 없이 30초까지 걸릴 수 있다 — [streaming.md](streaming.md)) |
| 마이그레이션 | `node dist/apps/user-service/apps/user-service/src/migrate.js`(user-service 이미지) — 앱보다 먼저, 한 번만. 적용은 사용자가 실행한다. 적용 계정에는 PostgreSQL 확장 `btree_gist`(기간 가격 · 예약 점유 겹침 배타 제약) 생성 권한이 필요하다(RDS PostgreSQL 13+ 는 DB 의 CREATE 권한) · `vector`(pgvector — 업체 검색 벡터 `t_store_embedding`, 마이그레이션이 `CREATE EXTENSION IF NOT EXISTS vector` 를 한다 — PostgreSQL 이미지에 pgvector 가 있어야 한다, 예: `pgvector/pgvector` 이미지 · RDS 는 지원 확장) |
| 프로브 | `GET /health/live` · `GET /health/ready`(지표 · 헬스 체크 포트 — [monitoring.md](monitoring.md)) |
| 브로커 계정 · 권한 | 앱별 계정(`BROKER_USER`)과 그 권한 — `deskless.cmd` 쓰기는 gateway 만([messaging.md](messaging.md)). `npm run broker:check` 로 설계와 대조한다 |
| 시각대 | `TZ=Asia/Seoul` |

- 앱끼리 · 인프라와의 기다림은 앱이 맡는다 — migrate 는 DB 연결을 최대 1분 재시도, 앱은 `@nestjs/typeorm` 기본 재시도(10회 · 3초 간격), RabbitMQ 자동 재연결(로그인 거부도 재시도), Redis 가 없어도 부팅(문 요청만 503).

### 설정 — `.env`

키 이름 · 로컬 기본값은 [.env.example](../.env.example) 하나에 있고, 키마다의 뜻은 아래 표다. 로컬 실행은 이 파일을 `.env` 로 복사해 쓰고, 쿠버네티스는 deskless 가 같은 키 이름으로 Secret · ConfigMap 을 넣는다. 환경 차이(로컬 · 운영)는 값으로만 두고 코드에 환경별 분기를 두지 않는다.

- **`.env.example` 모양**(사용자 결정 2026-11-24): 절은 앱 · 기능 단위 — 그 앱 · 기능의 포트 · 바인딩 · 지표 포트 · 주소 · 계정 · 한도를 한 절에 두고, 어느 앱에도 묶이지 않는 값만 "공통" 절. 주석은 키 묶음당 한 줄(길어도 두 줄) — `(필수)` · 비우면 어떻게 되는지 · 세팅 가이드 경로만, 긴 설명은 이 표에. 새 키는 그 절에 한 줄 주석과 함께 넣고 이 표에도 한 줄 더한다.
- `(필수)` 값이 비면 앱이 제대로 돌지 않는다(부팅은 되고 그 기능이 실패하는 것도 있다 — 표의 "비면").

| 절 | 키 | 뜻 · 비면 · 주의 |
|---|---|---|
| 공통 | `NODE_ENV` | `production` 운영 / `development` 로컬 디버깅 전용 — JWT 만료를 검사하지 않는다 |
| 〃 | `INTERNAL_API_TOKEN` (필수) | 게이트웨이가 서비스 내부 HTTP 에 `x-internal-token` 으로 싣고 서비스 전역 `InternalAuthGuard` 가 시간차 안전 비교한다(비면 전부 거부). 내부 파일 저장소 업로드 · 열람 주소의 HMAC 서명 키도 이 값 — 모든 앱이 같은 값 |
| 〃 | `METRICS_HOST` | 지표 · 헬스 체크 서버 바인딩(기본 127.0.0.1, 파드는 0.0.0.0) — [monitoring.md](monitoring.md) |
| gateway | `GATEWAY_PORT` · `GATEWAY_METRICS_PORT` | 게이트웨이 포트(기본 3000) · 지표 · 헬스 체크 포트(로컬 9464) |
| 〃 | `GATEWAY_PUBLIC_URL` | 브라우저가 게이트웨이에 닿는 주소(끝 `/` 없이, 예: `http://localhost:3000`) — 내부 파일 저장소의 업로드 · 열람 · 사진 주소(`<주소>/files/…`)와 테스트 데이터 사진 주소(`<주소>/sample/…`)의 기준. gateway · user-service · admin-service 가 쓴다. 비면 그 주소를 만드는 요청이 실패한다 |
| 〃 | `CORS_ORIGINS` | 허용할 프론트 주소(쉼표 구분, `*` = 전체) — 비면 다른 출처의 브라우저 요청을 모두 막는다([cors.config.ts](../apps/gateway/src/config/cors.config.ts)) |
| 〃 | `TRUST_PROXY` | 믿을 앞단 프록시 단 수 — Ingress 1단이면 1, 그 앞에 클라우드 로드밸런서가 더 있으면 2. 비면 설정하지 않는다(로컬 직접 실행). 앞단이 없는데 값을 주면 클라이언트가 `X-Forwarded-For` 로 IP 를 위조할 수 있다([trust-proxy.config.ts](../apps/gateway/src/config/trust-proxy.config.ts)) |
| 〃 | `COMMAND_STREAM_TIMEOUT_MS` · `INTERNAL_HTTP_TIMEOUT_MS` | 큐 경로 SSE 가 결과를 기다리는 시간(기본 30000 — 넘기면 `pending`) · 게이트웨이 → 서비스 내부 HTTP 대기(기본 10000) |
| 〃 | `GATEWAY_INSTANCE_ID` | 결과 큐 이름에 쓰는 인스턴스 ID — 비면 `gw-<호스트 이름>-<pid>`(쿠버네티스는 파드 이름, 인스턴스마다 달라야 한다) |
| 〃 | `SWAGGER_TITLE` · `SWAGGER_PATH` | Swagger 제목 · 경로(기본 `swagger`) |
| 〃 | `USER_SERVICE_URL` · `ADMIN_SERVICE_URL` | 게이트웨이가 부르는 서비스 주소 — 로컬 `localhost:3010` · `:3020`, 쿠버네티스는 Service 주소 |
| user-service | `USER_SERVICE_PORT` · `USER_SERVICE_HOST` · `USER_SERVICE_METRICS_PORT` | 포트(3010) · 바인딩(기본 127.0.0.1 — 같은 머신의 게이트웨이만, 파드는 0.0.0.0) · 지표 포트(로컬 9465) |
| 〃 | `SEED_SAMPLE_DATA` | 1 이면 user-service 가 부팅할 때 업체 71곳(서울 10 · 전국 61) · 객실 · 업체 총관리자 71명 · 이용자 1명 · 문의 71건을 고정 ID 로 넣는다(이미 있으면 건너뜀). 운영 DB 는 0 — [guides/sample-data.md](guides/sample-data.md) |
| admin-service | `ADMIN_SERVICE_PORT` · `ADMIN_SERVICE_HOST` · `ADMIN_SERVICE_METRICS_PORT` | 포트(3020) · 바인딩(user-service 와 같다) · 지표 포트(로컬 9466) |
| scheduler | `SCHEDULER_METRICS_PORT` | 지표 · 헬스 체크 포트(로컬 9467) — scheduler 가 받는 연결은 이것뿐 |
| PostgreSQL | `DATABASE_URL` (필수) | 접속 주소 — 네 앱 모두(게이트웨이는 API 로그 적재 전용 연결 풀 5). 로컬은 deskless 로컬 클러스터, 운영은 클러스터 안 DB 또는 RDS 등 |
| 〃 | `DATABASE_POOL_SIZE` · `DATABASE_CONNECTION_TIMEOUT_MS` | 연결 풀 크기(기본 10) · 풀에서 연결을 기다리는 최대 시간(기본 30000 — 넘기면 그 요청은 500, 큐 경로는 재시도) |
| RabbitMQ | `RABBITMQ_HOST` · `RABBITMQ_PORT` (필수) | 브로커 주소 — 로컬은 deskless 로컬 클러스터, 운영은 클러스터 안 브로커 또는 Amazon MQ 등 |
| 〃 | `RABBITMQ_USER` · `RABBITMQ_PASSWORD` | 관리자 계정 — `npm run broker:check`(계정 권한 점검) 전용, 앱은 쓰지 않는다 |
| 〃 | `RABBITMQ_GATEWAY_PASSWORD` · `RABBITMQ_USER_SERVICE_PASSWORD` · `RABBITMQ_ADMIN_SERVICE_PASSWORD` (필수) | 앱별 브로커 계정 비밀번호 — 키 이름은 계정에서 만든다(`RABBITMQ_<계정>_PASSWORD` — messaging.util.ts), 각 앱은 자기 것만 읽는다. 계정 · 권한은 deskless 인프라 묶음이 만들어 같은 값이어야 한다. 큰따옴표 · 역슬래시 금지(계정 설정에 문자열로 그대로 실린다) |
| Redis (문 정보 · AI 대화) | `REDIS_URL` (필수) | 호실의 현재 QR · 문을 마지막으로 연 시각 · 바로 열기 명령 채널, AI 대화 이력 · 하루 질문 수 · 답하는 중 잠금 — 네 앱 모두. 비밀번호에 `@` `:` `/` 가 있으면 URL 인코딩, TLS 면 `rediss://` — [guides/redis-setup.md](guides/redis-setup.md) |
| 로그인 · 암호화 | `JWT_SECRET` (필수) | 토큰 서명 — user-service · admin-service 가 발급하고 게이트웨이가 검증한다(같은 값) |
| 〃 | `BCRYPT_CODE` · `BCRYPT_ROUNDS` | 비밀번호 해시 pepper — 가입이 시작된 뒤 바꾸면 기존 비밀번호를 검증할 수 없다 · 라운드(4 ~ 31 정수, 기본 12) |
| 〃 | `TOKEN_CIPHER_KEY` (필수) | refresh 토큰 암호화 키(hex 64자) — 만드는 명령은 `.env.example` 주석 |
| AWS 공통 | `AWS_REGION` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` | 리전(서울 `ap-northeast-2` — 기본값이 없어 키를 넣었는데 비면 SMS · S3 요청이 실패한다) · IAM 사용자 액세스 키. 키가 비면 SMS 를 보내지 않고 받는 번호 · 본문을 로그에 남긴 뒤 성공한다(인증번호는 DB `t_sms_verification.code` 에도 남고, 임시 비밀번호는 로그에서) — IAM 역할만으로 돌려도 SMS 는 생략되니 보내려면 키를 넣는다(S3 는 역할로도 된다). SMS 는 user-service · admin-service · scheduler, 파일은 user-service · admin-service — [guides/aws-setup.md](guides/aws-setup.md) "AWS 없이 돌리기" |
| SMS | `SMS_VERIFICATION_DAILY_LIMIT` | 같은 휴대폰 번호로 하루(한국 날짜)에 보낼 수 있는 인증 SMS 수(기본 10) — user-service · admin-service |
| 〃 | `USER_WEB_URL` | 이용자 프론트 주소(끝 `/` 없이) — SMS 링크의 기준: scheduler 의 QR 확인 링크(`<주소>/reservation/<예약 ID>`) · admin-service 의 이용 중 취소 요청 승인 링크(`<주소>/reservation/<예약 ID>/cancel-request`). 비면 QR 링크는 보내지 않고 이용 중 취소 요청은 503 |
| 파일 저장 | `AWS_S3_BUCKET` · `AWS_S3_PUBLIC_URL` | 사진 버킷 — 비면 내부 파일 저장소(게이트웨이 `/files`). CloudFront 배포 주소(`https://<배포>.cloudfront.net`) — S3 를 쓸 때 공개 파일 주소의 기준, 비면 공개 파일 주소 요청이 실패한다 — [guides/aws-setup.md](guides/aws-setup.md) |
| 〃 | `FILE_STORAGE_DIR` | 내부 파일 저장소 폴더(버킷이 빌 때) — 비면 `storage/files`(실행 위치 기준 — 로컬은 저장소 루트). gateway · user-service · admin-service 가 같은 폴더를 봐야 한다(쿠버네티스는 공용 파일 볼륨 자리) |
| 결제 (토스페이먼츠) | `TOSS_SECRET_KEY` | 시크릿 키 — 개발 `test_sk_…`(결제 환경 TEST) · 운영 `live_sk_…`. 결제창 · 승인은 프론트, 서버는 토스 조회로 검증 · 환불(user-service · scheduler). 비면 부팅은 되고 예약 생성 · 결제 확인 · 환불만 503 — [guides/toss-setup.md](guides/toss-setup.md) |
| AI 대화형 업체 검색 (Gemini) | `GEMINI_API_KEY` | Google AI Studio API 키 — user-service(요청 읽기 · 답 스트리밍 · 검색 문장 벡터) · scheduler(업체 검색 벡터)만. 비면 부팅은 되고 AI 질문 · 벡터 갱신만 503(부팅 때 한 번 경고) — [guides/gemini-setup.md](guides/gemini-setup.md) |
| 〃 | `GEMINI_CHAT_MODEL` · `GEMINI_EMBEDDING_MODEL` | 대화 모델(기본 `gemini-3-flash-preview` — Google 검색 그라운딩과 정해진 JSON 응답을 같이 쓰려면 Gemini 3 계열) · 임베딩 모델(기본 `gemini-embedding-001` — 768차원으로 줄여 쓴다, 바꾸면 scheduler 가 모든 업체 벡터를 다시 만든다) |
| 〃 | `CHAT_DAILY_LIMIT` | 이용자 하루 질문 수(기본 5 — 한국 시각 자정에 다시 채움, 답을 다 받은 질문만 센다) — user-service |

- 운영에 올리기 전 값 확인: `NODE_ENV=production`(development 는 JWT 만료를 검사하지 않는다) · 비밀값 새로 생성(내부 토큰 · 브로커 계정 비밀번호 · DB · Redis 비밀번호 · JWT · 토큰 암호화 키) · `CORS_ORIGINS` 를 실제 프론트 주소로 · `TRUST_PROXY` 를 앞단 단 수로 · `BCRYPT_CODE` 확정(가입 시작 후 바꾸면 기존 비밀번호 검증 불가) · `SEED_SAMPLE_DATA=0`.

### 로드밸런싱

| 경로 | 나누는 방법 |
|---|---|
| 클라이언트 → gateway | Ingress → gateway Service(여러 파드). SSE 를 바로 흘려보내도록 버퍼링을 끈다 |
| gateway → user-service · admin-service 내부 HTTP | 각 서비스의 Service(여러 파드) |
| gateway → 서비스 명령(큐) | 같은 앱의 인스턴스들이 자기 명령 큐(`q.user.cmd` · `q.admin.cmd`)를 경쟁 소비 — 브로커가 나눠 준다 |
| user-service → gateway 결과 | 명령의 `reply_to` 인스턴스 결과 큐로만 돌아가 요청을 받은 인스턴스가 SSE 로 돌려준다 — sticky session 불필요 |
| crontab | scheduler 인스턴스가 여러 대여도 `JobLockService`(PostgreSQL advisory lock)로 회차마다 1대만 실행 |

- 인스턴스 수는 deskless 차트가 정한다. 앱 코드는 인스턴스 로컬 상태(메모리 캐시 · 세션 등)에 기대지 않는다 — 문 소켓 연결 목록만 예외([realtime.md](realtime.md)).
- 기본 데이터 시드는 인스턴스마다 부팅 때 돈다. 빈 DB 에 동시에 뜨면 늦은 쪽은 PK 충돌 경고만 남기고 계속 뜬다(행은 먼저 넣은 쪽이 넣는다).

### 로컬 개발

앱은 PC 에서 watch 로 실행하고, PostgreSQL · RabbitMQ(계정 · 권한 포함) · Redis 는 deskless 저장소의 로컬 클러스터가 이 PC(localhost)에 열어 준 주소로 붙는다(`.env.example` 기본값 — 5432 · 5672 · 6379). 띄우는 방법은 deskless 저장소 README.

```bash
npm run db:migrate            # 마이그레이션 적용
npm run start:user-service    # :3010
npm run start:admin-service   # :3020
npm run start:scheduler       # crontab (운영 데이터를 바꾸는 작업은 NODE_ENV=production 일 때만)
npm run start:gateway         # :3000
```

## 새 도메인 추가 절차

1. **엔티티** — `libs/database/src/entities/<domain>/<feature>.entity.ts` + `ENTITIES` 등록 → `npm run db:generate -- <Name>` → `npm run db:check`([data-layer.md](data-layer.md)).
2. **규격** — `libs/contracts/src/<domain>/dto/*.dto.ts`(요청 · 응답 DTO), 큐 경로가 있으면 `<domain>.commands.ts`(type · 큐 이름 · 바인딩 키 · 내부 경로). 라우트는 `/api/v1/<service>/<domain>`, 내부 경로는 `/internal/v1/<service>/<domain>` 이다(로그인 그룹은 가드로 가른다).
3. **서비스** — 담당 앱(없으면 `apps/<x>-service` 를 nest-cli.json 프로젝트로 추가) 안에 `src/<domain>/`: `service` · `repositories/` + `interfaces/` + `<domain>.symbols.ts` · `controllers/<domain>.controller.ts`(내부, 동기 경로) · `controllers/<domain>.controller.queue.ts`(`@OnCommand`, 큐 경로) · `<domain>.constants.ts` · `test/`. crontab 은 서비스가 아니라 `apps/scheduler/src/<domain>/crontabs/`(+ scheduler 의 repository)에 둔다.
4. **게이트웨이** — `apps/gateway/src/api/v1/<service>/<domain>/controllers/` 에 동기 라우트 `<domain>.controller.ts` · 큐 라우트 `<domain>.controller.queue.ts`(한 파일에 섞지 않는다) + `<domain>.module.ts`(두 controller 등록), Swagger.
5. 새 서비스 앱이면 —
   - `nest-cli.json` 프로젝트 · `apps/<x>-service/tsconfig.app.json`
   - 루트 모듈 `MessagingModule.forService({queue, binding_keys, broker_user})` + `{provide: APP_GUARD, useClass: InternalAuthGuard}`
   - `BROKER_USER` 상수(messaging.constants.ts)에 계정 추가 — 그 계정 · 비밀번호 · 권한은 deskless 인프라 묶음에 더한다(deskless 저장소 작업)
   - 게이트웨이 `InternalHttpClient` 의 `InternalService` 유니온 · `SERVICE_URL` 표(internal-http.client.ts:7,10)
   - `.env.example` 키 · 이미지(`Dockerfile` 의 `APP` 값) — 배포(Deployment · Service · NetworkPolicy · 프로브)는 deskless 차트에 더한다(deskless 저장소 작업)
6. 테스트 — [testing.md](testing.md).

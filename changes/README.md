# deskless 수정 요청

[deskless](https://github.com/HaSungJe/deskless) 저장소(백엔드 · 프론트를 쿠버네티스로 엮는 저장소)가 이 저장소에 보낸 수정 요청을 받는 곳이다 — 프론트가 백엔드 요청을 `frontend/changes/` 에 받는 것과 같은 방식(사용자 결정 2026-11-23, AGENTS.md 주의사항).

- 받은 요청서는 이 폴더에 `<YYYY-MM-DD>-<기능>.md` 로 두고(다른 자리에 받았으면 반영 뒤 옮긴다) 위에서부터 차례로 반영한다.
- **반영 = 요청서 본문 + 영향 전수 확인** — 지우는 것 · 더하는 것 · 고치는 것을 하고, 요청서의 검색어로 저장소 전체를 훑어 그 변경으로 사실이 바뀌는 코드 · 주석 · 문서 · 규약 · 메모리를 모두 고친다(남긴 줄은 이유를 적는다). `npm test` · `npm run typecheck` · `npm run build` · `npm run lint` 통과까지.
- 반영하면 아래 목록에 상태를 적고 결과 요약을 남긴다 — deskless 쪽 요청서 상태는 deskless 가 이 요약을 보고 고친다(이 저장소에서 deskless 파일을 고치지 않는다).
- 반영한 요청서는 지우지 않고 기록으로 남긴다.

## 목록

| 날짜 | 요청 | 상태 |
|---|---|---|
| 2026-11-23 | [Docker 운영 구성 정리 · 모니터링 이전 · 헬스 체크](2026-11-23-k8s-cleanup.md) | 반영 `43abf2d` |
| 2026-11-24 | [`.env.example` 을 앱 · 기능 단위로 묶고 주석 줄이기](2026-11-24-env-example-layout.md) | 반영(2026-11-24) |
| 2026-11-25 | [편의시설 DTO 선언 순서(실행하면 바로 죽음)](2026-11-25-dto-declaration-order.md) | 반영(2026-11-25) |

## 2026-11-25 — 반영 결과 요약

**재현** — `c0534f1` 을 빌드해 앱마다 루트 모듈을 불러오니 gateway · admin-service(`StoreDetailFacilityResultDto`) · user-service(`DiscoveryStoreFacilityResultDto`)가 요청서와 같은 `ReferenceError: Cannot access '…' before initialization` 로 죽고 scheduler 만 불러와졌다.

**고침 — 선언 순서 3곳** — 요청서 표 그대로 편의시설 클래스를 쓰는 클래스 위로 옮겼다(모양 · 필드 · 데코레이터는 그대로): `libs/contracts/src/store/dto/store-detail.dto.ts`(`StoreDetailFacilityResultDto` → `StoreDetailResultDto` 위) · `store-mine.dto.ts`(`StoreMineFacilityResultDto` → `StoreMineResultDto` 위) · `libs/contracts/src/discovery/dto/discovery-store-detail.dto.ts`(`DiscoveryStoreFacilityResultDto` → `DiscoveryStoreDetailResultDto` 위).

**다시 찾기** — TypeScript 구문 트리로 `apps/` · `libs/` 의 모든 `.ts` 를 훑었다: 데코레이터가 붙은 필드 · 매개변수 · 반환 타입(`X` · `X | null` — 배열은 `Array` 라 제외)이 같은 파일 아래의 클래스인 곳. 고치기 전 정확히 위 3곳, 고친 뒤 0곳. 이번에 새로 만든 AI 대화 DTO(`libs/contracts/src/chat/dto/*`)는 처음부터 위에서 아래 순서라 걸리지 않는다.

**재발 막기**
- 규약 한 줄 — `docs/conventions.md` DTO 파일 절 · `AGENTS.md` DTO 줄 · 체크리스트: "중첩 결과 DTO 는 그것을 쓰는 클래스보다 위에 선언(ESM + 데코레이터 메타데이터 — 단일 필드 `x: X` · `x: X | null` 이 걸린다)".
- 빌드 산출물 불러오기 — `scripts/check-build-load.mjs`(`npm run build:check`): 앱마다 따로 띄운 node 에서 `dist/apps/<앱>/apps/<앱>/src/<앱>.module.js` 를 import 만 한다(서버 · DB · 브로커 · Redis 연결 없음). `npm run build` 가 네 앱을 빌드한 뒤 이어서 돌린다.
- 이미지 빌드 — `Dockerfile` 빌드 단계가 `nest build <APP>` 뒤 그 앱의 루트 모듈을 같은 방식으로 불러와 본다 → 이런 커밋은 **이미지 빌드에서 실패**한다(CrashLoopBackOff 대신). `scripts/` 는 이미지 빌드 문맥에서 제외돼 있어 Dockerfile 에는 한 줄 `node -e` 로 넣었다.
- 이 PC 의 ship 푸쉬 전 확인(beaver 로컬 설정 — git 제외)을 `typecheck` → `typecheck + build` 로 바꿨다.

**요청서와 다른 사실 하나** — "Vitest 는 이 오류를 내지 않았다" 는 맞지 않다. `c0534f1` 에서 `npm test` 를 돌리면 store · discovery spec 파일 29개가 같은 TDZ 오류로 **불러오기부터 실패**한다(Vitest 도 데코레이터 메타데이터를 낸다). 놓친 이유는 `7f9b498` 을 테스트 없이 내보낸 것이다(이 저장소는 테스트를 ship 뒤 따로 돌린다) — 그래서 테스트와 별개인 빌드 · 이미지 단계에 확인을 더했다. 문서 문구도 이 사실대로 적었다.

**그대로 둔 것** — `.beaver/output/frontend/changes/2026-11-24-store-facility.md` 의 DTO 사본(같은 순서) — 프론트용 사본은 Swagger 데코레이터를 뺀 결과 DTO 라 데코레이터 메타데이터가 없어 걸리지 않는다. `.beaver/output/plan|report/store/store-facility-*` — 지난 기록.

**검증** — `npm run typecheck` · `npm run lint` 통과, `npm run build`(네 앱 + `build:check` — 네 앱 모두 불러옴) 통과. `npm test` 는 1473건 중 **15건 실패 — 이 변경과 무관하게 전부터 있던 실패**다: 이 변경을 치운 `c0534f1` 그대로에서도 같은 12건이 실패하고, 나머지 3건(`store-application-approve` · `store-detail` · `store-mine-detail`)은 `c0534f1` 에서는 파일이 불러와지지 않아 숨어 있던 것이다. 대부분 편의시설 커밋이 `t_store.store_detail` 을 더한 뒤 갱신하지 않은 SQL 스냅샷 · 선언 안 된 필드 거절 단언이다. `docker build` 는 돌리지 않았다.

**이어서 고친 것(같은 날, 다음 커밋)** — 15건 모두 테스트 기대값이 코드보다 뒤처진 것이라 기대값을 고쳤다(코드 동작은 그대로): 업체 SELECT 스냅샷 10건에 `store_detail` 컬럼 · 입점 승인은 편의시설을 넣지 않는다(DB 기본값 `'{}'`) · 업체 상세(관리) 응답의 `store_detail` · 선언 안 된 필드는 게이트웨이가 막지 않는다(전역 파이프 whitelist 꺼짐 — service 가 버린다, 객실 그룹 등록 spec 과 같은 기준) 2건 · TypeORM 1.x 가 SET 의 NULL 도 파라미터로 넘긴다 1건. 같은 잘못된 설명("선언 안 된 항목 · 필드는 400")을 `StoreMineDetailDto` 주석과 프론트 요청서 2개(`2026-11-24-store-facility.md` · `2026-11-24-inquiry.md`)에서 바로잡았다. `npm test` 1473건 모두 통과.

## 2026-11-24 — 반영 결과 요약

**고침 — `.env.example`** — 절 13개(공통 · gateway · user-service · admin-service · scheduler · PostgreSQL · RabbitMQ · Redis(문 정보) · 로그인 · 암호화 · AWS 공통 · SMS · 파일 저장 · 결제(토스페이먼츠)), 머리 3줄 · 주석은 키 묶음당 한 줄. 131줄 → 105줄. 요청서 제안에서 두 곳을 다듬었다(요청서 3절이 허용):
- `INTERNAL_HTTP_TIMEOUT_MS` — 공통이 아니라 **gateway 절**(읽는 앱이 gateway 뿐 — `apps/gateway/src/modules/transport/internal-http.client.ts:57`), `COMMAND_STREAM_TIMEOUT_MS` 와 한 줄 주석.
- `GATEWAY_PUBLIC_URL` — gateway 절에 두되 주석에 "user-service · admin-service 도 쓴다"(파일 · 사진 주소를 만드는 쪽 — `libs/integration`).

**옮김 — 줄인 설명** — [docs/architecture.md](../docs/architecture.md) "설정" 에 `.env.example` 절 순서의 **키 묶음별 뜻 표**(뜻 · 비면 · 주의 · 읽는 앱 · 가이드)와 `.env.example` 모양 규칙(앱 · 기능 단위 절 · 한 줄 주석 · 새 키는 절 + 표에 한 줄)을 더했다. 지운 주석의 내용(앞단 프록시 단 수 · 위조 주의, 공개 주소 기준, SMS 링크 두 종류 · 비면 동작, 테스트 데이터 내용, AWS 키 · IAM 역할 · 리전, 공용 파일 폴더, 연결 대기 초과 500 · 큐 재시도, 브로커 비밀번호 문자 제한, Redis URL 인코딩 · TLS, 토스 키 종류)은 모두 이 표에 있다. 표를 쓰며 코드 기본값과 맞췄다 — `AWS_REGION` 은 코드 기본값이 없다(키를 넣었는데 비면 SMS · S3 실패 — `libs/integration/src/sms/sns-sms.sender.ts:30`).

**고침 — 가리키는 곳** — `AGENTS.md`("`.env` 하나가 곧 서버 설정" — 뜻은 architecture.md 표, 절 · 주석 규칙) · `README.md`(준비 절) · `docs/integration.md`(새 연동 추가 3단계 — 그 기능 절 + 표에 한 줄).

**검색에 걸리지만 그대로 둔 것** — `README.md:50` · `docs/architecture.md` 표의 "만드는 명령은 `.env.example` 주석"(`TOKEN_CIPHER_KEY` 명령 한 줄은 남겼다) · `docs/guides/redis-setup.md:9` "`.env.example` 의 Redis 절"(절 이름 그대로) · `docs/guides/sample-data.md` 제목 "테스트 데이터(샘플 시드)" · `integration.util.ts:124` "게이트웨이 공개 주소"(절 이름이 아니라 일반 표현) · Claude 메모리 `.env` 규칙(일반 표현).

**검증** — 키 · 값 목록이 전과 같다(요청서 5절 명령 — 45개, 차이 없음). 코드는 바뀌지 않아 테스트 · 빌드는 돌리지 않았다.

## 2026-11-23 — 반영 결과 요약

**지움** — `compose.*.yml` 9개(앱 4 · 인프라 3 · 공용 네트워크 · 모니터링) · `docker/`(nginx · rabbitmq `init.sh` · prometheus · grafana) · `scripts/docker-network.mjs` · `docs/guides/monitoring-integration.md` · `package.json` 의 `docker:*` 17개 · `.dockerignore` 의 `compose.*.yml` · `docker` 줄 · `.env.example` 키 17개(`*_REPLICAS` 4 · `POSTGRES_*` 4 · `RABBITMQ_MANAGEMENT_PORT` · `REDIS_PASSWORD` · `REDIS_PORT` · `GRAFANA_*` 3 · `MONITORING_DATABASE_URL` · `PROMETHEUS_*` 2). 원본은 커밋 `3125886`.

**더함 — 헬스 체크** — `libs/monitoring` 의 지표 서버에 `/health/live` · `/health/ready`(경로 상수 `monitoring.constants.ts`, 판단 `metrics.server.ts`). ready 는 HTTP 앱이면 `HttpAdapterHost.listening`, scheduler 는 지표 서버가 응답하면, 둘 다 종료 시작(onModuleDestroy) 뒤 503. 빌드 산출물로 작은 Nest 앱을 메모리에서 띄워 12개 경우(본 포트 열기 전 · 뒤 · 종료 시작 뒤 · `/metrics` · 없는 경로 · POST · 쿼리, scheduler 모양 3개)가 계약대로 답하는 것을 확인했다. 실제 앱을 띄운 확인은 사용자 몫.

**고침**
- 코드 주석: `trust-proxy.config.ts` · `cors.config.ts` · `apps/*/main.ts`(gateway · user-service · admin-service) · `local-file.server.ts` · `migrate.ts` · `user-leave-cleanup.crontab.ts` · `integration.constants.ts`(파일 폴더 · 업로드 한도의 짝 = Ingress) · `local-storage.gateway.ts` · `messaging.constants.ts` · `monitoring.constants.ts` · `monitoring.module.ts` · `Dockerfile` · `scripts/check-broker-acl.mjs`(실행 전제 · 실패 안내)
- `.env.example`: 머리 설명 · 키 주석을 deskless 기준으로, 로컬 기본 접속 주소를 `localhost`(DB 5432 · RabbitMQ 5672 · Redis 6379 — deskless 로컬 클러스터가 PC 에 여는 자리)로
- 문서: `AGENTS.md`(주의사항 · `changes/` 규칙 · 구조 트리 · 마이그레이션 · 내부 HTTP 바인딩 · 브로커 권한 · scheduler · 소켓 · 모니터링 절 · Key Patterns 배포 · `.env` · 체크리스트) · `README.md`(실행 · 명령 · 구조 · `changes/` 절) · `docs/architecture.md`("실행 (Docker)" → "실행 · 배포" — 앱이 배포에 기대하는 값 표) · `docs/monitoring.md`(앱 쪽 규칙 · 지표 목록 · 헬스 체크만) · `docs/realtime.md` · `docs/messaging.md` · `docs/data-layer.md` · `docs/integration.md` · `docs/error-handling.md` · `docs/guides/redis-setup.md` · `aws-setup.md` · `sample-data.md` · `toss-setup.md`
- 작업 세션 Claude 메모리: 데이터 관리 도구 규칙(모니터링 예외 → deskless) · 배포 안내 미루기 예시 · `.env` 규칙의 검증 예시

**검색에 걸리지만 그대로 둔 것**
- `Dockerfile` · `.dockerignore` — 이미지는 이 저장소가 만든다(남기는 것)
- `9464` — 로컬 gateway 지표 포트 기본값 · 쿠버네티스 지표 포트(deskless 차트가 같은 값을 넣는다)
- 수집하는 쪽을 가리키기만 하는 설명 — `libs/monitoring/src/metrics.service.ts:22` · `monitoring.util.ts:8` · `:21` · `libs/database/src/job-lock/job-lock.service.ts:41`(수집은 계속된다 — 위치만 deskless)
- `.beaver/output/` 의 지난 기획 · 보고 · 프론트 인계 기록, `.beaver/memory/_archived/db.md`(보관된 옛 규칙), Claude 메모리의 예시 커밋 줄 — 기록

**검증** — `npm test`(1376 통과) · `npm run typecheck` · `npm run build` · `npm run lint` 통과. `docker build` 는 돌리지 않았다(Dockerfile 은 주석만, `.dockerignore` 는 없어진 파일 줄만 바뀜).

**deskless 가 맞출 것** — 앱이 배포에 기대하는 값(컨테이너 포트 · 바인딩 0.0.0.0 · 서비스 주소 · 인스턴스 ID 비움 · `TRUST_PROXY` · 공용 파일 볼륨 `/app/storage/files` · Ingress 본문 한도 10MB · SSE 버퍼링 끔 · `/ws/` 업그레이드 · 읽기 대기 120초 · 마이그레이션 명령 · 프로브 · 브로커 계정 · 권한 · `TZ`)은 [docs/architecture.md](../docs/architecture.md) "실행 · 배포" 표. 로컬 클러스터는 PostgreSQL · RabbitMQ · Redis 를 PC 의 `localhost` 5432 · 5672 · 6379 에 열고, 계정 · 비밀번호는 `.env.example` 기본값과 맞춘다.

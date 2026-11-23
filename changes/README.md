# deskless 수정 요청

[deskless](https://github.com/HaSungJe/deskless) 저장소(백엔드 · 프론트를 쿠버네티스로 엮는 저장소)가 이 저장소에 보낸 수정 요청을 받는 곳이다 — 프론트가 백엔드 요청을 `frontend/changes/` 에 받는 것과 같은 방식(사용자 결정 2026-11-23, AGENTS.md 주의사항).

- 받은 요청서는 이 폴더에 `<YYYY-MM-DD>-<기능>.md` 로 두고(다른 자리에 받았으면 반영 뒤 옮긴다) 위에서부터 차례로 반영한다.
- **반영 = 요청서 본문 + 영향 전수 확인** — 지우는 것 · 더하는 것 · 고치는 것을 하고, 요청서의 검색어로 저장소 전체를 훑어 그 변경으로 사실이 바뀌는 코드 · 주석 · 문서 · 규약 · 메모리를 모두 고친다(남긴 줄은 이유를 적는다). `npm test` · `npm run typecheck` · `npm run build` · `npm run lint` 통과까지.
- 반영하면 아래 목록에 상태를 적고 결과 요약을 남긴다 — deskless 쪽 요청서 상태는 deskless 가 이 요약을 보고 고친다(이 저장소에서 deskless 파일을 고치지 않는다).
- 반영한 요청서는 지우지 않고 기록으로 남긴다.

## 목록

| 날짜 | 요청 | 상태 |
|---|---|---|
| 2026-11-23 | [Docker 운영 구성 정리 · 모니터링 이전 · 헬스 체크](2026-11-23-k8s-cleanup.md) | 반영(2026-11-23) |

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

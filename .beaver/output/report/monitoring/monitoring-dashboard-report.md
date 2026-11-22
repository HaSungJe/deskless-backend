# Report — monitoring-dashboard

## Feature Summary
- **Feature**: 서버 부하 대시보드 — 시간대별 부하로 인스턴스 증설 판단
- **Entry point**: `GET /metrics (앱마다 지표 전용 포트 — 모니터링 내부망)` · `CMD npm run docker:monitoring` · Grafana 대시보드 2개
- **Domain**: monitoring (로드맵 해당 없음)
- **Plan**: [monitoring-dashboard-plan.md](../../plan/monitoring/monitoring-dashboard-plan.md)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `package.json` · `package-lock.json` | modified | `prom-client@^15.1.3` · 스크립트 `docker:monitoring` · `docker:logs:monitoring` |
| `tsconfig.json` | modified | 경로 `@app/monitoring/*` |
| `libs/monitoring/src/monitoring.constants.ts` · `monitoring.util.ts` | created | 옵션 토큰 · 경로 · 응답 시간 구간 · `UNMATCHED` · `toRouteLabel`(경로 틀) · `toMonitoringOptions`(`readPositiveInt` 재사용) |
| `libs/monitoring/src/metrics.service.ts` | created | 레지스트리(`service` 기본 라벨) · prom-client 기본 지표 · `nodejs_eventloop_time_seconds{state}` · `gauge()` · `histogram()` |
| `libs/monitoring/src/metrics.server.ts` | created | 지표 전용 HTTP 서버(`GET /metrics` 하나, 못 열면 경고만) — 부팅 뒤 열고 종료 때 닫음 |
| `libs/monitoring/src/http-metrics.middleware.ts` · `monitoring.module.ts` | created | HTTP 요청 시간 · 처리 중 수(finish · close 중 먼저 한 번), `MonitoringModule.forRoot`(전역 — http 앱만 미들웨어) |
| `libs/messaging/src/command.dispatcher.ts` | modified | 판정 본문을 `private decide` 로 옮기고 `dispatch` 가 시간 · 결과를 잰다 — `messaging_command_duration_seconds{type, outcome}` |
| `libs/database/src/job-lock/job-lock.service.ts` | modified | `scheduler_job_duration_seconds{task, result}` — done · failed · skipped |
| `libs/database/src/database-pool.metrics.ts` · `database.module.ts` | created · modified | `db_client_connections{state}` — pg 풀 total · idle · waiting(긁을 때 읽음) |
| `apps/gateway/src/modules/transport/command-stream.service.ts` | modified | `gateway_command_streams_pending` |
| `apps/{gateway,user-service,admin-service,scheduler}/src/*.module.ts` | modified | `MonitoringModule.forRoot(toMonitoringOptions(…))` — 기본 포트 9464 · 9465 · 9466 · 9467, scheduler 는 `http: false` |
| `scripts/docker-network.mjs` | modified | 네트워크 `deskless-monitoring`(internal) |
| `compose.{gateway,user-service,admin-service,scheduler}.yml` | modified | 앱 인스턴스를 모니터링 내부망에, `<APP>_METRICS_PORT: 9464` · `METRICS_HOST: 0.0.0.0`, 모니터링 비밀값 빈 값 |
| `compose.rabbitmq.yml` | modified | rabbitmq 를 모니터링 내부망에(이미지에 든 Prometheus 플러그인 15692) |
| `compose.monitoring.yml` | created | Prometheus v3.16.0 · Grafana 13.2.6 · postgres-exporter v0.20.1 · redis_exporter v1.97.0-alpine, 127.0.0.1 포트만 |
| `docker/prometheus/prometheus.yml` · `rules.yml` | created | 앱 5개(gateway · user-service · admin-service · scheduler · web) DNS 찾기 · RabbitMQ(큐별 detailed + 전체) · 수집기, 기록 규칙 7개 |
| `docker/grafana/provisioning/{datasources,dashboards}/*.yml` | created | 데이터 원본 uid `deskless-prometheus` · Deskless 폴더 |
| `docker/grafana/dashboards/deskless-service-load.json` · `deskless-infra.json` | created | 서비스 부하 28 패널(서비스 목록은 `label_values` — 붙은 서비스가 저절로) · 인프라 22 패널 |
| `.env.example` · `README.md` | modified | 지표 포트 · `METRICS_HOST` · Grafana · `MONITORING_DATABASE_URL` · 포트 · 보존, 실행 표 · 명령 · 구조 · 설명 |
| `docs/monitoring.md` | created | 모니터링 규약(초안 표시 — ship 때 확정): 흐름 · 규칙 · 지표 목록 · 기록 규칙 · 대시보드 · 증설 기준 · 실행 · 쿠버네티스 이행 |
| `docs/guides/monitoring-integration.md` | created | 다른 프로젝트 연결 규격(사용자 요청) — 붙는 조건 · 필수 · 선택 지표 · 라벨 규칙 · Node 예시 · 확인 · 백엔드 할 일 · 요청 문서 틀 |
| `AGENTS.md` · `docs/architecture.md` | modified | "모니터링" 절 · 체크리스트 · libs/monitoring · docker/ · scheduler 예외 · 묶음 설명 |
| `.beaver/output/frontend/changes/2026-11-22-monitoring-web.md` · `changes/README.md` | created · modified | 프론트 요청 — Next.js 서버 지표(규격의 첫 적용, 서비스 이름 `web`) |

## Tests Written
없음 — 지표 모듈 · 계측은 라이브러리 · 인프라라 spec 을 두지 않는 규약(spec 결과 표에 ✓ 없음). 부품은 `MetricsService` 를 `@Optional()` 로 받아 기존 spec 이 그대로 돈다.

## Verification
- `npm run typecheck` 0 · `npm run lint` 0 · `npm run db:check` 일치 · `npm test` 124 파일 1,376건(기존 그대로 — 디스패처 리팩터링 포함) · `npm run build`(네 앱) · 바뀐 `.ts` prettier.
- 지표 출력 확인(일회용 spec 으로 레지스트리를 만들어 출력 — 지운 뒤): `service="user-service"` 기본 라벨, `nodejs_eventloop_time_seconds{state="active"|"idle"}`(collect 의 `this` 동작), `http_server_request_duration_seconds_count{…route="/…/:reservation_id"…}`, `db_client_connections{state="total"}`, `toRouteLabel` 틀 없음 → `UNMATCHED`, 잘못된 포트 env → 기본 포트.
- `docker compose -f compose.<묶음>.yml config -q` 8개 OK(monitoring 은 필수 env 를 셸 값으로 넣어 확인), user-service 인스턴스 네트워크 `broker · data · monitoring · service` · 지표 env · 모니터링 비밀값 빈 값 확인.
- Prometheus · Grafana YAML 4개 파싱 OK(수집 대상 9개 · 기록 규칙 7개), 대시보드 JSON 2개 — 데이터 원본 uid 전부 `deskless-prometheus` · 패널 ID 겹침 없음 · 폭 24 넘는 패널 없음.
- RabbitMQ 공식 이미지가 `rabbitmq_prometheus` 를 기본으로 켠다(docker-library/rabbitmq 4.2 Dockerfile 307-308행 — issue #419).

## Plan 과 달라진 점
- 큐 명령 지표 라벨 `type · action · outcome` → **`type · outcome`**(done · failed · retry · invalid) — 회신 결과(`result`)는 `reply_to` 가 없으면 성공이어도 null 이라 결과를 판정에서 직접 받는다. 형식 오류 · 핸들러 없음은 `type="UNKNOWN"`(라벨이 끝없이 늘지 않게).
- crontab 지표 라벨 `job` → **`task`** — `job` 은 Prometheus 가 붙이는 수집 대상 이름이라 부딪히면 `exported_job` 으로 바뀐다(규약 문서에 "`job` · `instance` 라벨 ❌" 로 적었다).
- 프론트 예시 코드의 포트 env 는 규격 문서의 일반형 `METRICS_PORT`(다른 저장소라 앱 이름 접두가 필요 없다).

## Remaining Issues
- **실제 실행 확인은 사용자 몫** — Docker 로 띄워 Grafana 대시보드 · Prometheus Targets · `--scale` 따라감을 본다(배포 순서는 plan 끝).
- Grafana 대시보드 JSON 은 생성 스크립트(scratchpad — 커밋 안 함)로 만든 결과가 원본이다. 고칠 때는 JSON 을 고친다(`docs/monitoring.md`).
- `docs/monitoring.md` 는 초안 표시 — ship 에서 코드와 맞춰 확정한다.

## Change - 261122-1 (공용 네트워크 · 볼륨 선언 한곳 — revision `monitoring-dashboard-revision-261122-1.md`, 사용자 요청 · 이번 작업에 포함)
- 변경 요약: compose 파일 8개가 각자 선언하던 공용 external 네트워크 5개(`edge` · `service` · `broker` · `data` · `monitoring`) · 볼륨(`files`)을 **`compose.shared.yml`** 한곳으로 모았다. 각 묶음은 맨 위 `include: [compose.shared.yml]` 로 불러오고 묶음 전용 선언(DB 데이터 볼륨 · 모니터링 `default`)만 남는다. `scripts/docker-network.mjs` 는 상수(`NETWORKS` · `VOLUMES`) 대신 그 파일을 읽어 만든다(`x-internal` · `x-purpose` 확장 필드 — Node 내장만, 정해진 형식만 읽고 못 읽으면 멈춘다). 새 공용 리소스는 이 파일에만 더한다.
- 바뀐 파일: `compose.shared.yml`(새) · `compose.{postgres,rabbitmq,redis,user-service,admin-service,scheduler,gateway,monitoring}.yml` · `scripts/docker-network.mjs` · `README.md` · `AGENTS.md` · `docs/architecture.md` · `docs/monitoring.md`.
- 확인: 바꾸기 전 · 후 `docker compose -f compose.<묶음>.yml config --format json` 의 네트워크 · 볼륨(이름 · external) · 서비스별 네트워크 · 볼륨이 8개 묶음 모두 같음. `readSharedResources()` 만 따로 돌려(네트워크를 만들지 않고) 네트워크 5개(internal: service · monitoring 만 true) · 볼륨 1개 · 설명 모두 — 지운 상수와 같음, name 이 빠진 파일은 오류로 멈춤. `node --check` · prettier 통과.
- 남은 일: 없음 — Compose 2.20 이상이 필요하다(`include`, 이 PC v2.34). 운영 서버의 Docker Compose 버전을 확인한다.

# Monitoring — 지표 · 대시보드 (Prometheus · Grafana)

서버 부하를 시간대별로 보고 인스턴스 수(`USER_SERVICE_REPLICAS` · `GATEWAY_REPLICAS` · `ADMIN_SERVICE_REPLICAS`)를 정하는 근거를 만드는 규칙(사용자 결정 2026-11-22). 앱 인스턴스마다 지표를 내고, Prometheus 가 Docker DNS 로 인스턴스를 모두 찾아 모으고, Grafana 대시보드에서 서비스별 합계 · 평균 · 인스턴스별로 본다. 구현은 [libs/monitoring](../libs/monitoring/src) · 묶음 [compose.monitoring.yml](../compose.monitoring.yml) · 설정 [docker/prometheus](../docker/prometheus) · [docker/grafana](../docker/grafana).

## 흐름

```
gateway × N ────────┐ :9464/metrics (지표 전용 포트 — 공개 · 내부 API 와 다른 포트)
user-service × N ───┤
admin-service × N ──┤   deskless-monitoring (internal)
scheduler × N ──────┤
web(프론트) × N ─────┤   ← 다른 프로젝트도 같은 규격으로 붙는다(docs/guides/monitoring-integration.md)
rabbitmq :15692 ────┤
postgres-exporter ──┤
redis-exporter ─────┘
        │ 15초마다 — 서비스 이름을 DNS 로 풀어 인스턴스를 모두 긁는다(--scale 을 저절로 따라감)
        ▼
   Prometheus (기록 규칙 — 서비스별 부하율 · 요청률 · 응답 시간, 30일 보관)
        │
        ▼
   Grafana http://localhost:3001 — Deskless 폴더: 서비스 부하 · 인프라
```

## 규칙

- **지표는 앱마다 전용 포트** — `MonitoringModule.forRoot(toMonitoringOptions(<서비스 이름>, process.env.<APP>_METRICS_PORT, <기본 포트>, <http>))` 를 앱 루트 모듈이 한 번 들인다(전역). 지표 서버(`MetricsServer`)는 `/metrics` 하나만 여는 별도 HTTP 서버라 공개 API · 내부 토큰(`InternalAuthGuard`) 규칙과 섞이지 않고, gateway 공개 주소에 지표가 노출되지 않는다. 포트를 못 열면 경고 로그만 남기고 앱은 그대로 돈다.
  - 포트: 로컬은 앱마다 다르다(gateway 9464 · user-service 9465 · admin-service 9466 · scheduler 9467 — 한 PC 에서 네 앱이 겹치지 않게), Docker 는 compose 가 9464 로 고정. 바인딩 `METRICS_HOST`(기본 127.0.0.1, compose 0.0.0.0 — 모니터링 내부망만 닿는다).
  - scheduler 는 지표 포트 하나만 연다 — "들어오는 연결 없음" 의 유일한 예외(API · 큐 소비는 여전히 없다, 사용자 결정 2026-11-22).
- **지표 정의는 그 지표를 내는 부품 안에** — `MetricsService.gauge()` · `.histogram()` 으로 만들고, 부품은 `MetricsService` 를 `@Optional()` 로 받는다(모듈이 없으면 — 테스트 · 마이그레이션 실행기 — 아무것도 하지 않는다). 지표 목록은 아래 표 한 곳에 모은다.
- **라벨에는 개수가 정해진 값만** — 라우트 틀(`/reservation/:reservation_id` — `toRouteLabel`, 틀이 없으면 `UNMATCHED`) · 명령 type · crontab 잠금 키 · 상태 코드처럼. ID · 주소 · 사용자 입력은 라벨에 넣지 않는다(값마다 시계열이 생겨 Prometheus 가 터진다).
- **`job` · `instance` 라벨은 쓰지 않는다** — Prometheus 가 붙이는 수집 대상 이름 · 주소라 앱 라벨과 부딪히면 `exported_job` 으로 바뀐다(crontab 은 `task`). 앱 라벨은 `service`(= 서비스 이름, 모든 지표에 기본으로 붙는다).
- **`display_name` 은 Prometheus 가 붙인다**(`prometheus.yml` 앱 job 의 `relabel_configs`) — 대시보드 표시용 한국어 이름. 앱은 이 라벨을 내지 않는다(`job` · `instance` 와 같은 취급).
- **비율은 앱이 누적값을 내고 Prometheus 가 계산한다** — 부하율은 앱이 이벤트 루프 누적 시간(`nodejs_eventloop_time_seconds{state}`)을 내고 기록 규칙이 `rate` 로 나눈다(긁는 쪽이 여럿이어도 맞고, 쿠버네티스 HPA 가 같은 이름을 쓴다).
- **이름 · 단위** — Prometheus 규칙(`snake_case`, 단위 접미사 `_seconds` · `_bytes`, 누적은 `_total`), 표준이 있으면 표준 이름(prom-client 기본 지표 · `http_server_request_duration_seconds`).
- **새 지표를 더할 때** — 부품 안에서 만들고 → 아래 지표 목록에 한 줄 → 필요하면 기록 규칙(`docker/prometheus/rules.yml`)과 대시보드 JSON(`docker/grafana/dashboards/`)에 패널. 대시보드 JSON 은 파일이 원본이다(Grafana 화면에서 고친 것은 저장되지 않는다).
- **모니터링 묶음은 compose 하나** — `compose.monitoring.yml`(Prometheus · Grafana · PostgreSQL · Redis 수집기). 관리 도구를 compose 에 넣지 않는 규칙의 예외(지표를 계속 모으는 수집기 — 사용자 결정 2026-11-22). `docker:up` 은 gateway 다음 맨 끝에 띄우고 `docker:down` 은 맨 먼저 내린다(사용자 결정 2026-11-23) — 모니터링 필수값이 비면 `docker:up` 이 이 단계에서 멈춘다(앞의 묶음은 이미 떠 있다). 따로는 `npm run docker:monitoring`.

## 지표 목록

모든 앱 지표에 `service` 라벨(서비스 이름)이 붙는다. Prometheus 가 `job`(서비스 이름) · `instance`(인스턴스 주소)를 더한다.

| 지표 | 종류 | 라벨 | 내는 곳 | 뜻 |
|---|---|---|---|---|
| `process_cpu_seconds_total` · `process_resident_memory_bytes` · `nodejs_eventloop_lag_p99_seconds` · `nodejs_heap_*` · `nodejs_gc_*` … | prom-client 기본 | — | 모든 앱(`MetricsService`) | CPU · 메모리 · 이벤트 루프 지연 · GC |
| `nodejs_eventloop_time_seconds` | gauge(누적) | `state` = active · idle | 모든 앱(`MetricsService`) | 이벤트 루프가 일한 · 쉰 누적 시간 — 부하율의 원천 |
| `http_server_request_duration_seconds` | histogram | `method` · `route` · `status_code` | gateway · user-service · admin-service(`HttpMetricsMiddleware`) | HTTP 요청 처리 시간 — `_count` 가 요청 수 |
| `http_server_active_requests` | gauge | — | 〃 | 처리 중인 HTTP 요청 |
| `messaging_command_duration_seconds` | histogram | `type` · `outcome` = done · failed · retry · invalid | user-service · admin-service(`CommandDispatcher`) | 큐 명령 1건 처리 시간 · 결과 |
| `scheduler_job_duration_seconds` | histogram | `task`(잠금 키) · `result` = done · failed · skipped | scheduler(`JobLockService`) | crontab 회차 — skipped 는 다른 인스턴스가 잡음 |
| `db_client_connections` | gauge | `state` = total · idle · waiting | DB 를 쓰는 앱(`DatabasePoolMetrics`) | 커넥션 풀 — waiting 이 생기면 풀이 찼다 |
| `gateway_command_streams_pending` | gauge | — | gateway(`CommandStreamService`) | 큐 명령 결과를 기다리는 SSE 스트림 |
| `rabbitmq_detailed_queue_messages_ready` · `_unacked` · `_consumers` | (RabbitMQ 플러그인) | `queue` | rabbitmq :15692 | 큐 적체 · 처리 중 · 소비자 |
| `pg_*` · `redis_*` | (수집기) | — | postgres-exporter · redis-exporter | 연결 · 커밋 · 캐시 · 메모리 · 명령 · AOF |

## 기록 규칙 — `docker/prometheus/rules.yml`

| 이름 | 뜻 |
|---|---|
| `instance:eventloop_utilization:ratio` | 인스턴스 부하율(0 ~ 1) |
| `job:eventloop_utilization:avg` | 서비스 평균 부하율 — HPA 기준 |
| `job:eventloop_utilization:avg15m` | 서비스 평균 부하율의 15분 평균 — **증설 판정 기준**(판정 표 · 시간대별 부하 · 7일 칸) |
| `job:http_requests:rate1m` · `job:http_request_duration_seconds:p95` · `job:http_errors:ratio` | 서비스 초당 요청 · 95% 응답 시간 · 5xx 비율 |

서비스 집계는 `by (job, display_name)` — `display_name` 은 `prometheus.yml` 이 앱 job 마다 붙이는 한국어 표시 이름이다.

## 대시보드 · 증설 판단

Grafana 화면은 한국어(`GF_USERS_DEFAULT_LANGUAGE=ko-KR`), 홈은 "서비스 부하". 모든 패널에 설명(ⓘ — 무엇 · 어떻게 읽나 · 언제 걱정하나)이 있다.

- **서비스 부하**(`deskless-service-load`) — "인스턴스를 늘려야 하나?"
  - 맨 위 **판정 표**: 서비스 · 대수 · 지금(5분) · 24시간 최고 · 7일 중 70% 넘은 날 · 판정(여유 · 지켜보기 · 1대 늘리기), 오른쪽에 읽는 법.
  - 시간대별 부하율(서비스별 15분 평균 · 70% 빨간 점선) · 최근 7일 × 시간대 칸(1시간 한 칸 — 초록 50% 미만 · 노랑 50 ~ 70% · 빨강 70% 이상).
  - 접힌 행 **"늘리기 전에 확인"**: 초당 요청 · 95% 응답 시간 · 서버 오류 비율 · 밀린 작업 · DB 연결 기다리는 요청 · 인스턴스별 부하율 · CPU · 메모리.
  - 서비스 목록은 Prometheus 에서 읽는다(`label_values(nodejs_eventloop_time_seconds, job)`) — 붙은 서비스가 저절로 나온다. 스케줄러는 판정 표 · 부하 그래프 · 7일 칸에 없다(늘려도 회차마다 1대만 실행 — JobLockService).
- **인프라**(`deskless-infra`) — "DB · Redis · 큐는 괜찮나?" 맨 위 상태 카드 6개(실패한 작업 · 밀린 작업 · DB 연결 사용률 · Redis 메모리 · Redis 저장 · 예약 작업 실패 — 0 은 "없음") → 큐(서버별 밀린 작업) · DB(연결 상태별 + 최대의 80% · 초당 커밋 · 롤백 · 서버별 연결) · Redis(메모리 · 연결 · 명령) · 예약 작업(작업별 최근 24시간 성공 · 실패 표).
- **이름** — 서비스는 Prometheus 가 붙이는 `display_name`(게이트웨이 · 이용자 서버 · 관리자 서버 · 스케줄러 · 프론트), 큐 · 작업 · DB 연결 상태는 대시보드 쿼리의 `label_replace`(모르는 값은 원래 이름). 게이트웨이 응답 큐(`q.gw.result.*`)는 바로 비워지므로 넣지 않는다.
- **증설 판단 기준**(판정 표와 같다)
  - **부하율 = 이벤트 루프 사용률** — Node 는 인스턴스 하나가 주로 코어 하나를 쓴다. 100% 면 그 인스턴스는 더 받을 수 없다.
  - 하루마다 **15분 평균 부하율의 최고**를 본다(1 ~ 2분 튀는 값은 세지 않는다). 최근 7일 중 70% 이상인 날이 **3일 이상이면 1대 늘린다**, 1 ~ 2일은 지켜보기, 0일은 여유. 하루는 Prometheus 가 UTC 0시로 끊어 한국 시각 오전 9시 ~ 다음 날 오전 9시다(밤 피크가 하루 안에 들어간다).
  - 늘리기 전에 — 인스턴스별 부하율이 고르지 않으면 분배(nginx)부터, DB 연결 대기가 있으면 풀 · DB 최대 연결부터(늘리면 DB 연결이 더 모자란다). 같은 서버 안에서는 **CPU 코어 수까지만** 효과가 있다.

## 실행

1. `.env` — `GRAFANA_ADMIN_PASSWORD` · `MONITORING_DATABASE_URL`(필수 — 앱 `DATABASE_URL` 의 `?schema=public` 을 수집기가 읽지 못해 따로, 운영은 `pg_monitor` 역할의 읽기 전용 계정 권장), 선택 `GRAFANA_ADMIN_USER` · `GRAFANA_PORT`(3001) · `PROMETHEUS_PORT`(9090) · `PROMETHEUS_RETENTION`(30d). `REDIS_URL` 은 앱과 같은 값.
2. `npm run docker:network`(내부망 `deskless-monitoring` — 선언은 `compose.shared.yml`) → 앱 묶음 · RabbitMQ 를 한 번 다시 띄운다(내부망에 붙는다) → `npm run docker:monitoring`(`npm run docker:up` 이면 마지막에 함께 뜬다).
3. Grafana `http://localhost:3001` → Deskless 폴더. Prometheus `http://localhost:9090/targets` 에서 수집 대상이 UP 인지 본다.
- 내리기: `docker compose -f compose.monitoring.yml down` 또는 `npm run docker:down`(데이터는 볼륨 `deskless-prometheus-data` · `deskless-grafana-data` 에 남는다). 로그: `npm run docker:logs:monitoring`.
- 운영 서버에서는 127.0.0.1 포트만 열려 있어 SSH 터널로 본다(`ssh -L 3001:127.0.0.1:3001 <서버>`).
- 실제 운영(RDS · ElastiCache)은 `.env` 의 `MONITORING_DATABASE_URL` · `REDIS_URL` 만 바꾼다 — compose 는 그대로.

## 다른 프로젝트 붙이기

별도 저장소의 서비스(프론트 Next.js 등)는 [docs/guides/monitoring-integration.md](guides/monitoring-integration.md) 를 그 저장소에 넘긴다. 백엔드가 할 일은 `docker/prometheus/prometheus.yml` 에 수집 대상 한 줄뿐이다(대시보드 서비스 목록은 Prometheus 에서 읽는다). 첫 적용: 프론트 `web`(`.beaver/output/frontend/changes/2026-11-22-monitoring-web.md`).

## 쿠버네티스로 옮길 때

- 앱 코드 · 지표 이름 · 기록 규칙은 그대로다. 찾는 방식만 바뀐다 — Docker DNS(`dns_sd_configs`) → ServiceMonitor/PodMonitor(kube-prometheus-stack), 지표 포트 9464 를 Service 포트로.
- 자동 증설(HPA)은 prometheus-adapter 로 `job:eventloop_utilization:avg`(또는 인스턴스 부하율)을 기준으로 쓸 수 있다 — 지금 사람이 보는 70% 기준이 그대로 HPA 목표값이 된다.
- 컨테이너 · 파드 CPU · 메모리 · 재시작 · 노드 지표는 쿠버네티스가 기본으로 준다(kubelet cAdvisor · kube-state-metrics) — 그래서 이번에 컨테이너 · 호스트 수집기를 두지 않았다.

## 테스트

지표 모듈 · 계측은 라이브러리 · 인프라라 spec 을 두지 않는다(testing.md). 부품은 `MetricsService` 를 `@Optional()` 로 받아 기존 spec 이 모듈 없이 그대로 돈다. compose 형식은 `docker compose -f compose.monitoring.yml config`, 대시보드는 JSON 읽기로 확인한다.

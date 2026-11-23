# Monitoring — 앱 지표 · 헬스 체크

앱 인스턴스마다 지표(`/metrics`)와 헬스 체크(`/health/live` · `/health/ready`)를 전용 포트로 내는 규칙(사용자 결정 2026-11-22 · 2026-11-23). 구현은 [libs/monitoring](../libs/monitoring/src).

**지표를 모으고 보는 쪽은 deskless 저장소(쿠버네티스)** 다 — Prometheus 수집 대상 · 기록 규칙(부하율 · 요청률 · 응답 시간) · Grafana 대시보드 · 증설 판정 기준 · DB · Redis · RabbitMQ 수집기 · 다른 프로젝트(프론트 등)를 수집에 붙이는 규격이 모두 거기 있다(백엔드에서 옮겨 간 원본은 커밋 `3125886` — 사용자 결정 2026-11-23). 이 문서는 앱이 내는 쪽만 다룬다.

```
gateway × N ────────┐  지표 · 헬스 체크 전용 포트(공개 · 내부 API 와 다른 포트)
user-service × N ───┤    GET /metrics        ← deskless 의 Prometheus 가 긁는다
admin-service × N ──┤    GET /health/live    ← 쿠버네티스 liveness 프로브
scheduler × N ──────┘    GET /health/ready   ← 쿠버네티스 readiness 프로브
```

## 규칙

- **지표 · 헬스 체크는 앱마다 전용 포트** — `MonitoringModule.forRoot(toMonitoringOptions(<서비스 이름>, process.env.<APP>_METRICS_PORT, <기본 포트>, <http>))` 를 앱 루트 모듈이 한 번 들인다(전역). 지표 · 헬스 체크 서버(`MetricsServer`)는 `/metrics` · `/health/live` · `/health/ready` 만 여는 별도 HTTP 서버라 공개 API · 내부 토큰(`InternalAuthGuard`) · API 로그 · HTTP 지표 규칙과 섞이지 않고, gateway 공개 주소에 노출되지 않는다. 포트를 못 열면 경고 로그만 남기고 앱은 그대로 돈다(쿠버네티스에서는 프로브가 실패해 파드가 다시 뜬다).
  - 포트: 로컬은 앱마다 다르다(gateway 9464 · user-service 9465 · admin-service 9466 · scheduler 9467 — 한 PC 에서 네 앱이 겹치지 않게), 쿠버네티스는 deskless 차트가 9464 로 넣는다. 바인딩 `METRICS_HOST`(기본 127.0.0.1, 파드는 deskless 차트가 0.0.0.0 — 프로브 · 지표 수집만 닿는다).
  - scheduler 는 이 포트 하나만 연다 — "들어오는 연결 없음" 의 유일한 예외(API · 큐 소비는 여전히 없다, 사용자 결정 2026-11-22).
- **지표 정의는 그 지표를 내는 부품 안에** — `MetricsService.gauge()` · `.histogram()` 으로 만들고, 부품은 `MetricsService` 를 `@Optional()` 로 받는다(모듈이 없으면 — 테스트 · 마이그레이션 실행기 — 아무것도 하지 않는다). 지표 목록은 아래 표 한 곳에 모은다.
- **라벨에는 개수가 정해진 값만** — 라우트 틀(`/reservation/:reservation_id` — `toRouteLabel`, 틀이 없으면 `UNMATCHED`) · 명령 type · crontab 잠금 키 · 상태 코드처럼. ID · 주소 · 사용자 입력은 라벨에 넣지 않는다(값마다 시계열이 생겨 Prometheus 가 터진다).
- **`job` · `instance` · `display_name` 라벨은 앱이 쓰지 않는다** — 수집하는 쪽(deskless 의 Prometheus)이 붙이는 수집 대상 이름 · 주소 · 대시보드 표시 이름이라 앱 라벨과 부딪히면 `exported_job` 처럼 바뀐다(crontab 은 `task`). 앱 라벨은 `service`(= 서비스 이름, 모든 지표에 기본으로 붙는다).
- **비율은 앱이 누적값을 내고 수집하는 쪽이 계산한다** — 부하율은 앱이 이벤트 루프 누적 시간(`nodejs_eventloop_time_seconds{state}`)을 내고 deskless 의 기록 규칙이 `rate` 로 나눈다(긁는 쪽이 여럿이어도 맞고, 쿠버네티스 HPA 가 같은 이름을 쓴다).
- **이름 · 단위** — Prometheus 규칙(`snake_case`, 단위 접미사 `_seconds` · `_bytes`, 누적은 `_total`), 표준이 있으면 표준 이름(prom-client 기본 지표 · `http_server_request_duration_seconds`).
- **새 지표를 더할 때** — 부품 안에서 만들고 → 아래 지표 목록에 한 줄. 기록 규칙 · 대시보드 패널이 필요하면 deskless 저장소에서 더한다(이름 · 라벨 · 뜻을 넘긴다).

## 지표 목록

모든 앱 지표에 `service` 라벨(서비스 이름)이 붙는다. 수집하는 쪽이 `job`(서비스 이름) · `instance`(인스턴스 주소) · `display_name`(표시 이름)을 더한다.

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

## 헬스 체크 — 쿠버네티스 프로브 (사용자 결정 2026-11-23)

| 경로 (지표 · 헬스 체크 전용 포트) | 200 | 503 |
|---|---|---|
| `GET /health/live` | 프로세스가 응답하면 항상 | — |
| `GET /health/ready` | 요청을 받을 준비가 됨 — HTTP 앱은 본 포트가 열려 있고(`HttpAdapterHost.listening`), scheduler 는 부팅 훅 단계까지 왔고, 둘 다 종료가 시작되지 않았다 | 부팅 중 · 종료 중 |

- **상태 코드가 계약이다** — 본문은 사람이 볼 때 참고용(`{"status":"ok"}` · `{"status":"not_ready"}`).
- **DB · 브로커 · Redis 는 보지 않는다** — 앱이 "없어도 부팅하고 그 요청만 503" 인 설계라([rabbitmq.connection.ts](../libs/messaging/src/rabbitmq.connection.ts)), 의존 서비스가 잠깐 끊길 때 모든 파드가 한꺼번에 준비 안 됨이 돼 조회 · 로그인까지 막히는 일을 피한다.
- **본 포트가 아니라 전용 포트인 이유** — user-service · admin-service 본 포트는 모든 요청에 내부 토큰을 요구하고(프로브는 비밀값 헤더를 싣기 어렵다), gateway 본 포트는 모든 요청을 API 로그 DB 에 적재한다(프로브가 `t_api_log` 를 채운다).
- **본 포트 확인이 필요한 이유** — HTTP 앱은 `app.listen()` 이 초기화(onApplicationBootstrap — 지표 서버가 이때 열린다)를 먼저 하고 그 뒤에 본 포트를 연다. 그래서 "지표 서버가 응답함 = 준비됨" 이 아니다.
- **종료** — 종료 신호를 받으면 Nest 12 는 onModuleDestroy → beforeApplicationShutdown → 본 포트 닫기 → onApplicationShutdown 순으로 부른다. 준비됨은 가장 먼저(onModuleDestroy) 503 으로 바뀌고, live 는 이 서버가 닫힐 때(onApplicationShutdown)까지 200. 종료 전 대기(preStop) · 종료 유예 시간은 deskless 차트가 맡는다 — 앱 코드에 지연을 넣지 않는다.
- 로컬 확인: 앱을 띄운 뒤 `curl -i http://127.0.0.1:9464/health/ready`(gateway — 포트는 앱마다 위 표).

## 테스트

지표 모듈 · 계측 · 헬스 체크는 라이브러리 · 인프라라 spec 을 두지 않는다(testing.md). 부품은 `MetricsService` 를 `@Optional()` 로 받아 기존 spec 이 모듈 없이 그대로 돈다. `npm run typecheck` · `npm run build` 로 확인하고, 응답은 앱을 띄워 위 `curl` 로 본다.

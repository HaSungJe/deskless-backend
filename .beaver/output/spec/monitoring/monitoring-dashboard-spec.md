---
feature_goal: "서버 부하 대시보드 — 시간대별 부하로 인스턴스 증설 판단"
domain: "monitoring"
roadmap_phase: ""
api_method: "GET"
api_path: "/metrics (앱마다 지표 전용 포트 — 모니터링 내부망)"
affected_data: ["Prometheus 시계열(볼륨 deskless-prometheus-data — 기본 30일)", "Grafana 설정(볼륨 deskless-grafana-data)", "새 Docker 네트워크 deskless-monitoring(internal)"]
---

# 서버 부하 대시보드

## 한눈에

- **무엇을** gateway · user-service · admin-service · scheduler(+ 프론트 Next.js 서버 `web` — 프론트 저장소가 붙으면)의 모든 인스턴스와 PostgreSQL · Redis · RabbitMQ 큐의 지표를 Prometheus 가 모으고, Grafana 대시보드에서 **서비스별 부하율(인스턴스 합계 · 평균 · 인스턴스별)을 시간대별로** 본다.
- **왜** 지금은 `USER_SERVICE_REPLICAS` · `GATEWAY_REPLICAS` 를 몇으로 둘지 근거가 없다. 특정 시간대에 어느 서비스가 얼마나 차는지 보고 인스턴스를 늘리는 기준으로 쓴다.
- **범위 밖** 자동 증설(쿠버네티스 HPA 몫 — 지표 이름 · 라벨은 그대로 넘어가게 만든다), 알림(Alertmanager), 로그(Loki) · 트레이스(Tempo), 컨테이너 · 호스트 지표(cAdvisor · node_exporter — 쿠버네티스로 가면 기본 제공), nginx 지표.

| 진입점 | 한 줄 요약 | 테스트 |
|---|---|---|
| 1. 앱 지표 | 앱 인스턴스마다 지표 전용 포트에서 부하 · 요청 · 큐 명령 · crontab · DB 풀 지표를 낸다 | 0건 |
| 2. 모니터링 묶음 | `npm run docker:monitoring` — Prometheus · Grafana · PostgreSQL · Redis 수집기를 띄우고 인스턴스를 저절로 찾는다 | 0건 |
| 3. 서비스 부하 대시보드 | 서비스별 부하율 · 요청 · 응답 시간 · 큐 적체를 시간대별로, 어제 · 지난주 같은 시각과 비교 | 0건 |
| 4. 인프라 대시보드 | PostgreSQL · Redis · RabbitMQ · crontab 상태 | 0건 |

---

## 1. 앱 지표 — `GET /metrics (지표 전용 포트)`

**동작 흐름**

1. **지표 서버 시작** — 앱이 부팅을 마치면 지표 전용 포트(Docker 안 9464, 로컬은 앱마다 다른 포트)에 `/metrics` 하나만 여는 작은 HTTP 서버를 띄운다.
   - 포트를 열지 못하면 → 경고 로그만 남기고 앱은 그대로 돈다(지표는 앱을 막지 않는다).
2. **요청 재기** — gateway · user-service · admin-service 는 HTTP 요청마다 라우트(경로 틀) · 메서드 · 상태 코드 묶음별 횟수 · 걸린 시간 · 처리 중인 수를 잰다.
3. **큐 명령 재기** — user-service · admin-service 는 큐 명령마다 명령 종류 · 결과(done · failed · requeue · dead)별 횟수 · 걸린 시간을 잰다.
4. **crontab 재기** — scheduler 는 crontab 회차마다 작업 이름 · 결과(실행 · 실패 · 다른 인스턴스가 잡아 건너뜀)별 횟수 · 걸린 시간을 잰다.
5. **긁어 갈 때 계산** — Prometheus 가 부르면 프로세스 CPU · 메모리 · 이벤트 루프 사용률(부하율) · 지연 · DB 커넥션 풀(전체 · 놀고 있는 · 기다리는)을 그 순간 값으로 채워 돌려준다.

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| Prometheus 가 `GET :9464/metrics` | 200 Prometheus 텍스트 형식 — 모든 지표에 `service`(앱 이름) 라벨 | — (인프라 · 라이브러리 — spec 을 두지 않는 규약, build 때 로컬 실행 대신 typecheck · build 로 확인) |
| `/metrics` 말고 다른 경로 | 404 | — (인프라) |
| 공개 gateway 주소(`/api` · `/metrics`) | 지표가 없다 — 지표는 전용 포트에만 | — (경로가 다른 서버) |
| 큰 경로 값(ID 가 들어간 주소) | 라우트 틀(`/api/v1/user-service/reservation/:reservation_id`)로 묶여 라벨이 늘어나지 않는다 | — (인프라) |

---

## 2. 모니터링 묶음 — `CMD npm run docker:monitoring`

**동작 흐름**

1. **내부망 만들기** — `npm run docker:network` 가 모니터링 전용 내부망 `deskless-monitoring`(internal — 밖으로 안 나감)을 더 만든다.
2. **앱 · 브로커 연결** — 앱 인스턴스(gateway · user-service · admin-service · scheduler)와 RabbitMQ 가 이 내부망에도 붙는다(다시 띄울 때 적용).
3. **수집기 띄우기** — Prometheus · Grafana · PostgreSQL 수집기 · Redis 수집기를 띄운다. 프론트(Next.js — 별도 저장소, 같은 서버의 Docker)도 서비스 이름 `web` 으로 이 내부망에 붙으면 같은 방식으로 찾는다 — 아직 없으면 찾을 대상이 없을 뿐 오류가 아니다.
4. **인스턴스 찾기** — Prometheus 가 15초마다 Docker 내장 DNS 로 서비스 이름의 인스턴스를 모두 찾아 긁는다 — `--scale` 로 늘리거나 줄이면 다음 회차에 저절로 따라간다.
5. **대시보드 준비** — Grafana 는 데이터 원본(Prometheus)과 대시보드 2개를 파일로 미리 넣은 채 뜬다(손으로 만들 것 없음).

**입력**

| 필드 | 필수 | 설명 |
|---|---|---|
| `GRAFANA_ADMIN_PASSWORD` | ✓ | Grafana 관리자 비밀번호(관리자 아이디 `GRAFANA_ADMIN_USER`, 기본 admin) — 비면 띄우지 않는다 |
| `MONITORING_DATABASE_URL` | ✓ | PostgreSQL 수집기 접속 주소(`…?sslmode=disable` — 앱의 `DATABASE_URL` 은 `schema=public` 이 붙어 수집기가 읽지 못한다, 읽기 전용 계정 권장) |
| `REDIS_URL` | ✓ | 앱과 같은 값 — Redis 수집기가 쓴다 |
| `GRAFANA_PORT` · `PROMETHEUS_PORT` · `PROMETHEUS_RETENTION` | | 호스트 포트(기본 3001 · 9090, 127.0.0.1 에만) · 보존 기간(기본 30d) |

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| 띄운 뒤 `http://localhost:3001` | Grafana 로그인 → "Deskless" 폴더에 대시보드 2개 | — (Docker 실행은 사용자 몫 — `docker compose config` 로 형식만) |
| user-service 를 2대 → 4대 | 다음 수집 회차(15초)부터 4대가 보이고 합계 · 평균에 들어간다 | — (Prometheus DNS 찾기) |
| 앱이 꺼져 있다 | 그 인스턴스는 "꺼짐"(up 0)으로 보인다 — 대시보드 맨 위 인스턴스 수가 준다 | — |
| 실제 운영(RDS · ElastiCache) | `.env` 의 `MONITORING_DATABASE_URL` · `REDIS_URL` 만 바꾼다 — compose 는 그대로 | — |

---

## 3. 서비스 부하 대시보드 — `PAGE Grafana /d/deskless-service-load`

**동작 흐름**

1. **서비스 고르기** — 맨 위에서 서비스(gateway · user-service · admin-service · web)를 고른다(여러 개 가능). web(Next.js 서버)은 부하율 · CPU · 메모리 · 이벤트 루프만 — 프론트가 부르는 API 의 요청 · 응답 시간은 gateway 에서 본다.
2. **지금 상태 보기** — 인스턴스 수 · 평균 부하율 · 가장 바쁜 인스턴스 부하율 · 초당 요청 · 95% 응답 시간 · 오류율 · 큐 적체를 숫자 카드로 본다.
3. **추이 보기** — 부하율 · CPU · 메모리 · 이벤트 루프 지연 · 초당 요청(인스턴스별 — 고르게 나뉘는지) · 응답 시간 · DB 커넥션 대기를 시간축으로 본다.
4. **시간대 비교** — 같은 그래프에 지금 · 어제 같은 시각 · 지난주 같은 시각을 겹쳐 보고, 최근 7일 시간대별 최대 부하를 막대로 본다.
5. **증설 판단** — 그래프의 70% 기준선과 화면 안 안내문(판단 기준)을 보고 인스턴스 수를 정한다.

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| 평소 | 부하율이 기준선(70%) 아래, 큐 적체 0 근처 | — (대시보드 — JSON 형식 검사로 확인) |
| 특정 시간대 user-service 평균 부하율이 기준선을 넘는다 | 그 시간대가 막대 · 겹친 선에서 반복해서 보인다 → `USER_SERVICE_REPLICAS` +1 판단 근거 | — |
| 인스턴스 하나만 높다 | 인스턴스별 초당 요청이 고르지 않다 — 늘리기 전에 분배(nginx)부터 본다 | — |

**판단 기준 (대시보드 안내문에 싣는다)**
- **부하율 = 이벤트 루프 사용률** — Node 는 인스턴스 하나가 주로 코어 하나를 쓰므로 CPU% 보다 "그 인스턴스가 얼마나 찼는지" 를 바로 보여 준다(100% 면 그 인스턴스는 더 받을 수 없다).
- 피크 시간대에 서비스 **평균 부하율이 70% 를 자주 넘거나**, **큐 적체가 줄지 않고 늘기만 하거나**, **95% 응답 시간이 평소의 2배를 넘으면** 그 서비스 인스턴스를 1대 늘린다.
- 같은 서버 한 대 안에서는 **CPU 코어 수까지만** 늘리는 효과가 있다 — 그 위는 서버를 늘려야 한다.

---

## 4. 인프라 대시보드 — `PAGE Grafana /d/deskless-infra`

**동작 흐름**

1. **PostgreSQL** — 연결 수(상태별) · 최대 연결 대비, 초당 커밋 · 롤백, 캐시 적중률, 교착, DB 크기를 본다.
2. **Redis** — 메모리 · 초당 명령 · 연결 수 · 키 적중률 · AOF 상태를 본다.
3. **RabbitMQ** — 큐별 대기 · 처리 중 메시지 · 소비자 수 · 초당 발행 · 전달 · DLQ(`q.dead`)를 본다.
4. **scheduler** — crontab 작업별 실행 · 실패 · 건너뜀 · 걸린 시간을 본다.

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| DB 연결이 최대에 가깝다 | 연결 수 패널이 기준선(최대의 80%)을 넘는다 — 인스턴스를 늘리기 전에 풀 크기 · DB 최대 연결을 먼저 본다 | — (대시보드) |
| crontab 이 실패한다 | 작업별 실패 수가 늘어난다 | — |

---

## 데이터 변화

| 대상 | 무엇이 바뀌나 |
|---|---|
| DB 스키마 | 없음(마이그레이션 없음) |
| Docker | 네트워크 `deskless-monitoring`(internal) · 볼륨 `deskless-prometheus-data` · `deskless-grafana-data` 새로. 앱 · RabbitMQ 묶음은 이 네트워크에 더 붙는다(다시 띄울 때) |
| 앱 | 지표 전용 포트 하나씩 더 연다(모니터링 내부망 · 로컬은 127.0.0.1) — 공개 · 내부 API 는 그대로 |

## 결정한 것

- [x] **인스턴스마다 수집 → Grafana 한 화면**(사용자 2026-11-22) — 로드밸런서 뒤 인스턴스는 gateway 한 곳에서 하나씩 볼 수 없다. Prometheus 가 Docker DNS 로 인스턴스를 모두 찾는다.
- [x] **대상: gateway · user-service · admin-service · scheduler + PostgreSQL · Redis + RabbitMQ 큐 적체**(사용자 2026-11-22). 컨테이너 · 호스트 · nginx 지표는 빼고, 큐는 RabbitMQ 이미지에 든 Prometheus 플러그인(15692)이라 컨테이너가 늘지 않는다.
- [x] **지표는 앱마다 전용 포트**(사용자 2026-11-22 — 수집 방식 선택에 따름) — 공개 API · 내부 토큰 규칙을 건드리지 않고 gateway 공개 주소에 지표가 노출되지 않는다. 포트 env 는 앱마다(`GATEWAY_METRICS_PORT` 9464 · `USER_SERVICE_METRICS_PORT` 9465 · `ADMIN_SERVICE_METRICS_PORT` 9466 · `SCHEDULER_METRICS_PORT` 9467 — 로컬에서 네 앱이 한 PC 에서 돌 때 겹치지 않게, 기존 `*_PORT` 와 같은 이름 짓기), Docker 는 컨테이너 안 9464 고정.
- [x] **scheduler 는 지표 포트만 예외로 연다**(사용자 2026-11-22) — "들어오는 연결 없음" 의 예외, API · 큐 소비는 여전히 없다. crontab 지표는 모든 crontab 이 거치는 `JobLockService.runExclusive` 한 곳에서 잰다(crontab 파일은 고치지 않는다).
- [x] **compose 묶음 하나**(사용자 2026-11-22) — 메모리 "관리 도구는 compose 밖" 의 예외로 기록했다(수집기라 성격이 다름).
- [x] **프론트(Next.js) 서버도 같은 방식으로**(사용자 2026-11-22 — 프론트는 별도 저장소, 백엔드와 같은 서버의 Docker) — 백엔드는 받을 자리만(Prometheus 수집 대상 `web` · 대시보드 서비스 목록), 프론트 저장소가 할 일(`instrumentation.ts` 지표 서버 · 같은 지표 이름 · 포트 9464 · 내부망 `deskless-monitoring` · 서비스 이름 `web`)은 프론트 수정 요청 문서로 넘긴다. 브라우저 지표(Web Vitals)는 범위 밖.
- [x] **다른 프로젝트를 붙이는 규격 문서**(사용자 2026-11-22) — 제3의 프로젝트가 들어올 때 그대로 넘기는 `docs/guides/monitoring-integration.md`(지켜야 할 것: 내부망 · 서비스 이름 · 지표 포트 · 경로 · 지표 이름 · 라벨 · 금지 라벨, Node 예시 코드, 확인 방법, 백엔드가 할 일, 요청 문서 틀). 백엔드 쪽 할 일을 Prometheus 수집 대상 한 줄로 줄이려고 대시보드 서비스 목록은 Prometheus 에서 읽는다(`label_values`) — 새 서비스가 저절로 목록에 나온다. 프론트 요청 문서는 이 규격의 첫 적용.
- [x] **부하율 = 이벤트 루프 사용률(ELU)**, 기준선 70% — Node 인스턴스가 얼마나 찼는지 바로 보이는 값. 기준선은 대시보드에서 바꿀 수 있다.
- [x] **쿠버네티스로 넘어가도 그대로 쓰게** — 지표는 prom-client 표준 이름 + `service` 라벨, 서비스별 부하율 · 요청률은 Prometheus 기록 규칙(`service:…`)으로 미리 계산(나중에 HPA 기준으로 그대로), 찾는 방식만 DNS → ServiceMonitor 로 바뀐다.
- [x] **보존 30일 기본** — 어제 · 지난주 같은 시각 비교와 한 달 추이에 충분. `PROMETHEUS_RETENTION` 으로 바꾼다.
- [x] **접속은 127.0.0.1 포트만** — Grafana(3001) · Prometheus(9090). 관리자 비밀번호는 `.env` 필수(약한 기본값을 compose 에 넣지 않는 규칙).

## 제안 (코드베이스 기반)

- [x] gateway 의 큐 명령 대기(SSE 스트림) 수를 지표로 — `CommandStreamService.pendingCount()` 가 이미 "모니터링 · 테스트용" 으로 있다(`command-stream.service.ts:117`).
- [x] DB 커넥션 풀(전체 · 놀고 있는 · 기다리는)을 지표로 — 풀이 차면 인스턴스를 늘려도 빨라지지 않는다(늘리면 오히려 DB 연결이 모자란다). TypeORM 의 pg 풀 값을 긁을 때 읽는다.
- [ ] 알림(기준선을 일정 시간 넘으면 SMS) — 이번 범위 밖, 필요하면 다음에.

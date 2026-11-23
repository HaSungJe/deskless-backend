# Revision — monitoring-dashboard — 261123-1

> 기존 기능의 변경 계획. 원래 spec.md / plan.md 는 고치지 않고 참고만 한다.

## Reason for Change Request
대시보드를 띄워 보니 증설 판단 기준이 어디 있는지 알 수 없고, 패널이 많고 이름이 원문(`q.admin.cmd` · `user-service` · `reservation.refund` · `idle in transaction`)이라 읽기 어렵다(사용자 2026-11-23). 그래서 **맨 위 판정 표 한 장이 "늘려야 하나?"에 답하는** 구조로 다시 짠다. 이름은 한국어로 바꾸고, 원인을 찾는 패널은 접어 둔다.

정한 것(사용자 2026-11-23):
- 화면 틀은 "판정 표 중심" — 서비스 부하는 판정 표 → 시간대별 부하 → 7일 × 시간대 칸 → 접힌 "늘리기 전에 확인", 인프라는 맨 위 상태 카드 6개 → 큐 · DB · Redis · 예약 작업.
- 판정 기준 — 최근 7일 중 "15분 평균 부하율의 하루 최고가 70% 이상"인 날이 3일 이상이면 **1대 늘리기**, 1~2일이면 **지켜보기**, 0일이면 **여유**.

## Spec Before → After

| 항목 | Before | After |
|------|--------|-------|
| 서비스 부하 — 맨 위 | 지금 상태 stat 9개(인스턴스 수 · 평균 · 최대 · 초당 요청 · p95 · 5xx · 큐 적체 · SSE 대기) + 긴 안내문 | **판정 표 1개**(서비스 · 대수 · 지금 · 24시간 최고 · 7일 중 70% 넘은 날 · 판정) + 오른쪽 짧은 읽는 법(색 · 기준 · 늘려도 효과 없는 경우) |
| 서비스 부하 — 그래프 | 부하 추이 5개(인스턴스별 · 평균/최대 · CPU · 메모리 · 이벤트 루프 지연) | **시간대별 부하율 1개** — 서비스별 15분 평균, 70% 빨간 점선 · 위는 빨간 영역 |
| 서비스 부하 — 시간대 | 지금 · 어제 · 지난주 겹친 선 + 7일 1시간 막대 | **최근 7일 × 시간대 칸**(status history — 1시간 한 칸, 초록 · 노랑 · 빨강, 대시보드 기간과 상관없이 7일) |
| 서비스 부하 — 원인 찾기 | 펼친 행 2개 · 패널 7개(요청 · 큐 · DB) | **접힌 행 "늘리기 전에 확인"** 8개 — 초당 요청 · 95% 응답 시간 · 서버 오류 비율 · 밀린 작업 · DB 연결 기다리는 요청 · 인스턴스별 부하율 · CPU · 메모리, 제목이 질문형("손님이 늘었나" · "한 대만 바쁜가") |
| 서비스 부하 — 뺀 패널 | — | 이벤트 루프 지연 p99 · 처리 중인 요청 · 라우트 상위 10 · SSE 대기 · 큐 명령 처리량 · 어제/지난주 비교 · 가장 바쁜 인스턴스(인스턴스별 부하율이 대신) |
| scheduler | 모든 패널에 섞임 | 판정 표 · 부하 그래프 · 7일 칸에서 **뺀다**(늘려도 crontab 은 회차마다 1대만 돈다 — JobLockService). "늘리기 전에 확인"의 인스턴스별 · CPU · 메모리에는 나온다 |
| 색 기준(부하율) | 70% 주황 · 90% 빨강 | **50% 노랑(지켜보기) · 70% 빨강(늘리기 검토)** — 판정 기준과 같은 70% |
| 서비스 이름 | job 원문(`user-service` …) | Prometheus 가 붙이는 **`display_name`** 라벨 — 게이트웨이 · 이용자 서버 · 관리자 서버 · 스케줄러 · 프론트(`prometheus.yml` 앱마다 한 줄 — 새 서비스도 그 한 줄) |
| 인프라 — 맨 위 | PostgreSQL stat 4개(연결/최대 · 캐시 적중률 · 교착 · 크기) | **상태 카드 6개**(배경색) — 실패한 작업 · 밀린 작업 · DB 연결 사용률 · Redis 메모리 · Redis 저장(AOF) · 예약 작업 실패(24시간). 0 은 "없음" |
| 인프라 — 큐 | 큐별 대기 · 처리 중/소비자 · 초당 발행/전달 · DLQ stat, 이름 원문 · 게이트웨이 결과 큐(`q.gw.result.*`)까지 | **서버별 밀린 작업 1개** — 이용자 서버 작업 · 관리자 서버 작업(결과 큐 숨김), 실패한 작업(`q.dead`)은 맨 위 카드 |
| 인프라 — DB | 연결 상태별(0 인 상태까지 전부) · 커밋/롤백 · 앱 풀(서비스 × 상태) | 연결 수(**쿼리 실행 중 · 쉬는 중 · 트랜잭션 열고 멈춤** 3개 + 주의선 최대의 80%) · 초당 처리(커밋 · 롤백) · 서버별 DB 연결 |
| 인프라 — Redis | 메모리 · 초당 명령 · 연결 · 키 적중률/AOF stat(1.00 으로 표시) | 메모리 · 연결 수 · 초당 명령(AOF 는 맨 위 카드 "정상 / 꺼짐 · 실패") |
| 인프라 — 예약 작업 | 실패 stat · 작업별 회차 막대 · 걸린 시간 p95, 작업 이름 원문 | **작업별 최근 24시간 표**(작업 · 성공 · 실패 — 실패 칸 빨강), 작업 이름 한국어(결제 대기 만료 · 환불 …) |
| 범례 | 표(Mean · Max · Last) | 이름만(목록) — 값은 마우스를 올리면 |
| 패널 설명(ⓘ) | 일부만 | **모든 패널** — 무엇 · 어떻게 읽나 · 언제 걱정하나 |
| Grafana 화면 | 영어 · 홈은 빈 환영 화면 | **한국어**(`GF_USERS_DEFAULT_LANGUAGE=ko-KR`) · **홈 = 서비스 부하**(`GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH`) · 두 대시보드 서로 링크 |
| 기록 규칙 | 7개(`:avg` · `:max` · `job:process_cpu:rate1m` …), 서비스 집계 `by (job)` | `+ job:eventloop_utilization:avg15m`(판정 · 그래프 · 7일 칸), `− :max` · `− job:process_cpu:rate1m`(쓰는 패널 없음), 서비스 집계 `by (job, display_name)` |

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `docker/grafana/dashboards/deskless-service-load.json` | modify(다시 생성) | 판정 표 · 시간대별 부하 · 7일 칸 · 접힌 "늘리기 전에 확인" 8개 |
| `docker/grafana/dashboards/deskless-infra.json` | modify(다시 생성) | 상태 카드 6 · 큐 1 · DB 3 · Redis 3 · 예약 작업 표 1 |
| `docker/prometheus/prometheus.yml` | modify | 앱 job 5개에 `display_name` 붙이기(relabel) |
| `docker/prometheus/rules.yml` | modify | `avg15m` 추가 · `:max` · `process_cpu` 삭제 · `by (job, display_name)` |
| `compose.monitoring.yml` | modify | Grafana 한국어 화면 · 홈 대시보드 |
| `docs/monitoring.md` | modify | 규칙(라벨) · 기록 규칙 표 · 대시보드 · 증설 판단 절 |
| `docs/guides/monitoring-integration.md` | modify | 서비스 한국어 이름 · 백엔드 할 일(relabel 한 줄) · 확인 순서(판정 표) |
| `AGENTS.md` | modify | 모니터링 절 — `display_name` 라벨(Prometheus 가 붙임), 다른 프로젝트 붙일 때 한 줄에 이름 포함 |
| `README.md` | modify | 모니터링 줄에 "한국어 화면 · 홈 = 서비스 부하" |
| `.beaver/output/report/monitoring/monitoring-dashboard-report.md` | modify | `## Modification - 261123-1` 추가 + 지난 변경 머리글을 `## Change - 261122-1` → `## Modification - 261122-1`(spec 보드가 "미반영"으로 읽던 것) |

작업용(커밋하지 않음): scratchpad 의 대시보드 생성기 `grafana-dashboards.cjs`(아래 코드로 바꿔 돌린다 — 결과 JSON 이 원본) · 가짜 지표 스크립트 `fake-metrics.mjs`(`display_name` · `avg15m` · DB · Redis · `q.dead` · crontab 값 추가 — 인프라 대시보드도 채워 보게).

프론트 수정 요청 문서: 없음 — 공개 API · 화면 동작이 그대로이고 프론트 저장소가 할 일도 없다(`web` 의 한국어 이름은 백엔드 `prometheus.yml` 이 붙인다).

## Code Changes

### `docker/prometheus/prometheus.yml` — 앱 job

```yaml
# before
    # ── 앱 (지표 전용 포트 9464 · /metrics) ──
    - job_name: gateway
      dns_sd_configs: [{names: [gateway], type: A, port: 9464, refresh_interval: 15s}]
    - job_name: user-service
      dns_sd_configs: [{names: [user-service], type: A, port: 9464, refresh_interval: 15s}]
    - job_name: admin-service
      dns_sd_configs: [{names: [admin-service], type: A, port: 9464, refresh_interval: 15s}]
    - job_name: scheduler
      dns_sd_configs: [{names: [scheduler], type: A, port: 9464, refresh_interval: 15s}]
    # 프론트 Next.js 서버(별도 저장소 — 같은 서버의 Docker, 서비스 이름 web). 아직 붙지 않았으면 대상 0개 — 오류 아님
    - job_name: web
      dns_sd_configs: [{names: [web], type: A, port: 9464, refresh_interval: 15s}]
```

```yaml
# after
    # ── 앱 (지표 전용 포트 9464 · /metrics) ──
    # display_name = 대시보드에 보이는 한국어 이름 — 이 job 의 모든 지표 · up 에 붙는다. 새 앱도 같은 모양으로 한 줄(이름 포함)
    - job_name: gateway
      dns_sd_configs: [{names: [gateway], type: A, port: 9464, refresh_interval: 15s}]
      relabel_configs: [{target_label: display_name, replacement: '게이트웨이'}]
    - job_name: user-service
      dns_sd_configs: [{names: [user-service], type: A, port: 9464, refresh_interval: 15s}]
      relabel_configs: [{target_label: display_name, replacement: '이용자 서버'}]
    - job_name: admin-service
      dns_sd_configs: [{names: [admin-service], type: A, port: 9464, refresh_interval: 15s}]
      relabel_configs: [{target_label: display_name, replacement: '관리자 서버'}]
    - job_name: scheduler
      dns_sd_configs: [{names: [scheduler], type: A, port: 9464, refresh_interval: 15s}]
      relabel_configs: [{target_label: display_name, replacement: '스케줄러'}]
    # 프론트 Next.js 서버(별도 저장소 — 같은 서버의 Docker, 서비스 이름 web). 아직 붙지 않았으면 대상 0개 — 오류 아님
    - job_name: web
      dns_sd_configs: [{names: [web], type: A, port: 9464, refresh_interval: 15s}]
      relabel_configs: [{target_label: display_name, replacement: '프론트'}]
```

### `docker/prometheus/rules.yml` — 전체(after)

```yaml
# 기록 규칙 — 서비스별 부하율 · 요청률 · 응답 시간을 미리 계산한다. 대시보드와 나중의 쿠버네티스 HPA(prometheus-adapter)가 같은 이름을 쓴다.
#
# 부하율 = 이벤트 루프 사용률(ELU) — 앱은 이벤트 루프가 일한 · 쉰 누적 시간(nodejs_eventloop_time_seconds{state})을 내고 여기서 rate 로 나눈다.
# Node 는 인스턴스 하나가 주로 코어 하나를 쓰므로 1.0(100%)이면 그 인스턴스는 더 받을 수 없다. 증설 기준선은 0.7(docs/monitoring.md).
# 서비스 집계는 by (job, display_name) — display_name 은 prometheus.yml 이 앱 job 마다 붙이는 한국어 이름(대시보드 표시용).
groups:
    - name: deskless-service-load
      rules:
          # 인스턴스 부하율 (0 ~ 1)
          - record: instance:eventloop_utilization:ratio
            expr: sum without (state) (rate(nodejs_eventloop_time_seconds{state="active"}[1m])) / sum without (state) (rate(nodejs_eventloop_time_seconds[1m]))
          # 서비스 평균 부하율 — HPA 기준
          - record: job:eventloop_utilization:avg
            expr: avg by (job, display_name) (instance:eventloop_utilization:ratio)
          # 서비스 평균 부하율의 15분 평균 — 증설 판정(1~2분 튀는 값은 세지 않는다). 같은 그룹의 앞 규칙을 같은 회차에 쓴다
          - record: job:eventloop_utilization:avg15m
            expr: avg_over_time(job:eventloop_utilization:avg[15m])
          # 서비스 초당 HTTP 요청
          - record: job:http_requests:rate1m
            expr: sum by (job, display_name) (rate(http_server_request_duration_seconds_count[1m]))
          # 서비스 95% 응답 시간(초)
          - record: job:http_request_duration_seconds:p95
            expr: histogram_quantile(0.95, sum by (job, display_name, le) (rate(http_server_request_duration_seconds_bucket[5m])))
          # 서비스 5xx 비율 (0 ~ 1)
          - record: job:http_errors:ratio
            expr: sum by (job, display_name) (rate(http_server_request_duration_seconds_count{status_code=~"5.."}[5m])) / sum by (job, display_name) (rate(http_server_request_duration_seconds_count[5m]))
```

### `compose.monitoring.yml` — grafana environment

```yaml
# before
            GF_DATE_FORMATS_DEFAULT_TIMEZONE: 'Asia/Seoul'
            TZ: Asia/Seoul
```

```yaml
# after
            GF_DATE_FORMATS_DEFAULT_TIMEZONE: 'Asia/Seoul'
            GF_USERS_DEFAULT_LANGUAGE: 'ko-KR' # 화면 한국어(개인 설정이 없는 사용자)
            GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH: '/var/lib/grafana/dashboards/deskless-service-load.json' # 홈 = 서비스 부하
            TZ: Asia/Seoul
```

### 대시보드 생성기(작업용 — scratchpad `grafana-dashboards.cjs`, 결과 JSON 2개가 원본) — 전체(after)

```js
// Grafana 대시보드 JSON 생성기(작업용 — 커밋하지 않는다, 결과 JSON 이 원본). 사용: node grafana-dashboards.cjs <저장소>
const fs = require('fs');
const path = require('path');
const repo = process.argv[2];
const DS = {type: 'prometheus', uid: 'deskless-prometheus'};
let id = 0;

// ── 색 ──
/** 초록에서 시작하는 단계 — [값, 색] 들 */
const steps = (...pairs) => ({mode: 'absolute', steps: [{color: 'green', value: null}, ...pairs.map(([value, color]) => ({color, value}))]});
const PLAIN = steps();
/** 부하율 — 50% 지켜보기(노랑) · 70% 늘리기 검토(빨강) */
const LOAD_STEPS = steps([0.5, 'yellow'], [0.7, 'red']);
/** 그래프의 70% 기준선 — 아래는 투명, 위는 빨간 영역 */
const LINE_70 = {mode: 'absolute', steps: [{color: 'transparent', value: null}, {color: 'red', value: 0.7}]};
/** 0 을 "없음" 으로 */
const ZERO_NONE = [{type: 'value', options: {0: {text: '없음', index: 0}}}];

// ── 한국어 이름 — 서비스는 Prometheus 가 붙이는 display_name(prometheus.yml), 큐 · 작업 · DB 연결 상태는 여기서(모르는 값은 원래 이름) ──
const QUEUE_NAMES = {'q.user.cmd': '이용자 서버 작업', 'q.admin.cmd': '관리자 서버 작업', 'q.dead': '실패한 작업'};
const TASK_NAMES = {
    'reservation.payment-expire': '결제 대기 만료',
    'reservation.payment-recheck': '늦은 결제 승인 확인',
    'reservation.refund': '환불',
    'reservation.qr-sync': 'QR 맞추기',
    'reservation.usage': '이용 시작 · 종료 전환',
    'reservation.qr-link': 'QR 확인 링크 문자',
    'user.leave-cleanup': '탈퇴 처리',
    'api-log.partition': 'API 로그 월 파티션 만들기',
};
const PG_STATE_NAMES = {active: '쿼리 실행 중', idle: '쉬는 중', 'idle in transaction': '트랜잭션 열고 멈춤'};

/**
 * 라벨 값을 한국어 이름 라벨(to)로 — 원래 값을 먼저 옮기고 아는 값만 덮어쓴다(PromQL label_replace, 정규식은 통째 일치).
 */
function rename(expr, label, names, to) {
    let out = `label_replace(${expr}, "${to}", "$1", "${label}", "(.*)")`;
    for (const [from, name] of Object.entries(names)) {
        out = `label_replace(${out}, "${to}", "${name}", "${label}", "${from.replace(/\./g, '\\\\.')}")`;
    }
    return out;
}

// ── 고르는 조건 ──
const APP = 'job=~"$job"';
/** 판정 · 부하 그래프 대상 — scheduler 는 늘려도 회차마다 1대만 돈다(JobLockService) */
const SCALE = 'job=~"$job", job!="scheduler"';
const LOAD15 = `job:eventloop_utilization:avg15m{${SCALE}}`;
/** 최근 7일 중 하루 최고(15분 평균 부하율)가 70% 이상인 날 수 — 하루 = UTC 0시 단위(한국 오전 9시 ~ 다음 날 오전 9시, 밤 피크가 하루에 들어간다) */
const HOT_DAYS = `sum_over_time((max_over_time(${LOAD15}[1d]) >= bool 0.7)[7d:1d])`;
const WORK = 'queue=~"q.user.cmd|q.admin.cmd"';
const WORK_BACKLOG = rename(`sum by (queue) (rabbitmq_detailed_queue_messages_ready{${WORK}})`, 'queue', QUEUE_NAMES, 'queue_name');

// ── 패널 ──
const target = (expr, legend, i, extra = {}) => ({datasource: DS, expr, legendFormat: legend, refId: String.fromCharCode(65 + i), ...extra});
const row = (title, y, opt = {}) => ({id: ++id, type: 'row', title, collapsed: !!opt.collapsed, gridPos: {h: 1, w: 24, x: 0, y}, panels: opt.panels ?? []});
const note = (content, pos) => ({id: ++id, type: 'text', title: '', transparent: true, gridPos: pos, options: {mode: 'markdown', content}});
const by = (name, properties) => ({matcher: {id: 'byName', options: name}, properties});

/** 상태 카드 — 큰 값 하나, 배경색 */
function card(title, expr, pos, description, opt = {}) {
    return {
        id: ++id,
        type: 'stat',
        title,
        description,
        datasource: DS,
        gridPos: pos,
        targets: [target(expr, '', 0, {instant: true})],
        fieldConfig: {defaults: {unit: opt.unit ?? 'none', decimals: opt.decimals ?? 0, thresholds: opt.thresholds ?? PLAIN, mappings: opt.mappings ?? [], color: {mode: 'thresholds'}, noValue: '수집 전'}, overrides: []},
        options: {reduceOptions: {calcs: ['lastNotNull'], fields: '', values: false}, colorMode: 'background', graphMode: 'none', textMode: 'value', justifyMode: 'center', orientation: 'auto', wideLayout: true, showPercentChange: false},
    };
}

/** 시계열 — 범례는 이름만(값은 마우스를 올리면) */
function series(title, exprs, pos, description, opt = {}) {
    return {
        id: ++id,
        type: 'timeseries',
        title,
        description,
        datasource: DS,
        gridPos: pos,
        ...(opt.interval ? {interval: opt.interval} : {}),
        targets: exprs.map(([e, l], i) => target(e, l, i)),
        fieldConfig: {
            defaults: {
                unit: opt.unit ?? 'none',
                min: 0,
                max: opt.max,
                decimals: opt.decimals,
                thresholds: opt.line ?? PLAIN,
                color: {mode: 'palette-classic'},
                custom: {drawStyle: 'line', lineWidth: 2, fillOpacity: 0, showPoints: 'never', spanNulls: true, stacking: {mode: 'none', group: 'A'}, thresholdsStyle: {mode: opt.line ? 'dashed+area' : 'off'}},
            },
            overrides: opt.overrides ?? [],
        },
        options: {legend: {displayMode: 'list', placement: 'bottom', showLegend: true}, tooltip: {mode: 'multi', sort: 'desc'}},
    };
}

/** 표 — 쿼리마다 한 열(instant), columns = {원래 이름: 보일 이름}(이 순서 · 나머지 열은 숨김) */
function table(title, exprs, columns, pos, description, overrides, sortBy) {
    return {
        id: ++id,
        type: 'table',
        title,
        description,
        datasource: DS,
        gridPos: pos,
        targets: exprs.map((e, i) => target(e, '', i, {instant: true, range: false, format: 'table'})),
        transformations: [
            {id: 'merge', options: {}},
            {id: 'organize', options: {excludeByName: {}, indexByName: Object.fromEntries(Object.keys(columns).map((n, i) => [n, i])), renameByName: columns}},
            {id: 'filterFieldsByName', options: {include: {names: Object.values(columns)}}},
        ],
        fieldConfig: {defaults: {custom: {align: 'center', cellOptions: {type: 'auto'}, inspect: false}, color: {mode: 'thresholds'}, thresholds: PLAIN, noValue: '-'}, overrides},
        options: {showHeader: true, cellHeight: 'lg', footer: {show: false}, sortBy},
    };
}

/** 7일 × 시간대 칸 — 대시보드 기간과 상관없이 최근 7일, 1시간 한 칸 */
function history(title, expr, pos, description) {
    return {
        id: ++id,
        type: 'status-history',
        title,
        description,
        datasource: DS,
        gridPos: pos,
        timeFrom: '7d',
        interval: '1h',
        maxDataPoints: 200,
        targets: [target(expr, '{{display_name}}', 0)],
        fieldConfig: {defaults: {unit: 'percentunit', decimals: 0, thresholds: LOAD_STEPS, color: {mode: 'thresholds'}, custom: {lineWidth: 0, fillOpacity: 85}}, overrides: []},
        options: {showValue: 'never', rowHeight: 0.85, colWidth: 1, legend: {showLegend: false}, tooltip: {mode: 'single', sort: 'none'}},
    };
}

const jobVar = {
    name: 'job',
    label: '서비스',
    type: 'query',
    datasource: DS,
    query: {query: 'label_values(nodejs_eventloop_time_seconds, job)', refId: 'PrometheusVariableQueryEditor-VariableQuery'},
    definition: 'label_values(nodejs_eventloop_time_seconds, job)',
    multi: true,
    includeAll: true,
    current: {selected: true, text: ['All'], value: ['$__all']},
    refresh: 2,
    sort: 1,
    regex: '',
    hide: 0,
    options: [],
};

/** 대시보드 — 두 대시보드는 deskless 태그 링크로 서로 오간다 */
const dashboard = (uid, title, description, panels, vars) => ({
    uid,
    title,
    description,
    tags: ['deskless'],
    timezone: 'Asia/Seoul',
    editable: false,
    graphTooltip: 1,
    refresh: '30s',
    schemaVersion: 39,
    time: {from: 'now-24h', to: 'now'},
    links: [{title: '다른 대시보드', type: 'dashboards', tags: ['deskless'], asDropdown: false, includeVars: false, keepTime: true}],
    templating: {list: vars},
    panels,
});

// ── 서비스 부하 — "인스턴스를 늘려야 하나?" ──
id = 0;
const pct = [{id: 'unit', value: 'percentunit'}, {id: 'decimals', value: 0}, {id: 'thresholds', value: LOAD_STEPS}, {id: 'custom.cellOptions', value: {type: 'color-text'}}];
const verdictMappings = [
    {type: 'range', options: {from: 3, to: 7, result: {text: '1대 늘리기', color: 'red', index: 0}}},
    {type: 'range', options: {from: 1, to: 2, result: {text: '지켜보기', color: 'yellow', index: 1}}},
    {type: 'value', options: {0: {text: '여유', color: 'green', index: 2}}},
];
const servicePanels = [
    table(
        '판정 — 인스턴스를 늘려야 하나?',
        [`count by (job, display_name) (up{${SCALE}} == 1)`, `avg_over_time(job:eventloop_utilization:avg{${SCALE}}[5m])`, `max_over_time(${LOAD15}[1d])`, HOT_DAYS, HOT_DAYS],
        {display_name: '서비스', 'Value #A': '대수', 'Value #B': '지금', 'Value #C': '24시간 최고', 'Value #D': '7일 중 70% 넘은 날', 'Value #E': '판정'},
        {h: 8, w: 16, x: 0, y: 0},
        '서비스마다 인스턴스를 늘릴지 판정한다. 부하율 = 서버가 일하느라 바빴던 시간 비율(이벤트 루프 사용률 — 그 서비스 인스턴스들의 평균, 100% 면 더 받을 수 없다). 지금 = 최근 5분, 24시간 최고 = 15분 평균의 최고. 하루마다 15분 평균 부하율의 최고를 보고, 최근 7일 중 70% 이상인 날이 3일 이상이면 "1대 늘리기", 1~2일 "지켜보기", 0일 "여유". 하루는 한국 시각 오전 9시 ~ 다음 날 오전 9시. 스케줄러는 늘려도 회차마다 한 대만 실행해서 빠진다.',
        [
            by('서비스', [{id: 'custom.align', value: 'left'}]),
            by('대수', [{id: 'unit', value: 'suffix:대'}, {id: 'decimals', value: 0}]),
            by('지금', pct),
            by('24시간 최고', pct),
            by('7일 중 70% 넘은 날', [{id: 'unit', value: 'suffix:일'}, {id: 'decimals', value: 0}]),
            by('판정', [{id: 'mappings', value: verdictMappings}, {id: 'custom.cellOptions', value: {type: 'color-background', mode: 'basic'}}]),
        ],
        [{displayName: '7일 중 70% 넘은 날', desc: true}],
    ),
    note(
        [
            '**판정 읽는 법**',
            '- 🟥 **1대 늘리기** — 최근 7일 중 3일 이상 부하율 70% 넘음',
            '- 🟨 **지켜보기** — 1~2일',
            '- 🟩 **여유** — 0일',
            '',
            '70% 넘음 = 15분 넘게 계속 70% 이상(잠깐 튀는 값은 세지 않는다).',
            '',
            '**늘리기 전에** 아래 "늘리기 전에 확인"을 펼친다 — DB 연결을 기다리거나 한 대만 바쁘면 늘려도 나아지지 않는다.',
        ].join('\n'),
        {h: 8, w: 8, x: 16, y: 0},
    ),
    series('시간대별 부하율 — 서비스별 (15분 평균)', [[LOAD15, '{{display_name}}']], {h: 9, w: 24, x: 0, y: 8}, '서비스별 부하율(판정과 같은 15분 평균). 빨간 점선(70%) 위에 머무는 시간이 매일 같은 시간대에 반복되면 늘릴 때다.', {unit: 'percentunit', max: 1, line: LINE_70}),
    history('최근 7일 — 시간대별 부하 (칸 하나 = 1시간)', `max_over_time(${LOAD15}[$__interval])`, {h: 7, w: 24, x: 0, y: 17}, '최근 7일을 1시간 칸으로 나눠 그 시간의 최고 부하율을 색으로 — 초록 50% 미만 · 노랑 50~70% · 빨강 70% 이상. 매일 같은 시간대가 빨가면 그 시간대가 피크다. 대시보드 기간과 상관없이 항상 7일이다.'),
    row('늘리기 전에 확인 — 늘려도 효과가 없는 경우를 걸러낸다', 24, {
        collapsed: true,
        panels: [
            series('손님이 늘었나 — 초당 요청', [[`job:http_requests:rate1m{${APP}}`, '{{display_name}}']], {h: 7, w: 8, x: 0, y: 25}, '서비스별 초당 HTTP 요청. 부하가 오를 때 요청도 같이 늘었으면 손님이 많아진 것 — 늘리면 된다. 요청은 그대로인데 부하만 오르면 느린 처리(DB · 외부 연동)부터 본다.', {unit: 'reqps'}),
            series('느려졌나 — 95% 응답 시간', [[`job:http_request_duration_seconds:p95{${APP}}`, '{{display_name}}']], {h: 7, w: 8, x: 8, y: 25}, '요청 100개 중 95개가 이 시간 안에 끝났다. 평소의 2배를 넘으면 늘릴 신호다.', {unit: 's'}),
            series('오류가 늘었나 — 서버 오류(5xx) 비율', [[`job:http_errors:ratio{${APP}}`, '{{display_name}}']], {h: 7, w: 8, x: 16, y: 25}, '응답 중 서버 오류(500번대) 비율. 늘리기보다 로그로 원인부터 본다 — 부하 때문이면 부하율도 같이 높다.', {unit: 'percentunit'}),
            series('일이 밀리나 — 서버별 밀린 작업', [[WORK_BACKLOG, '{{queue_name}}']], {h: 7, w: 8, x: 0, y: 32}, '쓰기 요청(예약 · 결제 확인 등)은 큐에 들어가 서버가 차례로 처리한다. 줄지 않고 계속 늘기만 하면 처리하는 서버가 모자라다 — 그 서버를 늘린다.'),
            series('DB 연결을 기다리나 — 서버별 대기 요청', [[`sum by (job, display_name) (db_client_connections{${APP}, state="waiting"})`, '{{display_name}}']], {h: 7, w: 8, x: 8, y: 32}, 'DB 연결이 모자라 기다리는 요청 수. 0 이 아니면 서버를 늘려도 나아지지 않는다(DB 연결이 더 모자라진다) — 연결 풀 크기 · DB 최대 연결부터 본다.'),
            series('한 대만 바쁜가 — 인스턴스별 부하율', [[`instance:eventloop_utilization:ratio{${APP}}`, '{{display_name}} · {{instance}}']], {h: 7, w: 8, x: 16, y: 32}, '같은 서비스의 인스턴스끼리 비슷해야 정상이다. 한 대만 높으면 나눠 주는 쪽(nginx) 문제 — 늘려도 그 한 대는 그대로다.', {unit: 'percentunit', max: 1, line: LINE_70}),
            series('CPU — 인스턴스별 (1 = 코어 1개)', [[`rate(process_cpu_seconds_total{${APP}}[5m])`, '{{display_name}} · {{instance}}']], {h: 7, w: 12, x: 0, y: 39}, 'Node 서버 한 대는 주로 코어 1개를 쓴다. 서버 PC 의 CPU 코어 수보다 많이 늘려도 효과가 없다. 판정 표에 없는 서비스(이벤트 루프가 없는 런타임)는 이것으로 부하를 본다.', {decimals: 2}),
            series('메모리 — 인스턴스별', [[`process_resident_memory_bytes{${APP}}`, '{{display_name}} · {{instance}}']], {h: 7, w: 12, x: 12, y: 39}, '계속 오르기만 하고 내려오지 않으면 메모리 누수 — 늘리기와 상관없이 원인을 찾는다.', {unit: 'bytes'}),
        ],
    }),
];

// ── 인프라 — "DB · Redis · 큐는 괜찮나?" ──
id = 0;
const PG_LIMIT = '주의선 (최대의 80%)';
const taskCount = (result) => rename(`round(sum by (task) (increase(scheduler_job_duration_seconds_count{result="${result}"}[24h])) or sum by (task) (increase(scheduler_job_duration_seconds_count[24h])) * 0)`, 'task', TASK_NAMES, 'task_name');
const infraPanels = [
    card('실패한 작업', 'sum(rabbitmq_detailed_queue_messages_ready{queue="q.dead"}) or vector(0)', {h: 4, w: 4, x: 0, y: 0}, '큐 작업 중 3번 시도해도 처리하지 못해 따로 모아 둔 것(q.dead). 자동으로 다시 처리하지 않는다 — 1건이라도 있으면 RabbitMQ 관리 화면(http://localhost:15672 → Queues → q.dead → Get messages)에서 내용을 본다. 입력 오류 같은 업무 실패는 여기 쌓이지 않는다.', {unit: 'suffix:건', thresholds: steps([1, 'red']), mappings: ZERO_NONE}),
    card('밀린 작업', `sum(rabbitmq_detailed_queue_messages_ready{${WORK}}) or vector(0)`, {h: 4, w: 4, x: 4, y: 0}, '서버가 아직 꺼내 가지 않은 큐 작업(이용자 서버 · 관리자 서버 합). 잠깐 쌓였다 줄면 정상, 10건 넘게 계속 있으면 노랑 · 100건 넘으면 빨강 — 처리하는 서버를 늘린다.', {unit: 'suffix:건', thresholds: steps([10, 'yellow'], [100, 'red']), mappings: ZERO_NONE}),
    card('DB 연결 사용률', 'sum(pg_stat_activity_count) / max(pg_settings_max_connections)', {h: 4, w: 4, x: 8, y: 0}, 'DB 최대 연결 중 지금 열린 연결 비율. 60% 노랑 · 80% 빨강 — 넘으면 새 연결이 거부될 수 있다. 서버를 늘리면 연결도 같이 늘어난다.', {unit: 'percentunit', thresholds: steps([0.6, 'yellow'], [0.8, 'red'])}),
    card('Redis 메모리', 'sum(redis_memory_used_bytes)', {h: 4, w: 4, x: 12, y: 0}, 'Redis 가 쓰는 메모리. 문 정보(현재 QR · 문 연 시각)만 두어 작게 유지된다 — 계속 커지면 지워지지 않는 키가 있다.', {unit: 'bytes', decimals: 1}),
    card('Redis 저장(AOF)', 'min(redis_aof_enabled * redis_aof_last_write_status)', {h: 4, w: 4, x: 16, y: 0}, 'Redis 가 디스크에 기록(AOF)을 남기고 있는지. "꺼짐 · 실패" 면 재시작 때 문을 연 시각이 사라진다 — 디스크 공간 · 권한을 본다.', {thresholds: {mode: 'absolute', steps: [{color: 'red', value: null}, {color: 'green', value: 1}]}, mappings: [{type: 'value', options: {1: {text: '정상', color: 'green', index: 0}, 0: {text: '꺼짐 · 실패', color: 'red', index: 1}}}]}),
    card('예약 작업 실패 (24시간)', 'round(sum(increase(scheduler_job_duration_seconds_count{result="failed"}[24h]))) or vector(0)', {h: 4, w: 4, x: 20, y: 0}, '스케줄러 작업(결제 대기 만료 · 환불 등)이 최근 24시간에 실패한 횟수. 1건이라도 있으면 아래 표에서 어느 작업인지 보고 스케줄러 로그(npm run docker:logs:scheduler)를 본다.', {unit: 'suffix:건', thresholds: steps([1, 'red']), mappings: ZERO_NONE}),
    row('큐 — 서버가 처리할 작업', 4),
    series('서버별 밀린 작업', [[WORK_BACKLOG, '{{queue_name}}']], {h: 7, w: 24, x: 0, y: 5}, '쓰기 요청(예약 · 결제 확인 등)이 서버별 큐에서 차례를 기다리는 수. 잠깐 솟았다 바로 0 으로 내려오면 정상, 줄지 않고 계속 늘면 그 서버가 모자라다. 게이트웨이 응답 큐는 바로 비워져 넣지 않았다.'),
    row('DB (PostgreSQL)', 12),
    series('연결 수 — 상태별', [[rename('sum by (state) (pg_stat_activity_count{state=~"active|idle|idle in transaction"})', 'state', PG_STATE_NAMES, 'state_name'), '{{state_name}}'], ['max(pg_settings_max_connections) * 0.8', PG_LIMIT]], {h: 7, w: 8, x: 0, y: 13}, 'DB 에 열린 연결. "트랜잭션 열고 멈춤" 이 오래 쌓이면 트랜잭션을 닫지 않는 코드가 있다. 합이 빨간 주의선에 닿으면 DB 최대 연결을 늘리거나 서버의 연결 풀을 줄인다.', {
        overrides: [by(PG_LIMIT, [{id: 'color', value: {mode: 'fixed', fixedColor: 'red'}}, {id: 'custom.lineStyle', value: {fill: 'dash', dash: [10, 10]}}])],
    }),
    series('초당 처리 — 커밋 · 롤백', [['sum(rate(pg_stat_database_xact_commit[5m]))', '커밋(저장)'], ['sum(rate(pg_stat_database_xact_rollback[5m]))', '롤백(취소)']], {h: 7, w: 8, x: 8, y: 13}, 'DB 가 1초에 끝낸 트랜잭션 수. 롤백이 갑자기 늘면 오류가 난 요청이 많다는 뜻 — 서비스 부하 대시보드의 오류 비율과 같이 본다.', {unit: 'ops'}),
    series('서버별 DB 연결', [['sum by (job, display_name) (db_client_connections{state="total"})', '{{display_name}}']], {h: 7, w: 8, x: 16, y: 13}, '앱 서버마다 열어 둔 DB 연결(연결 풀). 서버를 늘리면 이 합도 늘어난다 — DB 최대 연결을 넘지 않게 본다.'),
    row('Redis', 20),
    series('메모리', [['sum(redis_memory_used_bytes)', '사용']], {h: 7, w: 8, x: 0, y: 21}, 'Redis 가 쓰는 메모리. 문 정보만 두어 평평해야 정상이다.', {unit: 'bytes'}),
    series('연결 수', [['sum(redis_connected_clients)', '연결']], {h: 7, w: 8, x: 8, y: 21}, '앱 인스턴스마다 연결 1 ~ 2개(게이트웨이는 구독 연결 하나 더). 인스턴스 수와 같이 움직이면 정상이다.'),
    series('초당 명령', [['sum(rate(redis_commands_processed_total[5m]))', '명령']], {h: 7, w: 8, x: 16, y: 21}, 'Redis 가 1초에 처리한 명령. QR 확인 · 문 열기 · QR 동기화가 쓴다.', {unit: 'ops'}),
    row('예약 작업 (스케줄러)', 28),
    table(
        '작업별 실행 — 최근 24시간',
        [taskCount('done'), taskCount('failed')],
        {task_name: '작업', 'Value #A': '성공', 'Value #B': '실패'},
        {h: 8, w: 24, x: 0, y: 29},
        '스케줄러가 돌린 작업의 최근 24시간 회차. 실패 칸이 빨가면 스케줄러 로그(npm run docker:logs:scheduler)를 본다. 운영(NODE_ENV=production)에서만 돌아 개발 환경에서는 비어 있다.',
        [
            by('작업', [{id: 'custom.align', value: 'left'}]),
            by('성공', [{id: 'decimals', value: 0}, {id: 'unit', value: 'suffix:회'}]),
            by('실패', [{id: 'decimals', value: 0}, {id: 'unit', value: 'suffix:회'}, {id: 'thresholds', value: steps([1, 'red'])}, {id: 'custom.cellOptions', value: {type: 'color-background', mode: 'basic'}}]),
        ],
        [{displayName: '실패', desc: true}],
    ),
];

const out = path.join(repo, 'docker/grafana/dashboards');
fs.writeFileSync(path.join(out, 'deskless-service-load.json'), JSON.stringify(dashboard('deskless-service-load', '서비스 부하', '인스턴스를 늘려야 하나? — 맨 위 판정 표가 답한다', servicePanels, [jobVar]), null, 2) + '\n');
fs.writeFileSync(path.join(out, 'deskless-infra.json'), JSON.stringify(dashboard('deskless-infra', '인프라', 'DB · Redis · 큐 · 예약 작업은 괜찮나?', infraPanels, []), null, 2) + '\n');
console.log('✓ 대시보드 2개');
```

### `docs/monitoring.md` — 바뀌는 절

```markdown
<!-- before — 기록 규칙 표 -->
| `job:eventloop_utilization:avg` · `:max` | 서비스 평균 · 가장 바쁜 인스턴스 부하율 — **증설 판단 기준** |
| `job:process_cpu:rate1m` | 서비스 CPU(코어 수 단위, 인스턴스 합계) |
```

```markdown
<!-- after — 기록 규칙 표 -->
| `job:eventloop_utilization:avg` | 서비스 평균 부하율 — HPA 기준 |
| `job:eventloop_utilization:avg15m` | 서비스 평균 부하율의 15분 평균 — **증설 판정 기준**(판정 표 · 시간대별 부하 · 7일 칸) |

서비스 집계는 `by (job, display_name)` — `display_name` 은 `prometheus.yml` 이 앱 job 마다 붙이는 한국어 표시 이름이다.
```

```markdown
<!-- after — "대시보드 · 증설 판단" 절 전체 -->
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
```

`docs/monitoring.md` 의 "규칙" 절 라벨 조항에 한 줄 더한다:
```markdown
- **`display_name` 은 Prometheus 가 붙인다**(`prometheus.yml` 앱 job 의 `relabel_configs`) — 대시보드 표시용 한국어 이름. 앱은 이 라벨을 내지 않는다(`job` · `instance` 와 같은 취급).
```

### `docs/guides/monitoring-integration.md` — 바뀌는 곳

```markdown
<!-- before — 1절 사용 중인 서비스 이름 -->
**사용 중인 서비스 이름** — `gateway` · `user-service` · `admin-service` · `scheduler` · `web`(프론트 Next.js). 새 이름은 백엔드와 정한 뒤 이 표에 더한다.
```

```markdown
<!-- after -->
**사용 중인 서비스 이름**(대시보드 표시 이름) — `gateway`(게이트웨이) · `user-service`(이용자 서버) · `admin-service`(관리자 서버) · `scheduler`(스케줄러) · `web`(프론트 — Next.js). 새 이름은 표시 이름과 함께 백엔드와 정한 뒤 여기에 더한다.
```

```markdown
<!-- before — 2절 아래 -->
… 이벤트 루프가 없는 런타임은 CPU · 메모리만 내고, 부하율은 대시보드의 CPU 패널로 본다.
<!-- after -->
… 이벤트 루프가 없는 런타임은 CPU · 메모리만 내고, 판정 표에는 나오지 않는다 — 부하는 "늘리기 전에 확인"의 CPU 패널로 본다.
```

```markdown
<!-- before — 6절 3 -->
3. Grafana "서비스 부하" 대시보드 맨 위 서비스 목록에 이름이 나오고, 부하율 · CPU · 메모리 패널에 선이 그려진다.
<!-- after -->
3. Grafana "서비스 부하" 대시보드 맨 위 판정 표에 표시 이름이 나오고(Node — 이벤트 루프 지표가 있을 때), "늘리기 전에 확인"의 CPU · 메모리 패널에 선이 그려진다.
```

```markdown
<!-- before — 7절 -->
1. `docker/prometheus/prometheus.yml` 의 "앱" 에 한 줄 — `- {job_name: <이름>, dns_sd_configs: [{names: [<이름>], type: A, port: 9464, refresh_interval: 15s}]}`.
…
대시보드는 고치지 않는다 — 서비스 목록을 Prometheus 에서 읽는다(`label_values(nodejs_eventloop_time_seconds, job)`).
<!-- after -->
1. `docker/prometheus/prometheus.yml` 의 "앱" 에 job 하나 — `dns_sd_configs: [{names: [<이름>], type: A, port: 9464, refresh_interval: 15s}]` 와 `relabel_configs: [{target_label: display_name, replacement: '<표시 이름>'}]`(위 앱들과 같은 모양).
…
대시보드는 고치지 않는다 — 서비스 목록은 Prometheus 에서 읽고(`label_values(nodejs_eventloop_time_seconds, job)`), 이름은 `display_name` 으로 나온다.
```
머리말(3행)의 "인스턴스 수 · 부하율 · CPU · 메모리가 … 대시보드("서비스 부하")에 시간대별로 나오고" 는 "대수 · 부하율 · 판정이 '서비스 부하' 대시보드 판정 표와 시간대별 부하에, CPU · 메모리가 '늘리기 전에 확인'에 나오고" 로 바꾼다.

### `AGENTS.md` — 모니터링 절

```markdown
<!-- before -->
- **라벨은 개수가 정해진 값만** — 라우트 틀(`toRouteLabel`) · 명령 type · 잠금 키 · 상태 코드. ID · 주소 · 사용자 값 ❌(시계열이 터진다), `job` · `instance` ❌(Prometheus 가 붙이는 이름 — crontab 은 `task`). 모든 지표에 `service` 라벨.
…
- **다른 프로젝트(프론트 등)를 붙일 때**는 연결 규격 [docs/guides/monitoring-integration.md](docs/guides/monitoring-integration.md) 를 그 저장소에 넘기고, 백엔드는 `docker/prometheus/prometheus.yml` 수집 대상 한 줄 + 규격의 이름 목록만(대시보드 서비스 목록은 Prometheus 에서 읽는다).
```

```markdown
<!-- after -->
- **라벨은 개수가 정해진 값만** — 라우트 틀(`toRouteLabel`) · 명령 type · 잠금 키 · 상태 코드. ID · 주소 · 사용자 값 ❌(시계열이 터진다), `job` · `instance` · `display_name` ❌(Prometheus 가 붙이는 이름 — crontab 은 `task`, `display_name` 은 대시보드 한국어 표시 이름으로 `prometheus.yml` 이 붙인다). 모든 지표에 `service` 라벨.
…
- **다른 프로젝트(프론트 등)를 붙일 때**는 연결 규격 [docs/guides/monitoring-integration.md](docs/guides/monitoring-integration.md) 를 그 저장소에 넘기고, 백엔드는 `docker/prometheus/prometheus.yml` 수집 대상 하나(+ 표시 이름 `display_name`) + 규격의 이름 목록만(대시보드 서비스 목록은 Prometheus 에서 읽는다).
```

### `README.md` — 모니터링 줄

```markdown
<!-- before -->
| 9 | monitoring | `npm run docker:monitoring` | Prometheus · Grafana(http://localhost:3001 — 서비스 부하 · 인프라 대시보드) · …
<!-- after -->
| 9 | monitoring | `npm run docker:monitoring` | Prometheus · Grafana(http://localhost:3001 — 한국어 화면 · 홈이 서비스 부하 대시보드, 인프라 대시보드) · …
```

## 정한 값 (코드에 들어가는 기준 — 리뷰에서 바꿀 수 있다)
- 부하율 색: 50% 미만 초록 · 50 ~ 70% 노랑 · 70% 이상 빨강. 판정: 7일 중 3일 이상 1대 늘리기 · 1 ~ 2일 지켜보기 · 0일 여유(사용자 결정).
- 밀린 작업 카드: 10건부터 노랑 · 100건부터 빨강. DB 연결 사용률: 60% 노랑 · 80% 빨강. 실패한 작업 · 예약 작업 실패: 1건부터 빨강.

## 배포 (사용자 — 개발이 끝난 뒤)
- `npm run docker:monitoring` — Grafana 를 새 환경 값으로 다시 만든다(한국어 · 홈).
- `docker compose -f compose.monitoring.yml restart prometheus` — 수집 설정(`display_name`) · 기록 규칙을 다시 읽는다.
- 가짜 데이터를 다시 보려면: Prometheus 데이터를 지우고(`docker compose -f compose.monitoring.yml down` → `docker volume rm deskless-prometheus-data` → `npm run docker:monitoring`) 바뀐 가짜 지표 스크립트를 다시 실행한다 — 지난번 가짜 데이터에는 `display_name` · `avg15m` 이 없어 판정 표에 빈 이름 줄이 생긴다.

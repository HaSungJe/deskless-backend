# 모니터링 연결 규격 — 다른 프로젝트가 붙을 때

deskless 서버 모니터링(Prometheus · Grafana)에 **별도 저장소의 서비스**(프론트 Next.js · 새 서버 등)를 붙이는 규격이다. 이 문서 하나를 그 저장소에 그대로 넘기면 된다 — 백엔드 내부 구조를 몰라도 된다. 규격대로 붙으면 그 서비스의 대수 · 부하율 · 판정이 백엔드와 같은 "서비스 부하" 대시보드의 판정 표와 시간대별 부하에, CPU · 메모리가 "늘리기 전에 확인"에 나오고, 인스턴스를 늘릴지 판단하는 근거가 된다.

## 1. 붙는 조건 (필수)

| 항목 | 값 |
|---|---|
| 실행 위치 | 백엔드와 **같은 서버의 Docker**(compose) — 서버리스 호스팅(Vercel 등)은 Prometheus 가 가져갈 수 없어 대상 밖 |
| 네트워크 | 외부 네트워크 **`deskless-monitoring`** 에 붙는다(`external: true` — 백엔드의 `npm run docker:network` 가 만든다, internal 망이라 밖으로 나가지 않는다) |
| 서비스 이름 | compose 서비스 이름 = Prometheus 의 job 이름 = 지표의 `service` 라벨. 소문자 kebab, 아래 사용 중인 이름과 겹치지 않게 |
| 지표 포트 · 경로 | Docker 안 **9464** · **`GET /metrics`** · Prometheus 텍스트 형식(`text/plain; version=0.0.4`) |
| 노출 | 지표는 **전용 포트로만** — 공개 포트 · 공개 라우트(`/api/metrics` 같은)로 열지 않는다. 호스트 포트도 열지 않는다(`ports` 없이 내부망만) |
| 인스턴스 | 여러 대로 늘려도 된다(`--scale` · replicas) — Prometheus 가 서비스 이름을 DNS 로 풀어 인스턴스를 모두 찾는다 |

**사용 중인 서비스 이름**(대시보드 표시 이름) — `gateway`(게이트웨이) · `user-service`(이용자 서버) · `admin-service`(관리자 서버) · `scheduler`(스케줄러) · `web`(프론트 — Next.js). 새 이름은 표시 이름과 함께 백엔드와 정한 뒤 여기에 더한다.

## 2. 내야 하는 지표 (필수)

| 지표 | 종류 | 라벨 | 설명 |
|---|---|---|---|
| (모든 지표 공통) | — | `service` = 서비스 이름 | 기본 라벨로 붙인다 |
| `process_cpu_seconds_total` | counter | — | 프로세스 CPU 누적 초 |
| `process_resident_memory_bytes` | gauge | — | 프로세스 메모리 |
| `nodejs_eventloop_time_seconds` | gauge(누적) | `state` = `active` · `idle` | **Node 면 필수** — 이벤트 루프가 일한 · 쉰 누적 초(`performance.eventLoopUtilization()` 의 `active` · `idle` ÷ 1000). 부하율은 백엔드 Prometheus 가 이 값으로 계산한다 |

Node 는 `prom-client` 의 `collectDefaultMetrics()` 가 위 CPU · 메모리(+ 이벤트 루프 지연 · 힙 · GC)를 이 이름 그대로 낸다. Node 가 아니면 그 언어의 Prometheus 클라이언트로 같은 이름 · 단위를 낸다 — 이벤트 루프가 없는 런타임은 CPU · 메모리만 내고, 판정 표에는 나오지 않는다 — 부하는 "늘리기 전에 확인"의 CPU 패널로 본다.

## 3. 내면 좋은 지표 (선택)

이름 · 라벨이 같으면 대시보드 패널이 저절로 채워진다.

| 지표 | 종류 | 라벨 | 언제 |
|---|---|---|---|
| `http_server_request_duration_seconds` | histogram(구간 0.005 · 0.01 · 0.025 · 0.05 · 0.1 · 0.25 · 0.5 · 1 · 2.5 · 5 · 10 · 30초) | `method` · `route`(경로 틀) · `status_code` | HTTP 요청을 직접 받는 서버 |
| `http_server_active_requests` | gauge | — | 〃 처리 중인 요청 수 |
| `db_client_connections` | gauge | `state` = `total` · `idle` · `waiting` | DB 커넥션 풀이 있을 때 |

## 4. 라벨 · 이름 규칙

- **라벨에 끝없이 늘어나는 값 금지** — ID · 주소(쿼리 포함) · 사용자 입력 · 시각. 경로는 **틀**(`/reservation/:reservation_id`)로, 틀이 없으면 하나(`UNMATCHED`)로 묶는다. 값마다 시계열이 생겨 Prometheus 가 터진다.
- **`job` · `instance` 라벨 금지** — Prometheus 가 붙이는 이름이라 부딪히면 바뀐다(`exported_job`).
- 이름은 `snake_case`, 단위는 접미사(`_seconds` · `_bytes`), 누적은 `_total`. 서비스 전용 지표는 서비스 이름을 앞에 붙인다(`web_…`).

## 5. 예시 코드 — Node (Next.js)

Next.js 는 서버 시작 때 한 번 부르는 `instrumentation.ts` 에서 지표 서버를 연다(일반 Node 서버는 시작 코드에서 `startMetricsServer('<서비스 이름>')` 한 번). 의존성 `prom-client@^15`.

```ts
// instrumentation.ts — Node 런타임에서만
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const {startMetricsServer} = await import('./lib/metrics-server');
        startMetricsServer('web');
    }
}
```

```ts
// lib/metrics-server.ts
import {createServer} from 'node:http';
import {performance} from 'node:perf_hooks';
import {collectDefaultMetrics, Gauge, Registry} from 'prom-client';

/**
 * 지표 전용 서버 — /metrics 하나. 개발 모드의 다시 불러오기(HMR)로 두 번 열리지 않게 전역 표시를 둔다.
 *
 * @param service 서비스 이름(compose 서비스 이름 · Prometheus job 이름과 같다)
 */
export function startMetricsServer(service: string): void {
    const marker = globalThis as {__desklessMetrics?: boolean};
    if (marker.__desklessMetrics) {
        return;
    }
    marker.__desklessMetrics = true;
    const registry = new Registry();
    registry.setDefaultLabels({service});
    collectDefaultMetrics({register: registry});
    new Gauge({
        name: 'nodejs_eventloop_time_seconds',
        help: '이벤트 루프 누적 시간(초) — state: active · idle',
        labelNames: ['state'],
        registers: [registry],
        collect() {
            const elu = performance.eventLoopUtilization();
            this.set({state: 'active'}, elu.active / 1000);
            this.set({state: 'idle'}, elu.idle / 1000);
        },
    });
    const server = createServer((req, res) => {
        if (req.method !== 'GET' || req.url?.split('?')[0] !== '/metrics') {
            res.writeHead(404).end();
            return;
        }
        registry.metrics().then(
            (body) => res.writeHead(200, {'Content-Type': registry.contentType}).end(body),
            () => res.writeHead(500).end(),
        );
    });
    server.on('error', () => undefined); // 포트를 못 열어도 서비스는 그대로
    server.listen(Number(process.env.METRICS_PORT ?? 9468), process.env.METRICS_HOST ?? '127.0.0.1');
}
```

```yaml
# 그 저장소의 compose — 서비스 이름 · 네트워크 · 지표 env
services:
    web:
        environment:
            METRICS_PORT: '9464' # Docker 안은 9464 고정(로컬 기본 9468 은 백엔드 9464 ~ 9467 과 겹치지 않게)
            METRICS_HOST: '0.0.0.0' # 내부망에서만 닿는다
        networks: [default, monitoring]
networks:
    monitoring:
        name: deskless-monitoring
        external: true
```

## 6. 확인

1. 그 컨테이너 안에서 `wget -qO- http://127.0.0.1:9464/metrics | grep nodejs_eventloop_time_seconds` — `service="<이름>"` 이 붙어 나온다.
2. 백엔드 서버에서 Prometheus `http://localhost:9090/targets` — 그 job 의 인스턴스가 모두 **UP**.
3. Grafana "서비스 부하" 대시보드 맨 위 판정 표에 표시 이름이 나오고(Node — 이벤트 루프 지표가 있을 때), "늘리기 전에 확인"의 CPU · 메모리 패널에 선이 그려진다.

## 7. 백엔드가 할 일

1. `docker/prometheus/prometheus.yml` 의 "앱" 에 job 하나 — `dns_sd_configs: [{names: [<이름>], type: A, port: 9464, refresh_interval: 15s}]` 와 `relabel_configs: [{target_label: display_name, replacement: '<표시 이름>'}]`(위 앱들과 같은 모양).
2. 이 문서 1절의 "사용 중인 서비스 이름" 에 더한다.
3. `docker compose -f compose.monitoring.yml restart prometheus`.

대시보드는 고치지 않는다 — 서비스 목록은 Prometheus 에서 읽고(`label_values(nodejs_eventloop_time_seconds, job)`), 이름은 `display_name` 으로 나온다.

## 8. 요청 문서 틀

새 프로젝트에 넘기는 요청서. 프론트는 `.beaver/output/frontend/changes/<날짜>-<기능>.md` 에 두고(첫 사례: `2026-11-22-monitoring-web.md`), 다른 저장소는 그 저장소가 받는 곳에 둔다.

````md
# <서비스> 모니터링 연결 — 요청 (<YYYY-MM-DD>)

- 규격: deskless-backend `docs/guides/monitoring-integration.md`(이 문서를 함께 넘긴다)
- 반영 순서: 상관없음 — 백엔드 Prometheus 는 <이름> 이 붙기 전에는 대상 0개(오류 아님)

## 바뀐 이유
<왜 이 서비스의 지표가 필요한지 한 줄 — 예: 인스턴스 수를 정할 근거>

## 정한 값
- 서비스 이름 `<이름>` · 네트워크 `deskless-monitoring` · 지표 포트 9464(로컬 <포트>) · 경로 `/metrics`

## 할 일
- [ ] 의존성 `prom-client@^15`(Node) 또는 그 언어의 Prometheus 클라이언트
- [ ] 지표 서버(규격 5절 예시) — 서비스 이름 `<이름>`
- [ ] compose — 서비스 이름 · `deskless-monitoring` 네트워크 · `METRICS_PORT=9464` · `METRICS_HOST=0.0.0.0`
- [ ] 확인(규격 6절)

## 백엔드 쪽
- [x] `docker/prometheus/prometheus.yml` 에 수집 대상 `<이름>` (<커밋>)
````

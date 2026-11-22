# Plan — monitoring-dashboard

> 무엇을·왜는 [spec](../../spec/monitoring/monitoring-dashboard-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 진입점마다 핵심 코드(지표 모듈 · 계측 자리 · 모니터링 묶음 설정) ② 대시보드 패널의 쿼리(PromQL) ③ 규약만으로 예측할 수 없는 규칙(라우트 라벨 · 부하율 계산 · 인스턴스 찾기)
> **싣지 않는 것** 앱 모듈 배선 · compose 의 반복 블록 · Grafana JSON 의 화면 배치 — 형제 패턴을 표 한 줄로 가리킨다

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `package.json` · `package-lock.json` | 수정 | `prom-client@15.1.3` 의존성 · 스크립트 `docker:monitoring` · `docker:logs:monitoring` | 생략 (아래 4) |
| `tsconfig.json` | 수정 | 경로 `@app/monitoring/*` → `./libs/monitoring/src/*` | 생략 (아래 4) |
| `libs/monitoring/src/monitoring.constants.ts` | 신규 | 옵션 토큰 · 경로 · 응답 시간 구간 · 기본 포트 | 아래 1-1 |
| `libs/monitoring/src/metrics.service.ts` | 신규 | 레지스트리 · 기본 지표 · 이벤트 루프 사용 시간 · 지표 만들기(gauge · histogram) | 아래 1-1 |
| `libs/monitoring/src/metrics.server.ts` | 신규 | 지표 전용 HTTP 서버(`/metrics` 하나) — 부팅 뒤 열고 종료 때 닫음 | 아래 1-1 |
| `libs/monitoring/src/http-metrics.middleware.ts` · `monitoring.util.ts` | 신규 | HTTP 요청 횟수 · 시간 · 처리 중 수, 라우트 틀 라벨 | 아래 1-1 · 3-1 |
| `libs/monitoring/src/monitoring.module.ts` | 신규 | `MonitoringModule.forRoot({service, port, host, http})`(전역) | 아래 1-1 |
| `libs/messaging/src/command.dispatcher.ts` | 수정 | 큐 명령 처리 시간 · 판정(`@Optional` 지표) | 아래 1-1 |
| `libs/database/src/job-lock/job-lock.service.ts` | 수정 | crontab 회차 시간 · 결과(실행 · 실패 · 건너뜀) | 아래 1-1 |
| `libs/database/src/database-pool.metrics.ts` · `database.module.ts` | 신규 · 수정 | DB 커넥션 풀(전체 · 놀고 있는 · 기다리는) | 아래 1-1 |
| `apps/gateway/src/modules/transport/command-stream.service.ts` | 수정 | 응답을 기다리는 SSE 스트림 수 | 아래 1-1 |
| `apps/{gateway,user-service,admin-service,scheduler}/src/*.module.ts` | 수정 | `MonitoringModule.forRoot(...)` | 생략 (아래 4) |
| `scripts/docker-network.mjs` | 수정 | 네트워크 `deskless-monitoring`(internal) | 생략 (아래 4) |
| `compose.{gateway,user-service,admin-service,scheduler,rabbitmq}.yml` | 수정 | 앱 인스턴스 · RabbitMQ 를 모니터링 내부망에, 앱 지표 포트 env | 아래 1-2 (gateway 하나) · 나머지 생략 |
| `compose.monitoring.yml` | 신규 | Prometheus · Grafana · PostgreSQL 수집기 · Redis 수집기 | 아래 1-2 |
| `docker/prometheus/prometheus.yml` · `rules.yml` | 신규 | 인스턴스 찾기 · 수집 · 기록 규칙 | 아래 1-2 · 3-2 |
| `docker/grafana/provisioning/datasources/prometheus.yml` · `dashboards/deskless.yml` | 신규 | 데이터 원본 · 대시보드 폴더 미리 넣기 | 아래 1-2 |
| `docker/grafana/dashboards/deskless-service-load.json` · `deskless-infra.json` | 신규 | 대시보드 2개 | 쿼리 아래 1-3 · 1-4, 화면 배치는 생략 |
| `.beaver/output/frontend/changes/2026-11-22-monitoring-web.md` · `changes/README.md` | 신규 · 수정 | 프론트 수정 요청 — Next.js 서버 지표(`instrumentation.ts` · 지표 이름 · 포트 · 내부망 · 서비스 이름 `web`) | 아래 1-5 |
| `docs/guides/monitoring-integration.md` | 신규 | 다른 프로젝트를 모니터링에 붙이는 규격(그 저장소에 그대로 넘기는 독립 문서) — 아래 3-5 | 생략 (아래 3-5 목차) |
| `.env.example` · `README.md` | 수정 | 지표 포트 · 모니터링 env, 모니터링 묶음 · 접속 · 판단 기준 | 생략 |
| `docs/monitoring.md`(새) · `AGENTS.md` · `docs/architecture.md` | 신규 · 수정 | 모니터링 규약(새 영역 — §4.5 초안 표시) | 생략 |
| `.beaver/output/report/monitoring/monitoring-dashboard-report.md` | 신규 | build 리포트 | 생략 |

---

## 1. 비즈니스 로직 — 진입점별 코드

### 1-1. 앱 지표 — `MonitoringModule` · 계측 자리

지표는 **앱을 막지 않는다** — 포트를 못 열면 경고만, 계측하는 쪽은 `@Optional()` 로 받아 모듈이 없으면(테스트 · 마이그레이션 실행기) 아무것도 하지 않는다. 지표 정의는 그 지표를 내는 부품 안에 둔다(디스패처 · 잠금 · 풀 · 스트림) — 이름 목록은 `docs/monitoring.md` 한 곳에 모은다.

```ts
// libs/monitoring/src/monitoring.constants.ts
/** MonitoringModule 옵션 주입 토큰 */
export const MONITORING_OPTIONS = Symbol('MonitoringOptions');

/** 지표 경로 — 지표 전용 포트에서 이 경로만 연다 */
export const METRICS_PATH = '/metrics';

/** 응답 · 처리 시간 구간(초) — 큐 경로 SSE 는 기본 30초까지 걸린다 */
export const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

/** 라우트를 못 찾은 요청(정적 파일 · 404)의 라우트 라벨 — 주소를 그대로 라벨로 쓰지 않는다 */
export const UNMATCHED_ROUTE = 'UNMATCHED';

/** MonitoringModule 옵션 */
export interface MonitoringOptions {
    /** 앱 이름 — 모든 지표의 service 라벨 */
    service: string;
    /** 지표 전용 포트 */
    port: number;
    /** 바인딩 주소 — 로컬 127.0.0.1, Docker 0.0.0.0(모니터링 내부망만 닿는다) */
    host: string;
    /** HTTP 요청 지표 미들웨어를 붙이는지 — scheduler 는 false(HTTP 없음) */
    http: boolean;
}
```

```ts
// libs/monitoring/src/metrics.service.ts
import {Inject, Injectable} from '@nestjs/common';
import {performance} from 'node:perf_hooks';
import {collectDefaultMetrics, Gauge, Histogram, Registry} from 'prom-client';
import type {GaugeConfiguration, HistogramConfiguration} from 'prom-client';
import {MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';

/**
 * 앱 하나의 지표 레지스트리 — 기본 지표(CPU · 메모리 · 이벤트 루프 지연 · GC) + 이벤트 루프 사용 시간 + 부품이 만드는 지표.
 * 모든 지표에 service 라벨이 붙는다(쿠버네티스로 가도 같은 이름 · 라벨).
 */
@Injectable()
export class MetricsService {
    readonly registry = new Registry();

    /**
     * @param options 모니터링 옵션
     */
    constructor(@Inject(MONITORING_OPTIONS) options: MonitoringOptions) {
        this.registry.setDefaultLabels({service: options.service});
        collectDefaultMetrics({register: this.registry});
        // 부하율의 원천 — 이벤트 루프가 일한 · 쉰 누적 시간(초). 비율은 Prometheus 가 rate 로 계산한다(긁는 쪽이 여럿이어도 맞다)
        new Gauge({
            name: 'nodejs_eventloop_time_seconds',
            help: '이벤트 루프 누적 시간(초) — state: active(일함) · idle(쉼)',
            labelNames: ['state'],
            registers: [this.registry],
            collect() {
                const elu = performance.eventLoopUtilization();
                this.set({state: 'active'}, elu.active / 1000);
                this.set({state: 'idle'}, elu.idle / 1000);
            },
        });
    }

    /**
     * 게이지를 만들어 이 앱 레지스트리에 등록한다.
     *
     * @param config 이름 · 설명 · 라벨 · collect
     * @returns 게이지
     */
    gauge<T extends string>(config: Omit<GaugeConfiguration<T>, 'registers'>): Gauge<T> {
        return new Gauge({...config, registers: [this.registry]});
    }

    /**
     * 히스토그램을 만들어 이 앱 레지스트리에 등록한다.
     *
     * @param config 이름 · 설명 · 라벨 · 구간(기본 DURATION_BUCKETS)
     * @returns 히스토그램
     */
    histogram<T extends string>(config: Omit<HistogramConfiguration<T>, 'registers'>): Histogram<T> {
        return new Histogram({buckets: DURATION_BUCKETS, ...config, registers: [this.registry]});
    }
}
```

```ts
// libs/monitoring/src/metrics.server.ts
import {Inject, Injectable, Logger} from '@nestjs/common';
import type {OnApplicationBootstrap, OnApplicationShutdown} from '@nestjs/common';
import {createServer} from 'node:http';
import type {Server} from 'node:http';
import {METRICS_PATH, MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';
import {MetricsService} from './metrics.service.js';

/**
 * 지표 전용 HTTP 서버 — /metrics 하나만. 앱 HTTP 서버(공개 · 내부 API)와 포트가 달라 내부 토큰 · 공개 경로 규칙과 섞이지 않는다.
 * 부팅을 마친 뒤 열고(못 열면 경고만 — 앱은 그대로 돈다) 종료 때 닫는다.
 */
@Injectable()
export class MetricsServer implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(MetricsServer.name);
    private server: Server | null = null;

    /**
     * @param options 모니터링 옵션
     * @param metrics 지표 레지스트리
     */
    constructor(
        @Inject(MONITORING_OPTIONS) private readonly options: MonitoringOptions,
        private readonly metrics: MetricsService,
    ) {}

    /**
     * 지표 서버를 연다.
     */
    onApplicationBootstrap(): void {
        const registry = this.metrics.registry;
        const server = createServer((req, res) => {
            if (req.method !== 'GET' || req.url?.split('?')[0] !== METRICS_PATH) {
                res.writeHead(404).end();
                return;
            }
            registry
                .metrics()
                .then((body) => res.writeHead(200, {'Content-Type': registry.contentType}).end(body))
                .catch(() => res.writeHead(500).end());
        });
        server.on('error', (error) => this.logger.warn(`지표 서버를 열지 못함(${this.options.host}:${this.options.port}) — 지표 없이 계속: ${error.message}`));
        server.listen(this.options.port, this.options.host, () => this.logger.log(`지표 서버 ${this.options.host}:${this.options.port}${METRICS_PATH}`));
        this.server = server;
    }

    /**
     * 지표 서버를 닫는다.
     */
    async onApplicationShutdown(): Promise<void> {
        const server = this.server;
        this.server = null;
        if (server?.listening) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    }
}
```

```ts
// libs/monitoring/src/http-metrics.middleware.ts
import {Injectable} from '@nestjs/common';
import type {NestMiddleware} from '@nestjs/common';
import type {NextFunction, Request, Response} from 'express';
import type {Gauge, Histogram} from 'prom-client';
import {MetricsService} from './metrics.service.js';
import {toRouteLabel} from './monitoring.util.js';

/**
 * HTTP 요청 지표 — 횟수 · 걸린 시간(메서드 · 라우트 틀 · 상태 코드) · 처리 중인 수. 응답이 끝날 때(finish · close 중 먼저, 한 번) 잰다 — api-log 미들웨어와 같은 자리.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
    private readonly duration: Histogram<'method' | 'route' | 'status_code'>;
    private readonly active: Gauge;

    /**
     * @param metrics 지표 레지스트리
     */
    constructor(metrics: MetricsService) {
        this.duration = metrics.histogram({name: 'http_server_request_duration_seconds', help: 'HTTP 요청 처리 시간(초)', labelNames: ['method', 'route', 'status_code']});
        this.active = metrics.gauge({name: 'http_server_active_requests', help: '처리 중인 HTTP 요청 수'});
    }

    /**
     * 요청 시작 — 끝날 때 한 번 잰다.
     *
     * @param req 요청
     * @param res 응답
     * @param next 다음
     */
    use(req: Request, res: Response, next: NextFunction): void {
        const end = this.duration.startTimer({method: req.method});
        this.active.inc();
        let done = false;
        const finish = (): void => {
            if (done) {
                return;
            }
            done = true;
            this.active.dec();
            end({route: toRouteLabel(req), status_code: String(res.statusCode)});
        };
        res.once('finish', finish);
        res.once('close', finish);
        next();
    }
}
```

```ts
// libs/monitoring/src/monitoring.module.ts
import {Global, Inject, Module} from '@nestjs/common';
import type {DynamicModule, MiddlewareConsumer, NestModule} from '@nestjs/common';
import {HttpMetricsMiddleware} from './http-metrics.middleware.js';
import {MetricsServer} from './metrics.server.js';
import {MetricsService} from './metrics.service.js';
import {MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';

/**
 * 모니터링 모듈(전역) — 앱 루트 모듈이 forRoot 로 한 번 들인다. MetricsService 를 내보내 부품(디스패처 · 잠금 · 풀 · 스트림)이 @Optional 로 받는다.
 */
@Global()
@Module({})
export class MonitoringModule implements NestModule {
    /**
     * @param options 모니터링 옵션
     * @returns 동적 모듈
     */
    static forRoot(options: MonitoringOptions): DynamicModule {
        return {
            module: MonitoringModule,
            providers: [{provide: MONITORING_OPTIONS, useValue: options}, MetricsService, MetricsServer, HttpMetricsMiddleware],
            exports: [MetricsService],
        };
    }

    /**
     * @param options 모니터링 옵션
     */
    constructor(@Inject(MONITORING_OPTIONS) private readonly options: MonitoringOptions) {}

    /**
     * HTTP 앱이면 모든 라우트에 요청 지표 미들웨어 — scheduler(HTTP 없음)는 붙이지 않는다.
     *
     * @param consumer 미들웨어 등록기
     */
    configure(consumer: MiddlewareConsumer): void {
        if (this.options.http) {
            consumer.apply(HttpMetricsMiddleware).forRoutes('*');
        }
    }
}
```

계측 자리 3곳 + 게이트웨이 스트림:

```ts
// libs/messaging/src/command.dispatcher.ts — 생성자 · dispatch (기존 판정 본문은 private decide 로 옮기고 그대로, 명령 type 도 함께 돌려받는다)
    private readonly duration: Histogram<'type' | 'action' | 'outcome'> | null;

    constructor(
        private readonly registry: CommandHandlerRegistry,
        @Optional() metrics?: MetricsService,
    ) {
        this.duration = metrics?.histogram({name: 'messaging_command_duration_seconds', help: '큐 명령 1건 처리 시간(초)', labelNames: ['type', 'action', 'outcome']}) ?? null;
    }

    async dispatch(content: Buffer, deliveryCount: number): Promise<DispatchDecision> {
        const end = this.duration?.startTimer();
        const {type, decision} = await this.decide(content, deliveryCount);
        // outcome — 회신한 결과: done · failed, 회신 없음(재시도 · 형식 오류): none
        end?.({type: type ?? 'UNKNOWN', action: decision.action, outcome: decision.result === null ? 'none' : decision.result.payload.error === null ? 'done' : 'failed'});
        return decision;
    }
```

```ts
// libs/database/src/job-lock/job-lock.service.ts — 생성자 · runExclusive
    private readonly duration: Histogram<'job' | 'result'> | null;

    constructor(
        private readonly dataSource: DataSource,
        @Optional() metrics?: MetricsService,
    ) {
        this.duration = metrics?.histogram({name: 'scheduler_job_duration_seconds', help: 'crontab 회차 시간(초) — result: done · failed · skipped(다른 인스턴스가 잡음)', labelNames: ['job', 'result']}) ?? null;
    }

    async runExclusive(key: string, job: () => Promise<void>): Promise<boolean> {
        const end = this.duration?.startTimer({job: key});
        const runner = this.dataSource.createQueryRunner();
        await runner.connect();
        try {
            const rows: {locked: boolean}[] = await runner.query(JOB_LOCK_SQL.TRY, [key]);
            if (rows[0]?.locked !== true) {
                end?.({result: 'skipped'});
                return false;
            }
            try {
                await job();
                end?.({result: 'done'});
                return true;
            } catch (error) {
                end?.({result: 'failed'});
                throw error;
            } finally {
                await runner.query(JOB_LOCK_SQL.UNLOCK, [key]);
            }
        } finally {
            await runner.release();
        }
    }
```

```ts
// libs/database/src/database-pool.metrics.ts — 새 provider(DatabaseModule providers 에 등록)
/**
 * DB 커넥션 풀 지표 — 긁을 때 pg 풀의 전체 · 놀고 있는 · 기다리는 수를 읽는다. 풀이 차서 기다림이 생기면 인스턴스를 늘려도 빨라지지 않는다.
 */
@Injectable()
export class DatabasePoolMetrics implements OnModuleInit {
    /**
     * @param dataSource TypeORM DataSource
     * @param metrics 지표 레지스트리(모니터링 모듈이 없으면 없음)
     */
    constructor(
        private readonly dataSource: DataSource,
        @Optional() private readonly metrics?: MetricsService,
    ) {}

    /**
     * 풀 게이지 등록
     */
    onModuleInit(): void {
        const driver = this.dataSource.driver as unknown as {master?: {totalCount: number; idleCount: number; waitingCount: number}};
        this.metrics?.gauge({
            name: 'db_client_connections',
            help: 'DB 커넥션 풀 — state: total(열린) · idle(놀고 있는) · waiting(연결을 기다리는 요청)',
            labelNames: ['state'],
            collect() {
                const pool = driver.master;
                if (pool) {
                    this.set({state: 'total'}, pool.totalCount);
                    this.set({state: 'idle'}, pool.idleCount);
                    this.set({state: 'waiting'}, pool.waitingCount);
                }
            },
        });
    }
}
```

```ts
// apps/gateway/src/modules/transport/command-stream.service.ts — 생성자에 @Optional() metrics?: MetricsService, onModuleInit 끝에
        const streams = this.streams;
        this.metrics?.gauge({name: 'gateway_command_streams_pending', help: '큐 명령 결과를 기다리는 SSE 스트림 수', collect() { this.set(streams.size); }});
```

### 1-2. 모니터링 묶음 — `compose.monitoring.yml` · Prometheus · Grafana 설정

```yaml
# compose.monitoring.yml — 일부(공통 logging 앵커 · 주석은 다른 묶음과 같다)
name: deskless-monitoring

services:
    prometheus:
        image: prom/prometheus:v3.16.0
        container_name: deskless-prometheus
        command:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.path=/prometheus'
            - '--storage.tsdb.retention.time=${PROMETHEUS_RETENTION:-30d}'
        volumes:
            - ./docker/prometheus:/etc/prometheus:ro
            - prometheus-data:/prometheus
        ports:
            - '127.0.0.1:${PROMETHEUS_PORT:-9090}:9090'
        networks: [monitoring, default]
        restart: unless-stopped

    grafana:
        image: grafana/grafana:13.2.6
        container_name: deskless-grafana
        environment:
            GF_SECURITY_ADMIN_USER: '${GRAFANA_ADMIN_USER:-admin}'
            GF_SECURITY_ADMIN_PASSWORD: '${GRAFANA_ADMIN_PASSWORD:?.env 에 GRAFANA_ADMIN_PASSWORD 가 필요합니다}'
            GF_USERS_ALLOW_SIGN_UP: 'false'
            GF_AUTH_ANONYMOUS_ENABLED: 'false'
        volumes:
            - ./docker/grafana/provisioning:/etc/grafana/provisioning:ro
            - ./docker/grafana/dashboards:/var/lib/grafana/dashboards:ro
            - grafana-data:/var/lib/grafana
        ports:
            - '127.0.0.1:${GRAFANA_PORT:-3001}:3000'
        networks: [default]
        depends_on: [prometheus]
        restart: unless-stopped

    postgres-exporter:
        image: prometheuscommunity/postgres-exporter:v0.20.1
        environment:
            DATA_SOURCE_NAME: '${MONITORING_DATABASE_URL:?.env 에 MONITORING_DATABASE_URL 이 필요합니다}'
        networks: [monitoring, data]
        restart: unless-stopped

    redis-exporter:
        image: oliver006/redis_exporter:v1.97.0-alpine
        environment:
            REDIS_ADDR: '${REDIS_URL:?.env 에 REDIS_URL 이 필요합니다}'
        networks: [monitoring, data]
        restart: unless-stopped

networks:
    monitoring:
        name: deskless-monitoring
        external: true
    data:
        name: deskless-data
        external: true
    default: {} # 호스트 포트용 — internal 망에서는 포트를 열 수 없다

volumes:
    prometheus-data:
        name: deskless-prometheus-data
    grafana-data:
        name: deskless-grafana-data
```

```yaml
# compose.gateway.yml — gateway 인스턴스(형제: user-service · admin-service · scheduler 도 같은 3가지)
    gateway:
        environment:
            # 지표 전용 포트 — 모니터링 내부망에서만 닿는다(서버 구성 — .env 값과 무관)
            GATEWAY_METRICS_PORT: '9464'
            METRICS_HOST: '0.0.0.0'
        networks: [edge, service, broker, data, monitoring]
networks:
    monitoring:
        name: deskless-monitoring
        external: true
# compose.rabbitmq.yml — rabbitmq: networks: [broker, monitoring] (+ 같은 networks 블록) — 이미지에 든 Prometheus 플러그인(15692)
```

```yaml
# docker/prometheus/prometheus.yml
global:
    scrape_interval: 15s
    evaluation_interval: 15s

rule_files:
    - /etc/prometheus/rules.yml

scrape_configs:
    # 앱 — Docker 내장 DNS 로 서비스 이름의 인스턴스를 모두 찾는다(--scale 을 15초 안에 따라간다). job = 앱 이름
    - {job_name: gateway, dns_sd_configs: [{names: [gateway], type: A, port: 9464, refresh_interval: 15s}]}
    - {job_name: user-service, dns_sd_configs: [{names: [user-service], type: A, port: 9464, refresh_interval: 15s}]}
    - {job_name: admin-service, dns_sd_configs: [{names: [admin-service], type: A, port: 9464, refresh_interval: 15s}]}
    - {job_name: scheduler, dns_sd_configs: [{names: [scheduler], type: A, port: 9464, refresh_interval: 15s}]}
    # 프론트 Next.js 서버(별도 저장소 — 같은 서버의 Docker, 서비스 이름 web 으로 deskless-monitoring 에 붙는다). 아직 없으면 대상 0개 — 오류 아님
    - {job_name: web, dns_sd_configs: [{names: [web], type: A, port: 9464, refresh_interval: 15s}]}
    # RabbitMQ — 큐별 지표(적체 · 소비자)는 detailed 엔드포인트, 전체 지표는 기본 엔드포인트
    - job_name: rabbitmq-queues
      metrics_path: /metrics/detailed
      params: {family: [queue_coarse_metrics, queue_consumer_count]}
      static_configs: [{targets: ['rabbitmq:15692']}]
    - {job_name: rabbitmq, static_configs: [{targets: ['rabbitmq:15692']}]}
    - {job_name: postgres, static_configs: [{targets: ['postgres-exporter:9187']}]}
    - {job_name: redis, static_configs: [{targets: ['redis-exporter:9121']}]}
```

```yaml
# docker/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
    - {name: Prometheus, uid: deskless-prometheus, type: prometheus, access: proxy, url: 'http://prometheus:9090', isDefault: true, editable: false}
# docker/grafana/provisioning/dashboards/deskless.yml
apiVersion: 1
providers:
    - {name: deskless, folder: Deskless, type: file, disableDeletion: true, allowUiUpdates: false, options: {path: /var/lib/grafana/dashboards}}
```

### 1-3. 서비스 부하 대시보드 — `deskless-service-load.json` 패널 쿼리

변수 `job` — **Prometheus 에서 읽는다**(`label_values(nodejs_eventloop_time_seconds, job)` — 고정 목록 ❌, 규격대로 붙은 새 프로젝트가 저절로 나온다). 지금은 gateway · user-service · admin-service · scheduler · web(붙으면), 여러 개 — HTTP · DB · 큐 패널은 그 지표를 내는 서비스만 값이 있다 — 쿼리는 기록 규칙(아래 3-2)을 쓴다. 부하율 패널에는 0.7 기준선(threshold), 안내문 패널(텍스트)에 spec 의 판단 기준.

```promql
# ① 지금 상태(숫자 카드)
count by (job) (up{job=~"$job"} == 1)                                   # 인스턴스 수
job:eventloop_utilization:avg{job=~"$job"}                              # 평균 부하율
job:eventloop_utilization:max{job=~"$job"}                              # 가장 바쁜 인스턴스
job:http_requests:rate1m{job=~"$job"}                                    # 초당 요청
job:http_request_duration_seconds:p95{job=~"$job"}                      # 95% 응답 시간
job:http_errors:ratio{job=~"$job"}                                       # 5xx 비율
sum by (queue) (rabbitmq_detailed_queue_messages_ready{queue=~"q.user.cmd|q.admin.cmd"})   # 큐 적체

# ② 추이(시간축 — 인스턴스별 + 평균)
instance:eventloop_utilization:ratio{job=~"$job"}                       # 부하율(인스턴스별)
rate(process_cpu_seconds_total{job=~"$job"}[1m])                          # CPU(코어 수 단위)
process_resident_memory_bytes{job=~"$job"}                                 # 메모리
nodejs_eventloop_lag_p99_seconds{job=~"$job"}                              # 이벤트 루프 지연 p99
sum by (job, instance) (rate(http_server_request_duration_seconds_count{job=~"$job"}[1m]))   # 인스턴스별 초당 요청(고르게 나뉘는지)
histogram_quantile(0.5, sum by (job, le) (rate(http_server_request_duration_seconds_bucket{job=~"$job"}[5m])))  # p50 (p95 · p99 도 같은 모양)
sum by (job) (http_server_active_requests{job=~"$job"})                   # 처리 중
max by (job) (db_client_connections{job=~"$job", state="waiting"})        # DB 연결 대기
sum by (job, type) (rate(messaging_command_duration_seconds_count{job=~"user-service|admin-service"}[5m]))  # 큐 명령 처리량
gateway_command_streams_pending                                           # SSE 대기

# ③ 시간대 비교 — 같은 그래프에 지금 · 어제 · 지난주 같은 시각
job:eventloop_utilization:avg{job=~"$job"}
job:eventloop_utilization:avg{job=~"$job"} offset 1d
job:eventloop_utilization:avg{job=~"$job"} offset 7d
# 최근 7일 시간대별 최대 부하(막대 — 1시간 간격, 패널 시간 범위 7일 고정)
max_over_time(job:eventloop_utilization:max{job=~"$job"}[1h])
```

### 1-4. 인프라 대시보드 — `deskless-infra.json` 패널 쿼리

```promql
# PostgreSQL
sum by (state) (pg_stat_activity_count)                                   # 연결 수(상태별)
pg_settings_max_connections                                                # 최대 연결(기준선 80%)
sum(rate(pg_stat_database_xact_commit[1m])) · sum(rate(pg_stat_database_xact_rollback[1m]))
sum(rate(pg_stat_database_blks_hit[5m])) / (sum(rate(pg_stat_database_blks_hit[5m])) + sum(rate(pg_stat_database_blks_read[5m])))   # 캐시 적중률
sum(rate(pg_stat_database_deadlocks[5m]))  ·  pg_database_size_bytes
# Redis
redis_memory_used_bytes · rate(redis_commands_processed_total[1m]) · redis_connected_clients
rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
redis_aof_enabled · redis_aof_last_bgrewrite_status
# RabbitMQ
rabbitmq_detailed_queue_messages_ready · rabbitmq_detailed_queue_messages_unacked · rabbitmq_detailed_queue_consumers   (by queue)
rate(rabbitmq_global_messages_received_total[1m]) · rate(rabbitmq_global_messages_delivered_total[1m])
rabbitmq_detailed_queue_messages_ready{queue="q.dead"}                     # DLQ
# scheduler — crontab
sum by (job, result) (increase(scheduler_job_duration_seconds_count[1h]))   # 작업별 실행 · 실패 · 건너뜀
histogram_quantile(0.95, sum by (job, le) (rate(scheduler_job_duration_seconds_bucket[1h])))
```

### 1-5. 프론트 수정 요청 문서에 싣는 코드 — Next.js 서버 지표(프론트 저장소가 넣는다)

백엔드와 **같은 지표 이름**(`prom-client` 기본 지표 + `nodejs_eventloop_time_seconds{state}`)을 써야 기록 규칙(부하율)과 대시보드를 그대로 쓴다. `/metrics` 를 Next.js 라우트로 열면 공개 주소에 노출되므로 전용 포트로 연다. 개발 모드의 다시 불러오기(HMR)로 두 번 열리지 않게 전역 표시를 둔다.

```ts
// instrumentation.ts (Next.js 가 서버 시작 때 한 번 부른다 — Node 런타임에서만)
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const {startMetricsServer} = await import('./lib/metrics-server');
        startMetricsServer();
    }
}
```

```ts
// lib/metrics-server.ts
import {createServer} from 'node:http';
import {performance} from 'node:perf_hooks';
import {collectDefaultMetrics, Gauge, Registry} from 'prom-client';

/** Next.js 서버 지표 전용 서버 — /metrics 하나, 백엔드와 같은 지표 이름 · service 라벨 web */
export function startMetricsServer(): void {
    const marker = globalThis as {__desklessMetrics?: boolean};
    if (marker.__desklessMetrics) {
        return;
    }
    marker.__desklessMetrics = true;
    const registry = new Registry();
    registry.setDefaultLabels({service: 'web'});
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
        registry.metrics().then((body) => res.writeHead(200, {'Content-Type': registry.contentType}).end(body), () => res.writeHead(500).end());
    });
    server.on('error', () => undefined); // 포트를 못 열어도 화면은 그대로
    server.listen(Number(process.env.WEB_METRICS_PORT ?? 9468), process.env.METRICS_HOST ?? '127.0.0.1');
}
```

프론트 compose 의 서비스 이름 `web`, 네트워크 `deskless-monitoring`(external), env `WEB_METRICS_PORT: '9464'` · `METRICS_HOST: '0.0.0.0'` — 로컬 기본 9468 은 백엔드(9464 ~ 9467)와 겹치지 않게. 반영 순서는 상관없다(백엔드 Prometheus 는 `web` 이 없으면 대상 0개).

---

## 3. 데이터 규칙 — 규약만으로 예측할 수 없는 부분

### 3-1. 라우트 라벨은 경로 틀로 — `libs/monitoring/src/monitoring.util.ts`

실제 주소(`/reservation/5a3e…`)를 라벨로 쓰면 예약 ID 마다 시계열이 생겨 Prometheus 가 터진다. Express 가 맞춘 라우트 틀(`req.route.path` — Nest 는 컨트롤러 경로 전체를 등록한다)을 쓰고, 틀이 없으면(정적 파일 · 404 · 지표 서버 밖) 하나로 묶는다.

```ts
/**
 * HTTP 요청의 라우트 라벨 — Express 가 맞춘 라우트 틀(:id 그대로), 없으면 UNMATCHED
 *
 * @param req 요청(응답이 끝난 뒤 — 라우팅을 거친 상태)
 * @returns 라우트 라벨
 */
export function toRouteLabel(req: Request): string {
    const path = (req.route as {path?: unknown} | undefined)?.path;
    return typeof path === 'string' ? `${req.baseUrl}${path}` : UNMATCHED_ROUTE;
}
```

### 3-2. 부하율 · 서비스별 값은 기록 규칙으로 — `docker/prometheus/rules.yml`

부하율(이벤트 루프 사용률)은 앱이 순간값을 내지 않고 **누적 시간(active · idle)** 을 내고 Prometheus 가 rate 로 나눈다 — 앱이 직전 긁기와의 차이로 계산하면 긁는 쪽이 둘(로컬 Prometheus + 쿠버네티스 등)일 때 서로 구간을 빼앗는다. 서비스별 값은 기록 규칙으로 미리 계산해 대시보드 · 나중의 HPA 가 같은 이름을 쓴다.

```yaml
groups:
    - name: deskless-service-load
      rules:
          - record: instance:eventloop_utilization:ratio
            expr: sum without (state) (rate(nodejs_eventloop_time_seconds{state="active"}[1m])) / sum without (state) (rate(nodejs_eventloop_time_seconds[1m]))
          - record: job:eventloop_utilization:avg
            expr: avg by (job) (instance:eventloop_utilization:ratio)
          - record: job:eventloop_utilization:max
            expr: max by (job) (instance:eventloop_utilization:ratio)
          - record: job:http_requests:rate1m
            expr: sum by (job) (rate(http_server_request_duration_seconds_count[1m]))
          - record: job:http_request_duration_seconds:p95
            expr: histogram_quantile(0.95, sum by (job, le) (rate(http_server_request_duration_seconds_bucket[5m])))
          - record: job:http_errors:ratio
            expr: sum by (job) (rate(http_server_request_duration_seconds_count{status_code=~"5.."}[5m])) / sum by (job) (rate(http_server_request_duration_seconds_count[5m]))
```

### 3-3. 인스턴스 찾기는 Docker DNS — 서비스 이름 = 모든 인스턴스

같은 외부 네트워크에 붙은 컨테이너는 compose 서비스 이름(`user-service`)이 별칭이라 DNS 가 인스턴스 IP 를 모두 돌려준다 — nginx 의 `resolve` 와 같은 원리(`docker/nginx/user-service.conf`). 그래서 앱 인스턴스(LB 아님)를 `deskless-monitoring` 에 붙인다. 지운 인스턴스는 DNS 에서 빠져 목록에서 사라진다(꺼진 것으로 남지 않는다) — 인스턴스 수 카드는 "지금 찾은 · 살아 있는 수" 다.

### 3-4. PostgreSQL 수집기 주소는 따로 — `MONITORING_DATABASE_URL`

수집기(lib/pq)는 주소의 모르는 질의 값을 서버 설정으로 넘겨서, 앱 `DATABASE_URL` 의 `?schema=public` 이 붙으면 접속이 실패한다. 수집기 전용 env 로 두고 `.env.example` 에 `postgresql://deskless:deskless@postgres:5432/deskless?sslmode=disable` 예시(읽기 전용 계정 권장 — `pg_monitor` 역할).

### 3-5. 다른 프로젝트 연결 규격 — `docs/guides/monitoring-integration.md`(사용자 요청 2026-11-22)

제3의 프로젝트(별도 저장소)가 들어올 때 **이 문서 하나를 그 저장소에 넘기면** 붙을 수 있게 쓴다 — 백엔드 내부 구조는 싣지 않는다. 목차:

1. **붙는 조건(필수)** — 같은 서버의 Docker, 외부 네트워크 `deskless-monitoring`(external) 에 붙는 compose 서비스, **서비스 이름 = 지표의 job 이름**(소문자 kebab, 다른 서비스와 겹치지 않게 — 지금 쓰는 이름 목록), 지표 포트 Docker 안 **9464** · 경로 **`/metrics`** · Prometheus 텍스트 형식, 공개 포트 · 공개 라우트로 지표를 열지 않는다.
2. **내야 하는 지표(필수)** — 모든 지표에 `service` 라벨(= 서비스 이름), 프로세스 CPU · 메모리(`process_cpu_seconds_total` · `process_resident_memory_bytes`), 부하율 원천 — Node 면 `nodejs_eventloop_time_seconds{state="active"|"idle"}`(누적 초) + prom-client 기본 지표.
3. **내면 좋은 지표(선택)** — HTTP 를 받으면 `http_server_request_duration_seconds{method, route, status_code}` 히스토그램(구간 표 · route 는 경로 틀) + `http_server_active_requests`, DB 풀이면 `db_client_connections{state}`. 이름이 같으면 대시보드 패널이 그대로 채워진다.
4. **라벨 금지** — ID · 주소 · 사용자 값처럼 끝없이 늘어나는 값(시계열이 터진다). 이름은 Prometheus 규칙(`snake_case` · 단위 접미사 `_seconds` · `_bytes` · 누적은 `_total`).
5. **Node 예시 코드** — 1-5 의 `metrics-server.ts` 를 서비스 이름만 바꿔 쓰는 형태(Next.js 는 `instrumentation.ts`, 일반 Node 는 시작 코드에서 한 번). Node 가 아니면 그 언어의 Prometheus 클라이언트로 같은 이름(이벤트 루프가 없으면 CPU · 메모리만 — 부하율 패널은 CPU 로 본다).
6. **확인** — 그 컨테이너 안에서 `/metrics` 응답, Prometheus Targets(`http://localhost:9090/targets`)에 job 이 UP, Grafana 서비스 목록에 이름.
7. **백엔드가 할 일** — `docker/prometheus/prometheus.yml` 에 수집 대상 한 줄(`dns_sd_configs` — 서비스 이름 · 9464) + 이 문서의 이름 목록에 추가 → `docker compose -f compose.monitoring.yml restart prometheus`. 대시보드는 고치지 않는다(서비스 목록을 Prometheus 에서 읽는다).
8. **요청 문서 틀** — 새 프로젝트에 넘기는 요청서(바뀐 이유 · 서비스 이름 · 할 일 체크리스트 · 예시 코드 · 확인 · 반영 순서), 프론트의 `2026-11-22-monitoring-web.md` 가 첫 사례.

AGENTS.md 모니터링 절에 "다른 프로젝트를 붙일 때는 이 규격 문서를 넘기고 백엔드는 수집 대상 한 줄" 을 적는다.

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| 앱 루트 모듈 배선 | `MonitoringModule.forRoot({service: 'gateway', port: readPositiveInt(process.env.GATEWAY_METRICS_PORT, 9464), host: process.env.METRICS_HOST || '127.0.0.1', http: true})` — 다른 전역 모듈 import 와 같은 자리(user-service 9465 · admin-service 9466 · scheduler 9467 + `http: false`) | `apps/gateway/src/gateway.module.ts` · `libs/common/src/utils/env.ts`(`readPositiveInt`) |
| HTTP 미들웨어 등록 | `consumer.apply(...).forRoutes('*')` | `apps/gateway/src/gateway.module.ts:68` |
| 인프라 로그 | `private readonly logger = new Logger(X.name)` — 인프라 클래스만 | AGENTS.md 로깅 |
| 라이브러리 경로 | `tsconfig.json` paths 한 줄(`@app/messaging/*` 와 같은 모양), Dockerfile 은 `libs` 전체를 복사해 그대로 | `tsconfig.json:40` · `Dockerfile:21` |
| 공용 네트워크 | `NETWORKS` 에 `{name: 'deskless-monitoring', internal: true, purpose: …}` | `scripts/docker-network.mjs:14` |
| compose 앱 · 인프라 묶음 | 앱 env(서버 구성 고정 값) · external 네트워크 블록 · logging 앵커 · `restart: unless-stopped` | `compose.user-service.yml` · `compose.redis.yml` |
| 스크립트 | `docker:monitoring`: `docker compose -f compose.monitoring.yml up -d`, `docker:logs:monitoring` — `docker:up` · `docker:down` 에는 넣지 않는다(모니터링 env 가 없을 때 전체 묶음 명령이 막히지 않게, 내릴 때는 `docker compose -f compose.monitoring.yml down`) | `package.json:34-48` |
| Grafana 대시보드 JSON | 패널 = 1-3 · 1-4 쿼리, 데이터 원본 uid `deskless-prometheus`, 폴더 Deskless, 시간대 Asia/Seoul | Grafana 프로비저닝 형식 |

## 테스트

spec 의 결과 표에 ✓ 행이 없다 — 지표 모듈 · 계측은 라이브러리 · 인프라라 spec 을 두지 않는 규약(AGENTS.md Testing). 기존 테스트는 계측을 `@Optional` 로 받아 모듈 없이 그대로 돈다. 확인은 아래로 한다.

| 종류 | 대상 | 이유 |
|---|---|---|
| 회귀 | `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run db:check` | 디스패처 · 잠금 · 스트림 생성자에 선택 주입이 더해져도 기존 spec 이 그대로 통과해야 한다 |
| 형식 | `docker compose -f compose.<묶음>.yml config -q` 8개(monitoring 포함) · `docker/grafana/dashboards/*.json` JSON 읽기 · 패널 데이터 원본 uid 확인 | 컨테이너를 띄우지 않고 확인(허용) |
| 사용자 확인(배포 뒤) | Grafana 접속 · 대시보드 2개 · `--scale user-service=3` 뒤 인스턴스 수 3 | Docker 실행은 사용자 몫 |

## 만드는 순서

1. `prom-client` 설치 · `tsconfig.json` 경로 → 2. `libs/monitoring`(상수 · util · MetricsService · MetricsServer · 미들웨어 · 모듈) → 3. 계측(디스패처 · 잠금 · 풀 · 스트림) → 4. 앱 루트 모듈 배선 → 5. typecheck · test → 6. 네트워크 스크립트 · compose(앱 4 · rabbitmq · monitoring) → 7. Prometheus 설정 · 규칙, Grafana 프로비저닝 · 대시보드 JSON 2개 → 8. `.env.example` · README · docs(monitoring.md 초안 · AGENTS.md · architecture.md) · 연결 규격 `docs/guides/monitoring-integration.md` · 프론트 수정 요청 문서(규격의 첫 적용) + 목록 줄 → 9. 검사(compose config · JSON · lint · build) → 10. 리포트

## 배포(사용자 — ship 뒤)

1. `.env` 에 `GRAFANA_ADMIN_PASSWORD` · `MONITORING_DATABASE_URL`(필요하면 `GRAFANA_PORT` · `PROMETHEUS_PORT` · `PROMETHEUS_RETENTION`).
2. `npm run docker:network`(모니터링 내부망) → `npm run docker:rabbitmq` · `npm run docker:user-service` · `npm run docker:admin-service` · `npm run docker:scheduler` · `npm run docker:gateway`(새 이미지 + 내부망) → `npm run docker:monitoring`.
3. `http://localhost:3001` → Deskless 폴더의 대시보드 2개.

import {Inject, Injectable, Logger} from '@nestjs/common';
import type {OnApplicationBootstrap, OnApplicationShutdown} from '@nestjs/common';
import {createServer} from 'node:http';
import type {Server} from 'node:http';
import {METRICS_PATH, MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';
import {MetricsService} from './metrics.service.js';

/**
 * 지표 전용 HTTP 서버 — /metrics 하나만. 앱 HTTP 서버(공개 · 내부 API)와 포트가 달라 내부 토큰 · 공개 경로 규칙과 섞이지 않는다.
 * 부팅을 마친 뒤 열고(못 열면 경고만 — 앱은 그대로 돈다) 종료 때 닫는다. scheduler 처럼 HTTP 서버가 없는 앱도 이 포트 하나만 연다.
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

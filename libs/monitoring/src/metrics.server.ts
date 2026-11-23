import {Inject, Injectable, Logger, Optional} from '@nestjs/common';
import type {OnApplicationBootstrap, OnApplicationShutdown, OnModuleDestroy} from '@nestjs/common';
import {HttpAdapterHost} from '@nestjs/core';
import {createServer} from 'node:http';
import type {Server, ServerResponse} from 'node:http';
import {HEALTH_LIVE_PATH, HEALTH_READY_PATH, METRICS_PATH, MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';
import {MetricsService} from './metrics.service.js';

/**
 * 헬스 체크 응답 — 프로브는 상태 코드만 본다(본문은 사람이 볼 때 참고용).
 *
 * @param res 응답
 * @param ok 200 이면 true, 503 이면 false
 */
function sendHealth(res: ServerResponse, ok: boolean): void {
    res.writeHead(ok ? 200 : 503, {'Content-Type': 'application/json'}).end(JSON.stringify({status: ok ? 'ok' : 'not_ready'}));
}

/**
 * 지표 · 헬스 체크 전용 HTTP 서버 — `/metrics` · `/health/live` · `/health/ready`. 앱 HTTP 서버(공개 · 내부 API)와 포트가 달라
 * 내부 토큰 · API 로그 · HTTP 지표 · 공개 경로 규칙과 섞이지 않는다(쿠버네티스 프로브가 비밀값 없이 부른다).
 * 부팅을 마친 뒤 열고(못 열면 경고만 — 앱은 그대로 돈다) 종료 때 닫는다. scheduler 처럼 HTTP 서버가 없는 앱도 이 포트 하나만 연다.
 *
 * 준비됨(`/health/ready`) — DB · 브로커 · Redis 는 보지 않는다(없어도 부팅하고 그 요청만 503 인 설계라, 잠깐 끊길 때 모든 파드가 한꺼번에 빠지지 않게).
 * - HTTP 앱: 본 포트가 요청을 받는 중(`HttpAdapterHost.listening` — 지표 서버는 본 포트보다 먼저 열린다)
 * - scheduler: 지표 서버가 응답하면(부팅 훅 단계까지 왔다)
 * - 종료 신호를 받으면 앱 훅 중 가장 먼저(onModuleDestroy) 503 — live 는 이 서버가 닫힐 때(onApplicationShutdown)까지 200
 */
@Injectable()
export class MetricsServer implements OnApplicationBootstrap, OnModuleDestroy, OnApplicationShutdown {
    private readonly logger = new Logger(MetricsServer.name);
    private server: Server | null = null;
    private shuttingDown = false;

    /**
     * @param options 모니터링 옵션
     * @param metrics 지표 레지스트리
     * @param httpAdapterHost 본 HTTP 서버 상태(HTTP 앱의 준비됨 판단)
     */
    constructor(
        @Inject(MONITORING_OPTIONS) private readonly options: MonitoringOptions,
        private readonly metrics: MetricsService,
        @Optional() private readonly httpAdapterHost?: HttpAdapterHost,
    ) {}

    /**
     * 지표 · 헬스 체크 서버를 연다.
     */
    onApplicationBootstrap(): void {
        const registry = this.metrics.registry;
        const server = createServer((req, res) => {
            const path = req.method === 'GET' ? req.url?.split('?')[0] : undefined;
            if (path === METRICS_PATH) {
                registry
                    .metrics()
                    .then((body) => res.writeHead(200, {'Content-Type': registry.contentType}).end(body))
                    .catch(() => res.writeHead(500).end());
                return;
            }
            if (path === HEALTH_LIVE_PATH) {
                sendHealth(res, true);
                return;
            }
            if (path === HEALTH_READY_PATH) {
                sendHealth(res, this.isReady());
                return;
            }
            res.writeHead(404).end();
        });
        server.on('error', (error) => this.logger.warn(`지표 · 헬스 체크 서버를 열지 못함(${this.options.host}:${this.options.port}) — 지표 · 헬스 체크 없이 계속: ${error.message}`));
        server.listen(this.options.port, this.options.host, () =>
            this.logger.log(`지표 · 헬스 체크 서버 ${this.options.host}:${this.options.port} (${METRICS_PATH} · ${HEALTH_LIVE_PATH} · ${HEALTH_READY_PATH})`),
        );
        this.server = server;
    }

    /**
     * 종료가 시작됐다 — 준비됨을 503 으로 바꾼다(앱 종료 훅 중 가장 먼저 불린다).
     */
    onModuleDestroy(): void {
        this.shuttingDown = true;
    }

    /**
     * 지표 · 헬스 체크 서버를 닫는다.
     */
    async onApplicationShutdown(): Promise<void> {
        const server = this.server;
        this.server = null;
        if (server?.listening) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    }

    /**
     * 요청을 받을 준비가 됐는지 — 종료 중이 아니고, HTTP 앱이면 본 포트가 열려 있다.
     *
     * @returns 준비됐으면 true
     */
    private isReady(): boolean {
        if (this.shuttingDown) return false;
        return !this.options.http || this.httpAdapterHost?.listening === true;
    }
}

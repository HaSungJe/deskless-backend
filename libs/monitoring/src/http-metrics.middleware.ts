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
        this.duration = metrics.histogram({name: 'http_server_request_duration_seconds', help: 'HTTP 요청 처리 시간(초) — route 는 경로 틀', labelNames: ['method', 'route', 'status_code']});
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

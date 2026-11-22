import {Global, Inject, Module} from '@nestjs/common';
import type {DynamicModule, MiddlewareConsumer, NestModule} from '@nestjs/common';
import {HttpMetricsMiddleware} from './http-metrics.middleware.js';
import {MetricsServer} from './metrics.server.js';
import {MetricsService} from './metrics.service.js';
import {MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';

/**
 * 모니터링 모듈(전역) — 앱 루트 모듈이 forRoot 로 한 번 들인다. MetricsService 를 내보내 부품(큐 명령 디스패처 · crontab 잠금 · DB 풀 · SSE 스트림)이 @Optional 로 받는다.
 */
@Global()
@Module({})
export class MonitoringModule implements NestModule {
    /**
     * @param options 모니터링 옵션
     * @returns 동적 모듈
     */
    static forRoot(options: MonitoringOptions): DynamicModule {
        return {module: MonitoringModule, providers: [{provide: MONITORING_OPTIONS, useValue: options}, MetricsService, MetricsServer, HttpMetricsMiddleware], exports: [MetricsService]};
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

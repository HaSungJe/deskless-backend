import type {Request} from 'express';
import {readPositiveInt} from '@app/common/utils/env.js';
import {METRICS_DEFAULT_HOST, UNMATCHED_ROUTE} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';

/**
 * HTTP 요청의 라우트 라벨 — Express 가 맞춘 라우트 틀(:id 그대로 — Nest 는 컨트롤러 경로 전체를 등록한다), 없으면 UNMATCHED.
 * 실제 주소를 라벨로 쓰면 ID 마다 시계열이 생겨 Prometheus 가 터진다.
 *
 * @param req 요청(응답이 끝난 뒤 — 라우팅을 거친 상태)
 * @returns 라우트 라벨
 */
export function toRouteLabel(req: Request): string {
    const path = (req.route as {path?: unknown} | undefined)?.path;
    return typeof path === 'string' ? `${req.baseUrl}${path}` : UNMATCHED_ROUTE;
}

/**
 * 지표 모듈 옵션 — 앱 이름 · 포트 env 값(비거나 잘못되면 기본 포트) · METRICS_HOST · HTTP 지표 여부
 *
 * @param service 앱 이름(service 라벨 · Prometheus job 이름과 같다)
 * @param port_env 지표 포트 env 값(예: process.env.GATEWAY_METRICS_PORT)
 * @param default_port 기본 포트 — 로컬에서 앱마다 겹치지 않게
 * @param http HTTP 요청 지표를 붙이는지
 * @returns MonitoringModule.forRoot 옵션
 */
export function toMonitoringOptions(service: string, port_env: string | undefined, default_port: number, http: boolean): MonitoringOptions {
    return {service, port: readPositiveInt(port_env, default_port), host: process.env.METRICS_HOST || METRICS_DEFAULT_HOST, http};
}

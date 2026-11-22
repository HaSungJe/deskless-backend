/** MonitoringModule 옵션 주입 토큰 */
export const MONITORING_OPTIONS = Symbol('MonitoringOptions');

/** 지표 경로 — 지표 전용 포트에서 이 경로만 연다 */
export const METRICS_PATH = '/metrics';

/** 응답 · 처리 시간 구간(초) — 큐 경로 SSE 는 기본 30초까지 걸린다 */
export const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

/** 라우트를 못 찾은 요청(정적 파일 · 404)의 라우트 라벨 — 주소를 그대로 라벨로 쓰지 않는다 */
export const UNMATCHED_ROUTE = 'UNMATCHED';

/** 지표 서버 바인딩 기본 주소 — 로컬은 같은 머신만, Docker 는 compose 가 METRICS_HOST=0.0.0.0 (모니터링 내부망만 닿는다) */
export const METRICS_DEFAULT_HOST = '127.0.0.1';

/** MonitoringModule 옵션 */
export interface MonitoringOptions {
    /** 앱 이름 — 모든 지표의 service 라벨 */
    service: string;
    /** 지표 전용 포트 */
    port: number;
    /** 바인딩 주소 */
    host: string;
    /** HTTP 요청 지표 미들웨어를 붙이는지 — scheduler 는 false(HTTP 없음) */
    http: boolean;
}

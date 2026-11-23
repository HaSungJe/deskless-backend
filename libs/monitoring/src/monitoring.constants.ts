/** MonitoringModule 옵션 주입 토큰 */
export const MONITORING_OPTIONS = Symbol('MonitoringOptions');

/** 지표 경로 — 지표 전용 포트에서 연다 */
export const METRICS_PATH = '/metrics';

/** 살아 있음 확인 경로(쿠버네티스 liveness 프로브) — 프로세스가 응답하면 항상 200 */
export const HEALTH_LIVE_PATH = '/health/live';

/** 준비됨 확인 경로(쿠버네티스 readiness 프로브) — 요청을 받을 수 있으면 200, 부팅 중 · 종료 중이면 503. DB · 브로커 · Redis 는 보지 않는다 */
export const HEALTH_READY_PATH = '/health/ready';

/** 응답 · 처리 시간 구간(초) — 큐 경로 SSE 는 기본 30초까지 걸린다 */
export const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

/** 라우트를 못 찾은 요청(정적 파일 · 404)의 라우트 라벨 — 주소를 그대로 라벨로 쓰지 않는다 */
export const UNMATCHED_ROUTE = 'UNMATCHED';

/** 지표 서버 바인딩 기본 주소 — 로컬은 같은 머신만, 쿠버네티스는 deskless 차트가 METRICS_HOST=0.0.0.0 (프로브 · 지표 수집만 닿는다) */
export const METRICS_DEFAULT_HOST = '127.0.0.1';

/** MonitoringModule 옵션 */
export interface MonitoringOptions {
    /** 앱 이름 — 모든 지표의 service 라벨 */
    service: string;
    /** 지표 · 헬스 체크 전용 포트 */
    port: number;
    /** 바인딩 주소 */
    host: string;
    /** HTTP 앱인지 — 요청 지표 미들웨어를 붙이고, 준비됨은 본 포트가 열렸는지로 본다. scheduler 는 false(HTTP 없음) */
    http: boolean;
}

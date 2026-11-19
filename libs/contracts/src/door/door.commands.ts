/**
 * 문 도메인 규격 — 문 쪽 타 업체 프로그램과의 실시간 소켓(gateway — 표준 WebSocket)의 경로 · 헤더 · 이벤트 이름.
 * HTTP 문 열기 · 닫기 API 는 없다(사용자 결정 2026-11-04) — QR 확인 · 바로 열기 명령은 모두 이 소켓으로 주고받는다. 서버는 문 상태(열림 · 닫힘)를 두지 않는다(사용자 결정 2026-11-19 — 잠금 알림 없음).
 * 소켓이 부르는 서버 쪽 처리(접속 확인 · QR 확인)는 user-service door 도메인 내부 HTTP(DOOR_INTERNAL_PATH)다 — 문을 쓰는 건 이용자 흐름이다(사용자 결정 2026-11-07).
 */

/** 문 소켓 경로 — gateway 가 이 경로의 WebSocket 업그레이드만 받는다 */
export const DOOR_SOCKET_PATH = '/ws/v1/door';

/** 소켓 접속 헤더 — 업그레이드 요청에 업체 ID · 업체 문 시크릿 코드(틀리면 업그레이드 전에 401) */
export const DOOR_SOCKET_HEADER = {
    /** 업체 ID (32자) */
    STORE_ID: 'x-store-id',
    /** 업체 문 시크릿 코드 (업체 총관리자가 정한 영문 · 숫자 16 ~ 64자) */
    STORE_SECRET: 'x-store-secret',
} as const;

/** 소켓 메시지 event — 모든 메시지는 JSON 한 개 `{"event": …, "data": …}` */
export const DOOR_SOCKET_EVENT = {
    /** 서버 → 문 프로그램: 접속 직후 업체 호실 전체 — `{store_id, list: [{room_id, room_name, floor}]}` */
    SNAPSHOT: 'door.snapshot',
    /** 문 프로그램 → 서버: 문이 읽은 QR 확인 요청 — `{room_id, qr}` */
    VERIFY: 'door.verify',
    /** 서버 → 문 프로그램: QR 확인 결과(그 연결에만) — `{room_id, ok}`. ok 면 문을 연다(서버는 QR 로 연 기록을 DB 에 남긴다) */
    VERIFIED: 'door.verified',
    /** 서버 → 문 프로그램: 관리자 바로 열기 명령(그 업체 연결 모두) — `{room_id}` */
    OPEN: 'door.open',
    /** 서버 → 문 프로그램: 받은 메시지를 처리하지 못했다 — `{status_code, message}` (연결은 유지) */
    ERROR: 'error',
} as const;

/** door 내부 HTTP 경로 접두 */
const DOOR_INTERNAL_BASE = '/internal/v1/user-service/door';

/**
 * door 도메인 내부 HTTP 경로 (게이트웨이 문 소켓 → user-service). actor 없이 내부 토큰만 — 업체는 소켓 접속 때 확인한 값이다.
 */
export const DOOR_INTERNAL_PATH = {
    /** 문 소켓 접속 확인 + 업체 호실 목록 (POST) */
    SNAPSHOT: `${DOOR_INTERNAL_BASE}/snapshot`,
    /** 문 소켓 QR 확인 (POST) */
    VERIFY: `${DOOR_INTERNAL_BASE}/verify`,
} as const;

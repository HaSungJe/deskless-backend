/** inquiry 내부 HTTP 경로 접두 — admin-service (문의 관리) */
const INQUIRY_INTERNAL_BASE = '/internal/v1/admin-service/inquiry';

/** inquiry 내부 HTTP 경로 접두 — user-service (이용자 문의) */
const INQUIRY_USER_INTERNAL_BASE = '/internal/v1/user-service/inquiry';

/**
 * inquiry 도메인 이용자 명령 (= 라우팅 키, user-service q.user.cmd 가 `user.#` 로 받는다).
 * 답변 · 블라인드는 admin-service 의 INQUIRY_COMMAND 다(기능은 행위자로 서버를 고른다).
 */
export const INQUIRY_USER_COMMAND = {
    /** 문의 등록 (이용자) */
    CREATE: 'user.inquiry.create',
} as const;

/**
 * inquiry 도메인 이용자 내부 HTTP 경로 (게이트웨이 → user-service). 파라미터가 있는 경로는 함수로 만든다.
 */
export const INQUIRY_USER_INTERNAL_PATH = {
    /** 문의 카테고리 목록 (GET, 로그인 없음 — 이용자 · 관리 화면 공용) */
    CATEGORY_LIST: `${INQUIRY_USER_INTERNAL_BASE}/category`,
    /** 내 문의 목록 (GET, 이용자) */
    LIST: INQUIRY_USER_INTERNAL_BASE,
    /** 내 문의 상세 (GET, 이용자) */
    inquiry: (inquiry_id: string) => `${INQUIRY_USER_INTERNAL_BASE}/${encodeURIComponent(inquiry_id)}`,
} as const;

/**
 * inquiry 도메인 문의 관리 명령 (= 라우팅 키, admin-service q.admin.cmd 가 `admin.#` 로 받는다) — `MINE_*` 는 업체 관리자(소속 업체 문의), 나머지는 관리자(바로방 문의).
 * 블라인드 · 해제는 상세에서 한 건씩 한다(사용자 결정 2026-11-24).
 */
export const INQUIRY_COMMAND = {
    /** 내 업체 문의 답변 (업체 관리자) */
    MINE_ANSWER: 'admin.inquiry.mine-answer',
    /** 내 업체 문의 블라인드 (업체 관리자 — 한 건) */
    MINE_BLIND: 'admin.inquiry.mine-blind',
    /** 내 업체 문의 블라인드 해제 (업체 관리자 — 한 건) */
    MINE_UNBLIND: 'admin.inquiry.mine-unblind',
    /** 바로방 문의 답변 (관리자) */
    ANSWER: 'admin.inquiry.answer',
    /** 바로방 문의 블라인드 (관리자 — 한 건) */
    BLIND: 'admin.inquiry.blind',
    /** 바로방 문의 블라인드 해제 (관리자 — 한 건) */
    UNBLIND: 'admin.inquiry.unblind',
} as const;

/**
 * inquiry 도메인 문의 관리 내부 HTTP 경로 (게이트웨이 → admin-service)
 */
export const INQUIRY_INTERNAL_PATH = {
    /** 바로방 문의 목록 (GET, 관리자) */
    LIST: INQUIRY_INTERNAL_BASE,
    /** 바로방 문의 상세 (GET, 관리자) */
    inquiry: (inquiry_id: string) => `${INQUIRY_INTERNAL_BASE}/${encodeURIComponent(inquiry_id)}`,
    /** 내 업체 문의 목록 (GET, 업체 관리자) */
    MINE_LIST: `${INQUIRY_INTERNAL_BASE}/mine`,
    /** 내 업체 문의 상세 (GET, 업체 관리자) */
    mineInquiry: (inquiry_id: string) => `${INQUIRY_INTERNAL_BASE}/mine/${encodeURIComponent(inquiry_id)}`,
} as const;

/** chat 내부 HTTP 경로 접두 — user-service (AI 대화형 업체 검색) */
const CHAT_INTERNAL_BASE = '/internal/v1/user-service/chat';

/**
 * chat 도메인 명령 (= 라우팅 키, user-service q.user.cmd 가 `user.#` 로 받는다).
 */
export const CHAT_COMMAND = {
    /** 대화 초기화 — 내 대화 이력을 바로 모두 지운다(하루 질문 수는 남긴다) */
    CLEAR: 'user.chat.clear',
} as const;

/**
 * chat 도메인 내부 HTTP 경로 (게이트웨이 → user-service). 메시지 보내기는 SSE 스트림 응답(내부 HTTP 스트리밍 — 게이트웨이가 그대로 흘린다).
 */
export const CHAT_INTERNAL_PATH = {
    /** 대화 보기 (GET, 이용자) */
    DETAIL: CHAT_INTERNAL_BASE,
    /** 남은 질문 수 (GET, 이용자) */
    QUOTA: `${CHAT_INTERNAL_BASE}/quota`,
    /** 메시지 보내기 (POST, 이용자 — SSE 스트림) */
    MESSAGE: `${CHAT_INTERNAL_BASE}/message`,
} as const;

/**
 * 메시지 보내기 스트림 이벤트 이름 — progress(진행 단계) → stores(업체 카드 0 ~ 3) → delta(답 글 조각, 여러 번) → done · 시작 뒤 실패는 failed.
 * 시작 전 실패(답하는 중 409 · 하루 질문 수 429 · 입력 400)는 이벤트가 아니라 일반 HTTP 응답이다.
 */
export const CHAT_STREAM_EVENT = {
    /** 진행 단계 — data: `{phase}` (CHAT_PROGRESS_PHASE) */
    PROGRESS: 'progress',
    /** 업체 카드 — data: `{list}` (숙소를 찾을 때만, 0 ~ 3곳) */
    STORES: 'stores',
    /** 답 글 조각 — data: `{text}` */
    DELTA: 'delta',
    /** 끝 — data: `{message, quota}` (대화에 저장된 AI 답 · 남은 질문 수) */
    DONE: 'done',
    /** 시작 뒤 실패 — data: `{status_code, message, validation_errors}` (저장 · 횟수 없음) */
    FAILED: 'failed',
} as const;

/** 진행 단계 — 웹 검색으로 요청 읽기 · 업체 찾기 · 답 쓰기 */
export const CHAT_PROGRESS_PHASE = {SEARCHING_WEB: 'SEARCHING_WEB', SEARCHING_STORES: 'SEARCHING_STORES', ANSWERING: 'ANSWERING'} as const;

/** 대화 메시지 주인 — 이용자 · AI */
export const CHAT_MESSAGE_ROLE = {USER: 'USER', AI: 'AI'} as const;

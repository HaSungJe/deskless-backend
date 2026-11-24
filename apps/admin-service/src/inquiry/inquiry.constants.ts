import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';

/** 업체 탈퇴 상태 — 매니저의 소속 업체에서 뺀다 (store 도메인 상수는 import 하지 않는다) */
export const INQUIRY_STORE_STATE_LEAVE = 'LEAVE';

/** 블라인드가 아닌 문의 상태 — 답변 · 블라인드 저장 조건(그사이 블라인드됐으면 0행) */
export const INQUIRY_UNBLINDED_STATES: string[] = [INQUIRY_STATE.RECEIVED, INQUIRY_STATE.ANSWERED];

/** 매니저의 소속 업체 없음 — 탈퇴 · 지운 업체 */
export const INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE = '소속 업체를 찾을 수 없습니다.';

/** 문의 없음 — 범위 밖(다른 업체 · 업체/바로방이 다른) 문의 포함(존재를 드러내지 않는다) */
export const INQUIRY_NOT_FOUND_MESSAGE = '문의를 찾을 수 없습니다.';

/** 블라인드된 문의에 답변 — 확인 때 · 저장 사이 블라인드 둘 다 */
export const INQUIRY_BLIND_ANSWER_MESSAGE = '블라인드된 문의에는 답변할 수 없습니다.';

/** 이미 블라인드된 문의를 블라인드 — 확인 때 · 저장 사이 블라인드 둘 다 */
export const INQUIRY_ALREADY_BLIND_MESSAGE = '이미 블라인드된 문의입니다.';

/** 블라인드가 아닌 문의를 해제 — 확인 때 · 저장 사이 해제 둘 다 */
export const INQUIRY_NOT_BLIND_MESSAGE = '블라인드된 문의가 아닙니다.';

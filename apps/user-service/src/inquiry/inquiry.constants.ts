/** 문의할 수 있는 업체 상태 — 영업 중 · 영업중지(탈퇴 제외, 사용자 결정 2026-11-24). 업체 이름 검색(discovery)과 같은 값이지만 도메인끼리 상수를 import 하지 않으므로 따로 둔다 */
export const INQUIRY_STORE_STATES: string[] = ['ACTIVE', 'SUSPEND'];

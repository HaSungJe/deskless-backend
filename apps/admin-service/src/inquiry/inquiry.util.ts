import {IsNull, Not} from 'typeorm';
import type {FindOptionsWhere} from 'typeorm';
import type {InquiryManageDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-detail.dto.js';
import type {InquiryManageItemResultDto, InquiryManageListDto} from '@app/contracts/inquiry/dto/inquiry-manage-list.dto.js';
import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {InquiryDetailRow, InquiryFilter, InquiryRow} from './interfaces/inquiry.repository.interface.js';

/**
 * 문의 범위 조건 — 업체 관리자는 소속 업체(store_id), 관리자는 바로방(store_id IS NULL). 범위 규칙은 여기 한 곳뿐이다.
 *
 * @param store_id 소속 업체 ID(업체 관리자) 또는 null(관리자 — 바로방)
 * @returns 조회 · 수정 조건
 */
export function toInquiryScopeWhere(store_id: string | null): FindOptionsWhere<InquiryEntity> {
    return {store_id: store_id ?? IsNull()};
}

/**
 * 관리 목록 필터 — 범위 + 카테고리(선택) + 상태(선택) + 검색어(선택, 빈 문자열은 없음). 고르지 않은 칸은 null(전체).
 *
 * @param store_id 소속 업체 ID 또는 null(바로방)
 * @param dto 목록 query
 * @returns 필터
 */
export function toInquiryListFilter(store_id: string | null, dto: InquiryManageListDto): InquiryFilter {
    return {store_id, inquiry_id: null, inquiry_category_id: dto.inquiry_category_id ?? null, inquiry_state_id: dto.inquiry_state_id ?? null, keyword: dto.keyword ? dto.keyword : null};
}

/**
 * 관리 상세 필터 — 범위 + 문의 ID.
 *
 * @param store_id 소속 업체 ID 또는 null(바로방)
 * @param inquiry_id 문의 ID
 * @returns 필터
 */
export function toInquiryDetailFilter(store_id: string | null, inquiry_id: string): InquiryFilter {
    return {store_id, inquiry_id, inquiry_category_id: null, inquiry_state_id: null, keyword: null};
}

/**
 * 답변 쓰기 — 답변완료 + 답변 내용 · 답변 계정 · 시각(고치면 셋 다 새 값).
 *
 * @param user_id 답변 계정
 * @param answer_content 답변
 * @param now 지금
 * @returns update 엔티티
 */
export function buildInquiryAnswer(user_id: string, answer_content: string, now: Date): InquiryEntity {
    const entity = new InquiryEntity();
    entity.inquiry_state_id = INQUIRY_STATE.ANSWERED;
    entity.answer_content = answer_content;
    entity.answer_user_id = user_id;
    entity.answered_at = now;
    return entity;
}

/**
 * 블라인드 쓰기 — 블라인드 + 처리한 계정 · 시각(답변 칸은 싣지 않아 그대로 — 해제 때 답변완료로 돌아갈 근거).
 *
 * @param user_id 블라인드한 계정
 * @param now 지금
 * @returns update 엔티티
 */
export function buildInquiryBlind(user_id: string, now: Date): InquiryEntity {
    const entity = new InquiryEntity();
    entity.inquiry_state_id = INQUIRY_STATE.BLIND;
    entity.blind_user_id = user_id;
    entity.blinded_at = now;
    return entity;
}

/**
 * 해제 쓰기 — 답변이 있으면 답변완료, 없으면 접수 + 블라인드 칸 지우기(null 은 update 에 그대로 실린다). 누가 풀었는지는 남기지 않는다.
 *
 * @param answered_at 찾은 문의의 답변 시각(없으면 null)
 * @returns update 엔티티
 */
export function buildInquiryUnblind(answered_at: Date | null): InquiryEntity {
    const entity = new InquiryEntity();
    entity.inquiry_state_id = answered_at === null ? INQUIRY_STATE.RECEIVED : INQUIRY_STATE.ANSWERED;
    entity.blind_user_id = null;
    entity.blinded_at = null;
    return entity;
}

/**
 * 해제 조건 — 범위 · 문의 ID + 블라인드 + 찾을 때와 같은 답변 여부. 그사이 풀렸거나 답변 여부가 바뀌었으면 0행이다(되돌릴 상태와 답변 칸이 어긋나 CHECK 위반이 나지 않게).
 *
 * @param where 범위 · 문의 ID 조건
 * @param answered_at 찾은 문의의 답변 시각(없으면 null)
 * @returns update 조건
 */
export function toInquiryUnblindWhere(where: FindOptionsWhere<InquiryEntity>, answered_at: Date | null): FindOptionsWhere<InquiryEntity> {
    return {...where, inquiry_state_id: INQUIRY_STATE.BLIND, answered_at: answered_at === null ? IsNull() : Not(IsNull())};
}

/**
 * 관리 목록 행 → 항목 (raw 시각은 ISO 문자열)
 *
 * @param row 목록 행
 * @returns 항목
 */
export function toInquiryManageItem(row: InquiryRow): InquiryManageItemResultDto {
    return {
        inquiry_id: row.inquiry_id,
        user_id: row.user_id,
        user_nickname: row.user_nickname,
        inquiry_category_id: row.inquiry_category_id,
        inquiry_category_name: row.inquiry_category_name,
        title: row.title,
        inquiry_state_id: row.inquiry_state_id,
        inquiry_state_name: row.inquiry_state_name,
        answered_at: row.answered_at ? new Date(row.answered_at).toISOString() : null,
        created_at: new Date(row.created_at).toISOString(),
    };
}

/**
 * 관리 상세 행 → 상세
 *
 * @param row 상세 행
 * @returns 상세
 */
export function toInquiryManageDetail(row: InquiryDetailRow): InquiryManageDetailResultDto {
    return {
        ...toInquiryManageItem(row),
        store_id: row.store_id ?? null,
        content: row.content,
        answer_content: row.answer_content ?? null,
        answer_user_name: row.answer_user_name ?? null,
        blinded_at: row.blinded_at ? new Date(row.blinded_at).toISOString() : null,
    };
}

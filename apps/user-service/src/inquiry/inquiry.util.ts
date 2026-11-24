import type {InquiryCategoryItemResultDto} from '@app/contracts/inquiry/dto/inquiry-category-list.dto.js';
import type {InquiryDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-detail.dto.js';
import type {InquiryListDto, InquiryListItemResultDto} from '@app/contracts/inquiry/dto/inquiry-list.dto.js';
import type {InquiryCategoryEntity} from '@app/database/entities/inquiry/inquiry-category.entity.js';
import type {MyInquiryDetailRow, MyInquiryFilter, MyInquiryRow} from './interfaces/inquiry.repository.interface.js';

/**
 * 카테고리 → 목록 항목 (정렬 순서 칸은 내려가지 않는다)
 *
 * @param entity 카테고리
 * @returns 항목
 */
export function toInquiryCategoryItem(entity: InquiryCategoryEntity): InquiryCategoryItemResultDto {
    return {inquiry_category_id: entity.inquiry_category_id, inquiry_category_name: entity.inquiry_category_name};
}

/**
 * 내 문의 목록 필터 — 작성자 + 카테고리(선택) + 상태(선택). 고르지 않은 칸은 null(전체).
 *
 * @param user_id 로그인 이용자 ID
 * @param dto 목록 query
 * @returns 필터
 */
export function toMyInquiryListFilter(user_id: string, dto: InquiryListDto): MyInquiryFilter {
    return {user_id, inquiry_id: null, inquiry_category_id: dto.inquiry_category_id ?? null, inquiry_state_id: dto.inquiry_state_id ?? null};
}

/**
 * 내 문의 상세 필터 — 작성자 + 문의 ID.
 *
 * @param user_id 로그인 이용자 ID
 * @param inquiry_id 문의 ID
 * @returns 필터
 */
export function toMyInquiryDetailFilter(user_id: string, inquiry_id: string): MyInquiryFilter {
    return {user_id, inquiry_id, inquiry_category_id: null, inquiry_state_id: null};
}

/**
 * 내 문의 목록 행 → 항목 (raw 시각은 ISO 문자열)
 *
 * @param row 목록 행
 * @returns 항목
 */
export function toMyInquiryItem(row: MyInquiryRow): InquiryListItemResultDto {
    return {
        inquiry_id: row.inquiry_id,
        store_id: row.store_id ?? null,
        store_name: row.store_name ?? null,
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
 * 내 문의 상세 행 → 상세
 *
 * @param row 상세 행
 * @returns 상세
 */
export function toMyInquiryDetail(row: MyInquiryDetailRow): InquiryDetailResultDto {
    return {...toMyInquiryItem(row), content: row.content, answer_content: row.answer_content ?? null};
}

import type {FindOptionsWhere} from 'typeorm';
import type {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {StoreEntity} from '@app/database/entities/store/store.entity.js';

/** 관리 목록 · 상세 필터 — store_id 는 범위(null = 바로방 · 항상 건다), 나머지는 null 이면 조건 없음(전체) */
export interface InquiryFilter {
    store_id: string | null;
    inquiry_id: string | null;
    inquiry_category_id: string | null;
    inquiry_state_id: string | null;
    keyword: string | null;
}

/** 관리 목록 행 (QueryBuilder raw — 별칭이 키와 같다) — 작성자 닉네임 · 카테고리 · 상태 이름 조인 */
export interface InquiryRow {
    inquiry_id: string;
    user_id: string;
    user_nickname: string;
    store_id: string | null;
    inquiry_category_id: string;
    inquiry_category_name: string;
    title: string;
    inquiry_state_id: string;
    inquiry_state_name: string;
    answered_at: Date | null;
    created_at: Date;
}

/** 관리 상세 행 — 목록 행 + 내용 · 답변 · 답변 계정 이름 · 블라인드 시각 */
export interface InquiryDetailRow extends InquiryRow {
    content: string;
    answer_content: string | null;
    answer_user_name: string | null;
    blinded_at: Date | null;
}

/**
 * inquiry repository 포트 (문의 관리) — 공유 DB 의 t_inquiry 와 매니저의 소속 업체(t_store · t_user)를 다룬다.
 * 범위 조건(업체 / 업체 없음)은 service 가 util 로 만들어 넘긴다. t_inquiry 는 지우지 않아 is_deleted 가 없다.
 */
export interface InquiryRepositoryInterface {
    /** 매니저의 소속 업체 — 탈퇴 · 지운 업체는 null */
    findManagerStore(user_id: string): Promise<StoreEntity | null>;
    /** 관리 목록 개수 — 목록과 같은 필터 */
    countInquiryRows(filter: InquiryFilter): Promise<number>;
    /** 관리 목록 — 문의일 최신순 */
    findInquiryRows(filter: InquiryFilter, limit: number, offset: number): Promise<InquiryRow[]>;
    /** 관리 상세 — 범위 밖이거나 없으면 null */
    findInquiryDetailRow(filter: InquiryFilter): Promise<InquiryDetailRow | null>;
    /** 문의 단건 — 답변 · 블라인드 · 해제 전 확인 */
    findInquiry(where: FindOptionsWhere<InquiryEntity>): Promise<InquiryEntity | null>;
    /** 문의 수정 — 상태 조건을 건 쓰기라 조건에 맞는 1행을 바꿨으면 true(그사이 상태가 바뀌었으면 false) */
    updateInquiry(where: FindOptionsWhere<InquiryEntity>, entity: InquiryEntity): Promise<boolean>;
}

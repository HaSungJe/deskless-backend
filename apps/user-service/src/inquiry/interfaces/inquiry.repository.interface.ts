import type {InquiryCategoryEntity} from '@app/database/entities/inquiry/inquiry-category.entity.js';
import type {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {StoreEntity} from '@app/database/entities/store/store.entity.js';

/** 내 문의 목록 · 상세 필터 — user_id 는 항상 건다(남의 문의는 없는 것과 같다), 나머지는 null 이면 조건 없음(전체) */
export interface MyInquiryFilter {
    user_id: string;
    inquiry_id: string | null;
    inquiry_category_id: string | null;
    inquiry_state_id: string | null;
}

/** 내 문의 목록 행 (QueryBuilder raw — 별칭이 키와 같다) — 업체 · 카테고리 · 상태 이름 조인 */
export interface MyInquiryRow {
    inquiry_id: string;
    store_id: string | null;
    store_name: string | null;
    inquiry_category_id: string;
    inquiry_category_name: string;
    title: string;
    inquiry_state_id: string;
    inquiry_state_name: string;
    answered_at: Date | null;
    created_at: Date;
}

/** 내 문의 상세 행 — 목록 행 + 내용 · 답변 */
export interface MyInquiryDetailRow extends MyInquiryRow {
    content: string;
    answer_content: string | null;
}

/**
 * inquiry repository 포트 (이용자 문의) — 공유 DB 의 t_inquiry · t_inquiry_category 와 문의할 업체(t_store)를 다룬다.
 * insert 의 엔티티는 호출자가 `new XEntity()` + 필드 할당으로 만든다(@BeforeInsert 트리거). t_inquiry 는 지우지 않아 is_deleted 가 없다.
 */
export interface InquiryRepositoryInterface {
    /** 문의 카테고리 전부 — 화면 정렬 순서 */
    findInquiryCategories(): Promise<InquiryCategoryEntity[]>;
    /** 문의할 업체 — 영업 중 · 영업중지이고 지워지지 않은 업체만(아니면 null) */
    findInquiryStore(store_id: string): Promise<StoreEntity | null>;
    /** 문의 등록 */
    insertInquiry(entity: InquiryEntity): Promise<void>;
    /** 내 문의 개수 — 목록과 같은 필터 */
    countMyInquiryRows(filter: MyInquiryFilter): Promise<number>;
    /** 내 문의 목록 — 문의일 최신순 */
    findMyInquiryRows(filter: MyInquiryFilter, limit: number, offset: number): Promise<MyInquiryRow[]>;
    /** 내 문의 상세 — 없거나 남의 문의면 null */
    findMyInquiryDetailRow(filter: MyInquiryFilter): Promise<MyInquiryDetailRow | null>;
}

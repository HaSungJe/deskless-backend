import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {In} from 'typeorm';
import type {Repository, SelectQueryBuilder} from 'typeorm';
import {InquiryCategoryEntity} from '@app/database/entities/inquiry/inquiry-category.entity.js';
import {InquiryStateEntity} from '@app/database/entities/inquiry/inquiry-state.entity.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import {notDeleted} from '@app/database/soft-delete.js';
import {INQUIRY_STORE_STATES} from '../inquiry.constants.js';
import type {InquiryRepositoryInterface, MyInquiryDetailRow, MyInquiryFilter, MyInquiryRow} from '../interfaces/inquiry.repository.interface.js';

/** DB 최종 실패 메시지 */
const SERVER_ERROR_MESSAGE = '서버에서 오류가 발생했습니다. 관리자에게 문의해주세요.';

/**
 * inquiry repository (이용자 문의) — 공유 DB 의 문의 · 문의 카테고리 · 상태와 문의할 업체를 다룬다(admin-service inquiry 와 같은 표 — 이용자 기능이라 user-service 에 둔다).
 * t_inquiry 는 지우지 않는다(is_deleted 없음). 업체는 소프트 삭제라 문의할 업체를 찾을 때 is_deleted = 0 을 붙인다.
 */
@Injectable()
export class InquiryRepository implements InquiryRepositoryInterface {
    /**
     * @param txHost 트랜잭션 호스트
     */
    constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

    /** t_inquiry */
    private get inquiries(): Repository<InquiryEntity> {
        return this.txHost.tx.getRepository(InquiryEntity);
    }

    /** t_inquiry_category */
    private get inquiryCategories(): Repository<InquiryCategoryEntity> {
        return this.txHost.tx.getRepository(InquiryCategoryEntity);
    }

    /** t_store */
    private get stores(): Repository<StoreEntity> {
        return this.txHost.tx.getRepository(StoreEntity);
    }

    /**
     * 문의 카테고리 전부 — 화면 정렬 순서(sort_order), 같으면 ID 순
     *
     * @returns 카테고리 목록
     */
    async findInquiryCategories(): Promise<InquiryCategoryEntity[]> {
        try {
            return await this.inquiryCategories.find({order: {sort_order: 'ASC', inquiry_category_id: 'ASC'}});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 문의할 업체 — 영업 중 · 영업중지이고 지워지지 않은 업체만(탈퇴 · 삭제 · 없음은 null)
     *
     * @param store_id 업체 ID
     * @returns 업체 또는 null
     */
    async findInquiryStore(store_id: string): Promise<StoreEntity | null> {
        try {
            return await this.stores.findOne({where: notDeleted<StoreEntity>({store_id, store_state_id: In(INQUIRY_STORE_STATES)}), loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 문의 등록
     *
     * @param entity 문의 엔티티(접수 · 답변 · 블라인드 칸 비움)
     */
    async insertInquiry(entity: InquiryEntity): Promise<void> {
        try {
            await this.inquiries.insert(entity);
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 내 문의 개수 — 목록과 같은 필터
     *
     * @param filter 작성자 · 카테고리 · 상태
     * @returns 개수
     */
    async countMyInquiryRows(filter: MyInquiryFilter): Promise<number> {
        try {
            return await this.buildMyInquiryQuery(filter, false).getCount();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 내 문의 목록 — 문의일 최신순(같으면 문의 ID 역순)
     *
     * @param filter 작성자 · 카테고리 · 상태
     * @param limit 개수
     * @param offset 건너뛸 개수
     * @returns 목록 행
     */
    async findMyInquiryRows(filter: MyInquiryFilter, limit: number, offset: number): Promise<MyInquiryRow[]> {
        try {
            return await this.buildMyInquiryQuery(filter, false).orderBy('i.created_at', 'DESC').addOrderBy('i.inquiry_id', 'DESC').limit(limit).offset(offset).getRawMany<MyInquiryRow>();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 내 문의 상세 — 없거나 남의 문의면 null
     *
     * @param filter 작성자 · 문의 ID
     * @returns 상세 행 또는 null
     */
    async findMyInquiryDetailRow(filter: MyInquiryFilter): Promise<MyInquiryDetailRow | null> {
        try {
            return (await this.buildMyInquiryQuery(filter, true).getRawOne<MyInquiryDetailRow>()) ?? null;
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 내 문의 쿼리 — 작성자는 항상, 문의 ID · 카테고리 · 상태는 값이 있을 때만(null 이면 전체).
     * 업체명(바로방 · 지운 업체도 — leftJoin, is_deleted 를 걸지 않는다: 이력 조인) · 카테고리명 · 상태명 조인, 상세면 내용 · 답변까지.
     * 매핑 민감(leftJoin · raw select · 동적 조립)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param filter 작성자 · 문의 ID · 카테고리 · 상태
     * @param detail true 면 상세 칸까지
     * @returns 쿼리 빌더
     */
    buildMyInquiryQuery(filter: MyInquiryFilter, detail: boolean): SelectQueryBuilder<InquiryEntity> {
        const query = this.inquiries
            .createQueryBuilder('i')
            .select('i.inquiry_id', 'inquiry_id')
            .addSelect('i.store_id', 'store_id')
            .addSelect('s.store_name', 'store_name')
            .addSelect('i.inquiry_category_id', 'inquiry_category_id')
            .addSelect('c.inquiry_category_name', 'inquiry_category_name')
            .addSelect('i.title', 'title')
            .addSelect('i.inquiry_state_id', 'inquiry_state_id')
            .addSelect('st.inquiry_state_name', 'inquiry_state_name')
            .addSelect('i.answered_at', 'answered_at')
            .addSelect('i.created_at', 'created_at')
            .leftJoin(StoreEntity, 's', 's.store_id = i.store_id')
            .innerJoin(InquiryCategoryEntity, 'c', 'c.inquiry_category_id = i.inquiry_category_id')
            .innerJoin(InquiryStateEntity, 'st', 'st.inquiry_state_id = i.inquiry_state_id')
            .where('i.user_id = :user_id', {user_id: filter.user_id});
        if (filter.inquiry_id !== null) {
            query.andWhere('i.inquiry_id = :inquiry_id', {inquiry_id: filter.inquiry_id});
        }
        if (filter.inquiry_category_id !== null) {
            query.andWhere('i.inquiry_category_id = :inquiry_category_id', {inquiry_category_id: filter.inquiry_category_id});
        }
        if (filter.inquiry_state_id !== null) {
            query.andWhere('i.inquiry_state_id = :inquiry_state_id', {inquiry_state_id: filter.inquiry_state_id});
        }
        if (detail) {
            query.addSelect('i.content', 'content').addSelect('i.answer_content', 'answer_content');
        }
        return query;
    }
}

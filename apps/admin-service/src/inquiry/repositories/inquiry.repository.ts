import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {Brackets} from 'typeorm';
import type {FindOptionsWhere, Repository, SelectQueryBuilder} from 'typeorm';
import {toContainsPattern} from '@app/common/utils/search.js';
import {LOGIN_SCOPE} from '@app/contracts/roles.js';
import {InquiryCategoryEntity} from '@app/database/entities/inquiry/inquiry-category.entity.js';
import {InquiryStateEntity} from '@app/database/entities/inquiry/inquiry-state.entity.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import {UserEntity} from '@app/database/entities/user/user.entity.js';
import {INQUIRY_STORE_STATE_LEAVE} from '../inquiry.constants.js';
import type {InquiryDetailRow, InquiryFilter, InquiryRepositoryInterface, InquiryRow} from '../interfaces/inquiry.repository.interface.js';

/** DB 최종 실패 메시지 */
const SERVER_ERROR_MESSAGE = '서버에서 오류가 발생했습니다. 관리자에게 문의해주세요.';

/**
 * inquiry repository (문의 관리) — 공유 DB 의 문의와 매니저의 소속 업체를 다룬다(user-service inquiry 와 같은 표 — 업체 관리자 · 관리자 기능이라 admin-service 에 둔다).
 * t_inquiry 는 지우지 않는다(is_deleted 없음). 작성자 · 답변 계정 조인에도 is_deleted 가 없다(t_user 에 소프트 삭제 칸이 없다 — 탈퇴는 상태 · 마스킹).
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

    /** t_store */
    private get stores(): Repository<StoreEntity> {
        return this.txHost.tx.getRepository(StoreEntity);
    }

    /**
     * 매니저의 소속 업체 — 매니저 그룹 회원의 store_id 로 찾는다. 탈퇴 업체 · 지운 업체는 없는 것과 같다.
     *
     * @param user_id 로그인 매니저 ID
     * @returns 업체 또는 null
     */
    async findManagerStore(user_id: string): Promise<StoreEntity | null> {
        try {
            return await this.buildManagerStoreQuery(user_id).getOne();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 매니저의 소속 업체 쿼리 — 매핑 민감(t_user 조인 · 관계 컬럼)이라 Data-Access Smoke spec 으로 SQL 을 고정한다. 문의는 업체 설정을 바꾸지 않아 잠그지 않는다.
     *
     * @param user_id 로그인 매니저 ID
     * @returns 쿼리 빌더
     */
    buildManagerStoreQuery(user_id: string): SelectQueryBuilder<StoreEntity> {
        return this.stores
            .createQueryBuilder('s')
            .innerJoin(UserEntity, 'u', 'u.store_id = s.store_id')
            .where('u.user_id = :user_id', {user_id})
            .andWhere('u.login_scope = :login_scope', {login_scope: LOGIN_SCOPE.MANAGER})
            .andWhere('s.store_state_id <> :leave', {leave: INQUIRY_STORE_STATE_LEAVE})
            .andWhere('s.is_deleted = 0')
            .loadAllRelationIds();
    }

    /**
     * 관리 목록 개수 — 목록과 같은 필터
     *
     * @param filter 범위 · 카테고리 · 상태 · 검색어
     * @returns 개수
     */
    async countInquiryRows(filter: InquiryFilter): Promise<number> {
        try {
            return await this.buildInquiryQuery(filter, false).getCount();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 관리 목록 — 문의일 최신순(같으면 문의 ID 역순)
     *
     * @param filter 범위 · 카테고리 · 상태 · 검색어
     * @param limit 개수
     * @param offset 건너뛸 개수
     * @returns 목록 행
     */
    async findInquiryRows(filter: InquiryFilter, limit: number, offset: number): Promise<InquiryRow[]> {
        try {
            return await this.buildInquiryQuery(filter, false).orderBy('i.created_at', 'DESC').addOrderBy('i.inquiry_id', 'DESC').limit(limit).offset(offset).getRawMany<InquiryRow>();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 관리 상세 — 범위 밖이거나 없으면 null
     *
     * @param filter 범위 · 문의 ID
     * @returns 상세 행 또는 null
     */
    async findInquiryDetailRow(filter: InquiryFilter): Promise<InquiryDetailRow | null> {
        try {
            return (await this.buildInquiryQuery(filter, true).getRawOne<InquiryDetailRow>()) ?? null;
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 문의 관리 쿼리 — 범위(store_id = 또는 IS NULL)는 항상, 문의 ID · 카테고리 · 상태 · 검색어(제목 · 내용 괄호 OR)는 값이 있을 때만.
     * 작성자 닉네임 · 카테고리명 · 상태명 조인, 상세면 내용 · 답변 · 답변 계정 이름 · 블라인드 시각을 더 읽는다.
     * 관리자 범위를 "조건 없음" 으로 두면 모든 업체 문의가 열리므로 바로방은 반드시 IS NULL 을 건다.
     * 매핑 민감(조인 · raw select · 동적 조립 · IS NULL 분기 · OR 괄호)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param filter 필터
     * @param detail true 면 상세 칸까지
     * @returns 쿼리 빌더
     */
    buildInquiryQuery(filter: InquiryFilter, detail: boolean): SelectQueryBuilder<InquiryEntity> {
        const query = this.inquiries
            .createQueryBuilder('i')
            .select('i.inquiry_id', 'inquiry_id')
            .addSelect('i.user_id', 'user_id')
            .addSelect('u.nickname', 'user_nickname')
            .addSelect('i.store_id', 'store_id')
            .addSelect('i.inquiry_category_id', 'inquiry_category_id')
            .addSelect('c.inquiry_category_name', 'inquiry_category_name')
            .addSelect('i.title', 'title')
            .addSelect('i.inquiry_state_id', 'inquiry_state_id')
            .addSelect('st.inquiry_state_name', 'inquiry_state_name')
            .addSelect('i.answered_at', 'answered_at')
            .addSelect('i.created_at', 'created_at')
            .innerJoin(UserEntity, 'u', 'u.user_id = i.user_id')
            .innerJoin(InquiryCategoryEntity, 'c', 'c.inquiry_category_id = i.inquiry_category_id')
            .innerJoin(InquiryStateEntity, 'st', 'st.inquiry_state_id = i.inquiry_state_id');
        if (filter.store_id === null) {
            query.where('i.store_id IS NULL');
        } else {
            query.where('i.store_id = :store_id', {store_id: filter.store_id});
        }
        if (filter.inquiry_id !== null) {
            query.andWhere('i.inquiry_id = :inquiry_id', {inquiry_id: filter.inquiry_id});
        }
        if (filter.inquiry_category_id !== null) {
            query.andWhere('i.inquiry_category_id = :inquiry_category_id', {inquiry_category_id: filter.inquiry_category_id});
        }
        if (filter.inquiry_state_id !== null) {
            query.andWhere('i.inquiry_state_id = :inquiry_state_id', {inquiry_state_id: filter.inquiry_state_id});
        }
        if (filter.keyword !== null) {
            const pattern = toContainsPattern(filter.keyword);
            query.andWhere(
                new Brackets((qb) => {
                    qb.where('i.title ILIKE :pattern', {pattern}).orWhere('i.content ILIKE :pattern', {pattern});
                }),
            );
        }
        if (detail) {
            query
                .addSelect('i.content', 'content')
                .addSelect('i.answer_content', 'answer_content')
                .addSelect('a.name', 'answer_user_name')
                .addSelect('i.blinded_at', 'blinded_at')
                .leftJoin(UserEntity, 'a', 'a.user_id = i.answer_user_id');
        }
        return query;
    }

    /**
     * 문의 단건 — 답변 · 블라인드 · 해제 전 확인(범위 조건은 service 가 넘긴다)
     *
     * @param where 조회 조건(범위 · 문의 ID)
     * @returns 문의 또는 null
     */
    async findInquiry(where: FindOptionsWhere<InquiryEntity>): Promise<InquiryEntity | null> {
        try {
            return await this.inquiries.findOne({where, loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 문의 수정 — 상태 조건을 건 쓰기(답변 · 블라인드 · 해제). 조건에 맞는 1행을 바꿨으면 true, 그사이 상태가 바뀌어 0행이면 false(service 가 400 으로 롤백)
     *
     * @param where 수정 조건(범위 · 문의 ID · 상태)
     * @param entity 바꿀 값(엔티티 인스턴스 — @BeforeUpdate 훅)
     * @returns 1행을 바꿨으면 true
     */
    async updateInquiry(where: FindOptionsWhere<InquiryEntity>, entity: InquiryEntity): Promise<boolean> {
        try {
            return (await this.inquiries.update(where, entity)).affected === 1;
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }
}

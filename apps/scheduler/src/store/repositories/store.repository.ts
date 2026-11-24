import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {In} from 'typeorm';
import type {FindOptionsWhere, InsertQueryBuilder, Repository} from 'typeorm';
import {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import {RoomPlanEntity} from '@app/database/entities/room/room-plan.entity.js';
import {StoreEmbeddingEntity} from '@app/database/entities/store/store-embedding.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import {notDeleted} from '@app/database/soft-delete.js';
import type {StoreRepositoryInterface} from '../interfaces/store.repository.interface.js';
import {STORE_EMBEDDING_STORE_STATE} from '../store.util.js';

const SERVER_ERROR_MESSAGE = '서버에서 오류가 발생했습니다. 관리자에게 문의해주세요.';

/** 검색 벡터를 다시 만들 때 바꾸는 컬럼 — 등록일 · ID 는 그대로 */
const EMBEDDING_UPDATE_COLUMNS = ['content', 'content_hash', 'embedding_model', 'embedding', 'updated_at'];

/**
 * 업체 repository(scheduler) — 업체 검색 벡터 갱신(AI 대화형 업체 검색). 업체 · 객실 그룹 · 상품 설정을 읽고 업체 검색 벡터를 저장한다.
 */
@Injectable()
export class StoreRepository implements StoreRepositoryInterface {
    /**
     * @param txHost 트랜잭션 호스트
     */
    constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

    /** 업체 */
    private get stores(): Repository<StoreEntity> {
        return this.txHost.tx.getRepository(StoreEntity);
    }

    /** 객실 그룹 */
    private get roomGroups(): Repository<RoomGroupEntity> {
        return this.txHost.tx.getRepository(RoomGroupEntity);
    }

    /** 업체 상품 설정 */
    private get roomPlans(): Repository<RoomPlanEntity> {
        return this.txHost.tx.getRepository(RoomPlanEntity);
    }

    /** 업체 검색 벡터 */
    private get storeEmbeddings(): Repository<StoreEmbeddingEntity> {
        return this.txHost.tx.getRepository(StoreEmbeddingEntity);
    }

    /**
     * 벡터를 만들 업체 — 활성 · 지워지지 않은 업체(업체 ID 순).
     *
     * @returns 업체
     */
    async findEmbeddingStores(): Promise<StoreEntity[]> {
        try {
            const where: FindOptionsWhere<StoreEntity> = {store_state_id: STORE_EMBEDDING_STORE_STATE};
            return await this.stores.find({where: notDeleted(where), order: {store_id: 'ASC'}, loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 업체들의 지워지지 않은 객실 그룹(그룹명 순).
     *
     * @param store_ids 업체 ID 목록
     * @returns 객실 그룹
     */
    async findEmbeddingRoomGroups(store_ids: string[]): Promise<RoomGroupEntity[]> {
        try {
            const where: FindOptionsWhere<RoomGroupEntity> = {store_id: In(store_ids)};
            return await this.roomGroups.find({where: notDeleted(where), order: {room_group_name: 'ASC'}, loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 업체들의 판매 중인 상품 설정(is_used 1).
     *
     * @param store_ids 업체 ID 목록
     * @returns 상품 설정
     */
    async findEmbeddingRoomPlans(store_ids: string[]): Promise<RoomPlanEntity[]> {
        try {
            return await this.roomPlans.find({where: {store_id: In(store_ids), is_used: 1}, loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 업체들의 저장된 검색 벡터.
     *
     * @param store_ids 업체 ID 목록
     * @returns 검색 벡터
     */
    async findStoreEmbeddings(store_ids: string[]): Promise<StoreEmbeddingEntity[]> {
        try {
            return await this.storeEmbeddings.find({where: {store_id: In(store_ids)}, loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 검색 벡터 저장 — 업체마다 1행, 이미 있으면 글 · 해시 · 모델 · 벡터 · 수정일만 바꾼다.
     *
     * @param entities new StoreEmbeddingEntity() + 할당 (@BeforeInsert 가 등록일 · 수정일을 채운다)
     */
    async upsertStoreEmbeddings(entities: StoreEmbeddingEntity[]): Promise<void> {
        if (entities.length === 0) {
            return;
        }
        try {
            await this.buildUpsertStoreEmbeddingsQuery(entities).execute();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 검색 벡터 저장 쿼리 — INSERT … ON CONFLICT ("store_id") DO UPDATE(글 · 해시 · 모델 · 벡터 · 수정일). 매핑 민감(충돌 처리 절 · vector 값)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param entities 검색 벡터
     * @returns 쿼리 빌더
     */
    buildUpsertStoreEmbeddingsQuery(entities: StoreEmbeddingEntity[]): InsertQueryBuilder<StoreEmbeddingEntity> {
        return this.storeEmbeddings.createQueryBuilder().insert().into(StoreEmbeddingEntity).values(entities).orUpdate(EMBEDDING_UPDATE_COLUMNS, ['store_id']);
    }
}

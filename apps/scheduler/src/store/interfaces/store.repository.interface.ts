import type {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import type {RoomPlanEntity} from '@app/database/entities/room/room-plan.entity.js';
import type {StoreEmbeddingEntity} from '@app/database/entities/store/store-embedding.entity.js';
import type {StoreEntity} from '@app/database/entities/store/store.entity.js';

/**
 * 업체 repository 포트(scheduler) — 업체 검색 벡터 갱신이 읽는 업체 · 객실 그룹 · 상품 설정과 업체 검색 벡터.
 */
export interface StoreRepositoryInterface {
    /**
     * 벡터를 만들 업체 — 활성 · 지워지지 않은 업체(업체 ID 순).
     */
    findEmbeddingStores(): Promise<StoreEntity[]>;

    /**
     * 업체들의 지워지지 않은 객실 그룹(그룹명 순).
     */
    findEmbeddingRoomGroups(store_ids: string[]): Promise<RoomGroupEntity[]>;

    /**
     * 업체들의 판매 중인 상품 설정(is_used 1).
     */
    findEmbeddingRoomPlans(store_ids: string[]): Promise<RoomPlanEntity[]>;

    /**
     * 업체들의 저장된 검색 벡터(내용 해시 · 모델 비교용).
     */
    findStoreEmbeddings(store_ids: string[]): Promise<StoreEmbeddingEntity[]>;

    /**
     * 검색 벡터 저장 — 업체마다 1행, 이미 있으면 글 · 해시 · 모델 · 벡터 · 수정일만 바꾼다(ON CONFLICT store_id DO UPDATE).
     */
    upsertStoreEmbeddings(entities: StoreEmbeddingEntity[]): Promise<void>;
}

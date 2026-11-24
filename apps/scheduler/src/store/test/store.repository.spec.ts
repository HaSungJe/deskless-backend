import {InternalServerErrorException} from '@nestjs/common';
import type {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {DataSource, In} from 'typeorm';
import {ENTITIES} from '@app/database/entities.js';
import {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import {RoomPlanEntity} from '@app/database/entities/room/room-plan.entity.js';
import {StoreEmbeddingEntity} from '@app/database/entities/store/store-embedding.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import {StoreRepository} from '../repositories/store.repository.js';
import {toStoreEmbeddingEntity} from '../store.util.js';

/**
 * txHost.tx(EntityManager)를 흉내 낸다 — getRepository(엔티티) 가 엔티티별 가짜 repository 를 돌려준다.
 *
 * @returns 저장소와 엔티티별 가짜 repository
 */
function makeRepository() {
    const fake = () => ({find: vi.fn().mockResolvedValue([])});
    const repos = new Map<unknown, ReturnType<typeof fake>>([StoreEntity, RoomGroupEntity, RoomPlanEntity, StoreEmbeddingEntity].map((entity) => [entity, fake()]));
    const txHost = {tx: {getRepository: (entity: unknown) => repos.get(entity)}} as unknown as TransactionHost<TransactionalAdapterTypeOrm>;
    return {repository: new StoreRepository(txHost), repo: (entity: unknown) => repos.get(entity)!};
}

describe('StoreRepository(scheduler) — 조건 · 통일 500', () => {
    it('대상 업체 — 활성 · 지워지지 않음 · 업체 ID 순, 객실 그룹 — 받은 업체 · 지워지지 않음 · 그룹명 순, 상품 — 판매 중, 검색 벡터 — 받은 업체', async () => {
        const {repository, repo} = makeRepository();

        await repository.findEmbeddingStores();
        await repository.findEmbeddingRoomGroups(['s1', 's2']);
        await repository.findEmbeddingRoomPlans(['s1', 's2']);
        await repository.findStoreEmbeddings(['s1', 's2']);

        expect(repo(StoreEntity).find).toHaveBeenCalledWith({where: {store_state_id: 'ACTIVE', is_deleted: 0}, order: {store_id: 'ASC'}, loadRelationIds: true});
        expect(repo(RoomGroupEntity).find).toHaveBeenCalledWith({where: {store_id: In(['s1', 's2']), is_deleted: 0}, order: {room_group_name: 'ASC'}, loadRelationIds: true});
        expect(repo(RoomPlanEntity).find).toHaveBeenCalledWith({where: {store_id: In(['s1', 's2']), is_used: 1}, loadRelationIds: true});
        expect(repo(StoreEmbeddingEntity).find).toHaveBeenCalledWith({where: {store_id: In(['s1', 's2'])}, loadRelationIds: true});
    });

    it('[FAIL:500] DB 실패는 통일 500 — 빈 저장은 쿼리를 만들지 않는다', async () => {
        const {repository, repo} = makeRepository();
        repo(StoreEntity).find.mockRejectedValueOnce(new Error('connection lost'));
        const buildSpy = vi.spyOn(repository, 'buildUpsertStoreEmbeddingsQuery').mockReturnValue({execute: vi.fn().mockRejectedValue(new Error('db'))} as never);

        await expect(repository.findEmbeddingStores()).rejects.toBeInstanceOf(InternalServerErrorException);
        await repository.upsertStoreEmbeddings([]);
        expect(buildSpy).not.toHaveBeenCalled();
        await expect(repository.upsertStoreEmbeddings([toStoreEmbeddingEntity('s1', '글', 'h', [0.1], 'm')])).rejects.toBeInstanceOf(InternalServerErrorException);
    });
});

describe('[SMOKE:data-access] 검색 벡터 저장 — DB 연결 없이 SQL 빌드', () => {
    let repository: StoreRepository;

    beforeAll(async () => {
        // 접속하지 않는다 — 엔티티 메타데이터만 만들어 QueryBuilder 가 SQL 을 조립하게 한다
        const dataSource = new DataSource({type: 'postgres', database: 'smoke', entities: ENTITIES});
        await (dataSource as unknown as {buildMetadatas: () => Promise<void>}).buildMetadatas();
        repository = new StoreRepository({tx: dataSource.manager} as unknown as TransactionHost<TransactionalAdapterTypeOrm>);
    });

    it('INSERT … ON CONFLICT ("store_id") DO UPDATE — 글 · 해시 · 모델 · 벡터 · 수정일만 바꾸고 등록일 · ID 는 그대로, 벡터는 pgvector 문자열', () => {
        const entity = toStoreEmbeddingEntity('s1', '업체: 바로방 온양온천점', 'hash-1', [0.1, 0.2, 0.3], 'gemini-embedding-001');
        const [sql, parameters] = repository.buildUpsertStoreEmbeddingsQuery([entity]).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(flat).toContain('INSERT INTO "t_store_embedding"');
        expect(flat).toMatch(
            /ON CONFLICT \( "store_id" \) DO UPDATE SET "content" = EXCLUDED\."content", "content_hash" = EXCLUDED\."content_hash", "embedding_model" = EXCLUDED\."embedding_model", "embedding" = EXCLUDED\."embedding", "updated_at" = EXCLUDED\."updated_at"/,
        );
        expect(flat).not.toMatch(/"created_at" = EXCLUDED/);
        expect(parameters).toEqual(expect.arrayContaining(['s1', '업체: 바로방 온양온천점', 'hash-1', 'gemini-embedding-001', '[0.1,0.2,0.3]']));
    });
});

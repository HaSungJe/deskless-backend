import {InternalServerErrorException} from '@nestjs/common';
import type {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {DataSource, In} from 'typeorm';
import {ENTITIES} from '@app/database/entities.js';
import {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import type {ChatRecommendFilter, ChatRecommendStoreRow} from '../interfaces/chat.repository.interface.js';
import {ChatRepository} from '../repositories/chat.repository.js';

const STORE_ROW_KEYS: (keyof ChatRecommendStoreRow)[] = ['store_id', 'store_name', 'address', 'latitude', 'longitude', 'store_detail', 'cover_file_key', 'cover_file_storage'];

/** 여행지 두 곳 사이(ALL) · 객실(PC) · 업체(반려동물) · 제외 2곳 · 검색 벡터 */
const FILTER_ALL: ChatRecommendFilter = {
    areas: [
        {latitude: 33.4581, longitude: 126.9425, radius_m: 15000},
        {latitude: 33.5432, longitude: 126.6694, radius_m: 20000},
    ],
    area_match: 'ALL',
    detail_conditions: [{key: 'has_pc', operator: 'EQ', value: 1, default_value: 1}],
    store_conditions: [{key: 'is_pet_allowed', operator: 'EQ', value: 1, default_value: 0}],
    excluded_store_ids: ['old-1', 'old-2'],
    query_vector: '[0.1,0.2,0.3]',
};

/** 후보 도시 여러 곳(ANY) · 조건 없음 · 벡터 없음 */
const FILTER_ANY: ChatRecommendFilter = {
    areas: [
        {latitude: 36.7805, longitude: 127.0035, radius_m: 10000},
        {latitude: 36.8465, longitude: 127.9897, radius_m: 10000},
    ],
    area_match: 'ANY',
    detail_conditions: [],
    store_conditions: [],
    excluded_store_ids: [],
    query_vector: null,
};

/**
 * raw select 의 별칭 목록 (` AS "<키>"`) — 서브쿼리 안의 별칭은 없다
 *
 * @param sql 공백을 한 칸으로 줄인 SQL
 * @returns 별칭 목록
 */
function selectAliases(sql: string): string[] {
    return [...sql.matchAll(/ AS "([a-z_]+)"/g)].map((match) => match[1]);
}

/**
 * txHost.tx(EntityManager)를 흉내 낸다 — getRepository(엔티티) 가 엔티티별 가짜 repository 를 돌려준다.
 *
 * @returns 저장소와 엔티티별 가짜 repository
 */
function makeRepository() {
    const fake = () => ({find: vi.fn().mockResolvedValue([])});
    const repos = new Map<unknown, ReturnType<typeof fake>>([StoreEntity, RoomGroupEntity].map((entity) => [entity, fake()]));
    const txHost = {tx: {getRepository: (entity: unknown) => repos.get(entity)}} as unknown as TransactionHost<TransactionalAdapterTypeOrm>;
    return {repository: new ChatRepository(txHost), repo: (entity: unknown) => repos.get(entity)!};
}

describe('ChatRepository — 조건 · 통일 500', () => {
    it('카드 객실 그룹 — 받은 업체들(In) · 지워지지 않은 그룹(is_deleted: 0) · loadRelationIds', async () => {
        const {repository, repo} = makeRepository();

        await repository.findCardRoomGroups(['s1', 's2']);

        expect(repo(RoomGroupEntity).find).toHaveBeenCalledWith({where: {store_id: In(['s1', 's2']), is_deleted: 0}, loadRelationIds: true});
    });

    it('[FAIL:500] DB 실패는 통일 500', async () => {
        const {repository, repo} = makeRepository();
        repo(RoomGroupEntity).find.mockRejectedValueOnce(new Error('connection lost'));

        await expect(repository.findCardRoomGroups(['s1'])).rejects.toBeInstanceOf(InternalServerErrorException);
    });
});

describe('[SMOKE:data-access] 추천 업체 — DB 연결 없이 SQL 빌드, 활성 · 영업 중 · 지워지지 않은 업체만', () => {
    let dataSource: DataSource;
    let repository: ChatRepository;

    beforeAll(async () => {
        // 접속하지 않는다 — 엔티티 메타데이터만 만들어 QueryBuilder 가 SQL 을 조립하게 한다
        dataSource = new DataSource({type: 'postgres', database: 'smoke', entities: ENTITIES});
        await (dataSource as unknown as {buildMetadatas: () => Promise<void>}).buildMetadatas();
        repository = new ChatRepository({tx: dataSource.manager} as unknown as TransactionHost<TransactionalAdapterTypeOrm>);
    });

    it('ALL · 객실 · 업체 · 제외 · 벡터 — 지역 괄호 AND, 객실 EXISTS(예약 받을 · 판매 중), 업체 JSON, NOT IN, 코사인 거리 NULLS LAST · LIMIT, 별칭 = ChatRecommendStoreRow 키', () => {
        const [sql, parameters] = repository.buildRecommendStoreQuery(FILTER_ALL, 3).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(flat).toContain('LEFT JOIN "t_store_embedding" "e" ON "e"."store_id" = "s"."store_id"');
        expect(flat).toMatch(/"s"\."store_state_id" = \$\d+ AND "s"\."is_open" = 1 AND "s"\."is_deleted" = 0/);
        expect(flat).toMatch(/\(\(12742000 \* ASIN\(LEAST\(1, SQRT.+\)\) <= \$\d+ AND \(12742000 \* ASIN\(LEAST\(1, SQRT.+\)\) <= \$\d+\)/);
        expect(flat).toContain('EXISTS (SELECT 1 FROM "t_room_group" "g" WHERE "g"."store_id" = "s"."store_id" AND "g"."is_deleted" = 0 AND EXISTS (SELECT 1 FROM "t_room" "r"');
        expect(flat).toContain('INNER JOIN "t_room_plan" "p"');
        expect(flat).toMatch(/COALESCE\(\("g"\."room_group_detail" ->> CAST\(\$\d+ AS text\)\)::integer, \$\d+\) = \$\d+/);
        expect(flat).toMatch(/COALESCE\(\("s"\."store_detail" ->> CAST\(\$\d+ AS text\)\)::integer, \$\d+\) = \$\d+/);
        expect(flat).toMatch(/"s"\."store_id" NOT IN \(\$\d+, \$\d+\)/);
        expect(flat).toMatch(/ORDER BY "e"\."embedding" <=> CAST\(\$\d+ AS vector\) ASC NULLS LAST, "s"\."store_id" ASC LIMIT 3/);
        expect(parameters).toEqual(
            expect.arrayContaining(['ACTIVE', 'STORE_IMAGE', 'DISABLED', 33.4581, 126.9425, 15000, 33.5432, 126.6694, 20000, 'has_pc', 'is_pet_allowed', 'old-1', 'old-2', '[0.1,0.2,0.3]']),
        );
        expect([...new Set(selectAliases(flat))].sort()).toEqual([...STORE_ROW_KEYS].sort());
    });

    it('ANY · 조건 없음 · 벡터 없음 — 지역 괄호 OR, 객실 · 업체 · 제외 조건 없음, 첫 지역에서 가까운 순', () => {
        const [sql, parameters] = repository.buildRecommendStoreQuery(FILTER_ANY, 3).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(flat).toMatch(/\(\(12742000 \* ASIN.+ <= \$\d+ OR \(12742000 \* ASIN.+ <= \$\d+\)/);
        expect(flat).not.toContain('"t_room_group" "g"');
        expect(flat).not.toContain('"s"."store_detail" ->>');
        expect(flat).not.toContain('NOT IN');
        expect(flat).not.toContain('<=>');
        expect(flat).toMatch(/ORDER BY \(12742000 \* ASIN.+\) ASC, "s"\."store_id" ASC LIMIT 3/);
        expect(parameters).toEqual(expect.arrayContaining([36.7805, 127.0035, 36.8465, 127.9897, 10000]));
    });
});

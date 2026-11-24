import {InternalServerErrorException} from '@nestjs/common';
import type {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {DataSource} from 'typeorm';
import type {EntityTarget, FindManyOptions, ObjectLiteral} from 'typeorm';
import {ENTITIES} from '@app/database/entities.js';
import {InquiryCategoryEntity} from '@app/database/entities/inquiry/inquiry-category.entity.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import type {MyInquiryDetailRow, MyInquiryFilter} from '../interfaces/inquiry.repository.interface.js';
import {InquiryRepository} from '../repositories/inquiry.repository.js';

/** 내 문의 상세 행 키 — raw select 별칭과 비교 */
const DETAIL_ROW_KEYS: (keyof MyInquiryDetailRow)[] = [
    'inquiry_id',
    'store_id',
    'store_name',
    'inquiry_category_id',
    'inquiry_category_name',
    'title',
    'inquiry_state_id',
    'inquiry_state_name',
    'answered_at',
    'created_at',
    'content',
    'answer_content',
];

/** 이용자 · 문의 */
const USER_ID = 'u'.repeat(32);
const INQUIRY_ID = 'a'.repeat(32);

/** 전체(카테고리 · 상태 없음) · 카테고리 + 상태 · 상세 필터 */
const FILTER_ALL: MyInquiryFilter = {user_id: USER_ID, inquiry_id: null, inquiry_category_id: null, inquiry_state_id: null};
const FILTER_PICKED: MyInquiryFilter = {user_id: USER_ID, inquiry_id: null, inquiry_category_id: 'RESERVATION', inquiry_state_id: 'BLIND'};
const FILTER_DETAIL: MyInquiryFilter = {user_id: USER_ID, inquiry_id: INQUIRY_ID, inquiry_category_id: null, inquiry_state_id: null};

/**
 * repository 가 manager.find · findOne 에 넘긴 옵션을 SQL 로 빌드한다 — EntityManager 와 같은 방식(실행만 뺀다).
 *
 * @param dataSource 메타데이터만 만든 DataSource
 * @param call 가로챈 호출 인자(대상 엔티티, 옵션)
 * @returns 공백을 하나로 줄인 SQL 과 파라미터
 */
function buildFindQuery(dataSource: DataSource, call: unknown[]): [string, unknown[]] {
    const [target, options] = call as [EntityTarget<ObjectLiteral>, FindManyOptions<ObjectLiteral>];
    const [sql, parameters] = dataSource.manager.createQueryBuilder(target, dataSource.getMetadata(target).name).setFindOptions(options).getQueryAndParameters();
    return [sql.replace(/\s+/g, ' '), parameters];
}

/**
 * raw select 의 별칭 목록 (` AS "<키>"`)
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
    const fake = () => ({find: vi.fn().mockResolvedValue([]), findOne: vi.fn().mockResolvedValue(null), insert: vi.fn().mockResolvedValue(undefined)});
    const repos = new Map<unknown, ReturnType<typeof fake>>([InquiryEntity, InquiryCategoryEntity, StoreEntity].map((entity) => [entity, fake()]));
    const txHost = {tx: {getRepository: (entity: unknown) => repos.get(entity)}} as unknown as TransactionHost<TransactionalAdapterTypeOrm>;
    return {repository: new InquiryRepository(txHost), repo: (entity: unknown) => repos.get(entity)!};
}

describe('InquiryRepository (user-service) — 조건 · 통일 500', () => {
    it('[SUCCESS] findInquiryCategories — 정렬 순서 · ID 순, insertInquiry — 받은 엔티티 그대로(@BeforeInsert 가 돈다)', async () => {
        const {repository, repo} = makeRepository();
        const entity = new InquiryEntity();

        await repository.findInquiryCategories();
        await repository.insertInquiry(entity);

        expect(repo(InquiryCategoryEntity).find).toHaveBeenCalledWith({order: {sort_order: 'ASC', inquiry_category_id: 'ASC'}});
        expect(repo(InquiryEntity).insert).toHaveBeenCalledWith(entity);
    });

    it.each([
        ['findInquiryCategories', InquiryCategoryEntity, 'find', []],
        ['findInquiryStore', StoreEntity, 'findOne', ['s1']],
        ['insertInquiry', InquiryEntity, 'insert', [new InquiryEntity()]],
    ] as const)('[FAIL:repository] %s — DB 실패는 통일 500', async (method, entity, fn, args) => {
        const {repository, repo} = makeRepository();
        repo(entity)[fn].mockRejectedValueOnce(new Error('db'));

        await expect((repository[method] as (...params: unknown[]) => Promise<unknown>)(...args)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it.each([
        ['countMyInquiryRows', 'getCount', [FILTER_ALL]],
        ['findMyInquiryRows', 'getRawMany', [FILTER_ALL, 20, 0]],
        ['findMyInquiryDetailRow', 'getRawOne', [FILTER_DETAIL]],
    ] as const)('[FAIL:repository] %s 는 buildMyInquiryQuery 를 실행(%s)하고, 실패는 통일 500', async (method, runner, args) => {
        const {repository} = makeRepository();
        const builder: Record<string, unknown> = {};
        for (const name of ['orderBy', 'addOrderBy', 'limit', 'offset']) {
            builder[name] = vi.fn(() => builder);
        }
        builder[runner] = vi.fn().mockRejectedValue(new Error('db'));
        const spy = vi.spyOn(repository, 'buildMyInquiryQuery').mockReturnValue(builder as never);

        await expect((repository[method] as (...params: unknown[]) => Promise<unknown>)(...args)).rejects.toBeInstanceOf(InternalServerErrorException);
        expect(spy).toHaveBeenCalledWith(args[0], method === 'findMyInquiryDetailRow');
    });
});

describe('[SMOKE:data-access] 내 문의 · 문의할 업체 — DB 연결 없이 SQL 빌드', () => {
    let dataSource: DataSource;
    let repository: InquiryRepository;

    beforeAll(async () => {
        // 접속하지 않는다 — 엔티티 메타데이터만 만들어 QueryBuilder 가 SQL 을 조립하게 한다
        dataSource = new DataSource({type: 'postgres', database: 'smoke', entities: ENTITIES});
        await (dataSource as unknown as {buildMetadatas: () => Promise<void>}).buildMetadatas();
        repository = new InquiryRepository({tx: dataSource.manager} as unknown as TransactionHost<TransactionalAdapterTypeOrm>);
    });

    it('문의할 업체 — findOne 에 넘긴 조건(업체 · 영업 중 · 영업중지 IN · 지워지지 않음)', async () => {
        const findOne = vi.spyOn(dataSource.manager, 'findOne').mockResolvedValue(null);

        await repository.findInquiryStore('s1');
        const [sql, parameters] = buildFindQuery(dataSource, findOne.mock.calls[0]);
        findOne.mockRestore();

        expect(parameters).toEqual(['s1', 'ACTIVE', 'SUSPEND', 0]);
        expect(sql).toContain('"StoreEntity"."store_id" = $1');
        expect(sql).toContain('"StoreEntity"."store_state_id" IN ($2, $3)');
        expect(sql).toContain('"StoreEntity"."is_deleted" = $4');
    });

    it('내 문의 목록 (전체) — 작성자 조건만, 업체 leftJoin(is_deleted 없음 — 바로방 · 지운 업체도) · 카테고리 · 상태 innerJoin, 상세 칸 없음', () => {
        const [sql, parameters] = repository.buildMyInquiryQuery(FILTER_ALL, false).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([USER_ID]);
        expect(flat).toContain('FROM "t_inquiry" "i" LEFT JOIN "t_store" "s" ON "s"."store_id" = "i"."store_id"');
        expect(flat).toContain('INNER JOIN "t_inquiry_category" "c" ON "c"."inquiry_category_id" = "i"."inquiry_category_id"');
        expect(flat).toContain('INNER JOIN "t_inquiry_state" "st" ON "st"."inquiry_state_id" = "i"."inquiry_state_id"');
        expect(flat).toContain('WHERE "i"."user_id" = $1');
        expect(flat).not.toContain('is_deleted');
        expect(flat).not.toContain('"i"."inquiry_category_id" =');
        expect(flat).not.toContain('"i"."inquiry_state_id" =');
        expect(flat).not.toContain('"content"');
    });

    it('내 문의 목록 (카테고리 + 상태) — 작성자 · 카테고리 · 상태가 같이 걸린다, 별칭 = 목록 행 키', () => {
        const [sql, parameters] = repository.buildMyInquiryQuery(FILTER_PICKED, false).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([USER_ID, 'RESERVATION', 'BLIND']);
        expect(flat).toContain('WHERE "i"."user_id" = $1 AND "i"."inquiry_category_id" = $2 AND "i"."inquiry_state_id" = $3');
        expect([...new Set(selectAliases(flat))].sort()).toEqual(DETAIL_ROW_KEYS.filter((key) => key !== 'content' && key !== 'answer_content').sort());
    });

    it('내 문의 상세 — 작성자 + 문의 ID, 내용 · 답변까지, 별칭 = 상세 행 키', () => {
        const [sql, parameters] = repository.buildMyInquiryQuery(FILTER_DETAIL, true).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([USER_ID, INQUIRY_ID]);
        expect(flat).toContain('WHERE "i"."user_id" = $1 AND "i"."inquiry_id" = $2');
        expect([...new Set(selectAliases(flat))].sort()).toEqual([...DETAIL_ROW_KEYS].sort());
    });
});

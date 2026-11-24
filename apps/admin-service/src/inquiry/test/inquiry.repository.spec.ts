import {InternalServerErrorException} from '@nestjs/common';
import type {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {DataSource, In, IsNull, Not} from 'typeorm';
import type {EntityTarget, FindManyOptions, ObjectLiteral} from 'typeorm';
import {ENTITIES} from '@app/database/entities.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {InquiryDetailRow, InquiryFilter} from '../interfaces/inquiry.repository.interface.js';
import {InquiryRepository} from '../repositories/inquiry.repository.js';

/** 관리 상세 행 키 — raw select 별칭과 비교 */
const DETAIL_ROW_KEYS: (keyof InquiryDetailRow)[] = [
    'inquiry_id',
    'user_id',
    'user_nickname',
    'store_id',
    'inquiry_category_id',
    'inquiry_category_name',
    'title',
    'inquiry_state_id',
    'inquiry_state_name',
    'answered_at',
    'created_at',
    'content',
    'answer_content',
    'answer_user_name',
    'blinded_at',
];

/** 업체 · 문의 · 매니저 */
const STORE_ID = 'b'.repeat(32);
const INQUIRY_ID = 'a'.repeat(32);
const MANAGER_ID = 'm'.repeat(32);

/** 업체 범위 + 카테고리 · 상태 · 검색어 / 바로방 범위(전체) / 바로방 상세 */
const FILTER_STORE: InquiryFilter = {store_id: STORE_ID, inquiry_id: null, inquiry_category_id: 'PAYMENT', inquiry_state_id: 'RECEIVED', keyword: '환불'};
const FILTER_DIRECT: InquiryFilter = {store_id: null, inquiry_id: null, inquiry_category_id: null, inquiry_state_id: null, keyword: null};
const FILTER_DETAIL: InquiryFilter = {store_id: null, inquiry_id: INQUIRY_ID, inquiry_category_id: null, inquiry_state_id: null, keyword: null};

/**
 * repository 가 manager.findOne 에 넘긴 옵션을 SQL 로 빌드한다(실행만 뺀다).
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
 * repository 가 manager.update 에 넘긴 조건 · 값을 SQL 로 빌드한다(실행만 뺀다).
 *
 * @param dataSource 메타데이터만 만든 DataSource
 * @param call 가로챈 호출 인자(대상 엔티티, 조건, 값)
 * @returns 공백을 하나로 줄인 SQL 과 파라미터
 */
function buildUpdateQuery(dataSource: DataSource, call: unknown[]): [string, unknown[]] {
    const [target, criteria, partial] = call as [EntityTarget<ObjectLiteral>, ObjectLiteral, ObjectLiteral];
    const [sql, parameters] = dataSource.manager.createQueryBuilder().update(target).set(partial).where(criteria).getQueryAndParameters();
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
 * txHost.tx(EntityManager)를 흉내 낸다 — 문의 표의 가짜 repository.
 *
 * @returns 저장소와 가짜 repository
 */
function makeRepository() {
    const inquiries = {findOne: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({affected: 1})};
    const txHost = {tx: {getRepository: () => inquiries}} as unknown as TransactionHost<TransactionalAdapterTypeOrm>;
    return {repository: new InquiryRepository(txHost), inquiries};
}

describe('InquiryRepository (admin-service) — 조건 · 상태 조건 쓰기 · 통일 500', () => {
    it('[SUCCESS] findInquiry — 받은 조건 그대로(is_deleted 없는 표) · loadRelationIds', async () => {
        const {repository, inquiries} = makeRepository();

        await repository.findInquiry({store_id: STORE_ID, inquiry_id: INQUIRY_ID});

        expect(inquiries.findOne).toHaveBeenCalledWith({where: {store_id: STORE_ID, inquiry_id: INQUIRY_ID}, loadRelationIds: true});
    });

    it('[SUCCESS] updateInquiry — 1행을 바꿨으면 true, 그사이 상태가 바뀌어 0행이면 false(service 가 400)', async () => {
        const {repository, inquiries} = makeRepository();
        const entity = new InquiryEntity();
        inquiries.update.mockResolvedValueOnce({affected: 1}).mockResolvedValueOnce({affected: 0});

        await expect(repository.updateInquiry({inquiry_id: INQUIRY_ID}, entity)).resolves.toBe(true);
        await expect(repository.updateInquiry({inquiry_id: INQUIRY_ID}, entity)).resolves.toBe(false);
        expect(inquiries.update).toHaveBeenCalledWith({inquiry_id: INQUIRY_ID}, entity);
    });

    it.each([
        ['findInquiry', 'findOne', [{inquiry_id: INQUIRY_ID}]],
        ['updateInquiry', 'update', [{inquiry_id: INQUIRY_ID}, new InquiryEntity()]],
    ] as const)('[FAIL:repository] %s — DB 실패는 통일 500', async (method, fn, args) => {
        const {repository, inquiries} = makeRepository();
        inquiries[fn].mockRejectedValueOnce(new Error('db'));

        await expect((repository[method] as (...params: unknown[]) => Promise<unknown>)(...args)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it.each([
        ['findManagerStore', 'buildManagerStoreQuery', 'getOne', [MANAGER_ID]],
        ['countInquiryRows', 'buildInquiryQuery', 'getCount', [FILTER_DIRECT]],
        ['findInquiryRows', 'buildInquiryQuery', 'getRawMany', [FILTER_DIRECT, 20, 0]],
        ['findInquiryDetailRow', 'buildInquiryQuery', 'getRawOne', [FILTER_DETAIL]],
    ] as const)('[FAIL:repository] %s 는 %s 를 실행(%s)하고, 실패는 통일 500', async (method, builderName, runner, args) => {
        const {repository} = makeRepository();
        const builder: Record<string, unknown> = {};
        for (const name of ['orderBy', 'addOrderBy', 'limit', 'offset']) {
            builder[name] = vi.fn(() => builder);
        }
        builder[runner] = vi.fn().mockRejectedValue(new Error('db'));
        const spy = vi.spyOn(repository as unknown as Record<string, (...params: unknown[]) => unknown>, builderName).mockReturnValue(builder);

        await expect((repository[method] as (...params: unknown[]) => Promise<unknown>)(...args)).rejects.toBeInstanceOf(InternalServerErrorException);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual(args[0]);
    });
});

describe('[SMOKE:data-access] 매니저 소속 업체 · 문의 관리 목록 · 상세 · 범위 조건 — DB 연결 없이 SQL 빌드', () => {
    let dataSource: DataSource;
    let repository: InquiryRepository;

    beforeAll(async () => {
        // 접속하지 않는다 — 엔티티 메타데이터만 만들어 QueryBuilder 가 SQL 을 조립하게 한다
        dataSource = new DataSource({type: 'postgres', database: 'smoke', entities: ENTITIES});
        await (dataSource as unknown as {buildMetadatas: () => Promise<void>}).buildMetadatas();
        repository = new InquiryRepository({tx: dataSource.manager} as unknown as TransactionHost<TransactionalAdapterTypeOrm>);
    });

    it('매니저의 소속 업체 — t_user 조인 · 매니저 그룹 · 탈퇴 아님 · 지워지지 않음, 잠그지 않는다', () => {
        const [sql, parameters] = repository.buildManagerStoreQuery(MANAGER_ID).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([MANAGER_ID, 'MANAGER', 'LEAVE']);
        expect(flat).toContain('INNER JOIN "t_user" "u" ON "u"."store_id" = "s"."store_id"');
        expect(flat).toContain('WHERE "u"."user_id" = $1 AND "u"."login_scope" = $2 AND "s"."store_state_id" <> $3 AND "s"."is_deleted" = 0');
        expect(flat).not.toContain('FOR UPDATE');
    });

    it('관리 목록 (업체 범위 + 카테고리 · 상태 · 검색어) — store_id = · 카테고리 · 상태 · (제목 OR 내용) 괄호, 조인 3개, 상세 칸 없음', () => {
        const [sql, parameters] = repository.buildInquiryQuery(FILTER_STORE, false).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([STORE_ID, 'PAYMENT', 'RECEIVED', '%환불%']);
        expect(flat).toContain('INNER JOIN "t_user" "u" ON "u"."user_id" = "i"."user_id"');
        expect(flat).toContain('INNER JOIN "t_inquiry_category" "c" ON "c"."inquiry_category_id" = "i"."inquiry_category_id"');
        expect(flat).toContain('INNER JOIN "t_inquiry_state" "st" ON "st"."inquiry_state_id" = "i"."inquiry_state_id"');
        expect(flat).toContain('WHERE "i"."store_id" = $1 AND "i"."inquiry_category_id" = $2 AND "i"."inquiry_state_id" = $3 AND ("i"."title" ILIKE $4 OR "i"."content" ILIKE $4)');
        expect(flat).not.toContain('"a"."name"');
        expect(flat).not.toContain('is_deleted');
    });

    it('관리 목록 (바로방 범위 · 전체) — 범위는 값이 없어도 store_id IS NULL 로 반드시 건다, 다른 조건 없음', () => {
        const [sql, parameters] = repository.buildInquiryQuery(FILTER_DIRECT, false).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([]);
        expect(flat).toMatch(/WHERE "i"."store_id" IS NULL$/);
    });

    it('관리 상세 (바로방) — 범위 + 문의 ID, 답변 계정 이름 leftJoin · 내용 · 답변 · 블라인드 시각, 별칭 = 상세 행 키', () => {
        const [sql, parameters] = repository.buildInquiryQuery(FILTER_DETAIL, true).getQueryAndParameters();
        const flat = sql.replace(/\s+/g, ' ');

        expect(parameters).toEqual([INQUIRY_ID]);
        expect(flat).toContain('LEFT JOIN "t_user" "a" ON "a"."user_id" = "i"."answer_user_id"');
        expect(flat).toContain('WHERE "i"."store_id" IS NULL AND "i"."inquiry_id" = $1');
        expect([...new Set(selectAliases(flat))].sort()).toEqual([...DETAIL_ROW_KEYS].sort());
    });

    it('문의 단건 (바로방 범위) — findOne 에 넘긴 관계 속성 store_id: IsNull() 이 "store_id" IS NULL 로', async () => {
        const findOne = vi.spyOn(dataSource.manager, 'findOne').mockResolvedValue(null);

        await repository.findInquiry({store_id: IsNull(), inquiry_id: INQUIRY_ID});
        const [sql, parameters] = buildFindQuery(dataSource, findOne.mock.calls[0]);
        findOne.mockRestore();

        expect(parameters).toEqual([INQUIRY_ID]);
        expect(sql).toContain('"InquiryEntity"."store_id" IS NULL');
        expect(sql).toContain('"InquiryEntity"."inquiry_id" = $1');
        expect(sql).not.toContain('is_deleted');
    });

    it('답변 · 블라인드 저장 조건 — 업체 범위 · 문의 ID · 상태 IN(접수 · 답변완료)', async () => {
        const update = vi.spyOn(dataSource.manager, 'update').mockResolvedValue({affected: 1, raw: [], generatedMaps: []});
        const entity = new InquiryEntity();
        entity.inquiry_state_id = 'BLIND';
        entity.blind_user_id = MANAGER_ID;

        await repository.updateInquiry({store_id: STORE_ID, inquiry_id: INQUIRY_ID, inquiry_state_id: In(['RECEIVED', 'ANSWERED'])}, entity);
        const [sql, parameters] = buildUpdateQuery(dataSource, update.mock.calls[0]);
        update.mockRestore();

        expect(parameters).toEqual(['BLIND', MANAGER_ID, STORE_ID, INQUIRY_ID, 'RECEIVED', 'ANSWERED']);
        expect(sql).toContain('WHERE ("store_id" = $3 AND "inquiry_id" = $4 AND "inquiry_state_id" IN ($5, $6))');
    });

    it('해제 저장 조건 — 바로방 범위 IS NULL · 블라인드 · 답변 있음 IS NOT NULL, 블라인드 칸은 NULL 로', async () => {
        const update = vi.spyOn(dataSource.manager, 'update').mockResolvedValue({affected: 1, raw: [], generatedMaps: []});
        const entity = new InquiryEntity();
        entity.inquiry_state_id = 'ANSWERED';
        entity.blind_user_id = null;
        entity.blinded_at = null;

        await repository.updateInquiry({store_id: IsNull(), inquiry_id: INQUIRY_ID, inquiry_state_id: 'BLIND', answered_at: Not(IsNull())}, entity);
        const [sql, parameters] = buildUpdateQuery(dataSource, update.mock.calls[0]);
        update.mockRestore();

        expect(parameters).toEqual(['ANSWERED', INQUIRY_ID, 'BLIND']);
        expect(sql).toContain('"blind_user_id" = NULL');
        expect(sql).toContain('"blinded_at" = NULL');
        expect(sql).toContain('"store_id" IS NULL');
        expect(sql).toContain('NOT("answered_at" IS NULL)');
    });
});

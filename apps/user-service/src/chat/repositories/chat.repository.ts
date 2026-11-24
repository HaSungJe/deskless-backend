import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {TransactionHost} from '@nestjs-cls/transactional';
import type {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {In} from 'typeorm';
import type {FindOptionsWhere, Repository, SelectQueryBuilder} from 'typeorm';
import {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import {StoreEmbeddingEntity} from '@app/database/entities/store/store-embedding.entity.js';
import {StoreFileEntity} from '@app/database/entities/store/store-file.entity.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import {notDeleted} from '@app/database/soft-delete.js';
import {CHAT_AREA_MATCH, CHAT_EARTH_RADIUS_KM, CHAT_ROOM_STATE_DISABLED, CHAT_STORE_IMAGE_PURPOSE, CHAT_STORE_STATE_ACTIVE} from '../chat.constants.js';
import type {ChatDetailCondition, ChatRecommendFilter, ChatRecommendStoreRow, ChatRepositoryInterface} from '../interfaces/chat.repository.interface.js';

const SERVER_ERROR_MESSAGE = '서버에서 오류가 발생했습니다. 관리자에게 문의해주세요.';

/** 그 그룹에 예약 받을 호실(지워지지 않고 사용중지 아님)이 있는지 — discovery 반경 업체 조회와 같은 식 */
const GROUP_HAS_BOOKABLE_ROOM_SQL = 'EXISTS (SELECT 1 FROM "t_room" "r" WHERE "r"."room_group_id" = "g"."room_group_id" AND "r"."is_deleted" = 0 AND "r"."room_state_id" <> :disabled_state)';

/** 그 그룹이 판매 중인지(그룹 상품 사용 · 요금 > 0 · 업체 상품 설정 사용) — discovery 반경 업체 조회와 같은 식 */
const GROUP_ON_SALE_SQL =
    'EXISTS (SELECT 1 FROM "t_room_group_plan" "gp" INNER JOIN "t_room_plan" "p" ON "p"."store_id" = "g"."store_id" AND "p"."room_plan_type_id" = "gp"."room_plan_type_id" WHERE "gp"."room_group_id" = "g"."room_group_id" AND "gp"."is_used" = 1 AND "gp"."price" > 0 AND "p"."is_used" = 1)';

/**
 * 업체와 한 점 사이 대원 거리(m) SQL — discovery 의 DISTANCE_SQL 과 같은 식(파라미터 이름만 받는다).
 *
 * @param latitude 위도 파라미터(예: `:area_latitude_0`)
 * @param longitude 경도 파라미터
 * @returns 거리 SQL
 */
function distanceSql(latitude: string, longitude: string): string {
    return `(${2 * CHAT_EARTH_RADIUS_KM * 1000} * ASIN(LEAST(1, SQRT(POWER(SIN(RADIANS("s"."latitude" - ${latitude}) / 2), 2) + COS(RADIANS(${latitude})) * COS(RADIANS("s"."latitude")) * POWER(SIN(RADIANS("s"."longitude" - ${longitude}) / 2), 2)))))`;
}

/**
 * 추가정보 조건 하나의 SQL — 빠진 JSON 항목은 기본값, 항목 키는 text 로 못 박는다(타입 없는 파라미터면 jsonb ->> 가 text · integer 중 고르지 못한다).
 *
 * @param column JSON 컬럼(`"g"."room_group_detail"` · `"s"."store_detail"`)
 * @param prefix 파라미터 이름 접두
 * @param index 조건 번호
 * @param condition 조건
 * @param parameters 파라미터를 담을 객체
 * @returns 조건 SQL
 */
function detailConditionSql(column: string, prefix: string, index: number, condition: ChatDetailCondition, parameters: Record<string, string | number>): string {
    parameters[`${prefix}_key_${index}`] = condition.key;
    parameters[`${prefix}_default_${index}`] = condition.default_value;
    parameters[`${prefix}_value_${index}`] = condition.value;
    return `COALESCE((${column} ->> CAST(:${prefix}_key_${index} AS text))::integer, :${prefix}_default_${index}) ${condition.operator === 'GTE' ? '>=' : '='} :${prefix}_value_${index}`;
}

/**
 * chat repository — 업체 · 객실 그룹 · 업체 검색 벡터 읽기(AI 대화형 업체 검색). 대화 자체는 CONVERSATION_STORE(Redis).
 */
@Injectable()
export class ChatRepository implements ChatRepositoryInterface {
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

    /**
     * 추천 업체 — 조건에 맞는 업체를 벡터 거리(없으면 첫 지역 거리) 가까운 순으로 limit 개.
     *
     * @param filter 조건
     * @param limit 최대 개수
     * @returns 업체 행
     */
    async findRecommendStoreRows(filter: ChatRecommendFilter, limit: number): Promise<ChatRecommendStoreRow[]> {
        try {
            return await this.buildRecommendStoreQuery(filter, limit).getRawMany<ChatRecommendStoreRow>();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 카드 객실 그룹 — 업체들의 지워지지 않은 객실 그룹.
     *
     * @param store_ids 업체 ID 목록
     * @returns 객실 그룹
     */
    async findCardRoomGroups(store_ids: string[]): Promise<RoomGroupEntity[]> {
        try {
            const where: FindOptionsWhere<RoomGroupEntity> = {store_id: In(store_ids)};
            return await this.roomGroups.find({where: notDeleted(where), loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 추천 업체 쿼리 — 활성 · 영업 중 · 지워지지 않은 업체에 지역(ALL 은 모두 AND · ANY 는 괄호 OR) · 객실 항목(예약 받을 · 판매 중인 그룹 EXISTS) · 업체 편의시설(업체 행 JSON) · 제외 업체를 걸고,
     * 검색 벡터가 있으면 업체 검색 벡터와의 코사인 거리(`<=>`) 가까운 순(벡터 없는 업체는 뒤 — NULLS LAST), 없으면 첫 지역에서 가까운 순으로 limit 개.
     * 대표 사진은 discovery 반경 업체 조회와 같은 서브쿼리. 매핑 민감(raw select · 서브쿼리 · 동적 조립 · pgvector)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param filter 조건
     * @param limit 최대 개수
     * @returns 쿼리 빌더
     */
    buildRecommendStoreQuery(filter: ChatRecommendFilter, limit: number): SelectQueryBuilder<StoreEntity> {
        const query = this.stores
            .createQueryBuilder('s')
            .leftJoin(StoreEmbeddingEntity, 'e', '"e"."store_id" = "s"."store_id"')
            .select('s.store_id', 'store_id')
            .addSelect('s.store_name', 'store_name')
            .addSelect('s.address', 'address')
            .addSelect('s.latitude', 'latitude')
            .addSelect('s.longitude', 'longitude')
            .addSelect('s.store_detail', 'store_detail')
            .addSelect(
                (sub) =>
                    sub
                        .select('"f"."file_key"')
                        .from(StoreFileEntity, 'f')
                        .where('"f"."store_id" = "s"."store_id"')
                        .andWhere('"f"."store_file_purpose_id" = :image_purpose')
                        .andWhere('"f"."is_deleted" = 0')
                        .orderBy('"f"."sort_order"', 'ASC')
                        .addOrderBy('"f"."created_at"', 'ASC')
                        .limit(1),
                'cover_file_key',
            )
            .addSelect(
                (sub) =>
                    sub
                        .select('"f"."file_storage"')
                        .from(StoreFileEntity, 'f')
                        .where('"f"."store_id" = "s"."store_id"')
                        .andWhere('"f"."store_file_purpose_id" = :image_purpose')
                        .andWhere('"f"."is_deleted" = 0')
                        .orderBy('"f"."sort_order"', 'ASC')
                        .addOrderBy('"f"."created_at"', 'ASC')
                        .limit(1),
                'cover_file_storage',
            )
            .where('s.store_state_id = :active_state')
            .andWhere('s.is_open = 1')
            .andWhere('s.is_deleted = 0');
        // 지역 — ALL 은 모두 AND, ANY 는 OR(괄호로 묶어 다른 조건과 섞이지 않게)
        if (filter.areas.length > 0) {
            const parameters: Record<string, number> = {};
            const conditions = filter.areas.map((area, index) => {
                parameters[`area_latitude_${index}`] = area.latitude;
                parameters[`area_longitude_${index}`] = area.longitude;
                parameters[`area_radius_m_${index}`] = area.radius_m;
                return `${distanceSql(`:area_latitude_${index}`, `:area_longitude_${index}`)} <= :area_radius_m_${index}`;
            });
            query.andWhere(`(${conditions.join(filter.area_match === CHAT_AREA_MATCH.ALL ? ' AND ' : ' OR ')})`, parameters);
        }
        // 객실 항목 — 모두 갖춘 예약 받을 · 판매 중인 그룹이 있는 업체만
        if (filter.detail_conditions.length > 0) {
            const parameters: Record<string, string | number> = {};
            const conditions = filter.detail_conditions.map((condition, index) => detailConditionSql('"g"."room_group_detail"', 'detail', index, condition, parameters));
            query.andWhere(
                `EXISTS (SELECT 1 FROM "t_room_group" "g" WHERE "g"."store_id" = "s"."store_id" AND "g"."is_deleted" = 0 AND ${GROUP_HAS_BOOKABLE_ROOM_SQL} AND ${GROUP_ON_SALE_SQL} AND ${conditions.join(' AND ')})`,
                {...parameters, disabled_state: CHAT_ROOM_STATE_DISABLED},
            );
        }
        // 업체 편의시설 — 업체 행 JSON 에 바로
        if (filter.store_conditions.length > 0) {
            const parameters: Record<string, string | number> = {};
            const conditions = filter.store_conditions.map((condition, index) => detailConditionSql('"s"."store_detail"', 'store_detail', index, condition, parameters));
            query.andWhere(conditions.join(' AND '), parameters);
        }
        // 이 이용자의 대화에서 이미 추천한 업체 빼기
        if (filter.excluded_store_ids.length > 0) {
            query.andWhere('s.store_id NOT IN (:...excluded_store_ids)', {excluded_store_ids: filter.excluded_store_ids});
        }
        // 벡터 거리(코사인) 가까운 순 — 검색 문장이 없으면 첫 지역에서 가까운 순, 둘 다 없으면 업체 ID 순
        if (filter.query_vector) {
            query.orderBy('"e"."embedding" <=> CAST(:query_vector AS vector)', 'ASC', 'NULLS LAST').setParameter('query_vector', filter.query_vector);
        } else if (filter.areas.length > 0) {
            query.orderBy(distanceSql(':area_latitude_0', ':area_longitude_0'), 'ASC');
        }
        return query.addOrderBy('s.store_id', 'ASC').limit(limit).setParameters({active_state: CHAT_STORE_STATE_ACTIVE, image_purpose: CHAT_STORE_IMAGE_PURPOSE});
    }
}

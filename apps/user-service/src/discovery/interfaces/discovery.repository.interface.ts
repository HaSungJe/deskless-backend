import type {FindOptionsWhere} from 'typeorm';
import type {RoomGroupImageEntity} from '@app/database/entities/room/room-group-image.entity.js';
import type {RoomGroupPlanPriceEntity} from '@app/database/entities/room/room-group-plan-price.entity.js';
import type {RoomGroupPlanEntity} from '@app/database/entities/room/room-group-plan.entity.js';
import type {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import type {StoreBreakEntity} from '@app/database/entities/store/store-break.entity.js';
import type {StoreFileEntity} from '@app/database/entities/store/store-file.entity.js';
import type {StoreHourEntity} from '@app/database/entities/store/store-hour.entity.js';
import type {StoreEntity} from '@app/database/entities/store/store.entity.js';

/** 추가정보 조건 하나 — 객실 그룹 상세 JSON 항목(빠지면 기본값)과 비교 */
export interface DiscoveryDetailCondition {
    /** 항목 키(ROOM_GROUP_DETAIL_FILTERS 에 있는 것만) */
    key: string;
    /** EQ: 같다, GTE: 이상 */
    operator: 'EQ' | 'GTE';
    /** 비교 값 */
    value: number;
    /** JSON 에 항목이 빠졌을 때 볼 값(ROOM_GROUP_DETAIL_DEFAULTS) */
    default_value: number;
}

/** 반경 업체 조회 조건 — 중심 · 반경(m) · 인덱스로 먼저 거를 위경도 사각형(거리 제한 없음이면 반경 · 사각형 null) · 추가정보 조건 */
export interface DiscoveryStoreFilter {
    latitude: number;
    longitude: number;
    radius_m: number | null;
    min_latitude: number | null;
    max_latitude: number | null;
    min_longitude: number | null;
    max_longitude: number | null;
    /** 모두 갖춘 이용자에게 보이는 객실 그룹이 있는 업체만 — 없으면 [] */
    detail_conditions: DiscoveryDetailCondition[];
}

/** 반경 업체 행 (QueryBuilder raw — 별칭이 이 키와 같다) */
export interface DiscoveryStoreRow {
    store_id: string;
    store_name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance_m: number;
    cover_file_key: string | null;
    cover_file_storage: string | null;
    is_open: number;
    is_always_open: number;
    min_hourly_price: number | null;
    min_night_price: number | null;
}

/** 업체 상품 설정 행 — 상품 종류명 조인 (QueryBuilder raw) */
export interface DiscoveryStorePlanRow {
    room_plan_type_id: string;
    room_plan_type_name: string;
    is_used: number;
    days_of_week: number;
    usage_hours: number | null;
    check_in_time: string | null;
    check_out_time: string | null;
    min_nights: number | null;
    max_nights: number | null;
    is_extendable: number;
    max_extensions: number;
}

/** 업체 이름 검색 행 (QueryBuilder raw — 별칭이 키와 같다) — 대표 사진은 업체 사진 첫 장의 키 · 저장소 */
export interface DiscoveryStoreSearchRow {
    store_id: string;
    store_name: string;
    address: string;
    latitude: number;
    longitude: number;
    cover_file_key: string | null;
    cover_file_storage: string | null;
}

/** 그룹별 예약 받을 호실 수 (QueryBuilder raw) */
export interface DiscoveryRoomCountRow {
    room_group_id: string;
    room_count: number;
}

/**
 * discovery repository 포트 — 공유 DB 의 업체 · 객실 표를 둘러보기 어휘로 읽기만 한다(사용자 결정 2026-11-03 — 공유 DB 직접 읽기).
 * is_deleted 가 있는 표는 repository 가 지워지지 않은 행만 읽는다.
 */
export interface DiscoveryRepositoryInterface {
    /** 반경 안의 활성 업체 — 가까운 순, limit 개 */
    findStoreRows(filter: DiscoveryStoreFilter, limit: number): Promise<DiscoveryStoreRow[]>;
    /** 업체 이름 검색 — 상호명 부분 일치 · 영업 중 · 영업중지, 상호명 순 limit 개(대표 사진 키 포함) */
    findStoreSearchRows(keyword: string, limit: number): Promise<DiscoveryStoreSearchRow[]>;
    /** 업체 단건 */
    findDiscoveryStore(where: FindOptionsWhere<StoreEntity>): Promise<StoreEntity | null>;
    /** 업체 정보 파일 — 정렬 순서 · 등록일 순 */
    findStoreImages(where: FindOptionsWhere<StoreFileEntity>): Promise<StoreFileEntity[]>;
    /** 요일 영업시간 — 요일 순 */
    findStoreHours(store_id: string): Promise<StoreHourEntity[]>;
    /** 브레이크타임 — 시작 순 */
    findStoreBreaks(store_id: string): Promise<StoreBreakEntity[]>;
    /** 업체 상품 설정 + 종류명 */
    findStorePlanRows(store_id: string): Promise<DiscoveryStorePlanRow[]>;
    /** 객실 그룹 — 그룹명 순 */
    findRoomGroups(where: FindOptionsWhere<RoomGroupEntity>): Promise<RoomGroupEntity[]>;
    /** 그룹별 예약 받을 호실 수(호실이 없는 그룹은 행이 없다) */
    countBookableRooms(room_group_ids: string[]): Promise<DiscoveryRoomCountRow[]>;
    /** 객실 그룹 사진 — 정렬 순서 · 등록일 순 */
    findRoomGroupImages(where: FindOptionsWhere<RoomGroupImageEntity>): Promise<RoomGroupImageEntity[]>;
    /** 그룹 상품 */
    findRoomGroupPlans(where: FindOptionsWhere<RoomGroupPlanEntity>): Promise<RoomGroupPlanEntity[]>;
    /** 기간 가격 — 시작 날짜 순 */
    findRoomGroupPlanPrices(where: FindOptionsWhere<RoomGroupPlanPriceEntity>): Promise<RoomGroupPlanPriceEntity[]>;
}

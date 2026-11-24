import type {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import type {StoreDetail} from '@app/database/entities/store/store.entity.js';

/** 추천 지역 — 중심 위경도 · 반경(m) */
export interface ChatRecommendArea {
    latitude: number;
    longitude: number;
    radius_m: number;
}

/** 추가정보 조건 하나 — 객실 그룹 상세 · 업체 편의시설 항목(정의의 연산 · 값 · 빠진 항목 기본값) */
export interface ChatDetailCondition {
    /** 항목 키(ROOM_GROUP_DETAIL_FILTERS 또는 STORE_DETAIL_FILTERS 에 있는 것만) */
    key: string;
    /** EQ: 같다, GTE: 이상 */
    operator: 'EQ' | 'GTE';
    /** 비교 값 */
    value: number;
    /** JSON 에 항목이 빠졌을 때 볼 값 */
    default_value: number;
}

/** 추천 업체 조건 — 지역(ALL · ANY) · 객실 · 업체 편의시설 · 제외 업체 · 검색 벡터(pgvector 문자열, 없으면 null) */
export interface ChatRecommendFilter {
    areas: ChatRecommendArea[];
    area_match: 'ALL' | 'ANY';
    /** 모두 갖춘 예약 받을 · 판매 중인 객실 그룹이 있는 업체만 — 없으면 [] */
    detail_conditions: ChatDetailCondition[];
    /** 업체 편의시설(t_store.store_detail)이 모두 맞는 업체만 — 없으면 [] */
    store_conditions: ChatDetailCondition[];
    /** 이 이용자의 대화에서 이미 추천한 업체 — 없으면 [] */
    excluded_store_ids: string[];
    /** 검색 문장 벡터 `'[0.1,…]'` — 있으면 코사인 거리 가까운 순 */
    query_vector: string | null;
}

/** 추천 업체 행 (QueryBuilder raw — 별칭이 이 키와 같다) */
export interface ChatRecommendStoreRow {
    store_id: string;
    store_name: string;
    address: string;
    latitude: number;
    longitude: number;
    /** jsonb — 저장 안 된 항목은 빠져 있을 수 있다(STORE_DETAIL_DEFAULTS 로 채운다) */
    store_detail: Partial<StoreDetail> | null;
    cover_file_key: string | null;
    cover_file_storage: string | null;
}

/**
 * chat repository 포트 — 업체 · 객실 그룹 · 업체 검색 벡터 읽기(대화 자체는 CONVERSATION_STORE).
 */
export interface ChatRepositoryInterface {
    /**
     * 추천 업체 — 활성 · 영업 중 · 지워지지 않은 업체 중 조건에 맞는 것을 벡터 거리(없으면 첫 지역 거리) 가까운 순으로 limit 개.
     */
    findRecommendStoreRows(filter: ChatRecommendFilter, limit: number): Promise<ChatRecommendStoreRow[]>;

    /**
     * 카드 객실 그룹 — 업체들의 지워지지 않은 객실 그룹(상세정보로 객실 항목을 정한다).
     */
    findCardRoomGroups(store_ids: string[]): Promise<RoomGroupEntity[]>;
}

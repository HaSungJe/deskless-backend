import {generateId} from '@app/common/utils/id.js';
import {ROOM_GROUP_DETAIL_DEFAULTS} from '@app/database/entities/room/room-group.entity.js';
import type {RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import type {RoomPlanEntity} from '@app/database/entities/room/room-plan.entity.js';
import {StoreEmbeddingEntity} from '@app/database/entities/store/store-embedding.entity.js';
import {STORE_DETAIL_DEFAULTS, STORE_DETAIL_FILTERS} from '@app/database/entities/store/store.entity.js';
import type {StoreDetail, StoreEntity} from '@app/database/entities/store/store.entity.js';
import {AI_EMBEDDING_MODEL_DEFAULT} from '@app/integration/integration.constants.js';

/** 벡터를 만들 업체 상태 — 활성 */
export const STORE_EMBEDDING_STORE_STATE = 'ACTIVE';

/** 임베딩 한 번에 보내는 업체 수 */
export const STORE_EMBEDDING_BATCH = 50;

/** 상품 종류 이름 — 검색용 글(판매) */
const PLAN_TYPE_NAME: Record<string, string> = {HOURLY: '시간 이용', NIGHT: '1박', LONG: '연박'};

/** 상품 종류 순서 */
const PLAN_TYPE_ORDER = ['HOURLY', 'NIGHT', 'LONG'];

/**
 * 임베딩 모델 이름 — GEMINI_EMBEDDING_MODEL, 비면 기본값(AI 어댑터와 같은 규칙). 바뀌면 모든 업체 벡터를 다시 만든다.
 *
 * @returns 모델 이름
 */
export function readEmbeddingModel(): string {
    return process.env.GEMINI_EMBEDDING_MODEL || AI_EMBEDDING_MODEL_DEFAULT;
}

/**
 * 객실 그룹 하나의 설명 — 이름(설명, 방 n개, 샤워실 · TV · PC 있는 것).
 *
 * @param group 객실 그룹
 * @returns 설명
 */
function describeRoomGroup(group: RoomGroupEntity): string {
    const detail = {...ROOM_GROUP_DETAIL_DEFAULTS, ...group.room_group_detail};
    const parts = [group.description, `방 ${detail.room_count}개`, detail.has_shower === 1 ? '샤워실' : null, detail.has_tv === 1 ? 'TV' : null, detail.has_pc === 1 ? 'PC 있음' : null];
    return `${group.room_group_name}(${parts.filter((part): part is string => !!part).join(', ')})`;
}

/**
 * 업체 검색용 글 — 이름 · 주소 · 소개 · 편의시설 · 객실 · 판매 상품을 줄마다(AI 대화형 검색이 이 글의 벡터로 찾는다). 같은 입력이면 같은 글(해시 비교).
 *
 * @param store 업체
 * @param groups 객실 그룹(모든 업체 — 이 업체 것만 쓴다)
 * @param plans 판매 중인 상품 설정(모든 업체)
 * @returns 검색용 글
 */
export function buildStoreEmbeddingContent(store: StoreEntity, groups: RoomGroupEntity[], plans: RoomPlanEntity[]): string {
    const detail: StoreDetail = {...STORE_DETAIL_DEFAULTS, ...store.store_detail};
    const facilities = Object.entries(STORE_DETAIL_FILTERS)
        .filter(([key, filter]) => detail[key as keyof StoreDetail] === filter.value)
        .map(([, filter]) => filter.name);
    const rooms = groups.filter((group) => group.store_id === store.store_id).map(describeRoomGroup);
    const sales = PLAN_TYPE_ORDER.filter((type) => plans.some((plan) => plan.store_id === store.store_id && plan.room_plan_type_id === type)).map((type) => PLAN_TYPE_NAME[type]);
    return [
        `업체: ${store.store_name}`,
        `주소: ${store.address}`,
        `소개: ${store.introduction ?? '없음'}`,
        `편의시설: ${facilities.join(' · ') || '없음'}`,
        `객실: ${rooms.join(' · ') || '없음'}`,
        `판매: ${sales.join(' · ') || '없음'}`,
    ].join('\n');
}

/**
 * 벡터를 다시 만들어야 하는지 — 저장된 것이 없거나 해시 · 모델이 다르면.
 *
 * @param saved 저장된 검색 벡터(없으면 null)
 * @param content_hash 지금 글의 해시
 * @param model 지금 모델
 * @returns 다시 만들면 true
 */
export function isEmbeddingStale(saved: StoreEmbeddingEntity | null, content_hash: string, model: string): boolean {
    return !saved || saved.content_hash !== content_hash || saved.embedding_model !== model;
}

/**
 * 저장할 검색 벡터 — 새 ID(이미 있으면 ON CONFLICT 로 그 행을 바꾼다).
 *
 * @param store_id 업체 ID
 * @param content 검색용 글
 * @param content_hash 글의 해시
 * @param vector 벡터
 * @param model 모델
 * @returns 엔티티
 */
export function toStoreEmbeddingEntity(store_id: string, content: string, content_hash: string, vector: number[], model: string): StoreEmbeddingEntity {
    const entity = new StoreEmbeddingEntity();
    entity.store_embedding_id = generateId();
    entity.store_id = store_id;
    entity.content = content;
    entity.content_hash = content_hash;
    entity.embedding_model = model;
    entity.embedding = vector;
    return entity;
}

/**
 * 목록을 size 개씩 나눈다.
 *
 * @param items 목록
 * @param size 묶음 크기
 * @returns 묶음 목록
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

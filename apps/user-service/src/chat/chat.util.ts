import {CHAT_MESSAGE_ROLE} from '@app/contracts/chat/chat.commands.js';
import type {ChatDetailResultDto} from '@app/contracts/chat/dto/chat-detail.dto.js';
import type {ChatMessageCardFacilityResultDto, ChatMessageCardResultDto, ChatMessageDoneResultDto} from '@app/contracts/chat/dto/chat-message.dto.js';
import type {ChatQuotaResultDto} from '@app/contracts/chat/dto/chat-quota.dto.js';
import {ROOM_GROUP_DETAIL_DEFAULTS, ROOM_GROUP_DETAIL_FILTERS} from '@app/database/entities/room/room-group.entity.js';
import type {RoomGroupDetail, RoomGroupEntity} from '@app/database/entities/room/room-group.entity.js';
import {STORE_DETAIL_DEFAULTS, STORE_DETAIL_FILTERS} from '@app/database/entities/store/store.entity.js';
import type {StoreDetail} from '@app/database/entities/store/store.entity.js';
import type {AiHistoryItem, ConversationTurn, ConversationUsage, StoredFile} from '@app/integration/interfaces/integration.interface.js';
import {dayjs, KST_TIMEZONE} from '@app/common/utils/dayjs.js';
import {readPositiveInt} from '@app/common/utils/env.js';
import {generateId} from '@app/common/utils/id.js';
import {CHAT_AREA_LIMIT, CHAT_AREA_MATCH, CHAT_AREA_RADIUS_KM, CHAT_DAILY_LIMIT_DEFAULT, CHAT_FACILITY_GROUP, CHAT_KOREA_BOUNDS, CHAT_SEARCH_TEXT_MAX, CHAT_UNDERSTAND_KIND} from './chat.constants.js';
import type {ChatDetailCondition, ChatRecommendArea, ChatRecommendFilter, ChatRecommendStoreRow} from './interfaces/chat.repository.interface.js';

/** 오늘 — 한국 날짜(yyyy-MM-dd) · 초기화 시각(다음 날 한국 00:00) */
export interface ChatToday {
    date: string;
    resets_at: Date;
}

/** 요청 읽기 결과의 지역 — 이름 · 위경도 · 반경(km) */
export interface ChatUnderstandingArea {
    name: string;
    latitude: number;
    longitude: number;
    radius_km: number;
}

/** 요청 읽기 결과 — AI 가 준 JSON 을 확인한 값 */
export interface ChatUnderstanding {
    kind: (typeof CHAT_UNDERSTAND_KIND)[keyof typeof CHAT_UNDERSTAND_KIND];
    areas: ChatUnderstandingArea[];
    area_match: 'ALL' | 'ANY';
    detail_keys: string[];
    search_text: string;
}

/**
 * 지금 시각의 한국 날짜와 다음 날 00:00 — 서버 시간대와 상관없다(dayjs tz).
 *
 * @param now 지금
 * @returns 오늘
 */
export function toKstToday(now: Date): ChatToday {
    const kst = dayjs(now).tz(KST_TIMEZONE);
    return {date: kst.format('YYYY-MM-DD'), resets_at: kst.startOf('day').add(1, 'day').toDate()};
}

/**
 * 오늘 남은 질문 수 — 질문 수 한 줄의 날짜가 오늘이면 그 횟수, 줄이 없거나 다른 날짜면 0회. 남은 수는 한도에서 뺀 값(0 아래로 가지 않는다).
 *
 * @param usage 질문 수 한 줄(날짜 · 횟수 — 줄이 없으면 날짜 null · 0) · 답하는 중
 * @param daily_limit 하루 한도(CHAT_DAILY_LIMIT)
 * @param today 오늘
 * @returns 남은 질문 수 결과
 */
export function toChatQuota(usage: ConversationUsage, daily_limit: number, today: ChatToday): ChatQuotaResultDto {
    const used_count = usage.date === today.date ? usage.count : 0;
    return {daily_limit, used_count, remaining_count: Math.max(0, daily_limit - used_count), resets_at: today.resets_at.toISOString(), is_answering: usage.is_answering ? 1 : 0};
}

/**
 * 하루 질문 한도 — `.env` CHAT_DAILY_LIMIT(양의 정수), 비거나 잘못되면 5.
 *
 * @returns 하루 한도
 */
export function readChatDailyLimit(): number {
    return readPositiveInt(process.env.CHAT_DAILY_LIMIT, CHAT_DAILY_LIMIT_DEFAULT);
}

/**
 * 숫자인지(유한한 수).
 *
 * @param value 값
 * @returns 숫자면 true
 */
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * AI 가 준 지역 하나 — 모양이 맞고 한국 안이면 지역(반경은 1 ~ 50km 로 자른다), 아니면 null.
 *
 * @param value AI 가 준 값
 * @returns 지역 또는 null
 */
function toUnderstandingArea(value: unknown): ChatUnderstandingArea | null {
    const area = value as Partial<ChatUnderstandingArea> | null;
    if (!area || !isFiniteNumber(area.latitude) || !isFiniteNumber(area.longitude) || !isFiniteNumber(area.radius_km)) {
        return null;
    }
    const inKorea =
        area.latitude >= CHAT_KOREA_BOUNDS.MIN_LATITUDE &&
        area.latitude <= CHAT_KOREA_BOUNDS.MAX_LATITUDE &&
        area.longitude >= CHAT_KOREA_BOUNDS.MIN_LONGITUDE &&
        area.longitude <= CHAT_KOREA_BOUNDS.MAX_LONGITUDE;
    if (!inKorea) {
        return null;
    }
    return {
        name: typeof area.name === 'string' ? area.name : '',
        latitude: area.latitude,
        longitude: area.longitude,
        radius_km: Math.min(CHAT_AREA_RADIUS_KM.MAX, Math.max(CHAT_AREA_RADIUS_KM.MIN, area.radius_km)),
    };
}

/**
 * 요청 읽기 결과 — AI 가 준 JSON 을 믿지 않고 확인한다(종류가 틀리면 여행 이야기 · 지역은 최대 3곳 · 한국 안 · 조건 키는 문자열만 · 검색 문장 200자).
 *
 * @param value AI 가 준 JSON
 * @returns 요청 읽기 결과
 */
export function toChatUnderstanding(value: unknown): ChatUnderstanding {
    const json = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const kinds: string[] = Object.values(CHAT_UNDERSTAND_KIND);
    const kind = typeof json.kind === 'string' && kinds.includes(json.kind) ? (json.kind as ChatUnderstanding['kind']) : CHAT_UNDERSTAND_KIND.TRAVEL_TALK;
    const areas = (Array.isArray(json.areas) ? json.areas : [])
        .map(toUnderstandingArea)
        .filter((area): area is ChatUnderstandingArea => area !== null)
        .slice(0, CHAT_AREA_LIMIT);
    return {
        kind,
        areas,
        area_match: json.area_match === CHAT_AREA_MATCH.ALL ? CHAT_AREA_MATCH.ALL : CHAT_AREA_MATCH.ANY,
        detail_keys: (Array.isArray(json.detail_keys) ? json.detail_keys : []).filter((key): key is string => typeof key === 'string'),
        search_text: typeof json.search_text === 'string' ? json.search_text.trim().slice(0, CHAT_SEARCH_TEXT_MAX) : '',
    };
}

/**
 * 벡터를 pgvector 문자열로.
 *
 * @param values 벡터
 * @returns `'[0.1,0.2,…]'`
 */
export function toVectorLiteral(values: number[]): string {
    return `[${values.join(',')}]`;
}

/**
 * 객실 그룹 상세 필터 항목인지 — 정의(ROOM_GROUP_DETAIL_FILTERS)에 있는 키만.
 *
 * @param key 항목 키
 * @returns 필터 항목이면 true
 */
function isRoomGroupDetailKey(key: string): key is keyof RoomGroupDetail {
    return Object.hasOwn(ROOM_GROUP_DETAIL_FILTERS, key);
}

/**
 * 업체 편의시설 필터 항목인지 — 정의(STORE_DETAIL_FILTERS)에 있는 키만.
 *
 * @param key 항목 키
 * @returns 필터 항목이면 true
 */
function isStoreDetailKey(key: string): key is keyof StoreDetail {
    return Object.hasOwn(STORE_DETAIL_FILTERS, key);
}

/**
 * 추천 업체 조건 — 지역(km → m) · 정의에 있는 조건 키만(중복은 한 번, 정의의 연산 · 값 · 기본값) · 제외 업체 · 검색 벡터.
 *
 * @param understanding 요청 읽기 결과
 * @param vector 검색 문장 벡터(없으면 null)
 * @param excluded_store_ids 이미 추천한 업체
 * @returns repository 조건
 */
export function toRecommendFilter(understanding: ChatUnderstanding, vector: number[] | null, excluded_store_ids: string[]): ChatRecommendFilter {
    const keys = [...new Set(understanding.detail_keys)];
    const detail_conditions: ChatDetailCondition[] = keys
        .filter(isRoomGroupDetailKey)
        .map((key) => ({key, operator: ROOM_GROUP_DETAIL_FILTERS[key].operator, value: ROOM_GROUP_DETAIL_FILTERS[key].value, default_value: ROOM_GROUP_DETAIL_DEFAULTS[key]}));
    const store_conditions: ChatDetailCondition[] = keys
        .filter(isStoreDetailKey)
        .map((key) => ({key, operator: STORE_DETAIL_FILTERS[key].operator, value: STORE_DETAIL_FILTERS[key].value, default_value: STORE_DETAIL_DEFAULTS[key]}));
    const areas: ChatRecommendArea[] = understanding.areas.map((area) => ({latitude: area.latitude, longitude: area.longitude, radius_m: area.radius_km * 1000}));
    return {areas, area_match: understanding.area_match, detail_conditions, store_conditions, excluded_store_ids, query_vector: vector && vector.length > 0 ? toVectorLiteral(vector) : null};
}

/**
 * 이 이용자의 대화에서 이미 추천한 업체 ID — 중복 없이.
 *
 * @param history 대화 이력
 * @returns 업체 ID 목록
 */
export function toRecommendedStoreIds(history: ConversationTurn[]): string[] {
    const ids = history.flatMap((turn) => (turn.stores as Partial<ChatMessageCardResultDto>[]).map((card) => card?.store_id).filter((id): id is string => typeof id === 'string'));
    return [...new Set(ids)];
}

/**
 * 대화 이력을 AI 대화 기록으로 — 한 건이 이용자 질문 · AI 답 두 줄.
 *
 * @param history 대화 이력
 * @returns AI 대화 기록
 */
export function toAiHistory(history: ConversationTurn[]): AiHistoryItem[] {
    return history.flatMap((turn) => [
        {role: 'user' as const, text: turn.question},
        {role: 'model' as const, text: turn.answer},
    ]);
}

/**
 * 객실 그룹 하나가 필터 조건을 만족하는지 — 빠진 항목은 기본값.
 *
 * @param detail 그룹 상세정보
 * @param key 항목 키
 * @returns 만족하면 true
 */
function matchesRoomGroupFilter(detail: Partial<RoomGroupDetail> | null, key: keyof RoomGroupDetail): boolean {
    const filter = ROOM_GROUP_DETAIL_FILTERS[key];
    const value = detail?.[key] ?? ROOM_GROUP_DETAIL_DEFAULTS[key];
    return filter.operator === 'GTE' ? value >= filter.value : value === filter.value;
}

/**
 * 카드의 편의시설 · 객실 항목 — 업체 편의시설 7개 중 있는 것(정의 순서) 다음, 그 업체 객실 그룹 하나라도 만족하는 객실 항목(정의 순서).
 *
 * @param store_detail 업체 편의시설(빠진 항목은 없음)
 * @param groups 그 업체의 객실 그룹
 * @returns 항목
 */
function toCardFacilities(store_detail: Partial<StoreDetail> | null, groups: RoomGroupEntity[]): ChatMessageCardFacilityResultDto[] {
    const detail = {...STORE_DETAIL_DEFAULTS, ...store_detail};
    const stores = Object.entries(STORE_DETAIL_FILTERS)
        .filter(([key, filter]) => detail[key as keyof StoreDetail] === filter.value)
        .map(([key, filter]) => ({key, name: filter.name, group: CHAT_FACILITY_GROUP.STORE}));
    const rooms = (Object.keys(ROOM_GROUP_DETAIL_FILTERS) as (keyof RoomGroupDetail)[])
        .filter((key) => groups.some((group) => matchesRoomGroupFilter(group.room_group_detail, key)))
        .map((key) => ({key, name: ROOM_GROUP_DETAIL_FILTERS[key].name, group: CHAT_FACILITY_GROUP.ROOM_GROUP}));
    return [...stores, ...rooms];
}

/**
 * 추천 업체 카드 — 업체 행 순서대로(대표 사진 공개 주소 · 편의시설 · 객실 항목).
 *
 * @param rows 추천 업체 행
 * @param groups 그 업체들의 객실 그룹
 * @param toPublicUrl 파일 행 → 공개 주소(STORAGE_GATEWAY.getPublicUrl)
 * @returns 카드
 */
export function toChatCards(rows: ChatRecommendStoreRow[], groups: RoomGroupEntity[], toPublicUrl: (file: StoredFile) => string): ChatMessageCardResultDto[] {
    return rows.map((row) => ({
        store_id: row.store_id,
        store_name: row.store_name,
        address: row.address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        image_url: row.cover_file_key ? toPublicUrl({file_key: row.cover_file_key, file_storage: row.cover_file_storage}) : null,
        facilities: toCardFacilities(
            row.store_detail,
            groups.filter((group) => group.store_id === row.store_id),
        ),
    }));
}

/**
 * 답 쓰기에 넘길 이번 말 — 이용자 말 + 요청 읽기 결과 요약(종류 · 지역 · 조건) + 추천 업체(카드에 있는 것만).
 *
 * @param content 이용자 말
 * @param understanding 요청 읽기 결과
 * @param cards 추천 업체 카드
 * @returns 이번 말
 */
export function toAnswerContent(content: string, understanding: ChatUnderstanding, cards: ChatMessageCardResultDto[]): string {
    const areas = understanding.areas.map((area) => `${area.name}(반경 ${area.radius_km}km)`).join(', ');
    const stores = cards.map((card, index) => `${index + 1}. ${card.store_name} — ${card.address} / ${card.facilities.map((facility) => facility.name).join(' · ') || '편의시설 정보 없음'}`);
    return [
        `[이용자 말]\n${content}`,
        `[종류] ${understanding.kind}`,
        `[지역] ${areas || '없음'}${understanding.areas.length > 1 ? ` (${understanding.area_match === CHAT_AREA_MATCH.ALL ? '모두 가까운 곳' : '어느 한 곳'})` : ''}`,
        `[추천 업체]\n${stores.length > 0 ? stores.join('\n') : '없음'}`,
    ].join('\n\n');
}

/**
 * 저장할 대화 한 건 — user_id · 질문 + 답 · 카드 · 시각(ISO).
 *
 * @param user_id 이용자 ID
 * @param question 질문
 * @param answer 답
 * @param cards 추천 업체 카드
 * @param asked_at 물은 시각
 * @param answered_at 답한 시각
 * @returns 한 건
 */
export function toChatTurn(user_id: string, question: string, answer: string, cards: ChatMessageCardResultDto[], asked_at: Date, answered_at: Date): ConversationTurn {
    return {turn_id: generateId(), user_id, question, answer, stores: cards, asked_at: asked_at.toISOString(), answered_at: answered_at.toISOString()};
}

/**
 * done 이벤트 data — 저장된 AI 답 · 남은 질문 수.
 *
 * @param turn 저장한 한 건
 * @param quota 남은 질문 수
 * @returns done data
 */
export function toChatDone(turn: ConversationTurn, quota: ChatQuotaResultDto): ChatMessageDoneResultDto {
    return {message: {role: CHAT_MESSAGE_ROLE.AI, content: turn.answer, stores: turn.stores as ChatMessageCardResultDto[], created_at: turn.answered_at}, quota};
}

/**
 * 대화 보기 — 한 건을 USER(물은 시각) · AI(답한 시각 · 카드) 두 메시지로 펼친다.
 *
 * @param turns 대화 이력(오래된 순)
 * @param quota 남은 질문 수
 * @returns 대화 보기 결과
 */
export function toChatDetail(turns: ConversationTurn[], quota: ChatQuotaResultDto): ChatDetailResultDto {
    return {
        messages: turns.flatMap((turn) => [
            {role: CHAT_MESSAGE_ROLE.USER, content: turn.question, stores: [], created_at: turn.asked_at},
            {role: CHAT_MESSAGE_ROLE.AI, content: turn.answer, stores: turn.stores as ChatMessageCardResultDto[], created_at: turn.answered_at},
        ]),
        quota,
    };
}

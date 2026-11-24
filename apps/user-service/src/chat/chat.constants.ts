import {ROOM_GROUP_DETAIL_FILTERS} from '@app/database/entities/room/room-group.entity.js';
import {STORE_DETAIL_FILTERS} from '@app/database/entities/store/store.entity.js';

/** 다른 질문에 답하는 중 — 409 */
export const CHAT_BUSY_MESSAGE = '이전 질문에 답하는 중입니다. 답이 끝난 뒤 다시 보내주세요.';

/** 오늘 질문을 모두 썼다 — 429 */
export const CHAT_QUOTA_EXCEEDED_MESSAGE = '오늘 질문을 모두 사용했습니다. 자정(한국 시각)에 다시 채워집니다.';

/** 하루 질문 한도 기본값 — CHAT_DAILY_LIMIT 이 비거나 잘못되면 */
export const CHAT_DAILY_LIMIT_DEFAULT = 5;

/** 답하는 중 잠금 만료(ms) — 서버가 풀지 못하고 죽어도 이 시간 뒤 풀린다. 한 질문의 AI 제한 시간 합(요청 읽기 30초 + 임베딩 30초 + 글 스트리밍 60초)보다 길게 둔다 */
export const CHAT_BUSY_TTL_MS = 180_000;

/** 대화 이력 보관 일수 — 7일(24 × 7시간) 지난 대화는 scheduler 가 지운다 */
export const CHAT_TURN_KEEP_DAYS = 7;

/** 대화 이력 · 질문 수 키 만료(ms) — 7일 동안 쓰지 않으면 키째 사라진다 */
export const CHAT_TURN_KEEP_MS = CHAT_TURN_KEEP_DAYS * 24 * 60 * 60 * 1000;

/** 대화 보기가 돌려주는 최대 건수(질문 + 답 한 건) */
export const CHAT_VIEW_LIMIT = 50;

/** AI 에 붙이는 최근 대화 건수 */
export const CHAT_HISTORY_LIMIT = 10;

/** 추천 업체 카드 최대 수 */
export const CHAT_CARD_LIMIT = 3;

/** 요청 읽기 결과의 종류 — 숙소 찾기 · 여행 이야기(지역 추천 · 되묻기) · 무관한 말 */
export const CHAT_UNDERSTAND_KIND = {STORE_SEARCH: 'STORE_SEARCH', TRAVEL_TALK: 'TRAVEL_TALK', OFF_TOPIC: 'OFF_TOPIC'} as const;

/** 지역 조건 — ALL: 모든 지역의 반경 안(여행지 두 곳 사이), ANY: 한 곳이라도(후보 도시 여러 곳) */
export const CHAT_AREA_MATCH = {ALL: 'ALL', ANY: 'ANY'} as const;

/** AI 가 준 지역 — 최대 개수 · 반경(km) 범위 · 한국 위경도 범위(밖이면 버린다) */
export const CHAT_AREA_LIMIT = 3;
export const CHAT_AREA_RADIUS_KM = {MIN: 1, MAX: 50};
export const CHAT_KOREA_BOUNDS = {MIN_LATITUDE: 33, MAX_LATITUDE: 39, MIN_LONGITUDE: 124, MAX_LONGITUDE: 132};

/** AI 가 준 검색 문장 최대 길이 */
export const CHAT_SEARCH_TEXT_MAX = 200;

/** 추천할 업체 상태 — 활성 */
export const CHAT_STORE_STATE_ACTIVE = 'ACTIVE';

/** 업체 대표 사진 용도 */
export const CHAT_STORE_IMAGE_PURPOSE = 'STORE_IMAGE';

/** 예약 받을 수 없는 호실 상태 — 객실 조건의 예약 받을 호실 확인 */
export const CHAT_ROOM_STATE_DISABLED = 'DISABLED';

/** 거리 계산 지구 반지름(km) — 대원 거리 */
export const CHAT_EARTH_RADIUS_KM = 6371;

/** 카드 편의시설 묶음 — 추가정보 필터 항목과 같은 이름 */
export const CHAT_FACILITY_GROUP = {STORE: 'STORE', ROOM_GROUP: 'ROOM_GROUP'} as const;

/** 요청 읽기에 넘기는 조건 키 안내 — 항목 정의(ROOM_GROUP_DETAIL_FILTERS · STORE_DETAIL_FILTERS)로 만든다(항목이 늘면 지시문에도 저절로) */
const CHAT_DETAIL_KEY_GUIDE = [
    ...Object.entries(ROOM_GROUP_DETAIL_FILTERS).map(([key, filter]) => `  - ${key}: ${filter.name}(객실)`),
    ...Object.entries(STORE_DETAIL_FILTERS).map(([key, filter]) => `  - ${key}: ${filter.name}(업체 편의시설)`),
].join('\n');

/** 요청 읽기 지시문 — 종류 · 지역(웹 검색으로 실제 위경도) · 조건 키 · 검색 문장을 정해진 JSON 으로 */
export const CHAT_UNDERSTAND_SYSTEM = `너는 한국 숙소 예약 서비스 '바로방'의 숙소 찾기 도우미다. 이용자의 마지막 말과 앞선 대화를 읽고, 정해진 JSON 형식으로만 답한다.
- kind: STORE_SEARCH(숙소를 찾아 추천해야 한다) · TRAVEL_TALK(여행지 · 지역 추천, 되묻기, 여행 이야기 — 아직 숙소를 찾을 단계가 아니다) · OFF_TOPIC(여행지 · 숙소 찾기와 전혀 무관한 말 — 애매하면 OFF_TOPIC 이 아니다)
- areas: 숙소를 찾을 지역(최대 3곳) — 이름, 그곳의 실제 위도 · 경도(필요하면 웹 검색으로 확인), 반경 radius_km(1 ~ 50). 한국 안만. 지역을 알 수 없으면 빈 배열
- area_match: 여러 곳 모두에서 가까워야 하면(예: 여행지 두 곳 사이에서 묵기) ALL, 여러 후보 중 아무 곳이나 되면(예: 온천이 있는 도시들) ANY
- detail_keys: 이용자가 원하는 조건을 아래 키에서만 고른다(없으면 빈 배열)
${CHAT_DETAIL_KEY_GUIDE}
- search_text: 숙소 검색에 쓸 짧은 문장(분위기 · 목적 · 주변 관광지 — 예: "가족 여행, 조용히 쉬기, 업무, 제주 동쪽 바다"). 숙소를 찾지 않으면 빈 문자열
- 앞선 대화에서 정한 지역 · 조건은 이용자가 바꾸지 않는 한 이어서 쓴다`;

/** 요청 읽기 응답 형식(JSON Schema) */
export const CHAT_UNDERSTAND_SCHEMA = {
    type: 'object',
    properties: {
        kind: {type: 'string', enum: Object.values(CHAT_UNDERSTAND_KIND)},
        areas: {
            type: 'array',
            items: {
                type: 'object',
                properties: {name: {type: 'string'}, latitude: {type: 'number'}, longitude: {type: 'number'}, radius_km: {type: 'number'}},
                required: ['name', 'latitude', 'longitude', 'radius_km'],
            },
        },
        area_match: {type: 'string', enum: Object.values(CHAT_AREA_MATCH)},
        detail_keys: {type: 'array', items: {type: 'string'}},
        search_text: {type: 'string'},
    },
    required: ['kind', 'areas', 'area_match', 'detail_keys', 'search_text'],
};

/** 답 쓰기 지시문 — 추천 업체(카드)만 숙소로 말한다 */
export const CHAT_ANSWER_SYSTEM = `너는 한국 숙소 예약 서비스 '바로방'의 숙소 찾기 도우미다. 한국어 존댓말로, 600자 안에서 답한다. 마크다운 표 · 제목은 쓰지 않는다.
- [추천 업체] 가 있으면 그 업체만 숙소로 말한다. 목록에 없는 숙소 · 업체 이름을 지어내지 않는다. 목록 순서대로 업체마다 이용자 요청에 왜 맞는지 한두 문장(편의시설 · 위치 · 객실)으로 말한다.
- [종류] 가 STORE_SEARCH 인데 [추천 업체] 가 비어 있으면, 조건에 맞는 숙소가 아직 없다고 말하고 지역 · 조건을 넓혀 보자고 제안한다.
- [종류] 가 TRAVEL_TALK 이면(지역 추천 등) 한 번에 3곳까지, 지역마다 특징을 한두 문장으로 소개하고 마음에 드는 곳을 물어본다. 이용자가 마음에 들지 않는다고 하면 앞서 말한 곳과 다른 곳을 추천한다.
- [종류] 가 OFF_TOPIC 이면 한두 문장으로 정중하게 여행지 · 숙소 찾기 이야기로 돌린다.`;

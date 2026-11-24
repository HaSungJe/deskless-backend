import {INestApplication, ServiceUnavailableException} from '@nestjs/common';
import request from 'supertest';
import {CHAT_ANSWER_SYSTEM, CHAT_UNDERSTAND_SCHEMA, CHAT_UNDERSTAND_SYSTEM} from '../chat.constants.js';
import {bootHttpPath, ChatMocks, createChatMocks, internalHeaders, NOW, parseSse, RESETS_AT, textStream, TODAY, turnFixture, USER_ACTOR} from './chat.test-helper.js';

const PATH = '/internal/v1/user-service/chat/message';

/** 7일(ms) — 이력 · 질문 수 키 만료 */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** 숙소 찾기 요청 읽기 결과 — 지역 1곳 · 객실(PC) · 업체(반려동물) · 모르는 키 · 검색 문장 */
const STORE_SEARCH = {
    kind: 'STORE_SEARCH',
    areas: [{name: '제주 성산', latitude: 33.46, longitude: 126.93, radius_km: 10}],
    area_match: 'ANY',
    detail_keys: ['has_pc', 'is_pet_allowed', 'unknown_key', 'has_pc'],
    search_text: '가족 여행 업무',
};

/** 추천 업체 행 — 편의시설 반려동물 · 주차 */
const STORE_ROW = {
    store_id: 'store-1',
    store_name: '바로방 성산점',
    address: '제주 서귀포시 성산읍 일출로 260',
    latitude: 33.461,
    longitude: 126.93,
    store_detail: {is_pet_allowed: 1, has_parking: 1},
    cover_file_key: 'sample/store-21-1.png',
    cover_file_storage: 'LOCAL',
};

/** 그 업체의 객실 그룹 — 2룸 · PC */
const ROOM_GROUP = {store_id: 'store-1', room_group_detail: {room_count: 2, has_shower: 1, has_tv: 1, has_pc: 1}};

/** 기대 카드 — 업체 편의시설(정의 순서) 다음 객실 항목(정의 순서) */
const CARD = {
    store_id: 'store-1',
    store_name: '바로방 성산점',
    address: '제주 서귀포시 성산읍 일출로 260',
    latitude: 33.461,
    longitude: 126.93,
    image_url: 'https://cdn.test/sample/store-21-1.png',
    facilities: [
        {key: 'is_pet_allowed', name: '반려동물 동반', group: 'STORE'},
        {key: 'has_parking', name: '주차', group: 'STORE'},
        {key: 'room_count', name: '방 2개 이상', group: 'ROOM_GROUP'},
        {key: 'has_shower', name: '샤워실', group: 'ROOM_GROUP'},
        {key: 'has_tv', name: 'TV', group: 'ROOM_GROUP'},
        {key: 'has_pc', name: 'PC', group: 'ROOM_GROUP'},
    ],
};

describe('POST /internal/v1/user-service/chat/message — 메시지 보내기 (내부 HTTP 스트리밍)', () => {
    let app: INestApplication;
    let mocks: ChatMocks;

    beforeEach(async () => {
        vi.useFakeTimers({toFake: ['Date']});
        vi.setSystemTime(NOW);
        mocks = createChatMocks();
        app = await bootHttpPath(mocks);
    });

    afterEach(async () => {
        vi.useRealTimers();
        vi.clearAllMocks();
        await app.close();
    });

    describe('[SUCCESS]', () => {
        it('숙소 질문 — progress → stores(카드) → delta … → done, 이력 한 건 저장(물은 날짜) · 잠금은 같은 ID 로 풀린다', async () => {
            mocks.store.getTurns.mockResolvedValueOnce([turnFixture({question: '이전 질문', answer: '이전 답'})]);
            mocks.store.getUsage.mockResolvedValueOnce({date: TODAY, count: 2, is_answering: false});
            mocks.store.appendTurn.mockResolvedValueOnce(3);
            mocks.ai.generateJson.mockResolvedValueOnce(STORE_SEARCH);
            mocks.repo.findRecommendStoreRows.mockResolvedValueOnce([STORE_ROW]);
            mocks.repo.findCardRoomGroups.mockResolvedValueOnce([ROOM_GROUP]);

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: '제주 성산에서 반려동물이랑 묵고 PC 도 필요해요'});

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            const events = parseSse(res.text);
            expect(events.map((item) => item.event)).toEqual(['progress', 'progress', 'stores', 'progress', 'delta', 'delta', 'done']);
            expect(events.slice(0, 4).map((item) => item.data)).toEqual([{phase: 'SEARCHING_WEB'}, {phase: 'SEARCHING_STORES'}, {list: [CARD]}, {phase: 'ANSWERING'}]);
            expect(events[4].data).toEqual({text: '안녕'});
            expect(events[5].data).toEqual({text: '하세요'});
            expect(events[6].data).toEqual({
                message: {role: 'AI', content: '안녕하세요', stores: [CARD], created_at: NOW.toISOString()},
                quota: {daily_limit: 5, used_count: 3, remaining_count: 2, resets_at: RESETS_AT, is_answering: 0},
            });

            // ① 잠금 · ② 횟수
            expect(mocks.store.acquireBusy).toHaveBeenCalledTimes(1);
            const [lock_user, lock_id, ttl] = mocks.store.acquireBusy.mock.calls[0];
            expect(lock_user).toBe(USER_ACTOR.user_id);
            expect(lock_id).toMatch(/^[0-9a-f]{32}$/);
            expect(ttl).toBe(180000);
            // ③ 요청 읽기 — 이력 한 건이 이용자 · AI 두 줄, 웹 검색
            expect(mocks.store.getTurns).toHaveBeenCalledWith(USER_ACTOR.user_id, new Date('2026-11-18T03:00:00.000Z'), 10);
            expect(mocks.ai.generateJson).toHaveBeenCalledTimes(1);
            expect(mocks.ai.generateJson).toHaveBeenCalledWith({
                system: CHAT_UNDERSTAND_SYSTEM,
                history: [
                    {role: 'user', text: '이전 질문'},
                    {role: 'model', text: '이전 답'},
                ],
                content: '제주 성산에서 반려동물이랑 묵고 PC 도 필요해요',
                schema: CHAT_UNDERSTAND_SCHEMA,
                use_search: true,
                signal: expect.any(AbortSignal),
            });
            // ④ 업체 찾기 — 검색 문장 벡터 · 정의에 있는 키만(중복 한 번) · 이력에서 추천한 업체 제외
            expect(mocks.ai.embed).toHaveBeenCalledWith({texts: ['가족 여행 업무'], task: 'QUERY', signal: expect.any(AbortSignal)});
            expect(mocks.repo.findRecommendStoreRows).toHaveBeenCalledWith(
                {
                    areas: [{latitude: 33.46, longitude: 126.93, radius_m: 10000}],
                    area_match: 'ANY',
                    detail_conditions: [{key: 'has_pc', operator: 'EQ', value: 1, default_value: 1}],
                    store_conditions: [{key: 'is_pet_allowed', operator: 'EQ', value: 1, default_value: 0}],
                    excluded_store_ids: ['old-store'],
                    query_vector: '[0.1,0.2,0.3]',
                },
                3,
            );
            expect(mocks.repo.findCardRoomGroups).toHaveBeenCalledWith(['store-1']);
            // ⑤ 답 쓰기 — 숙소 찾기는 웹 검색 없이 카드로
            expect(mocks.ai.streamText).toHaveBeenCalledTimes(1);
            const [answerInput] = mocks.ai.streamText.mock.calls[0];
            expect(answerInput.system).toBe(CHAT_ANSWER_SYSTEM);
            expect(answerInput.use_search).toBe(false);
            expect(answerInput.content).toContain('[종류] STORE_SEARCH');
            expect(answerInput.content).toContain('1. 바로방 성산점 — 제주 서귀포시 성산읍 일출로 260 / 반려동물 동반 · 주차 · 방 2개 이상 · 샤워실 · TV · PC');
            // ⑥ 저장 — 물은 날짜 · 7일 만료, 잠금 풀기
            expect(mocks.store.appendTurn).toHaveBeenCalledTimes(1);
            expect(mocks.store.appendTurn).toHaveBeenCalledWith(
                USER_ACTOR.user_id,
                {
                    turn_id: expect.stringMatching(/^[0-9a-f]{32}$/),
                    user_id: USER_ACTOR.user_id,
                    question: '제주 성산에서 반려동물이랑 묵고 PC 도 필요해요',
                    answer: '안녕하세요',
                    stores: [CARD],
                    asked_at: NOW.toISOString(),
                    answered_at: NOW.toISOString(),
                },
                TODAY,
                KEEP_MS,
            );
            expect(mocks.store.releaseBusy).toHaveBeenCalledTimes(1);
            expect(mocks.store.releaseBusy).toHaveBeenCalledWith(USER_ACTOR.user_id, lock_id);
        });

        it('여행과 무관한 말 — 업체를 찾지 않고 카드 없이 돌리는 답, 역시 한 건 저장(1회)', async () => {
            mocks.ai.generateJson.mockResolvedValueOnce({kind: 'OFF_TOPIC', areas: [], area_match: 'ANY', detail_keys: [], search_text: ''});

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: '오늘 야구 롯데 졌어'});

            const events = parseSse(res.text);
            expect(events.map((item) => item.event)).toEqual(['progress', 'progress', 'delta', 'delta', 'done']);
            expect(events[1].data).toEqual({phase: 'ANSWERING'});
            expect(mocks.ai.embed).not.toHaveBeenCalled();
            expect(mocks.repo.findRecommendStoreRows).not.toHaveBeenCalled();
            expect(mocks.ai.streamText.mock.calls[0][0].use_search).toBe(false);
            expect(mocks.ai.streamText.mock.calls[0][0].content).toContain('[종류] OFF_TOPIC');
            expect(mocks.store.appendTurn).toHaveBeenCalledTimes(1);
            expect(mocks.store.appendTurn.mock.calls[0][1].stores).toEqual([]);
            expect(mocks.store.releaseBusy).toHaveBeenCalledTimes(1);
        });
    });

    describe('[FAIL:limit] 시작 전 실패 — 일반 HTTP 응답, AI · 업체 검색 없음', () => {
        it('오늘 5회를 다 썼다 → 429 · 초기화 시각, 잠금은 풀린다', async () => {
            mocks.store.getUsage.mockResolvedValueOnce({date: TODAY, count: 5, is_answering: false});

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: '숙소 찾아줘'});

            expect(res.status).toBe(429);
            expect(res.body).toEqual({message: '오늘 질문을 모두 사용했습니다. 자정(한국 시각)에 다시 채워집니다.', validation_errors: null, resets_at: RESETS_AT});
            expect(mocks.ai.generateJson).not.toHaveBeenCalled();
            expect(mocks.store.appendTurn).not.toHaveBeenCalled();
            expect(mocks.store.releaseBusy).toHaveBeenCalledTimes(1);
            expect(mocks.store.releaseBusy).toHaveBeenCalledWith(USER_ACTOR.user_id, mocks.store.acquireBusy.mock.calls[0][1]);
        });

        it('다른 질문에 답하는 중 → 409, 횟수를 읽지 않고 남의 잠금을 풀지 않는다', async () => {
            mocks.store.acquireBusy.mockResolvedValueOnce(false);

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: '숙소 찾아줘'});

            expect(res.status).toBe(409);
            expect(res.body).toEqual({message: '이전 질문에 답하는 중입니다. 답이 끝난 뒤 다시 보내주세요.', validation_errors: null});
            expect(mocks.store.getUsage).not.toHaveBeenCalled();
            expect(mocks.ai.generateJson).not.toHaveBeenCalled();
            expect(mocks.store.releaseBusy).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:validation]', () => {
        it('빈 질문 · 100자 초과 → 400 content, 잠금 · AI 없음', async () => {
            const empty = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: ''});
            const long = await request(app.getHttpServer())
                .post(PATH)
                .set(internalHeaders(USER_ACTOR))
                .send({content: '가'.repeat(101)});

            expect(empty.status).toBe(400);
            expect(empty.body).toEqual({message: '질문을 입력해주세요.', validation_errors: [{property: 'content', message: '질문을 입력해주세요.'}]});
            expect(long.status).toBe(400);
            expect(long.body).toEqual({message: '질문은 100자 이내로 입력해주세요.', validation_errors: [{property: 'content', message: '질문은 100자 이내로 입력해주세요.'}]});
            expect(mocks.store.acquireBusy).not.toHaveBeenCalled();
            expect(mocks.ai.generateJson).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:ai] 시작 뒤 실패', () => {
        it('답을 쓰는 중 AI 가 실패한다 → failed 503 이벤트, 저장 · 횟수 없음, 잠금은 풀린다', async () => {
            mocks.ai.streamText.mockImplementationOnce(() => textStream(['안녕'], new ServiceUnavailableException({message: 'AI 답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.'})));

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: '휴양지 추천해줘'});

            expect(res.status).toBe(200);
            const events = parseSse(res.text);
            expect(events.map((item) => item.event)).toEqual(['progress', 'progress', 'delta', 'failed']);
            expect(events[3].data).toEqual({status_code: 503, message: 'AI 답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.', validation_errors: null});
            expect(mocks.store.appendTurn).not.toHaveBeenCalled();
            expect(mocks.store.releaseBusy).toHaveBeenCalledTimes(1);
        });

        it('답 글이 하나도 오지 않는다(공백만) → failed 503 이벤트, 빈 답을 저장 · 세지 않고, 잠금은 같은 ID 로 풀린다', async () => {
            mocks.ai.streamText.mockImplementationOnce(() => textStream([' ']));

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders(USER_ACTOR)).send({content: '휴양지 추천해줘'});

            expect(res.status).toBe(200);
            const events = parseSse(res.text);
            expect(events.map((item) => item.event)).toEqual(['progress', 'progress', 'delta', 'failed']);
            expect(events[3].data).toEqual({status_code: 503, message: 'AI 답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.', validation_errors: null});
            expect(mocks.store.appendTurn).not.toHaveBeenCalled();
            expect(mocks.store.releaseBusy).toHaveBeenCalledTimes(1);
            expect(mocks.store.releaseBusy).toHaveBeenCalledWith(USER_ACTOR.user_id, mocks.store.acquireBusy.mock.calls[0][1]);
        });
    });
});

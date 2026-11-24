import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {bootHttpPath, ChatMocks, createChatMocks, internalHeaders, NOW, RESETS_AT, TODAY, turnFixture, USER_ACTOR} from './chat.test-helper.js';

const PATH = '/internal/v1/user-service/chat';

describe('GET /internal/v1/user-service/chat — 대화 보기 (동기 경로)', () => {
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

    it('[SUCCESS] 7일 안 이력(최대 50건)을 한 건씩 USER · AI 두 메시지로 펼치고, 오늘 질문 수 한 줄로 남은 질문 수를 붙인다', async () => {
        const card = {store_id: 'store-1', store_name: '바로방 성산점', address: '제주', latitude: 33.46, longitude: 126.93, image_url: null, facilities: []};
        mocks.store.getTurns.mockResolvedValueOnce([turnFixture({stores: [card]})]);
        mocks.store.getUsage.mockResolvedValueOnce({date: TODAY, count: 2, is_answering: false});

        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(USER_ACTOR));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            messages: [
                {role: 'USER', content: '제주 여행 숙소 찾아줘', stores: [], created_at: '2026-11-25T01:00:00.000Z'},
                {role: 'AI', content: '바로방 성산점을 추천드려요.', stores: [card], created_at: '2026-11-25T01:00:20.000Z'},
            ],
            quota: {daily_limit: 5, used_count: 2, remaining_count: 3, resets_at: RESETS_AT, is_answering: 0},
        });
        expect(mocks.store.getTurns).toHaveBeenCalledTimes(1);
        expect(mocks.store.getTurns).toHaveBeenCalledWith(USER_ACTOR.user_id, new Date('2026-11-18T03:00:00.000Z'), 50);
        expect(mocks.store.getUsage).toHaveBeenCalledWith(USER_ACTOR.user_id);
        expect(mocks.ai.generateJson).not.toHaveBeenCalled();
    });
});

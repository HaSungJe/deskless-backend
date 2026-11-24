import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {bootHttpPath, ChatMocks, createChatMocks, internalHeaders, NOW, RESETS_AT, TODAY, USER_ACTOR} from './chat.test-helper.js';

const PATH = '/internal/v1/user-service/chat/quota';

describe('GET /internal/v1/user-service/chat/quota — 남은 질문 수 (동기 경로)', () => {
    let app: INestApplication;
    let mocks: ChatMocks;
    const timezone = process.env.TZ;

    beforeAll(() => {
        // 서버가 UTC 로 돌아도 한국 날짜로 나눈다
        process.env.TZ = 'UTC';
    });

    afterAll(() => {
        process.env.TZ = timezone;
    });

    beforeEach(async () => {
        vi.useFakeTimers({toFake: ['Date']});
        vi.setSystemTime(NOW);
        mocks = createChatMocks();
        app = await bootHttpPath(mocks);
    });

    afterEach(async () => {
        vi.useRealTimers();
        vi.clearAllMocks();
        delete process.env.CHAT_DAILY_LIMIT;
        await app.close();
    });

    it('[SUCCESS] 하루 한도는 .env CHAT_DAILY_LIMIT · 답하는 중이면 is_answering 1 — 질문 수 한 줄만 읽는다(이력 · AI 없음)', async () => {
        process.env.CHAT_DAILY_LIMIT = '7';
        mocks.store.getUsage.mockResolvedValueOnce({date: TODAY, count: 3, is_answering: true});

        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(USER_ACTOR));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({daily_limit: 7, used_count: 3, remaining_count: 4, resets_at: RESETS_AT, is_answering: 1});
        expect(mocks.store.getUsage).toHaveBeenCalledTimes(1);
        expect(mocks.store.getUsage).toHaveBeenCalledWith(USER_ACTOR.user_id);
        expect(mocks.store.getTurns).not.toHaveBeenCalled();
        expect(mocks.ai.generateJson).not.toHaveBeenCalled();
    });

    it('[SUCCESS] 질문 수 한 줄이 없으면(대화한 적 없음) 0회 — 남은 5회', async () => {
        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(USER_ACTOR));

        expect(res.body).toEqual({daily_limit: 5, used_count: 0, remaining_count: 5, resets_at: RESETS_AT, is_answering: 0});
    });

    describe('[CASES] 계산 규칙 — 오늘 남은 질문 수(한국 날짜 · 서버 UTC)', () => {
        const CASES = [
            {
                title: '오늘 날짜로 두 번이 저장돼 있다 → 남은 3회, 초기화는 다음 날 00:00(한국)',
                now: NOW,
                usage: {date: '2026-11-25', count: 2},
                used: 2,
                remaining: 3,
                resets_at: '2026-11-25T15:00:00.000Z',
            },
            {title: '오늘 날짜로 다섯 번이 저장돼 있다 → 남은 0회', now: NOW, usage: {date: '2026-11-25', count: 5}, used: 5, remaining: 0, resets_at: '2026-11-25T15:00:00.000Z'},
            {
                title: '한국 시각 밤 11시 59분(UTC 14:59)에 묻는다 → 그날 날짜로 세고, 초기화는 1분 뒤',
                now: new Date('2026-11-25T14:59:00.000Z'),
                usage: {date: '2026-11-25', count: 1},
                used: 1,
                remaining: 4,
                resets_at: '2026-11-25T15:00:00.000Z',
            },
            {
                title: '어제 날짜로 다섯 번이 저장돼 있는데 한국 자정(UTC 전날 15:00)이 지났다 → 0회로 보고 다시 5회',
                now: new Date('2026-11-25T15:00:00.000Z'),
                usage: {date: '2026-11-25', count: 5},
                used: 0,
                remaining: 5,
                resets_at: '2026-11-26T15:00:00.000Z',
            },
        ];

        it.each(CASES)('$title', async ({now, usage, used, remaining, resets_at}) => {
            vi.setSystemTime(now);
            mocks.store.getUsage.mockResolvedValueOnce({...usage, is_answering: false});

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(USER_ACTOR));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({daily_limit: 5, used_count: used, remaining_count: remaining, resets_at, is_answering: 0});
        });
    });
});

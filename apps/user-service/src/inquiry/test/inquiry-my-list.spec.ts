import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {ANSWERED_AT, bootHttpPath, CREATED_AT, createInquiryRepositoryMock, INQUIRY_ID, InquiryRepositoryMock, internalHeaders, myInquiryRow, USER_ACTOR} from './inquiry.test-helper.js';

const PATH = '/internal/v1/user-service/inquiry';

describe('GET /internal/v1/user-service/inquiry — 내 문의 목록 (동기 경로)', () => {
    let app: INestApplication;
    let repo: InquiryRepositoryMock;

    beforeEach(async () => {
        repo = createInquiryRepositoryMock();
        app = await bootHttpPath(repo);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await app.close();
    });

    it('[SUCCESS] 카테고리 · 상태를 고르면 개수 · 목록이 같은 필터(내 문의 + 카테고리 + 상태)로 — 페이지 · 시각 ISO, 바로방 문의는 업체 null', async () => {
        repo.countMyInquiryRows.mockResolvedValueOnce(2);
        repo.findMyInquiryRows.mockResolvedValueOnce([
            myInquiryRow({inquiry_state_id: 'ANSWERED', inquiry_state_name: '답변완료', answered_at: ANSWERED_AT}),
            myInquiryRow({inquiry_id: 'f'.repeat(32), store_id: null, store_name: null, inquiry_state_id: 'ANSWERED', inquiry_state_name: '답변완료', answered_at: ANSWERED_AT}),
        ]);

        const res = await request(app.getHttpServer()).get(PATH).query({inquiry_category_id: 'RESERVATION', inquiry_state_id: 'ANSWERED', page: '1', size: '10'}).set(internalHeaders(USER_ACTOR));

        expect(res.status).toBe(200);
        const filter = {user_id: USER_ACTOR.user_id, inquiry_id: null, inquiry_category_id: 'RESERVATION', inquiry_state_id: 'ANSWERED'};
        expect(repo.countMyInquiryRows).toHaveBeenCalledTimes(1);
        expect(repo.countMyInquiryRows).toHaveBeenCalledWith(filter);
        expect(repo.findMyInquiryRows).toHaveBeenCalledTimes(1);
        expect(repo.findMyInquiryRows).toHaveBeenCalledWith(filter, 10, 0);
        expect(res.body.list).toEqual([
            {
                inquiry_id: INQUIRY_ID,
                store_id: 'b'.repeat(32),
                store_name: '바로방 강남점',
                inquiry_category_id: 'RESERVATION',
                inquiry_category_name: '예약',
                title: '예약 시간 변경 문의',
                inquiry_state_id: 'ANSWERED',
                inquiry_state_name: '답변완료',
                answered_at: ANSWERED_AT.toISOString(),
                created_at: CREATED_AT.toISOString(),
            },
            expect.objectContaining({inquiry_id: 'f'.repeat(32), store_id: null, store_name: null}),
        ]);
        expect(res.body.pagination).toMatchObject({total_count: 2});

        // 아무것도 고르지 않으면(전체) 카테고리 · 상태 칸은 null
        await request(app.getHttpServer()).get(PATH).set(internalHeaders(USER_ACTOR));
        expect(repo.countMyInquiryRows).toHaveBeenLastCalledWith({user_id: USER_ACTOR.user_id, inquiry_id: null, inquiry_category_id: null, inquiry_state_id: null});
    });

    it('[FAIL:validation] 카테고리 · 상태가 허용값 밖이면 400 — 개수 · 목록을 읽지 않는다', async () => {
        const category = await request(app.getHttpServer()).get(PATH).query({inquiry_category_id: 'SPAM'}).set(internalHeaders(USER_ACTOR));
        const state = await request(app.getHttpServer()).get(PATH).query({inquiry_state_id: 'DONE'}).set(internalHeaders(USER_ACTOR));

        expect(category.status).toBe(400);
        expect(category.body.validation_errors).toEqual([{property: 'inquiry_category_id', message: '카테고리가 올바르지 않습니다.'}]);
        expect(state.status).toBe(400);
        expect(state.body.validation_errors).toEqual([{property: 'inquiry_state_id', message: '상태가 올바르지 않습니다.'}]);
        expect(repo.countMyInquiryRows).not.toHaveBeenCalled();
        expect(repo.findMyInquiryRows).not.toHaveBeenCalled();
    });
});

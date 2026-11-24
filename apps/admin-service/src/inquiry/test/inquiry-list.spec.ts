import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {
    ADMIN_ACTOR,
    bootHttpPath,
    CREATED_AT,
    createInquiryRepositoryMock,
    INQUIRY_ID,
    InquiryRepositoryMock,
    inquiryRow,
    internalHeaders,
    MANAGER_ACTOR,
    STORE_ID,
    USER_ID,
} from './inquiry.test-helper.js';

describe('GET /internal/v1/admin-service/inquiry/mine · /inquiry — 문의 목록 (동기 경로, 업체 관리자 · 관리자)', () => {
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

    it('[SUCCESS] 업체 관리자 — 소속 업체로 범위를 정하고 카테고리 · 상태 · 검색어가 개수 · 목록에 같은 필터로 실린다', async () => {
        repo.countInquiryRows.mockResolvedValueOnce(1);
        repo.findInquiryRows.mockResolvedValueOnce([inquiryRow()]);

        const res = await request(app.getHttpServer())
            .get('/internal/v1/admin-service/inquiry/mine')
            .query({inquiry_category_id: 'RESERVATION', inquiry_state_id: 'RECEIVED', keyword: '변경', page: '1', size: '10'})
            .set(internalHeaders(MANAGER_ACTOR));

        expect(res.status).toBe(200);
        expect(repo.findManagerStore).toHaveBeenCalledWith(MANAGER_ACTOR.user_id);
        const filter = {store_id: STORE_ID, inquiry_id: null, inquiry_category_id: 'RESERVATION', inquiry_state_id: 'RECEIVED', keyword: '변경'};
        expect(repo.countInquiryRows).toHaveBeenCalledTimes(1);
        expect(repo.countInquiryRows).toHaveBeenCalledWith(filter);
        expect(repo.findInquiryRows).toHaveBeenCalledWith(filter, 10, 0);
        expect(res.body.list).toEqual([
            {
                inquiry_id: INQUIRY_ID,
                user_id: USER_ID,
                user_nickname: '바로손님',
                inquiry_category_id: 'RESERVATION',
                inquiry_category_name: '예약',
                title: '예약 시간 변경 문의',
                inquiry_state_id: 'RECEIVED',
                inquiry_state_name: '접수',
                answered_at: null,
                created_at: CREATED_AT.toISOString(),
            },
        ]);
        expect(res.body.pagination).toMatchObject({total_count: 1});
    });

    it('[SUCCESS] 관리자 — 소속 업체를 찾지 않고 범위는 바로방(store_id null), 고르지 않은 카테고리 · 상태 · 검색어는 null(전체)', async () => {
        const res = await request(app.getHttpServer()).get('/internal/v1/admin-service/inquiry').set(internalHeaders(ADMIN_ACTOR));

        expect(res.status).toBe(200);
        expect(repo.findManagerStore).not.toHaveBeenCalled();
        const filter = {store_id: null, inquiry_id: null, inquiry_category_id: null, inquiry_state_id: null, keyword: null};
        expect(repo.countInquiryRows).toHaveBeenCalledWith(filter);
        expect(repo.findInquiryRows).toHaveBeenCalledWith(filter, 20, 0);
        expect(res.body.list).toEqual([]);
    });

    it('[FAIL:service] 업체 관리자의 업체가 탈퇴 · 삭제됐으면 404 소속 업체를 찾을 수 없습니다. — 목록을 읽지 않는다', async () => {
        repo.findManagerStore.mockResolvedValueOnce(null);

        const res = await request(app.getHttpServer()).get('/internal/v1/admin-service/inquiry/mine').set(internalHeaders(MANAGER_ACTOR));

        expect(res.status).toBe(404);
        expect(res.body).toEqual({message: '소속 업체를 찾을 수 없습니다.', validation_errors: null});
        expect(repo.countInquiryRows).not.toHaveBeenCalled();
        expect(repo.findInquiryRows).not.toHaveBeenCalled();
    });
});

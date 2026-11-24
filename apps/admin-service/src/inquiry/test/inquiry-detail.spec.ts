import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {ADMIN_ACTOR, bootHttpPath, createInquiryRepositoryMock, INQUIRY_ID, InquiryRepositoryMock, internalHeaders, MANAGER_ACTOR, STORE_ID} from './inquiry.test-helper.js';

describe('GET /internal/v1/admin-service/inquiry/mine/:inquiry_id · /inquiry/:inquiry_id — 문의 상세 (동기 경로, 업체 관리자 · 관리자)', () => {
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

    it('[FAIL:service] 범위 밖 문의는 404 — 업체 관리자는 소속 업체 범위, 관리자는 바로방 범위(store_id null)로 찾는다', async () => {
        const mine = await request(app.getHttpServer()).get(`/internal/v1/admin-service/inquiry/mine/${INQUIRY_ID}`).set(internalHeaders(MANAGER_ACTOR));
        const all = await request(app.getHttpServer()).get(`/internal/v1/admin-service/inquiry/${INQUIRY_ID}`).set(internalHeaders(ADMIN_ACTOR));

        expect(mine.status).toBe(404);
        expect(mine.body).toEqual({message: '문의를 찾을 수 없습니다.', validation_errors: null});
        expect(all.status).toBe(404);
        expect(all.body).toEqual({message: '문의를 찾을 수 없습니다.', validation_errors: null});
        expect(repo.findManagerStore).toHaveBeenCalledTimes(1);
        expect(repo.findInquiryDetailRow).toHaveBeenCalledTimes(2);
        expect(repo.findInquiryDetailRow).toHaveBeenNthCalledWith(1, {store_id: STORE_ID, inquiry_id: INQUIRY_ID, inquiry_category_id: null, inquiry_state_id: null, keyword: null});
        expect(repo.findInquiryDetailRow).toHaveBeenNthCalledWith(2, {store_id: null, inquiry_id: INQUIRY_ID, inquiry_category_id: null, inquiry_state_id: null, keyword: null});
    });
});

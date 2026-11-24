import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {bootHttpPath, createInquiryRepositoryMock, INQUIRY_ID, InquiryRepositoryMock, internalHeaders, USER_ACTOR} from './inquiry.test-helper.js';

describe('GET /internal/v1/user-service/inquiry/:inquiry_id — 내 문의 상세 (동기 경로)', () => {
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

    it('[FAIL:service] 남의 문의 ID 를 열면(작성자 조건으로 찾지 못함) 404 문의를 찾을 수 없습니다. — 내용을 돌려주지 않는다', async () => {
        repo.findMyInquiryDetailRow.mockResolvedValueOnce(null);

        const res = await request(app.getHttpServer()).get(`/internal/v1/user-service/inquiry/${INQUIRY_ID}`).set(internalHeaders(USER_ACTOR));

        expect(res.status).toBe(404);
        expect(res.body).toEqual({message: '문의를 찾을 수 없습니다.', validation_errors: null});
        expect(repo.findMyInquiryDetailRow).toHaveBeenCalledTimes(1);
        expect(repo.findMyInquiryDetailRow).toHaveBeenCalledWith({user_id: USER_ACTOR.user_id, inquiry_id: INQUIRY_ID, inquiry_category_id: null, inquiry_state_id: null});
    });
});

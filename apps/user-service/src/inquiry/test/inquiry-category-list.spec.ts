import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {bootHttpPath, createInquiryRepositoryMock, InquiryRepositoryMock, internalHeaders} from './inquiry.test-helper.js';

const PATH = '/internal/v1/user-service/inquiry/category';

describe('GET /internal/v1/user-service/inquiry/category — 문의 카테고리 목록 (동기 경로, 로그인 없음)', () => {
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

    it('[SUCCESS] repository 가 돌려준 순서(정렬 순서) 그대로 ID · 이름만 — 정렬 순서 칸은 내려가지 않는다, actor 없이도 된다', async () => {
        repo.findInquiryCategories.mockResolvedValueOnce([
            {inquiry_category_id: 'RESERVATION', inquiry_category_name: '예약', sort_order: 1},
            {inquiry_category_id: 'PAYMENT', inquiry_category_name: '결제/환불', sort_order: 2},
            {inquiry_category_id: 'ETC', inquiry_category_name: '기타', sort_order: 7},
        ]);

        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            list: [
                {inquiry_category_id: 'RESERVATION', inquiry_category_name: '예약'},
                {inquiry_category_id: 'PAYMENT', inquiry_category_name: '결제/환불'},
                {inquiry_category_id: 'ETC', inquiry_category_name: '기타'},
            ],
        });
        expect(repo.findInquiryCategories).toHaveBeenCalledTimes(1);
        expect(repo.findMyInquiryRows).not.toHaveBeenCalled();
        expect(repo.findMyInquiryDetailRow).not.toHaveBeenCalled();
    });
});

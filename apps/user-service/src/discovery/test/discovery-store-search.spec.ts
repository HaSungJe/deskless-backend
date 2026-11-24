import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {bootHttpPath, createDiscoveryRepositoryMock, createStorageGatewayMock, DiscoveryRepositoryMock, internalHeaders, STORE_ID, STORE_ID_2, StorageGatewayMock} from './discovery.test-helper.js';

const PATH = '/internal/v1/user-service/discovery/store-search';

describe('GET /internal/v1/user-service/discovery/store-search — 업체 이름 검색 (동기 경로, 로그인 없음)', () => {
    let app: INestApplication;
    let repo: DiscoveryRepositoryMock;
    let storage: StorageGatewayMock;

    beforeEach(async () => {
        repo = createDiscoveryRepositoryMock();
        storage = createStorageGatewayMock();
        app = await bootHttpPath(repo, storage);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await app.close();
    });

    it('[SUCCESS] 검색어 · 최대 20건으로 찾고, 주소 · 위경도(숫자) · 대표 사진(있으면 그 행의 저장소로 공개 주소, 없으면 null)을 붙인다', async () => {
        repo.findStoreSearchRows.mockResolvedValueOnce([
            {
                store_id: STORE_ID,
                store_name: '루미 강남점',
                address: '서울 강남구 테헤란로 1',
                latitude: '37.4979',
                longitude: '127.0276',
                cover_file_key: `store/${STORE_ID}/cover.jpg`,
                cover_file_storage: 'S3',
            },
            {store_id: STORE_ID_2, store_name: '루미 강남역점', address: '서울 강남구 강남대로 2', latitude: 37.4981, longitude: 127.028, cover_file_key: null, cover_file_storage: null},
        ]);

        const res = await request(app.getHttpServer()).get(PATH).query({keyword: '강남'}).set(internalHeaders());

        expect(res.status).toBe(200);
        expect(repo.findStoreSearchRows).toHaveBeenCalledTimes(1);
        expect(repo.findStoreSearchRows).toHaveBeenCalledWith('강남', 20);
        expect(storage.getPublicUrl).toHaveBeenCalledTimes(1);
        expect(storage.getPublicUrl).toHaveBeenCalledWith({file_key: `store/${STORE_ID}/cover.jpg`, file_storage: 'S3'});
        expect(res.body).toEqual({
            list: [
                {store_id: STORE_ID, store_name: '루미 강남점', address: '서울 강남구 테헤란로 1', latitude: 37.4979, longitude: 127.0276, image_url: `https://cdn.test/store/${STORE_ID}/cover.jpg`},
                {store_id: STORE_ID_2, store_name: '루미 강남역점', address: '서울 강남구 강남대로 2', latitude: 37.4981, longitude: 127.028, image_url: null},
            ],
        });
    });

    it('[FAIL:validation] 검색어가 비었거나 50자를 넘으면 400 — 검색하지 않는다', async () => {
        const empty = await request(app.getHttpServer()).get(PATH).set(internalHeaders());
        const tooLong = await request(app.getHttpServer())
            .get(PATH)
            .query({keyword: '가'.repeat(51)})
            .set(internalHeaders());

        expect(empty.status).toBe(400);
        expect(empty.body.validation_errors).toEqual([{property: 'keyword', message: '검색어를 입력해주세요.'}]);
        expect(tooLong.status).toBe(400);
        expect(tooLong.body.validation_errors).toEqual([{property: 'keyword', message: '검색어는 50자 이내로 입력해주세요.'}]);
        expect(repo.findStoreSearchRows).not.toHaveBeenCalled();
    });
});

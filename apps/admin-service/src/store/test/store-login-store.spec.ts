import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {bootHttpPath, createStorageGatewayMock, createStoreRepositoryMock, internalHeaders, STORE_CODE, STORE_ID, StorageGatewayMock, StoreRepositoryMock, storeRow} from './store.test-helper.js';

const PATH = `/internal/v1/admin-service/store/login-store/${STORE_CODE}`;

describe('GET /internal/v1/admin-service/store/login-store/:store_code — 매니저 로그인용 업체 조회 (로그인 없음, 동기 경로)', () => {
    let app: INestApplication;
    let repo: StoreRepositoryMock;
    let storage: StorageGatewayMock;

    beforeEach(async () => {
        repo = createStoreRepositoryMock();
        storage = createStorageGatewayMock();
        app = await bootHttpPath(repo, storage);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await app.close();
    });

    describe('[SUCCESS]', () => {
        it('업체코드로 찾아 활성 업체면 업체 ID · 업체코드 · 업체명만 돌려준다(로그인 없음)', async () => {
            repo.findStore.mockResolvedValueOnce(storeRow());

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

            expect(res.status).toBe(200);
            expect(repo.findStore).toHaveBeenCalledTimes(1);
            expect(repo.findStore).toHaveBeenCalledWith({store_code: STORE_CODE});
            expect(res.body).toEqual({store_id: STORE_ID, store_code: STORE_CODE, store_name: '룸리스 강남점'});
            expect(repo.findStoreFileRows).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:service]', () => {
        it('업체코드 모양이 틀려도 입력 오류 400 이 아니라 그대로 조회해 없는 업체 404', async () => {
            repo.findStore.mockResolvedValueOnce(null);

            const res = await request(app.getHttpServer()).get('/internal/v1/admin-service/store/login-store/5a3e-not-hex').set(internalHeaders());

            expect(res.status).toBe(404);
            expect(res.body).toEqual({message: '업체를 찾을 수 없습니다.', validation_errors: null});
            expect(repo.findStore).toHaveBeenCalledTimes(1);
            expect(repo.findStore).toHaveBeenCalledWith({store_code: '5a3e-not-hex'});
        });

        it('업체가 없으면(지워진 업체 포함) 404', async () => {
            repo.findStore.mockResolvedValueOnce(null);

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

            expect(res.status).toBe(404);
            expect(res.body).toEqual({message: '업체를 찾을 수 없습니다.', validation_errors: null});
            expect(repo.findStore).toHaveBeenCalledWith({store_code: STORE_CODE});
        });

        it('탈퇴한 업체는 없는 업체와 같은 404 — 업체 정보를 내주지 않는다', async () => {
            repo.findStore.mockResolvedValueOnce(storeRow({store_state_id: 'LEAVE'}));

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

            expect(res.status).toBe(404);
            expect(res.body).toEqual({message: '업체를 찾을 수 없습니다.', validation_errors: null});
            expect(res.body).not.toHaveProperty('store_id');
        });

        it('영업중지된 업체는 400 + 정지 사유, 업체 정보를 내주지 않는다', async () => {
            repo.findStore.mockResolvedValueOnce(storeRow({store_state_id: 'SUSPEND', suspend_comment: '민원 확인 중'}));

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

            expect(res.status).toBe(400);
            expect(res.body).toEqual({message: '영업이 중지된 업체입니다.', validation_errors: null, suspend_comment: '민원 확인 중'});
            expect(res.body).not.toHaveProperty('store_id');
        });
    });
});

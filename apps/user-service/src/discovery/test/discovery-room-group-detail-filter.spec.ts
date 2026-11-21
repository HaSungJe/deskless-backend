import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {ROOM_GROUP_DETAIL_DEFAULTS} from '@app/database/entities/room/room-group.entity.js';
import {bootHttpPath, createDiscoveryRepositoryMock, createStorageGatewayMock, DiscoveryRepositoryMock, internalHeaders} from './discovery.test-helper.js';

const PATH = '/internal/v1/user-service/discovery/room-group-detail-filter';

describe('GET /internal/v1/user-service/discovery/room-group-detail-filter — 추가정보 필터 항목 (동기 경로, 로그인 없음)', () => {
    let app: INestApplication;
    let repo: DiscoveryRepositoryMock;

    beforeEach(async () => {
        repo = createDiscoveryRepositoryMock();
        app = await bootHttpPath(repo, createStorageGatewayMock());
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await app.close();
    });

    it('[SUCCESS] 객실 그룹 상세 항목마다 체크박스 1개 — 정의 순서, 빠진 항목 없음, DB 조회 없음', async () => {
        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            list: [
                {key: 'room_count', name: '방 2개 이상'},
                {key: 'has_shower', name: '샤워실'},
                {key: 'has_tv', name: 'TV'},
                {key: 'has_pc', name: 'PC'},
            ],
        });
        expect(res.body.list.map((item: {key: string}) => item.key).sort()).toEqual(Object.keys(ROOM_GROUP_DETAIL_DEFAULTS).sort());
        for (const method of Object.values(repo)) {
            expect(method).not.toHaveBeenCalled();
        }
    });
});

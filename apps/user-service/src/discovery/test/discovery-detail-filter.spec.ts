import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {ROOM_GROUP_DETAIL_DEFAULTS} from '@app/database/entities/room/room-group.entity.js';
import {STORE_DETAIL_DEFAULTS} from '@app/database/entities/store/store.entity.js';
import {bootHttpPath, createDiscoveryRepositoryMock, createStorageGatewayMock, DiscoveryRepositoryMock, internalHeaders} from './discovery.test-helper.js';

const PATH = '/internal/v1/user-service/discovery/detail-filter';

describe('GET /internal/v1/user-service/discovery/detail-filter — 추가정보 필터 항목 (동기 경로, 로그인 없음)', () => {
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

    it('[SUCCESS] 객실 항목 4개(ROOM_GROUP) 다음 업체 편의시설 7개(STORE) — 정의 순서, 빠진 항목 없음, DB 조회 없음', async () => {
        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders());

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            list: [
                {key: 'room_count', name: '방 2개 이상', group: 'ROOM_GROUP'},
                {key: 'has_shower', name: '샤워실', group: 'ROOM_GROUP'},
                {key: 'has_tv', name: 'TV', group: 'ROOM_GROUP'},
                {key: 'has_pc', name: 'PC', group: 'ROOM_GROUP'},
                {key: 'has_convenience_store', name: '편의점', group: 'STORE'},
                {key: 'has_cafe', name: '카페', group: 'STORE'},
                {key: 'has_hot_spring', name: '온천', group: 'STORE'},
                {key: 'is_pet_allowed', name: '반려동물 동반', group: 'STORE'},
                {key: 'has_meal', name: '식사 제공', group: 'STORE'},
                {key: 'is_delivery_allowed', name: '배달 음식', group: 'STORE'},
                {key: 'has_parking', name: '주차', group: 'STORE'},
            ],
        });
        const keys = res.body.list.map((item: {key: string}) => item.key);
        expect(keys.slice(0, 4).sort()).toEqual(Object.keys(ROOM_GROUP_DETAIL_DEFAULTS).sort());
        expect(keys.slice(4).sort()).toEqual(Object.keys(STORE_DETAIL_DEFAULTS).sort());
        expect(new Set(keys).size).toBe(keys.length);
        for (const method of Object.values(repo)) {
            expect(method).not.toHaveBeenCalled();
        }
    });
});

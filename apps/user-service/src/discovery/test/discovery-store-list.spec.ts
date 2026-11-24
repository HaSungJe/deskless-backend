import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {DiscoveryStoreListDto} from '@app/contracts/discovery/dto/discovery-store-list.dto.js';
import {
    bootHttpPath,
    createDiscoveryRepositoryMock,
    createStorageGatewayMock,
    DiscoveryRepositoryMock,
    internalHeaders,
    STORE_ID,
    STORE_ID_2,
    StorageGatewayMock,
    storeRow,
    validateBody,
} from './discovery.test-helper.js';

const PATH = '/internal/v1/user-service/discovery/store';

/** 서울시청 */
const SEOUL = {latitude: '37.5665', longitude: '126.978'};

/** 지구 반지름(km) — 테스트 대조용(구현과 같은 값) */
const R = 6371;

/**
 * 대원 거리(km) — 테스트 대조용
 *
 * @param lat1 위도 1
 * @param lng1 경도 1
 * @param lat2 위도 2
 * @param lng2 경도 2
 * @returns 거리(km)
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const rad = (degrees: number) => (degrees * Math.PI) / 180;
    const x = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/**
 * 중심에서 방위로 거리만큼 간 점 — 테스트 대조용
 *
 * @param lat 위도
 * @param lng 경도
 * @param distance_km 거리(km)
 * @param bearing_deg 방위(도, 북쪽 0)
 * @returns [위도, 경도]
 */
function destination(lat: number, lng: number, distance_km: number, bearing_deg: number): [number, number] {
    const rad = (degrees: number) => (degrees * Math.PI) / 180;
    const deg = (radians: number) => (radians * 180) / Math.PI;
    const angle = distance_km / R;
    const lat2 = Math.asin(Math.sin(rad(lat)) * Math.cos(angle) + Math.cos(rad(lat)) * Math.sin(angle) * Math.cos(rad(bearing_deg)));
    const lng2 = rad(lng) + Math.atan2(Math.sin(rad(bearing_deg)) * Math.sin(angle) * Math.cos(rad(lat)), Math.cos(angle) - Math.sin(rad(lat)) * Math.sin(lat2));
    return [deg(lat2), deg(lng2)];
}

/** 위경도 사각형 */
type Box = {min_latitude: number; max_latitude: number; min_longitude: number; max_longitude: number};

/**
 * [CASES:radius-box] — 중심 + 반경 → 인덱스로 먼저 거를 위경도 사각형(사용자 확정 2026-11-06). 기대값은 소수 6자리.
 * [이름, query, 사각형]
 */
const RADIUS_BOX_CASES: [string, Record<string, string>, Box][] = [
    ['1. 서울 5km', {...SEOUL, radius_km: '5'}, {min_latitude: 37.521534, max_latitude: 37.611466, min_longitude: 126.921271, max_longitude: 127.034729}],
    ['2. 서울 50km', {...SEOUL, radius_km: '50'}, {min_latitude: 37.116839, max_latitude: 38.016161, min_longitude: 126.410706, max_longitude: 127.545294}],
    ['3. 제주 20km', {latitude: '33.4996', longitude: '126.5312', radius_km: '20'}, {min_latitude: 33.319736, max_latitude: 33.679464, min_longitude: 126.315507, max_longitude: 126.746893}],
    ['4. 적도 10km — 위 · 경도 폭이 같다', {latitude: '0', longitude: '0', radius_km: '10'}, {min_latitude: -0.089932, max_latitude: 0.089932, min_longitude: -0.089932, max_longitude: 0.089932}],
];

describe('GET /internal/v1/user-service/discovery/store — 반경 업체 조회 (동기 경로, 로그인 없음)', () => {
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

    /**
     * 조회 1번 → findStoreRows 에 넘긴 조건
     *
     * @param query 쿼리
     * @returns 필터 · 개수
     */
    async function requestFilter(query: Record<string, string>): Promise<[Record<string, number>, number]> {
        const res = await request(app.getHttpServer()).get(PATH).query(query).set(internalHeaders());
        expect(res.status).toBe(200);
        return repo.findStoreRows.mock.calls[0] as [Record<string, number>, number];
    }

    describe('[CASES:radius-box] 중심 + 반경 → 위경도 사각형', () => {
        it.each(RADIUS_BOX_CASES)('%s', async (_label, query, box) => {
            const [filter] = await requestFilter(query);

            expect(filter.latitude).toBe(Number(query.latitude));
            expect(filter.longitude).toBe(Number(query.longitude));
            expect(filter.radius_m).toBe(Number(query.radius_km) * 1000);
            for (const key of Object.keys(box) as (keyof Box)[]) {
                expect(filter[key]).toBeCloseTo(box[key], 6);
            }
        });

        it('5. 서울 50km — 원을 모두 덮는다: 꼭짓점까지 거리 ≥ 반경, 원 위의 점(10° 마다)이 모두 사각형 안', async () => {
            const [filter] = await requestFilter({...SEOUL, radius_km: '50'});

            const corners: [number, number][] = [
                [filter.min_latitude, filter.min_longitude],
                [filter.min_latitude, filter.max_longitude],
                [filter.max_latitude, filter.min_longitude],
                [filter.max_latitude, filter.max_longitude],
            ];
            for (const [lat, lng] of corners) {
                expect(haversineKm(37.5665, 126.978, lat, lng)).toBeGreaterThanOrEqual(50);
            }
            for (let bearing = 0; bearing < 360; bearing += 10) {
                const [lat, lng] = destination(37.5665, 126.978, 50, bearing);
                expect(lat).toBeGreaterThanOrEqual(filter.min_latitude - 1e-9);
                expect(lat).toBeLessThanOrEqual(filter.max_latitude + 1e-9);
                expect(lng).toBeGreaterThanOrEqual(filter.min_longitude - 1e-9);
                expect(lng).toBeLessThanOrEqual(filter.max_longitude + 1e-9);
            }
        });
    });

    describe('[SUCCESS]', () => {
        it('대표 사진 키는 CDN 공개 주소로, 없으면 null — 잘림 판단용으로 301개를 묻는다', async () => {
            repo.findStoreRows.mockResolvedValueOnce([
                storeRow(),
                storeRow({store_id: STORE_ID_2, store_name: '루미 역삼점', distance_m: 2500, cover_file_key: null, cover_file_storage: null, min_hourly_price: null}),
            ]);

            const res = await request(app.getHttpServer())
                .get(PATH)
                .query({...SEOUL, radius_km: '5'})
                .set(internalHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                list: [
                    {
                        store_id: STORE_ID,
                        store_name: '루미 강남점',
                        address: '서울 강남구 테헤란로 1',
                        latitude: 37.4979,
                        longitude: 127.0276,
                        distance_m: 1234,
                        image_url: `https://cdn.test/store/${STORE_ID}/cover.jpg`,
                        is_open: 1,
                        is_always_open: 0,
                        min_hourly_price: 30000,
                        min_night_price: 70000,
                    },
                    {
                        store_id: STORE_ID_2,
                        store_name: '루미 역삼점',
                        address: '서울 강남구 테헤란로 1',
                        latitude: 37.4979,
                        longitude: 127.0276,
                        distance_m: 2500,
                        image_url: null,
                        is_open: 1,
                        is_always_open: 0,
                        min_hourly_price: null,
                        min_night_price: 70000,
                    },
                ],
                is_truncated: 0,
            });
            expect(storage.getPublicUrl).toHaveBeenCalledTimes(1);
            expect(storage.getPublicUrl).toHaveBeenCalledWith({file_key: `store/${STORE_ID}/cover.jpg`, file_storage: 'LOCAL'});
            expect(repo.findStoreRows).toHaveBeenCalledTimes(1);
            expect(repo.findStoreRows.mock.calls[0][1]).toBe(301);
        });

        it('301행이면 앞 300개만 · is_truncated 1', async () => {
            repo.findStoreRows.mockResolvedValueOnce(
                Array.from({length: 301}, (_, index) => storeRow({store_id: index.toString(16).padStart(32, '0'), cover_file_key: null, cover_file_storage: null})),
            );

            const res = await request(app.getHttpServer())
                .get(PATH)
                .query({...SEOUL, radius_km: '50'})
                .set(internalHeaders());

            expect(res.body.list).toHaveLength(300);
            expect(res.body.list[299].store_id).toBe((299).toString(16).padStart(32, '0'));
            expect(res.body.is_truncated).toBe(1);
        });
    });

    describe('거리 제한 없음 · 추가정보 필터', () => {
        it('[SUCCESS] radius_km=ALL — 반경 · 사각형 없이(null) 가까운 순 301개를 묻는다, 추가정보 없음', async () => {
            await requestFilter({...SEOUL, radius_km: 'ALL'});

            expect(repo.findStoreRows).toHaveBeenCalledTimes(1);
            expect(repo.findStoreRows).toHaveBeenCalledWith(
                {latitude: 37.5665, longitude: 126.978, radius_m: null, min_latitude: null, max_latitude: null, min_longitude: null, max_longitude: null, detail_conditions: [], store_conditions: []},
                301,
            );
        });

        it('[SUCCESS] 반경을 주면 사각형 · 반경 그대로, 추가정보가 없으면 detail_conditions []', async () => {
            await requestFilter({...SEOUL, radius_km: '5'});

            const [filter] = repo.findStoreRows.mock.calls[0];
            expect(filter.radius_m).toBe(5000);
            expect(filter.min_latitude).toBeCloseTo(37.521534, 6);
            expect(filter.detail_conditions).toEqual([]);
            expect(filter.store_conditions).toEqual([]);
        });

        it('[SUCCESS] detail_filter — 객실 항목 · 업체 편의시설 항목이 섞여 와도 묶음별 조건으로 나뉜다(정의의 조건 · 비교 값 + 빠진 항목 기본값, 중복은 한 번 · 순서 유지)', async () => {
            await requestFilter({...SEOUL, radius_km: '10', detail_filter: 'has_pc,has_hot_spring,room_count,has_pc,is_pet_allowed'});

            expect(repo.findStoreRows).toHaveBeenCalledTimes(1);
            const [filter] = repo.findStoreRows.mock.calls[0];
            expect(filter.detail_conditions).toEqual([
                {key: 'has_pc', operator: 'EQ', value: 1, default_value: 1},
                {key: 'room_count', operator: 'GTE', value: 2, default_value: 1},
            ]);
            expect(filter.store_conditions).toEqual([
                {key: 'has_hot_spring', operator: 'EQ', value: 1, default_value: 0},
                {key: 'is_pet_allowed', operator: 'EQ', value: 1, default_value: 0},
            ]);
            expect(filter.radius_m).toBe(10000);
        });

        it('[FAIL:validation] 정의에 없는 항목(has_wifi) → 400 validation_errors.detail_filter, 조회 없음', async () => {
            const res = await request(app.getHttpServer())
                .get(PATH)
                .query({...SEOUL, radius_km: '5', detail_filter: 'has_pc,has_wifi'})
                .set(internalHeaders());

            expect(res.status).toBe(400);
            expect(res.body).toEqual({message: '추가정보 필터가 올바르지 않습니다.', validation_errors: [{property: 'detail_filter', message: '추가정보 필터가 올바르지 않습니다.'}]});
            expect(repo.findStoreRows).not.toHaveBeenCalled();
        });
    });

    describe('[SKIP]', () => {
        it('반경 안에 업체가 없으면 빈 목록 · 잘림 0', async () => {
            const res = await request(app.getHttpServer())
                .get(PATH)
                .query({...SEOUL, radius_km: '5'})
                .set(internalHeaders());

            expect(res.body).toEqual({list: [], is_truncated: 0});
            expect(storage.getPublicUrl).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:validation] 게이트웨이 ValidationPipe', () => {
        it.each([
            ['위도 91', {...SEOUL, latitude: '91', radius_km: '5'}, 'latitude', '위도가 올바르지 않습니다.'],
            ['반경 7km', {...SEOUL, radius_km: '7'}, 'radius_km', '반경은 5 · 10 · 20 · 50km · 제한 없음(ALL) 중에서 골라주세요.'],
            ['반경 all(소문자)', {...SEOUL, radius_km: 'all'}, 'radius_km', '반경은 5 · 10 · 20 · 50km · 제한 없음(ALL) 중에서 골라주세요.'],
            ['추가정보 필터 모양(쉼표 · 소문자 · _ 밖)', {...SEOUL, radius_km: '5', detail_filter: 'has_pc;drop'}, 'detail_filter', '추가정보 필터가 올바르지 않습니다.'],
            ['경도 없음', {latitude: '37.5665', radius_km: '5'}, 'longitude', '경도를 입력해주세요.'],
        ])('%s → %s', async (_label, query, property, message) => {
            await expect(validateBody(DiscoveryStoreListDto, query)).resolves.toEqual({message, validation_errors: [{property, message}]});
        });

        it('동기 경로에서도 같은 400 — 조회 없음', async () => {
            const res = await request(app.getHttpServer())
                .get(PATH)
                .query({...SEOUL, radius_km: '7'})
                .set(internalHeaders());

            expect(res.status).toBe(400);
            expect(repo.findStoreRows).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:internal]', () => {
        it('게이트웨이 내부 토큰이 없으면 403, 조회 없음', async () => {
            const res = await request(app.getHttpServer())
                .get(PATH)
                .query({...SEOUL, radius_km: '5'});

            expect(res.status).toBe(403);
            expect(repo.findStoreRows).not.toHaveBeenCalled();
        });
    });
});

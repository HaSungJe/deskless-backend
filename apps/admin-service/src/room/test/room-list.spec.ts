import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {ServiceUnavailableException} from '@nestjs/common';
import {
    bootHttpPath,
    createDoorStoreMock,
    createRoomRepositoryMock,
    createStorageGatewayMock,
    DoorStoreMock,
    FIXED_TIME,
    internalHeaders,
    MANAGER_ACTOR,
    ROOM_GROUP_ID,
    ROOM_ID,
    roomRow,
    RoomRepositoryMock,
    STORE_ID,
    storeRow,
} from './room.test-helper.js';

const PATH = '/internal/v1/admin-service/room';

describe('GET /internal/v1/admin-service/room — 호실 목록 (업체 관리자, 동기 경로)', () => {
    let app: INestApplication;
    let repo: RoomRepositoryMock;
    let door: DoorStoreMock;

    beforeEach(async () => {
        repo = createRoomRepositoryMock();
        repo.findManagerStore.mockResolvedValue(storeRow());
        repo.countRooms.mockResolvedValue(1);
        repo.findRoomRows.mockResolvedValue([roomRow()]);
        door = createDoorStoreMock();
        app = await bootHttpPath(repo, createStorageGatewayMock(), door);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await app.close();
    });

    describe('[SUCCESS]', () => {
        it('필터가 없으면 내 업체 호실을 세고 기본 페이지로 층 · 호실명 순 목록(그룹명 · 상태명 · 문을 마지막으로 연 시각 포함)을 돌려준다', async () => {
            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(200);
            expect(repo.findManagerStore).toHaveBeenCalledWith(MANAGER_ACTOR.user_id, false);
            expect(repo.countRooms).toHaveBeenCalledWith({store_id: STORE_ID});
            expect(repo.findRoomRows).toHaveBeenCalledWith({store_id: STORE_ID, floor: null, room_group_id: null}, 20, 0);
            expect(repo.countRooms.mock.invocationCallOrder[0]).toBeLessThan(repo.findRoomRows.mock.invocationCallOrder[0]);
            expect(res.body).toEqual({
                list: [
                    {
                        room_id: ROOM_ID,
                        room_group_id: ROOM_GROUP_ID,
                        room_group_name: '스탠다드',
                        room_name: '101호',
                        floor: 1,
                        room_state_id: 'AVAILABLE',
                        room_state_name: '예약가능',
                        created_at: FIXED_TIME.toISOString(),
                        door_opened_at: null,
                    },
                ],
                pagination: expect.objectContaining({total_count: 1, page: 1}),
                floors: [],
            });
            expect(repo.findRoomFloors).toHaveBeenCalledTimes(1);
            expect(repo.findRoomFloors).toHaveBeenCalledWith(STORE_ID);
        });

        it('내 업체 호실이 있는 층 전부(floors)는 거르기 · 페이지와 상관없이 업체 ID 로만 읽는다', async () => {
            repo.findRoomFloors.mockResolvedValueOnce([-1, 2, 3]);

            const res = await request(app.getHttpServer()).get(`${PATH}?floor=2&room_group_id=${ROOM_GROUP_ID}&page=3`).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(200);
            expect(res.body.floors).toEqual([-1, 2, 3]);
            expect(repo.findRoomFloors).toHaveBeenCalledTimes(1);
            expect(repo.findRoomFloors).toHaveBeenCalledWith(STORE_ID);
        });

        it('층(지하 음수 — 정수 문자열) · 그룹 필터는 숫자 층 · 그룹 ID 로 같은 조건을 세고 목록에 넘긴다', async () => {
            const res = await request(app.getHttpServer()).get(`${PATH}?floor=-1&room_group_id=${ROOM_GROUP_ID}`).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(200);
            expect(repo.countRooms).toHaveBeenCalledWith({store_id: STORE_ID, floor: -1, room_group_id: ROOM_GROUP_ID});
            expect(repo.findRoomRows).toHaveBeenCalledWith({store_id: STORE_ID, floor: -1, room_group_id: ROOM_GROUP_ID}, 20, 0);
        });

        it('문을 마지막으로 연 시각은 그 페이지 호실들을 한 번에(findRoomRows 순서대로) 읽어 같은 순서로 붙인다 — 연 적 없으면 null', async () => {
            const ROOM_ID_2 = '6'.repeat(32);
            repo.findRoomRows.mockResolvedValueOnce([roomRow(), roomRow({room_id: ROOM_ID_2, room_name: '102호'})]);
            door.getOpenedAt.mockResolvedValueOnce(['20261104093012', null]);

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(200);
            expect(door.getOpenedAt).toHaveBeenCalledTimes(1);
            expect(door.getOpenedAt).toHaveBeenCalledWith([ROOM_ID, ROOM_ID_2]);
            expect(res.body.list.map((item: {room_id: string; door_opened_at: string | null}) => [item.room_id, item.door_opened_at])).toEqual([
                [ROOM_ID, '20261104093012'],
                [ROOM_ID_2, null],
            ]);
            expect(res.body.list[0]).not.toHaveProperty('door_state');
        });

        it('빈 페이지면 빈 목록으로 연 시각을 묻는다(Redis 에는 묻지 않는 포트 규칙)', async () => {
            repo.findRoomRows.mockResolvedValueOnce([]);

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(200);
            expect(res.body.list).toEqual([]);
            expect(door.getOpenedAt).toHaveBeenCalledWith([]);
        });
    });

    describe('[FAIL:validation]', () => {
        it.each([
            ['층이 정수가 아님(B1)', 'floor=B1', 'floor', '층을 정수로 입력해주세요.'],
            ['그룹 ID 가 32자 hex 가 아님', 'room_group_id=xyz', 'room_group_id', '객실 그룹 ID가 올바르지 않습니다.'],
        ])('%s → 400 validation_errors.%s, 업체 조회 없음', async (_label, query, property, message) => {
            const res = await request(app.getHttpServer()).get(`${PATH}?${query}`).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(400);
            expect(res.body).toEqual({message, validation_errors: [{property, message}]});
            expect(repo.findManagerStore).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:service]', () => {
        it('소속 업체가 없으면 404, 개수 · 목록 조회 없음', async () => {
            repo.findManagerStore.mockResolvedValueOnce(null);

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(404);
            expect(res.body).toEqual({message: '소속 업체를 찾을 수 없습니다.', validation_errors: null});
            expect(repo.countRooms).not.toHaveBeenCalled();
            expect(repo.findRoomRows).not.toHaveBeenCalled();
        });
    });

    describe('[FAIL:external]', () => {
        it('Redis 에 닿지 못하면 503 — 호실 목록도 실패한다(호실 목록에 합친 결정)', async () => {
            door.getOpenedAt.mockRejectedValueOnce(new ServiceUnavailableException({message: '상태 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'}));

            const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(MANAGER_ACTOR));

            expect(res.status).toBe(503);
            expect(res.body).toEqual({message: '상태 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.', validation_errors: null});
        });
    });

    describe('[SECURITY]', () => {
        it('내부 토큰이 없으면 403, 업체 조회 없음', async () => {
            const res = await request(app.getHttpServer()).get(PATH);

            expect(res.status).toBe(403);
            expect(repo.findManagerStore).not.toHaveBeenCalled();
        });
    });
});

import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {Not} from 'typeorm';
import {bootHttpPath, createReservationRepositoryMock, internalHeaders, listRow, RESERVATION_ID, ReservationRepositoryMock, ROOM_ID, STORE_ID, USER_ACTOR} from './reservation.test-helper.js';

const PATH = '/internal/v1/user-service/reservation';

describe('GET /internal/v1/user-service/reservation — 내 예약 목록 (동기 경로)', () => {
    let app: INestApplication;
    let repo: ReservationRepositoryMock;

    beforeEach(async () => {
        repo = createReservationRepositoryMock();
        app = await bootHttpPath(repo);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await app.close();
    });

    it('[SUCCESS] count(결제 대기 만료 제외) → 페이지 → 목록, 시각은 ISO', async () => {
        repo.countReservations.mockResolvedValueOnce(21);
        repo.findMyReservationRows.mockResolvedValueOnce([listRow()]);

        const res = await request(app.getHttpServer()).get(PATH).query({page: '2', size: '20'}).set(internalHeaders(USER_ACTOR));

        expect(res.status).toBe(200);
        expect(repo.countReservations).toHaveBeenCalledTimes(1);
        expect(repo.countReservations).toHaveBeenCalledWith({user_id: USER_ACTOR.user_id, reservation_state_id: Not('EXPIRED')});
        expect(repo.findMyReservationRows).toHaveBeenCalledTimes(1);
        expect(repo.findMyReservationRows).toHaveBeenCalledWith(USER_ACTOR.user_id, null, 20, 20);
        expect(res.body.list[0]).toEqual({
            reservation_id: RESERVATION_ID,
            store_id: STORE_ID,
            store_name: '루미 강남점',
            room_id: ROOM_ID,
            room_name: '101호',
            room_group_name: '스탠다드',
            room_plan_type_id: 'HOURLY',
            room_plan_type_name: '시간 이용',
            reservation_state_id: 'CONFIRMED',
            reservation_state_name: '예약 확정',
            start_at: '2026-11-10T04:00:00.000Z',
            end_at: '2026-11-10T07:00:00.000Z',
            total_price: 30000,
            refund_deadline_at: '2026-11-10T03:00:00.000Z',
            is_room_disabled: 0,
            created_at: '2026-11-03T00:00:00.000Z',
        });
        expect(res.body.pagination).toMatchObject({total_count: 21});
    });

    it.each([
        ['사용중지 호실 → 1(전액 환불 취소 버튼)', 'DISABLED', 1],
        ['예약가능 → 0', 'AVAILABLE', 0],
        ['사용중 → 0', 'IN_USE', 0],
        ['정비중 → 0', 'MAINTENANCE', 0],
    ])('[SUCCESS] is_room_disabled — %s', async (_label, room_state_id, expected) => {
        repo.countReservations.mockResolvedValueOnce(1);
        repo.findMyReservationRows.mockResolvedValueOnce([listRow({room_state_id})]);

        const res = await request(app.getHttpServer()).get(PATH).set(internalHeaders(USER_ACTOR));

        expect(res.status).toBe(200);
        expect(res.body.list[0].is_room_disabled).toBe(expected);
    });

    describe('상태 거르기', () => {
        it('[SUCCESS] 상태를 주면 개수 · 목록이 같은 상태 조건 — pagination 은 거른 결과 기준', async () => {
            repo.countReservations.mockResolvedValueOnce(3);
            repo.findMyReservationRows.mockResolvedValueOnce([listRow({reservation_state_id: 'CANCELED', reservation_state_name: '취소'})]);

            const res = await request(app.getHttpServer()).get(PATH).query({reservation_state_id: 'CANCELED'}).set(internalHeaders(USER_ACTOR));

            expect(res.status).toBe(200);
            expect(repo.countReservations).toHaveBeenCalledTimes(1);
            expect(repo.countReservations).toHaveBeenCalledWith({user_id: USER_ACTOR.user_id, reservation_state_id: 'CANCELED'});
            expect(repo.findMyReservationRows).toHaveBeenCalledTimes(1);
            expect(repo.findMyReservationRows).toHaveBeenCalledWith(USER_ACTOR.user_id, 'CANCELED', 20, 0);
            expect(res.body.list[0].reservation_state_id).toBe('CANCELED');
            expect(res.body.pagination).toMatchObject({total_count: 3});
        });

        it('[SUCCESS] PENDING — 결제 대기 상태만(만료 EXPIRED 는 다른 상태라 섞이지 않는다)', async () => {
            repo.countReservations.mockResolvedValueOnce(1);
            repo.findMyReservationRows.mockResolvedValueOnce([listRow({reservation_state_id: 'PENDING', reservation_state_name: '결제 대기'})]);

            const res = await request(app.getHttpServer()).get(PATH).query({reservation_state_id: 'PENDING'}).set(internalHeaders(USER_ACTOR));

            expect(res.status).toBe(200);
            expect(repo.countReservations).toHaveBeenCalledWith({user_id: USER_ACTOR.user_id, reservation_state_id: 'PENDING'});
            expect(repo.findMyReservationRows).toHaveBeenCalledWith(USER_ACTOR.user_id, 'PENDING', 20, 0);
        });

        it.each([
            ['결제 대기 만료(EXPIRED) — 고를 수 없는 상태', 'EXPIRED'],
            ['소문자', 'confirmed'],
        ])('[FAIL:validation] %s → 400 validation_errors.reservation_state_id, 조회 없음', async (_label, reservation_state_id) => {
            const res = await request(app.getHttpServer()).get(PATH).query({reservation_state_id}).set(internalHeaders(USER_ACTOR));

            expect(res.status).toBe(400);
            expect(res.body.validation_errors).toContainEqual({property: 'reservation_state_id', message: '예약 상태가 올바르지 않습니다.'});
            expect(repo.countReservations).not.toHaveBeenCalled();
            expect(repo.findMyReservationRows).not.toHaveBeenCalled();
        });
    });
});

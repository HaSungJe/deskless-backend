# Revision — reservation-booking — 261122-1

> Change plan for an existing feature. The original spec.md / plan.md are not modified, only referenced.

## Reason for Change Request
프론트 요청(2026-11-22, U6 내 예약 `/reservation`) — 내 예약 목록에 결제 대기 · 예약 확정 · 이용 중 · 이용 완료 · 취소가 섞여 나와 상태 칩으로 골라 보려 한다. query 가 `page` · `size` 뿐이라 화면에서 거르면 받은 한 쪽 안에서만 걸러지고 전체 개수 · 쪽 번호가 맞지 않는다.

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| query | `page` · `size` | + **`reservation_state_id`**(선택) — `PENDING` · `CONFIRMED` · `CHECKED_IN` · `COMPLETED` · `CANCELED` 중 하나 |
| 거르기 없음 | 내 예약 전체(결제 대기 만료 `EXPIRED` 제외) | 그대로 |
| 거르기 있음 | — | 그 상태의 내 예약만. `EXPIRED` 는 고를 수 없고 늘 빠진다 |
| `pagination` | 전체 기준 | 거른 결과 기준(count 와 목록이 같은 조건) |
| 목록 밖 값(`EXPIRED` · 소문자 · 아무 문자열) | — | 400 `{message: '예약 상태가 올바르지 않습니다.', validation_errors: [{property: 'reservation_state_id', …}]}` — 형제 목록(`StoreListDto` · `UserListDto` · `ManagerAccountListDto`)의 상태 거르기와 같은 모양 |
| 정렬 · 응답 항목 · 로그인 · 그 밖의 실패 | 입실(시작) 일시 최근순, 항목 그대로 | 그대로 |
| 내 예약 상세 | 결제 대기 만료 404 | 그대로(같은 쿼리 빌더를 거르기 없이 쓴다) |

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `libs/contracts/src/reservation/dto/reservation-list.dto.ts` | modify | `ReservationListDto.reservation_state_id` — `@ApiProperty` → `@IsOptional` → `@IsIn`, 생성자 `?? null` |
| `apps/user-service/src/reservation/reservation.service.ts` | modify | `getMyReservations` — 개수 · 목록에 같은 상태 조건 |
| `apps/user-service/src/reservation/interfaces/reservation.repository.interface.ts` | modify | `findMyReservationRows(user_id, reservation_state_id, limit, offset)` |
| `apps/user-service/src/reservation/repositories/reservation.repository.ts` | modify | `findMyReservationRows` 인자 · `buildMyReservationsQuery(user_id, reservation_id, reservation_state_id)` 에 상태 조건(동적) |
| `apps/user-service/src/reservation/test/reservation-list.spec.ts` | modify | 거르기 · 검증 실패 사례, 기존 사례 인자 |
| `apps/user-service/src/reservation/test/reservation.repository.spec.ts` | modify | Smoke — 내 예약 쿼리 상태 조건 사례 + SQL 고정, 내 예약 수 상태 같음 사례 |
| `README.md` | modify | user-service 설명의 "내 예약" → "내 예약(목록 — 상태 거르기)" |
| `.beaver/output/frontend/changes/2026-11-22-reservation-list-state.md` · `changes/README.md` | add · modify | 프론트 수정 요청 반영 문서(요청에 대한 답 — 확인하고 싶은 점 1 · 2 포함) |
| `.beaver/output/report/reservation/reservation-booking-report.md` | modify | `## Change - 261122-1` 덧붙임 |

게이트웨이 controller(`apps/gateway/src/api/v1/user-service/reservation/controllers/reservation.controller.ts:67`) · 서비스 내부 controller(`apps/user-service/src/reservation/controllers/reservation.controller.ts:37`)는 이미 `new ReservationListDto(query)` 를 그대로 넘긴다 — 바꾸지 않는다. 게이트웨이 `toQueryString` 이 `null` 값을 빼므로(`internal-http.client.ts:105`) 거르기가 없으면 내부 요청에도 붙지 않는다.

## Code Changes

```ts
// libs/contracts/src/reservation/dto/reservation-list.dto.ts — before
import {ApiProperty} from '@nestjs/swagger';
import {PaginationDto, PaginationResultDto} from '@app/common/dto/pagination.dto.js';

/**
 * 내 예약 목록 query — 페이지만. 결제 대기 만료 건은 나오지 않는다, 입실 일시 최근순
 */
export class ReservationListDto extends PaginationDto {
    /**
     * @param data 요청 쿼리 — 빠진 페이지 값은 PaginationDto 기본값
     */
    constructor(data?: Partial<ReservationListDto>) {
        super(data);
    }
}
```

```ts
// libs/contracts/src/reservation/dto/reservation-list.dto.ts — after
import {ApiProperty} from '@nestjs/swagger';
import {IsIn, IsOptional} from 'class-validator';
import {PaginationDto, PaginationResultDto} from '@app/common/dto/pagination.dto.js';

/**
 * 내 예약 목록 query — 상태(선택) · 페이지. 결제 대기 만료 건은 나오지 않는다, 입실 일시 최근순
 */
export class ReservationListDto extends PaginationDto {
    @ApiProperty({description: '예약 상태 (PENDING: 결제 대기, CONFIRMED: 예약 확정, CHECKED_IN: 이용 중, COMPLETED: 이용 완료, CANCELED: 취소) — 없으면 전체', required: false})
    @IsOptional()
    @IsIn(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELED'], {message: '예약 상태가 올바르지 않습니다.'})
    reservation_state_id: string | null;

    /**
     * @param data 요청 쿼리 — 빠진 페이지 값은 PaginationDto 기본값, 빠진 거르기는 null
     */
    constructor(data?: Partial<ReservationListDto>) {
        super(data);
        this.reservation_state_id = data?.reservation_state_id ?? null;
    }
}
```

개수와 목록이 **같은 상태 조건**을 써야 `pagination` 이 거른 결과와 맞는다. 거르기가 있으면 그 상태와 같음(`EXPIRED` 는 고를 수 없으니 저절로 빠진다), 없으면 지금처럼 `EXPIRED` 가 아님.

```ts
// apps/user-service/src/reservation/reservation.service.ts — before
    /**
     * 내 예약 목록 — 결제 대기 만료 건 제외, 입실 최근순. (내부 HTTP: GET /internal/v1/user-service/reservation)
     *
     * @param user_id 이용자 ID
     * @param dto 페이지
     * @returns 목록 · 페이지 정보
     */
    async getMyReservations(user_id: string, dto: ReservationListDto): Promise<ReservationListResultDto> {
        const total_count = await this.reservationRepository.countReservations({user_id, reservation_state_id: Not(RESERVATION_STATE.EXPIRED)});
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.reservationRepository.findMyReservationRows(user_id, pagination.limit, pagination.offset);
        return {list: rows.map(toReservationListItem), pagination: pagination.getPagination()};
    }
```

```ts
// apps/user-service/src/reservation/reservation.service.ts — after
    /**
     * 내 예약 목록 — 상태 거르기(선택), 결제 대기 만료 건 제외, 입실 최근순. (내부 HTTP: GET /internal/v1/user-service/reservation)
     *
     * @param user_id 이용자 ID
     * @param dto 상태(선택) · 페이지
     * @returns 목록 · 페이지 정보(거른 결과 기준)
     */
    async getMyReservations(user_id: string, dto: ReservationListDto): Promise<ReservationListResultDto> {
        // ① 개수 — 거르기가 있으면 그 상태, 없으면 결제 대기 만료가 아닌 것
        const total_count = await this.reservationRepository.countReservations({user_id, reservation_state_id: dto.reservation_state_id ?? Not(RESERVATION_STATE.EXPIRED)});
        // ② 페이지 → ③ 같은 조건의 목록
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.reservationRepository.findMyReservationRows(user_id, dto.reservation_state_id, pagination.limit, pagination.offset);
        return {list: rows.map(toReservationListItem), pagination: pagination.getPagination()};
    }
```

```ts
// apps/user-service/src/reservation/interfaces/reservation.repository.interface.ts — before
    findMyReservationRows(user_id: string, limit: number, offset: number): Promise<ReservationListRow[]>;
```

```ts
// apps/user-service/src/reservation/interfaces/reservation.repository.interface.ts — after (주석의 @param 에 상태 한 줄)
    findMyReservationRows(user_id: string, reservation_state_id: string | null, limit: number, offset: number): Promise<ReservationListRow[]>;
```

```ts
// apps/user-service/src/reservation/repositories/reservation.repository.ts — before
    async findMyReservationRows(user_id: string, limit: number, offset: number): Promise<ReservationListRow[]> {
        try {
            return await this.buildMyReservationsQuery(user_id, null).orderBy('r.start_at', 'DESC').limit(limit).offset(offset).getRawMany<ReservationListRow>();
    // …
            return (await this.buildMyReservationsQuery(user_id, reservation_id).getRawOne<ReservationListRow>()) ?? null;
    // …
    buildMyReservationsQuery(user_id: string, reservation_id: string | null): SelectQueryBuilder<ReservationEntity> {
        // … select · join 그대로 …
            .where('r.user_id = :user_id', {user_id})
            .andWhere('r.reservation_state_id <> :expired', {expired: RESERVATION_STATE.EXPIRED});
        if (reservation_id !== null) {
            query.andWhere('r.reservation_id = :reservation_id', {reservation_id});
        }
        return query;
    }
```

```ts
// apps/user-service/src/reservation/repositories/reservation.repository.ts — after
    /**
     * 내 예약 목록 행
     *
     * @param user_id 이용자 ID
     * @param reservation_state_id 예약 상태 — 거르기 없으면 null
     * @param limit 개수
     * @param offset 건너뛸 개수
     * @returns 목록 행
     */
    async findMyReservationRows(user_id: string, reservation_state_id: string | null, limit: number, offset: number): Promise<ReservationListRow[]> {
        try {
            return await this.buildMyReservationsQuery(user_id, null, reservation_state_id).orderBy('r.start_at', 'DESC').limit(limit).offset(offset).getRawMany<ReservationListRow>();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    // findMyReservationRow — 상세는 거르기 없이
            return (await this.buildMyReservationsQuery(user_id, reservation_id, null).getRawOne<ReservationListRow>()) ?? null;

    /**
     * 내 예약 쿼리 — 업체 · 호실(상태 — 사용중지 표시) · 그룹 · 상품 종류 · 상태 조인(지운 업체 · 호실 · 그룹도 기록이라 그대로 보인다), 결제 대기 만료 제외, 예약 하나면 그 예약만, 상태를 주면 그 상태만.
     * 매핑 민감(조인 · raw select — 별칭이 ReservationListRow 키와 같다 · 동적 조립)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param user_id 이용자 ID
     * @param reservation_id 예약 ID — 목록은 null
     * @param reservation_state_id 예약 상태 — 거르기 없으면 null
     * @returns 쿼리 빌더
     */
    buildMyReservationsQuery(user_id: string, reservation_id: string | null, reservation_state_id: string | null): SelectQueryBuilder<ReservationEntity> {
        // … select · join 그대로 …
            .where('r.user_id = :user_id', {user_id})
            .andWhere('r.reservation_state_id <> :expired', {expired: RESERVATION_STATE.EXPIRED});
        if (reservation_id !== null) {
            query.andWhere('r.reservation_id = :reservation_id', {reservation_id});
        }
        if (reservation_state_id !== null) {
            query.andWhere('r.reservation_state_id = :reservation_state_id', {reservation_state_id});
        }
        return query;
    }
```

## 테스트

`reservation-list.spec.ts`(service 기능 spec — 동기 경로, repository mock) · `reservation.repository.spec.ts`(Smoke).

| 분류 | 상황 | 확인 |
|---|---|---|
| `[SUCCESS]` | 거르기 없이 2쪽 (기존 사례) | count `{user_id, reservation_state_id: Not('EXPIRED')}` 1회, 목록 `(user_id, null, 20, 20)` — 인자만 바뀜 |
| `[SUCCESS]` | `reservation_state_id=CANCELED` · 3건 | count `{user_id, reservation_state_id: 'CANCELED'}` 1회, 목록 `(user_id, 'CANCELED', 20, 0)` 1회, `pagination.total_count` 3 |
| `[SUCCESS]` | `reservation_state_id=PENDING` | count · 목록 모두 `'PENDING'` — 만료(`EXPIRED`)는 다른 상태라 섞이지 않는다 |
| `[FAIL:validation]` | `reservation_state_id=EXPIRED` · `confirmed` | 400 `validation_errors[0]` = `{property: 'reservation_state_id', message: '예약 상태가 올바르지 않습니다.'}` 모양, count · 목록 `.not.toHaveBeenCalled()` |
| `[SMOKE:data-access]` | `buildMyReservationsQuery('u1', null, 'CONFIRMED')` | 파라미터 `['u1', 'EXPIRED', 'CONFIRMED']`, `"r"."reservation_state_id" = $3`, SQL 고정(새 상수), 별칭 20개 그대로. 기존 두 사례(목록 · 상세)는 세 번째 인자 `null` 로 SQL 그대로 |
| `[SMOKE:data-access]` | `countReservations({user_id: 'u1', reservation_state_id: 'CONFIRMED'})` | `"ReservationEntity"."reservation_state_id" = $2`(관계 컬럼 같음) |

## Decisions

- [x] **결제 대기 만료 건(요청 확인 1)** — 만료는 상태 `EXPIRED` 로 따로 있고 목록은 거르기와 상관없이 늘 뺀다. `PENDING` 으로 거르면 상태가 `PENDING` 인 것만 나온다. 다만 결제 시간이 막 지난 결제 대기는 scheduler(1분마다, 운영 전용 — `reservation-payment-expire.crontab.ts:44`)가 토스 결제를 조회해 확정 · 만료 · 환불로 정리하기 전까지(최대 약 1분) `PENDING` 으로 보인다 — 늦게 결제가 끝났으면 확정이 되어야 하므로 시각으로 미리 숨기지 않는다(지금의 전체 목록과 같다). 근거: 만료 판정은 토스 조회가 필요하다 — 목록 쿼리가 시각만으로 가르면 늦은 승인 건을 잘못 숨긴다.
- [x] **정렬(요청 확인 2)** — 상태와 상관없이 지금처럼 입실(시작) 일시 최근순(`r.start_at DESC`).
- [x] **허용 값은 DTO 리터럴 배열** — 형제 목록 DTO 와 같다(`store-list.dto.ts:11` · `user-list.dto.ts:16`). `EXPIRED` 는 이용자에게 보이지 않는 상태라 넣지 않는다.
- [x] **조건은 service 에서, 동적 조립은 빌더에서** — 개수는 기존 `countReservations(FindOptionsWhere)` 를 그대로 쓰고(새 repository 메서드 없음), 목록은 기존 빌더에 선택 조건 하나를 더한다(상세와 같은 빌더 — `reservation_id` 조건과 같은 방식, `reservation.repository.ts:589`).

## 반영 순서
백엔드 배포 먼저 — 거르기가 없으면 지금과 같아 현재 화면은 그대로 동작한다. 마이그레이션 없음.

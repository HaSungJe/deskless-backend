# Revision — 객실 그룹 상세 · 호실 목록 값 추가 — 261120-1

> Change plan for an existing feature. The original spec.md / plan.md are not modified, only referenced.
> 원래 문서: `.beaver/output/plan/room/room-manage-plan.md` · `report/room/room-manage-report.md`(객실 그룹 · 호실 관리)

## Reason for Change Request
프론트 요청(2026-11-20 — roomless-frontend Phase 12 상품 · 객실, 시안 `frontend/design/manager.html` M5 객실 그룹 상세 · M4 호실): 시안에 있는 값 3개가 응답에 없어 프론트가 화면마다 API 를 여러 번 불러야 한다. 응답에 넣는다.
1. M5 그룹 상품 표의 "기간 가격" 칸 — 상품마다 기간 가격 개수
2. M5 맨 위 설명 줄 "호실 3개(203호 · 301호 · 302호)" — 그룹의 호실 수 · 호실 목록
3. M4 층 거르기 "전체 · 2층 · 3층 · 4층" — 내 업체 호실이 있는 층 전부(페이지 · 거르기와 상관없이)

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| `GET /api/v1/admin-service/room/group/:room_group_id` `plans[]` | `{room_plan_type_id, room_plan_type_name, is_used, price}` | + **`price_count: number`** — 그 그룹 상품의 지워지지 않은 기간 가격 수(지난 기간 포함). 그룹 상품 조회 쿼리에 COUNT 서브쿼리(그룹 목록 `room_count` 와 같은 방식 — `room.repository.ts:236`) |
| 같은 응답 | 그룹 · 사진 · 상품 | + **`room_count: number`**(지워지지 않은 호실 수 — 그룹 목록의 `room_count` 와 같은 값) + **`rooms: [{room_id, room_name, floor}]`**(지워지지 않은 호실, 층 · 호실명 순 — 호실 목록과 같은 순서) |
| `GET /api/v1/admin-service/room` | `{list, pagination}` | + **`floors: number[]`** — 내 업체의 지워지지 않은 호실이 있는 층 전부, 오름차순(거르기 `floor` · `room_group_id` · 페이지와 상관없이). 따로 API 를 두지 않고 응답에 넣는다(요청의 첫 안 — 화면이 목록과 함께 받는다) |
| 실패 | — | 그대로(404 · 401 · 503 — 호실 목록의 503 은 Redis 연 시각 때문) |

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `libs/contracts/src/room/dto/room-group-detail.dto.ts` | modify | `RoomGroupDetailPlanResultDto.price_count` · `RoomGroupDetailRoomResultDto`(새) · `RoomGroupDetailResultDto.room_count` · `rooms` |
| `libs/contracts/src/room/dto/room-list.dto.ts` | modify | `RoomListResultDto.floors` |
| `apps/admin-service/src/room/interfaces/room.repository.interface.ts` | modify | `RoomGroupPlanRow.price_count` · `findRoomGroupRooms` · `findRoomFloors` |
| `apps/admin-service/src/room/repositories/room.repository.ts` | modify | 그룹 상품 쿼리에 `price_count` 서브쿼리 · `buildRoomGroupRoomsQuery` + `findRoomGroupRooms` · `buildRoomFloorsQuery` + `findRoomFloors` |
| `apps/admin-service/src/room/room.service.ts` · `room.util.ts` | modify | 그룹 상세에 호실 · 상품 기간 가격 수, 호실 목록에 층 |
| `apps/admin-service/src/room/test/room-group-detail.spec.ts` · `room-list.spec.ts` · `room.repository.spec.ts` · `room.test-helper.ts` | modify | 단언 · Data-Access Smoke(그룹 상품 SQL · 그룹 호실 · 층) · mock |
| `.beaver/output/frontend/changes/2026-11-20-room-group-detail-floors.md` · `changes/README.md` | add · modify | 프론트 수정 요청 |
| `README.md` | modify | 업체 관리 줄(그룹 상세 · 호실 목록 값) |

## Code Changes

```ts
// apps/admin-service/src/room/repositories/room.repository.ts — buildRoomGroupPlanRowsQuery after (price_count 한 줄)
            .addSelect('gp.price', 'price')
            .addSelect(
                (sub) => sub.select('CAST(COUNT(*) AS integer)').from(RoomGroupPlanPriceEntity, 'pp').where('"pp"."room_group_plan_id" = "gp"."room_group_plan_id"').andWhere('"pp"."is_deleted" = 0'),
                'price_count',
            )
```

```ts
// apps/admin-service/src/room/repositories/room.repository.ts — 새 조회 2개(빌더는 Data-Access Smoke)
    async findRoomGroupRooms(room_group_id: string): Promise<RoomEntity[]> {
        try {
            return await this.buildRoomGroupRoomsQuery(room_group_id).getMany();
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    buildRoomGroupRoomsQuery(room_group_id: string): SelectQueryBuilder<RoomEntity> {
        return this.rooms.createQueryBuilder('r').setFindOptions({where: notDeleted<RoomEntity>({room_group_id}), order: {floor: 'ASC', room_name: 'ASC'}, loadRelationIds: true});
    }

    async findRoomFloors(store_id: string): Promise<number[]> {
        try {
            const rows = await this.buildRoomFloorsQuery(store_id).getRawMany<{floor: number}>();
            return rows.map((row) => Number(row.floor));
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    buildRoomFloorsQuery(store_id: string): SelectQueryBuilder<RoomEntity> {
        return this.rooms.createQueryBuilder('r').select('r.floor', 'floor').distinct(true).where('r.store_id = :store_id', {store_id}).andWhere('r.is_deleted = 0').orderBy('r.floor', 'ASC');
    }
```

```ts
// apps/admin-service/src/room/room.service.ts — getMyRoomGroup after
        const images = await this.roomRepository.findRoomGroupImages(room_group_id);
        const plans = await this.roomRepository.findRoomGroupPlanRows(room_group_id);
        const rooms = await this.roomRepository.findRoomGroupRooms(room_group_id);
        return toRoomGroupDetail(
            group,
            images.map((image) => toRoomGroupImageItem(image, this.storageGateway.getPublicUrl(image))),
            sortByPlanType(plans).map(toRoomGroupPlanItem),
            rooms.map(toRoomGroupRoomItem),
        );
```

```ts
// apps/admin-service/src/room/room.service.ts — getMyRooms after (끝)
        // 4. 그 페이지 호실들의 마지막으로 연 시각 (MGET — 받은 순서대로)
        const openedAt = await this.doorStore.getOpenedAt(rows.map((row) => row.room_id));

        // 5. 내 업체 호실이 있는 층 전부 — 거르기 · 페이지와 상관없이(층 거르기 선택지)
        const floors = await this.roomRepository.findRoomFloors(store.store_id);
        return {list: rows.map((row, index) => toRoomListItem(row, openedAt[index])), pagination: pagination.getPagination(), floors};
```

```ts
// apps/admin-service/src/room/room.util.ts — 변환
export function toRoomGroupDetail(group, images, plans, rooms: RoomGroupDetailRoomResultDto[]): RoomGroupDetailResultDto {
    return {..., images, plans, room_count: rooms.length, rooms, created_at, updated_at};
}
export function toRoomGroupPlanItem(row: RoomGroupPlanRow): RoomGroupDetailPlanResultDto {
    return {room_plan_type_id, room_plan_type_name, is_used: Number(row.is_used), price: Number(row.price), price_count: Number(row.price_count)};
}
export function toRoomGroupRoomItem(room: RoomEntity): RoomGroupDetailRoomResultDto {
    return {room_id: room.room_id, room_name: room.room_name, floor: Number(room.floor)};
}
```

## Test Cases
- room-group-detail — `[SUCCESS]` 응답에 상품마다 `price_count`(행 값 그대로 숫자) · `room_count` = 호실 수 · `rooms` 순서 그대로 `{room_id, room_name, floor}`, `findRoomGroupRooms(room_group_id)` 1번. 404 면 호실 조회 없음.
- room-list — `[SUCCESS]` 응답 `floors` = `findRoomFloors(store_id)` 결과, 거르기(층 · 그룹)를 줘도 층 조회 인자는 업체 ID 하나(거르기와 상관없음).
- room.repository — Data-Access Smoke: 그룹 상품 SQL 에 `price_count` 서브쿼리(지워지지 않은 기간 가격), 그룹 호실 SQL(관계 필드 where · 지워지지 않음 · 층 · 호실명 순), 층 SQL(DISTINCT · 업체 · 지워지지 않음 · 오름차순) + `findRoomFloors` 가 문자열 층도 숫자로 · 두 조회 통일 500.

## Decisions
- [x] `price_count` 는 지난 기간도 센다 — 요청 "지워지지 않은 것" 그대로(기간 가격 목록 API 도 지난 기간을 보여 준다).
- [x] `room_count` 는 `rooms.length` — 같은 조회에서 세므로 두 값이 어긋나지 않는다. 그룹 목록의 `room_count`(서브쿼리)와 같은 조건(지워지지 않은 호실).
- [x] 층 목록은 호실 목록 응답 `floors` 로 — 따로 API 를 만들지 않는다(요청이 둘 다 허용, 화면이 목록과 함께 받는다).

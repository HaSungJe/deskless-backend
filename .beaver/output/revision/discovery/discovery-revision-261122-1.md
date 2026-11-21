# Revision — discovery — 261122-1

> Change plan for an existing feature. The original spec.md / plan.md are not modified, only referenced.

## Reason for Change Request
사용자 요청(2026-11-22) — 업체 검색(반경 업체)에 ① **거리 제한 상관없음** 을 더하고 ② 객실 그룹 상세(방 개수 · 샤워실 · TV · PC)로 거르는 **추가정보 필터** 를 더한다. 프론트는 팝업의 체크박스로 고르고, **객실 그룹 상세에 항목이 생기면 필터에도 저절로 더해져야 한다.**

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| `radius_km` | 필수 `5` · `10` · `20` · `50` | + **`ALL`**(거리 제한 없음) — 사각형 · 반경 조건 없이 활성 업체 전체에서 중심과 가까운 순, 최대 300개(넘으면 `is_truncated` 1 — 지도를 옮기거나 필터를 더해 다시 조회). `distance_m` 은 그대로 |
| 추가정보 필터 | 없음 | query **`detail_filter`**(선택) — 객실 그룹 상세 항목 키를 쉼표로(`has_pc,has_shower`). **고른 조건을 모두 갖춘 객실 그룹이 하나라도 있는 업체만** 남는다 |
| 필터가 보는 그룹 | — | 이용자에게 보이는 그룹만 — 업체의 객실 그룹 목록(`/store/:store_id/room-group`)과 같은 기준: 지워지지 않음 · 예약 받을 호실(지워지지 않고 사용중지 아님)이 있음 · 판매 중인 그룹 상품(그룹 상품 사용 · 요금 > 0 · 업체 상품 설정 사용)이 있음 |
| 항목별 조건 | — | 항목마다 체크박스 1개 — 샤워실 · TV · PC 는 "있음"(=1), 방 개수는 "방 2개 이상"(≥2). 저장된 JSON 에 항목이 빠진 그룹은 기본값(`ROOM_GROUP_DETAIL_DEFAULTS`)으로 본다 |
| 필터 항목 목록 | — | **새 API** `GET /api/v1/user-service/discovery/room-group-detail-filter`(동기 · 인증 없음) → `{list: [{key, name}]}` — 프론트 팝업이 이 목록으로 체크박스를 그린다. 항목이 늘면 이 목록 · 검색 조건이 같이 늘어난다 |
| 모르는 항목 · 모양이 틀린 값 | — | 400 `{message: '추가정보 필터가 올바르지 않습니다.', validation_errors: [{property: 'detail_filter', …}]}` — 모양(소문자 · `_` · 쉼표)은 게이트웨이 DTO, 항목 이름은 user-service(정의 목록) |
| `radius_km` 목록 밖 값 | 400 | 그대로(메시지에 `ALL` 추가) |
| 업체 상세 · 객실 그룹 목록 | — | 그대로 |

## 항목이 늘면 필터도 늘어나는 방식
- 필터 정의 하나 `ROOM_GROUP_DETAIL_FILTERS` 를 **객실 그룹 상세 타입 바로 옆**(`room-group.entity.ts`, `RoomGroupDetail` · `ROOM_GROUP_DETAIL_DEFAULTS` 와 같은 파일)에 `Record<keyof RoomGroupDetail, RoomGroupDetailFilter>` 로 둔다 — `RoomGroupDetail` 에 항목을 더하고 정의를 빼먹으면 **typecheck 가 실패**한다.
- 검색 query 는 항목마다 필드를 두지 않고 `detail_filter` 하나(쉼표 목록)라 **DTO 를 고치지 않는다**(`forbidNonWhitelisted` 라 항목마다 필드를 두면 항목을 더할 때마다 DTO 도 고쳐야 한다). 항목 이름 확인 · 조건 · 기본값은 모두 정의 목록에서 나온다.
- 프론트는 항목 목록 API 로 체크박스를 그리므로 새 항목이 화면에도 저절로 나온다.

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `libs/database/src/entities/room/room-group.entity.ts` | modify | `RoomGroupDetailFilter` 인터페이스 · `ROOM_GROUP_DETAIL_FILTERS` 정의(스키마 변화 없음 — 마이그레이션 없음) |
| `libs/contracts/src/discovery/dto/discovery-store-list.dto.ts` | modify | `radius_km` 에 `ALL`, `detail_filter`(선택 — `@Matches` · `@MaxLength`) |
| `libs/contracts/src/discovery/dto/discovery-room-group-detail-filter.dto.ts` | add | 필터 항목 결과 DTO(`key` · `name`) · 목록 |
| `libs/contracts/src/discovery/discovery.commands.ts` | modify | `DISCOVERY_INTERNAL_PATH.ROOM_GROUP_DETAIL_FILTER` |
| `apps/user-service/src/discovery/discovery.constants.ts` | modify | `DISCOVERY_RADIUS_ALL = 'ALL'` · `DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE` |
| `apps/user-service/src/discovery/discovery.util.ts` | modify | `splitDetailFilter` · `isRoomGroupDetailFilterKey` · `toStoreFilter` · `toRoomGroupDetailFilterItems` |
| `apps/user-service/src/discovery/discovery.service.ts` | modify | `getStores`(필터 확인 · 조건) · 새 `getRoomGroupDetailFilters` |
| `apps/user-service/src/discovery/interfaces/discovery.repository.interface.ts` | modify | `DiscoveryStoreFilter` — 반경 · 사각형 nullable, `detail_conditions` · `DiscoveryDetailCondition` |
| `apps/user-service/src/discovery/repositories/discovery.repository.ts` | modify | `buildStoreRowsQuery` — 반경 조건은 있을 때만, 추가정보 EXISTS, 파라미터를 명시(필터 객체 펼치기 대신) · `GROUP_ON_SALE_SQL` |
| `apps/user-service/src/discovery/controllers/discovery.controller.ts` | modify | `GET /room-group-detail-filter` |
| `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts` | modify | `GET /api/v1/user-service/discovery/room-group-detail-filter`(Swagger · 가드 없음) · 업체 검색 Swagger 설명 |
| `apps/admin-service/src/room/room.constants.ts` | modify | `ROOM_GROUP_DETAIL_KEYS` 주석 — 항목을 더할 때 함께 고칠 목록에 `ROOM_GROUP_DETAIL_FILTERS` |
| `apps/user-service/src/discovery/test/discovery-store-list.spec.ts` | modify | 거리 제한 없음 · 추가정보 필터 · 검증 실패, 기존 사례의 필터 모양 |
| `apps/user-service/src/discovery/test/discovery-room-group-detail-filter.spec.ts` | add | 필터 항목 목록 |
| `apps/user-service/src/discovery/test/discovery.repository.spec.ts` | modify | Smoke — 거리 제한 없음 · 추가정보 EXISTS SQL 고정, 기존 SQL 그대로 |
| `AGENTS.md` · `README.md` · `docs/data-layer.md` · `docs/testing.md` | modify | 인증 없는 공개 라우트에 새 경로, jsonb 상세정보 규칙에 "필터 정의도 함께(타입이 강제)", Smoke 적용처, README 둘러보기 설명 |
| `.beaver/output/frontend/changes/2026-11-22-discovery-filter.md` · `changes/README.md` | add · modify | 프론트 수정 요청 — 팝업 체크박스 안내(사용자 요청) |
| `.beaver/output/report/discovery/discovery-report.md` | modify | `## Change - 261122-1` |

## Code Changes

```ts
// libs/database/src/entities/room/room-group.entity.ts — after (ROOM_GROUP_DETAIL_DEFAULTS 아래에 더한다)
/** 객실 그룹 상세 항목 하나의 검색 필터 — 체크박스 1개 */
export interface RoomGroupDetailFilter {
    /** 체크박스 이름 */
    name: string;
    /** 조건 — EQ: 값과 같다(있음 = 1), GTE: 값 이상 */
    operator: 'EQ' | 'GTE';
    /** 비교 값 */
    value: number;
}

/**
 * 객실 그룹 상세 검색 필터 — 항목마다 체크박스 1개(이 순서로 보인다). 업체 검색의 detail_filter · 필터 항목 API 가 이 정의만 쓴다.
 * RoomGroupDetail 의 모든 항목을 키로 가져야 한다(Record — 항목을 더하고 여기를 빼먹으면 타입 검사가 실패한다).
 */
export const ROOM_GROUP_DETAIL_FILTERS: Record<keyof RoomGroupDetail, RoomGroupDetailFilter> = {
    room_count: {name: '방 2개 이상', operator: 'GTE', value: 2},
    has_shower: {name: '샤워실', operator: 'EQ', value: 1},
    has_tv: {name: 'TV', operator: 'EQ', value: 1},
    has_pc: {name: 'PC', operator: 'EQ', value: 1},
};
```

```ts
// libs/contracts/src/discovery/dto/discovery-store-list.dto.ts — before
    @ApiProperty({description: '반경(km) — 5 · 10 · 20 · 50', enum: ['5', '10', '20', '50']})
    @IsIn(['5', '10', '20', '50'], {message: '반경은 5 · 10 · 20 · 50km 중에서 골라주세요.'})
    @IsNotEmpty({message: '반경을 입력해주세요.'})
    radius_km: string;

    constructor(data?: Partial<DiscoveryStoreListDto>) {
        this.latitude = data?.latitude ?? '';
        this.longitude = data?.longitude ?? '';
        this.radius_km = data?.radius_km ?? '';
    }
```

```ts
// libs/contracts/src/discovery/dto/discovery-store-list.dto.ts — after
    @ApiProperty({description: '반경(km) — 5 · 10 · 20 · 50, ALL: 거리 제한 없음(가까운 순 300개)', enum: ['5', '10', '20', '50', 'ALL']})
    @IsIn(['5', '10', '20', '50', 'ALL'], {message: '반경은 5 · 10 · 20 · 50km · 제한 없음(ALL) 중에서 골라주세요.'})
    @IsNotEmpty({message: '반경을 입력해주세요.'})
    radius_km: string;

    @ApiProperty({
        description: '추가정보 필터 — 객실 그룹 상세 항목 키를 쉼표로(항목은 GET /api/v1/user-service/discovery/room-group-detail-filter). 고른 조건을 모두 갖춘 객실 그룹이 있는 업체만',
        required: false,
        example: 'has_pc,has_shower',
    })
    @IsOptional()
    @Matches(/^[a-z_]+(,[a-z_]+)*$/, {message: '추가정보 필터가 올바르지 않습니다.'})
    @MaxLength(200, {message: '추가정보 필터가 올바르지 않습니다.'})
    detail_filter: string | null;

    /**
     * @param data 요청 쿼리 — 빠진 필수 값은 빈 문자열(검증에서 걸린다), 빠진 필터는 null
     */
    constructor(data?: Partial<DiscoveryStoreListDto>) {
        this.latitude = data?.latitude ?? '';
        this.longitude = data?.longitude ?? '';
        this.radius_km = data?.radius_km ?? '';
        this.detail_filter = data?.detail_filter ?? null;
    }
```

```ts
// libs/contracts/src/discovery/dto/discovery-room-group-detail-filter.dto.ts — new
import {ApiProperty} from '@nestjs/swagger';

/**
 * 추가정보 필터 항목 — 체크박스 1개
 */
export class DiscoveryRoomGroupDetailFilterItemResultDto {
    @ApiProperty({description: '항목 키 — 업체 검색 detail_filter 에 쉼표로 넣는다 (예: has_pc)'})
    key: string;

    @ApiProperty({description: '체크박스 이름 (예: PC · 방 2개 이상)'})
    name: string;
}

/**
 * 추가정보 필터 항목 목록 — 객실 그룹 상세 항목마다 1개, 보일 순서
 */
export class DiscoveryRoomGroupDetailFilterListResultDto {
    @ApiProperty({description: '필터 항목 (보일 순서)', type: () => [DiscoveryRoomGroupDetailFilterItemResultDto]})
    list: DiscoveryRoomGroupDetailFilterItemResultDto[];
}
```

```ts
// apps/user-service/src/discovery/discovery.util.ts — new functions
/**
 * 추가정보 필터 쉼표 목록 → 항목 키(중복 제거 · 순서 유지)
 *
 * @param detail_filter 쉼표 목록 — 없으면 null
 * @returns 항목 키, 없으면 []
 */
export function splitDetailFilter(detail_filter: string | null): string[] {
    return detail_filter ? [...new Set(detail_filter.split(','))] : [];
}

/**
 * 객실 그룹 상세의 필터 항목인지 — 정의(ROOM_GROUP_DETAIL_FILTERS)에 있는 키만
 *
 * @param key 항목 키
 * @returns 필터 항목이면 true
 */
export function isRoomGroupDetailFilterKey(key: string): key is keyof RoomGroupDetail {
    return Object.hasOwn(ROOM_GROUP_DETAIL_FILTERS, key);
}

/**
 * 반경 업체 조건 — 거리 제한 없음(ALL)이면 반경 · 사각형 null, 추가정보는 항목 정의의 조건 · 비교 값 + 빠진 항목의 기본값
 *
 * @param latitude 중심 위도
 * @param longitude 중심 경도
 * @param radius_km 반경(km 문자열) 또는 ALL
 * @param detail_keys 추가정보 항목 키(정의에 있는 것만)
 * @returns repository 조건
 */
export function toStoreFilter(latitude: number, longitude: number, radius_km: string, detail_keys: (keyof RoomGroupDetail)[]): DiscoveryStoreFilter {
    const detail_conditions = detail_keys.map((key) => ({key, operator: ROOM_GROUP_DETAIL_FILTERS[key].operator, value: ROOM_GROUP_DETAIL_FILTERS[key].value, default_value: ROOM_GROUP_DETAIL_DEFAULTS[key]}));
    if (radius_km === DISCOVERY_RADIUS_ALL) {
        return {latitude, longitude, radius_m: null, min_latitude: null, max_latitude: null, min_longitude: null, max_longitude: null, detail_conditions};
    }
    const km = Number(radius_km);
    return {latitude, longitude, radius_m: km * 1000, ...toRadiusBox(latitude, longitude, km), detail_conditions};
}

/**
 * 추가정보 필터 항목 목록 — 정의 순서
 *
 * @returns 항목(키 · 체크박스 이름)
 */
export function toRoomGroupDetailFilterItems(): DiscoveryRoomGroupDetailFilterItemResultDto[] {
    return Object.entries(ROOM_GROUP_DETAIL_FILTERS).map(([key, filter]) => ({key, name: filter.name}));
}
```

```ts
// apps/user-service/src/discovery/discovery.service.ts — before
    async getStores(dto: DiscoveryStoreListDto): Promise<DiscoveryStoreListResultDto> {
        // 1. 중심 · 반경 → 사각형(인덱스로 먼저 거른다) + 거리 조건, 잘림 판단용으로 1개 더
        const latitude = Number(dto.latitude);
        const longitude = Number(dto.longitude);
        const radius_km = Number(dto.radius_km);
        const rows = await this.discoveryRepository.findStoreRows({latitude, longitude, radius_m: radius_km * 1000, ...toRadiusBox(latitude, longitude, radius_km)}, DISCOVERY_STORE_LIMIT + 1);

        // 2. 대표 사진 공개 주소
        return {
```

```ts
// apps/user-service/src/discovery/discovery.service.ts — after
    /**
     * 반경 업체 조회 — 중심 위경도 + 반경(5 · 10 · 20 · 50km, ALL 은 거리 제한 없음)의 활성 업체를 가까운 순으로 최대 300개(넘으면 is_truncated 1).
     * 추가정보 필터를 주면 고른 조건을 모두 갖춘 이용자에게 보이는 객실 그룹이 있는 업체만. 지도 마커 · 목록 카드 공용.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/store)
     *
     * @param dto 위도 · 경도 · 반경 · 추가정보 필터
     * @returns 업체 목록 · 잘림 여부
     * @throws BadRequestException 추가정보 필터에 모르는 항목이 있을 때
     */
    async getStores(dto: DiscoveryStoreListDto): Promise<DiscoveryStoreListResultDto> {
        // ① 추가정보 필터 — 정의에 있는 항목만
        const detail_keys = splitDetailFilter(dto.detail_filter);
        if (!detail_keys.every(isRoomGroupDetailFilterKey)) {
            throw new BadRequestException({message: DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE, validation_errors: createValidationError('detail_filter', DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE)});
        }

        // ② 중심 · 반경 → 사각형(인덱스로 먼저 거른다) + 거리 조건(제한 없음이면 둘 다 없음) + 추가정보 조건, 잘림 판단용으로 1개 더
        const filter = toStoreFilter(Number(dto.latitude), Number(dto.longitude), dto.radius_km, detail_keys);
        const rows = await this.discoveryRepository.findStoreRows(filter, DISCOVERY_STORE_LIMIT + 1);

        // ③ 대표 사진 공개 주소
        return {
            // … 그대로 …
        };
    }

    /**
     * 추가정보 필터 항목 — 객실 그룹 상세 항목마다 체크박스 1개(정의 순서). 항목이 늘면 저절로 늘어난다.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/room-group-detail-filter)
     *
     * @returns 항목 목록
     */
    getRoomGroupDetailFilters(): DiscoveryRoomGroupDetailFilterListResultDto {
        return {list: toRoomGroupDetailFilterItems()};
    }
```

```ts
// apps/user-service/src/discovery/interfaces/discovery.repository.interface.ts — after
/** 추가정보 조건 하나 — 그룹 상세 JSON 항목(빠지면 기본값)과 비교 */
export interface DiscoveryDetailCondition {
    key: string;
    operator: 'EQ' | 'GTE';
    value: number;
    default_value: number;
}

/** 반경 업체 조건 — 반경 · 사각형은 거리 제한 없음(ALL)이면 null */
export interface DiscoveryStoreFilter {
    latitude: number;
    longitude: number;
    radius_m: number | null;
    min_latitude: number | null;
    max_latitude: number | null;
    min_longitude: number | null;
    max_longitude: number | null;
    /** 모두 갖춘 이용자에게 보이는 그룹이 있는 업체만 — 없으면 [] */
    detail_conditions: DiscoveryDetailCondition[];
}
```

빌더는 지금 `.setParameters({...filter, …})` 로 필터 객체를 펼친다 — 이제 필터에 배열 · null 이 들어가므로 **쓰는 값만 명시**한다(반경 조건 · 추가정보는 그 `andWhere` 에 값을 붙인다). 반경을 주고 추가정보가 없으면 SQL 은 지금과 한 글자도 같다(Smoke 의 기존 상수 그대로). JSON 항목 키도 파라미터(`->> :detail_key_N`)라 SQL 에 문자열을 끼워 넣지 않는다.

```ts
// apps/user-service/src/discovery/repositories/discovery.repository.ts — after (파일 상수 + buildStoreRowsQuery 뒷부분)
/** 그 그룹에 판매 중인 그룹 상품(그룹 상품 사용 · 요금 > 0 · 업체 상품 설정 사용)이 있는지 — 객실 그룹 목록의 isRoomGroupPlanOnSale 과 같은 기준 */
const GROUP_ON_SALE_SQL =
    'EXISTS (SELECT 1 FROM "t_room_group_plan" "gp" INNER JOIN "t_room_plan" "p" ON "p"."store_id" = "g"."store_id" AND "p"."room_plan_type_id" = "gp"."room_plan_type_id" WHERE "gp"."room_group_id" = "g"."room_group_id" AND "gp"."is_used" = 1 AND "gp"."price" > 0 AND "p"."is_used" = 1)';

    buildStoreRowsQuery(filter: DiscoveryStoreFilter, limit: number): SelectQueryBuilder<StoreEntity> {
        const query = this.stores
            .createQueryBuilder('s')
            // … select · 서브쿼리 그대로 …
            .where('s.store_state_id = :active_state')
            .andWhere('s.is_deleted = 0');
        // ① 반경 — 거리 제한 없음(ALL)이면 사각형 · 거리 조건 없이 전체
        if (filter.radius_m !== null) {
            query
                .andWhere('s.latitude BETWEEN :min_latitude AND :max_latitude', {min_latitude: filter.min_latitude, max_latitude: filter.max_latitude})
                .andWhere('s.longitude BETWEEN :min_longitude AND :max_longitude', {min_longitude: filter.min_longitude, max_longitude: filter.max_longitude})
                .andWhere(`${DISTANCE_SQL} <= :radius_m`, {radius_m: filter.radius_m});
        }
        // ② 추가정보 — 조건을 모두 갖춘, 이용자에게 보이는 그룹(지워지지 않음 · 예약 받을 호실 · 판매 중 상품)이 있는 업체만. 빠진 JSON 항목은 기본값
        if (filter.detail_conditions.length > 0) {
            const parameters: Record<string, string | number> = {};
            const conditions = filter.detail_conditions.map((condition, index) => {
                parameters[`detail_key_${index}`] = condition.key;
                parameters[`detail_default_${index}`] = condition.default_value;
                parameters[`detail_value_${index}`] = condition.value;
                return `COALESCE(("g"."room_group_detail" ->> :detail_key_${index})::integer, :detail_default_${index}) ${condition.operator === 'GTE' ? '>=' : '='} :detail_value_${index}`;
            });
            query.andWhere(
                `EXISTS (SELECT 1 FROM "t_room_group" "g" WHERE "g"."store_id" = "s"."store_id" AND "g"."is_deleted" = 0 AND ${GROUP_HAS_BOOKABLE_ROOM_SQL} AND ${GROUP_ON_SALE_SQL} AND ${conditions.join(' AND ')})`,
                parameters,
            );
        }
        // ③ 가까운 순(같으면 업체 ID 순)
        return query
            .orderBy('"distance_m"', 'ASC')
            .addOrderBy('s.store_id', 'ASC')
            .limit(limit)
            .setParameters({
                latitude: filter.latitude,
                longitude: filter.longitude,
                active_state: DISCOVERY_STORE_STATE_ACTIVE,
                image_purpose: DISCOVERY_STORE_IMAGE_PURPOSE,
                hourly_type: DISCOVERY_PLAN_TYPE.HOURLY,
                night_type: DISCOVERY_PLAN_TYPE.NIGHT,
                disabled_state: DISCOVERY_ROOM_STATE_DISABLED,
            });
    }
```

```ts
// apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts — new handler (형제 GET /store 와 같은 모양 — 가드 없음)
    /**
     * 추가정보 필터 항목 — 객실 그룹 상세 항목마다 체크박스 1개(로그인 없음)
     */
    @Get('/room-group-detail-filter')
    @HttpCode(200)
    @ApiOperation({summary: '업체 검색 추가정보 필터 항목 (체크박스 — 객실 그룹 상세 항목마다 1개)'})
    @ApiOkResponse({type: DiscoveryRoomGroupDetailFilterListResultDto})
    async getRoomGroupDetailFilters(): Promise<DiscoveryRoomGroupDetailFilterListResultDto> {
        return this.internalHttp.request<DiscoveryRoomGroupDetailFilterListResultDto>('user', 'GET', DISCOVERY_INTERNAL_PATH.ROOM_GROUP_DETAIL_FILTER);
    }
```

서비스 내부 controller 는 형제 `GET /store` 와 같은 한 줄 위임(`@Get('/room-group-detail-filter')` → `this.discoveryService.getRoomGroupDetailFilters()`), 내부 경로 상수는 `DISCOVERY_INTERNAL_PATH.ROOM_GROUP_DETAIL_FILTER: `${DISCOVERY_INTERNAL_BASE}/room-group-detail-filter``.

## 테스트

| 분류 | 위치 | 상황 | 확인 |
|---|---|---|---|
| `[SUCCESS]` | discovery-store-list.spec | `radius_km=ALL` | `findStoreRows` 1회, 조건 `{latitude, longitude, radius_m: null, min_*/max_*: null, detail_conditions: []}` · 한도 301 |
| `[SUCCESS]` | 〃 | `detail_filter=has_pc,room_count,has_pc` | 조건 `detail_conditions` = `[{key: 'has_pc', operator: 'EQ', value: 1, default_value: 1}, {key: 'room_count', operator: 'GTE', value: 2, default_value: 1}]`(중복 제거 · 순서 유지) |
| `[FAIL:validation]` | 〃 | `detail_filter=has_wifi`(없는 항목) | 400 `validation_errors[0].property = 'detail_filter'` · 메시지 `추가정보 필터가 올바르지 않습니다.`, `findStoreRows` 미호출 |
| `[FAIL:validation]` | 〃 | `detail_filter=has_pc;drop`(모양) · `radius_km=all`(소문자) | 400(DTO) — 각 property, `findStoreRows` 미호출 |
| (기존 사례) | 〃 | 반경 5 · 10 · 20 · 50 | 조건에 `detail_conditions: []` 만 더해진다 — 사각형 · 반경 값은 그대로 |
| `[SUCCESS]` | discovery-room-group-detail-filter.spec(새) | 항목 목록 | `list` = 4개 `[{room_count, 방 2개 이상}, {has_shower, 샤워실}, {has_tv, TV}, {has_pc, PC}]`, 키 집합 = `ROOM_GROUP_DETAIL_DEFAULTS` 의 키(빠진 항목 없음) |
| `[SMOKE:data-access]` | discovery.repository.spec | 기존 FILTER(+ `detail_conditions: []`) | 기존 `STORE_ROWS_SQL` · 파라미터 그대로 |
| `[SMOKE:data-access]` | 〃 | 거리 제한 없음 | `BETWEEN` · `<= $` 없음, 파라미터에 반경 · 사각형 없음, SQL 고정(새 상수) |
| `[SMOKE:data-access]` | 〃 | 추가정보 2개(EQ · GTE) | `EXISTS (SELECT 1 FROM "t_room_group" "g" …` · 호실 · 판매 상품 EXISTS · `COALESCE(("g"."room_group_detail" ->> $n)::integer, $m) = $k` · `>= `, 파라미터에 키 · 기본값 · 값, SQL 고정(새 상수) |

## Decisions

- [x] **거리 제한 없음은 `radius_km=ALL`**(사용자 2026-11-22) — 필수 값 그대로라 빠뜨림과 구분된다. 가까운 순 · 300개 · `is_truncated` 는 그대로. 사각형 인덱스를 못 쓰므로 활성 업체 전체의 거리를 계산한다 — 업체 수가 적은 지금은 문제없고, 커지면 측정 뒤 다시 본다.
- [x] **추가정보 필터는 객실 그룹 상세의 모든 항목, 체크박스 1개씩, 항목이 늘면 저절로**(사용자 2026-11-22) — 정의를 `Record<keyof RoomGroupDetail, …>` 로 타입에 묶고, query 는 쉼표 목록 하나(`detail_filter`), 항목 목록 API 로 프론트 체크박스를 그린다. 숫자 항목(방 개수)은 체크박스라 기준 값 하나("방 2개 이상")로 둔다.
- [x] **조건을 여러 개 고르면 한 객실 그룹이 모두 갖춰야**(사용자 2026-11-22) — 그 방 하나를 예약하므로.
- [x] **필터가 보는 그룹은 이용자에게 보이는 그룹만**(사용자 2026-11-22) — 객실 그룹 목록(`discovery.service.ts:88`)과 같은 기준이라 검색에 걸렸는데 상세에 그 객실이 안 보이는 일이 없다.
- [x] **항목 이름 확인은 user-service** — 정의는 database 엔티티 파일에 있고 contracts(게이트웨이 DTO)는 database 를 import 하지 않는다. 게이트웨이는 모양(`@Matches`)만, 서비스가 정의에 없는 키를 400 + `validation_errors`(`createValidationError` — 형제 `manager.service.ts:460`)로 거절한다.
- [x] **새 항목 목록 API 는 동기 · 인증 없음** — 형제 둘러보기 API(`GET /store`)와 같다. repository 를 부르지 않는다(정의 상수만).

## 반영 순서
백엔드 배포 먼저 — `radius_km` 기존 값 · `detail_filter` 없음은 지금과 같아 현재 화면은 그대로 동작한다. 마이그레이션 없음.

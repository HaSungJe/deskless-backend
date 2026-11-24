# Plan — 업체 편의시설 (설정 · 상세 노출 · 검색 필터)

> 무엇을·왜는 [spec](../../spec/store/store-facility-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 진입점마다 비즈니스 로직 전체 ② 계산 함수 ③ 규약만으로 예측할 수 없는 데이터 규칙·쿼리
> **싣지 않는 것** 진입점 껍데기, 입력 검증 객체, 등록·배선, 형제 코드와 같은 조회 — 따르는 패턴을 표 한 줄로 가리킨다

## 선행 조건

없음 — 새 외부 연동 · 인프라가 없다(컬럼 하나 + 기존 경로).

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `libs/database/src/entities/store/store.entity.ts` | 수정 | `StoreDetail` · `STORE_DETAIL_DEFAULTS` · `STORE_DETAIL_FILTERS`, 컬럼 `store_detail`(jsonb), `@AfterLoad` 기본값 채우기 | 아래 3-1 |
| `libs/database/src/migrations/<ts>-StoreDetail.ts` · `migrations.ts` | 신규 · 수정 | `npm run db:generate -- StoreDetail` 결과(컬럼 추가 · COMMENT) | 생략 (생성기) |
| `libs/database/src/seeder/sample-seed.data.ts` · `sample-seed.targets.ts` | 수정 | 테스트 데이터 업체 10곳에 편의시설 값 | 아래 3-4 |
| `libs/contracts/src/store/dto/store-mine-detail.dto.ts` | 신규 | 내 업체 편의시설 설정 본문(7개 선택 항목) | 생략 |
| `libs/contracts/src/store/store.commands.ts` | 수정 | `STORE_COMMAND.MINE_DETAIL = 'admin.store.mine-detail'` | 생략 |
| `libs/contracts/src/store/dto/store-mine.dto.ts` · `store-detail.dto.ts` | 수정 | 응답에 `store_detail`(각 파일에 자기 결과 DTO — `StoreMineFacilityResultDto` · `StoreDetailFacilityResultDto`) | 생략 |
| `libs/contracts/src/discovery/dto/discovery-store-detail.dto.ts` | 수정 | 응답에 `store_detail`(`DiscoveryStoreFacilityResultDto`) | 생략 |
| `libs/contracts/src/discovery/dto/discovery-detail-filter.dto.ts` | 신규 | 필터 항목 `{key, name, group}` · 목록 | 생략 |
| `libs/contracts/src/discovery/dto/discovery-room-group-detail-filter.dto.ts` | 삭제 | 새 필터 항목 DTO 로 바뀐다 | — |
| `libs/contracts/src/discovery/discovery.commands.ts` | 수정 | `ROOM_GROUP_DETAIL_FILTER` → `DETAIL_FILTER`(`/detail-filter`) | 생략 |
| `libs/contracts/src/discovery/dto/discovery-store-list.dto.ts` | 수정 | `detail_filter` 설명(업체 항목도 · 항목은 `/detail-filter`) | 생략 |
| `apps/admin-service/src/store/store.service.ts` | 수정 | `replaceMyStoreDetail` | 아래 1-1 |
| `apps/admin-service/src/store/store.util.ts` · `store.constants.ts` | 수정 | `buildStoreDetail` · `STORE_DETAIL_KEYS`, `toMineDetail` · `toStoreDetail` 에 `store_detail` | 아래 3-2 |
| `apps/admin-service/src/store/controllers/store.controller.queue.ts` | 수정 | `@OnCommand(MINE_DETAIL)` | 생략 |
| `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.queue.ts` | 수정 | `PUT /mine/detail`(매니저 가드) | 생략 |
| `apps/user-service/src/discovery/discovery.service.ts` | 수정 | `getDetailFilters`(옛 `getRoomGroupDetailFilters` 대신) · `getStores` 필터 검사 | 아래 1-2 · 1-3 |
| `apps/user-service/src/discovery/discovery.util.ts` · `discovery.constants.ts` | 수정 | `isDetailFilterKey` · `toDetailFilterItems` · `toStoreFilter`(업체 조건) · `toDiscoveryStoreDetail` 에 `store_detail`, 묶음 상수 | 아래 3-3 |
| `apps/user-service/src/discovery/interfaces/discovery.repository.interface.ts` · `repositories/discovery.repository.ts` | 수정 | `DiscoveryStoreFilter.store_conditions`, `buildStoreRowsQuery` 업체 조건 | 아래 3-3 |
| `apps/user-service/src/discovery/controllers/discovery.controller.ts` | 수정 | `GET /detail-filter`(옛 `/room-group-detail-filter` 삭제) | 생략 |
| `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts` | 수정 | `GET /detail-filter`(가드 없음, 옛 라우트 삭제) | 생략 |
| `apps/admin-service/src/store/test/*` · `apps/user-service/src/discovery/test/*` | 신규 · 수정 | service 기능 spec · repository spec · 기존 응답 단언 손보기 | 아래 "테스트" |
| `AGENTS.md` | 수정 | 공개 라우트 목록(`/room-group-detail-filter` → `/detail-filter`), Data Layer jsonb 문단에 업체 `store_detail` · `STORE_DETAIL_FILTERS` | 생략 |
| `docs/data-layer.md` · `docs/guides/sample-data.md` | 수정 | jsonb 예에 업체 편의시설, 테스트 데이터 편의시설 값 | 생략 |
| `README.md` | 확인 | 구조 · 명령 · 실행 방법 변화 없음 — 필터 주소 · 편의시설을 적은 곳이 없는지 확인만 | — |
| `.beaver/output/frontend/changes/2026-11-24-store-facility.md` · `changes/README.md` | 신규 · 수정 | 프론트 요청서(설정 화면 · 상세 표시 · 필터 주소 바뀜 · 묶음 · DTO 사본) + 목록 한 줄 — ship 뒤 사용자에게 파일로 건넨다(메모리 frontend) | 생략 |

---

## 1. 비즈니스 로직 — 진입점별 코드

### 1-1. 내 업체 편의시설 설정 — `StoreService.replaceMyStoreDetail` (admin-service)

영업시간 · 소개 수정과 같은 모양 — 업체 행 잠금 아래에서 그 업체만 바꾼다(store.service.ts:484 `updateMyStoreProfile`).

```ts
// apps/admin-service/src/store/store.service.ts (추가)
    /**
     * 내 업체 편의시설 설정 (업체 관리자) — 7개 항목을 통째로 바꾼다(보낸 항목은 그 값, 빠진 항목은 없음 0). (RabbitMQ: admin.store.mine-detail)
     *
     * @param user_id 로그인 매니저 ID
     * @param dto 편의시설 항목(모두 선택)
     */
    @Transactional()
    async replaceMyStoreDetail(user_id: string, dto: StoreMineDetailDto): Promise<void> {
        // ① 내 업체 찾기 — 탈퇴 · 지운 업체 제외, 업체 행 잠금
        const store = await this.storeRepository.findStoreByManager(user_id, true);
        if (!store) {
            throw new NotFoundException({message: STORE_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }

        // ② 편의시설 채우기 — 보낸 항목 + 빠진 항목은 없음(0), 선언 안 된 키는 버린다(3-2)
        const storeEntity = new StoreEntity();
        storeEntity.store_detail = buildStoreDetail(dto);

        // ③ 저장 — 통째로 교체
        await this.storeRepository.updateStore({store_id: store.store_id}, storeEntity);
    }
```

### 1-2. 검색 필터 항목 — `DiscoveryService.getDetailFilters` (user-service)

```ts
// apps/user-service/src/discovery/discovery.service.ts (getRoomGroupDetailFilters 를 바꾼다)
    /**
     * 업체 검색 추가정보 필터 항목 — 객실 항목(ROOM_GROUP_DETAIL_FILTERS) 다음 업체 항목(STORE_DETAIL_FILTERS), 항목마다 체크박스 1개 · 묶음 표시. 항목이 늘면 저절로 늘어난다.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/detail-filter)
     *
     * @returns 항목 목록
     */
    getDetailFilters(): DiscoveryDetailFilterListResultDto {
        // ① 항목 모으기 → ② 목록 반환 (DB 없음)
        return {list: toDetailFilterItems()};
    }
```

### 1-3. 반경 업체 조회 — `DiscoveryService.getStores` 의 필터 검사 (user-service, 바뀌는 줄만)

```ts
        // 1. 추가정보 필터 — 객실 · 업체 항목 정의에 있는 키만(둘 중 어디에도 없으면 400)
        const detail_keys = splitDetailFilter(dto.detail_filter);
        if (!detail_keys.every(isDetailFilterKey)) {
            throw new BadRequestException({message: DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE, validation_errors: createValidationError('detail_filter', DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE)});
        }

        // 2. 중심 · 반경 → 사각형 + 거리 조건 + 객실 항목 조건(그룹 EXISTS) + 업체 항목 조건(업체 JSON), 잘림 판단용으로 1개 더 — 나누기는 toStoreFilter(3-3)
        const filter = toStoreFilter(Number(dto.latitude), Number(dto.longitude), dto.radius_km, detail_keys);
        const rows = await this.discoveryRepository.findStoreRows(filter, DISCOVERY_STORE_LIMIT + 1);
```

업체 상세 · 내 업체 조회 · 업체 상세(관리)는 매핑 함수에 `store_detail: {...entity.store_detail}` 한 줄씩 — 기본값은 엔티티 `@AfterLoad` 가 채운다(3-1).

---

## 3. 데이터 규칙 — 규약만으로 예측할 수 없는 부분

### 3-1. 업체 편의시설 JSON — `libs/database/src/entities/store/store.entity.ts`

객실 그룹 상세(`room_group_detail` — room-group.entity.ts:1 ~ 40 · 107)와 같은 방식이다. 다른 점: 기본값이 모두 **없음(0)**(객실 기본값은 있음 1) — 업체가 체크하지 않은 시설을 있다고 보이면 안 된다. 필터 정의 타입은 객실 쪽을 import 하지 않고 같은 모양으로 따로 둔다(room-group.entity.ts 가 store.entity.ts 를 import 하므로 반대로 가져오면 ESM 순환).

```ts
/**
 * 업체 편의시설(t_store.store_detail) — 업체 전체가 제공하는 시설(사용자 결정 2026-11-24). 객실 그룹 상세(방 수 · 샤워 · TV · PC)와 따로 둔다.
 * 항목은 언제든 바뀔 수 있다(인터페이스 · 기본값 · 필터 정의만 고치고 마이그레이션 없음). 저장된 JSON 에 없는 항목은 조회 뒤 STORE_DETAIL_DEFAULTS(없음)로 채운다.
 */
export interface StoreDetail {
    /** 편의점 유무(0: 없음, 1: 있음) */
    has_convenience_store: 0 | 1;
    /** 카페 유무 */
    has_cafe: 0 | 1;
    /** 온천 유무 */
    has_hot_spring: 0 | 1;
    /** 반려동물 동반 가능 여부 */
    is_pet_allowed: 0 | 1;
    /** 식사 제공 여부 */
    has_meal: 0 | 1;
    /** 배달 음식 가능 여부 */
    is_delivery_allowed: 0 | 1;
    /** 주차 가능 여부 */
    has_parking: 0 | 1;
}

/** 업체 편의시설 기본값 — 모두 없음(0). 저장된 JSON 에 없는 항목은 조회 뒤 이 값으로 채운다(@AfterLoad) */
export const STORE_DETAIL_DEFAULTS: StoreDetail = {has_convenience_store: 0, has_cafe: 0, has_hot_spring: 0, is_pet_allowed: 0, has_meal: 0, is_delivery_allowed: 0, has_parking: 0};

/** 업체 편의시설 항목 하나의 검색 필터 — 체크박스 1개(객실 그룹 필터와 같은 모양) */
export interface StoreDetailFilter {
    /** 체크박스 이름 */
    name: string;
    /** 조건 — EQ: 값과 같다(있음 = 1) */
    operator: 'EQ';
    /** 비교 값 */
    value: number;
}

/**
 * 업체 편의시설 검색 필터 — 항목마다 체크박스 1개(이 순서로 보인다). StoreDetail 의 모든 항목을 키로 가져야 한다(Record — 항목을 더하고 빼먹으면 타입 검사 실패).
 * 키는 객실 그룹 필터(ROOM_GROUP_DETAIL_FILTERS)와 겹치면 안 된다 — 업체 검색 detail_filter 에 같이 들어간다.
 */
export const STORE_DETAIL_FILTERS: Record<keyof StoreDetail, StoreDetailFilter> = {
    has_convenience_store: {name: '편의점', operator: 'EQ', value: 1},
    has_cafe: {name: '카페', operator: 'EQ', value: 1},
    has_hot_spring: {name: '온천', operator: 'EQ', value: 1},
    is_pet_allowed: {name: '반려동물 동반', operator: 'EQ', value: 1},
    has_meal: {name: '식사 제공', operator: 'EQ', value: 1},
    is_delivery_allowed: {name: '배달 음식', operator: 'EQ', value: 1},
    has_parking: {name: '주차', operator: 'EQ', value: 1},
};

// StoreEntity 안 (introduction 다음)
    @Column({
        name: 'store_detail',
        type: 'jsonb',
        nullable: false,
        default: () => "'{}'",
        comment: '편의시설(JSON — has_convenience_store · has_cafe · has_hot_spring · is_pet_allowed · has_meal · is_delivery_allowed · has_parking, 항목은 바뀔 수 있다. 없는 항목은 조회 뒤 기본값 — 모두 없음 0)',
    })
    store_detail: StoreDetail;

    /**
     * 조회 직후 편의시설의 빈 항목을 기본값(없음)으로 채운다 — 나중에 더한 항목도 기존 행을 고치지 않고 없음으로 보인다.
     */
    @AfterLoad()
    fillDetailDefaults(): void {
        this.store_detail = {...STORE_DETAIL_DEFAULTS, ...this.store_detail};
    }
```

엔티티 머리 주석의 "편의시설 같은 객실 상세정보는 객실 그룹에 있다" 를 "객실 상세(방 수 · 샤워 · TV · PC)는 객실 그룹, 업체 편의시설은 store_detail" 로 고친다. 입점 승인의 업체 insert 는 `store_detail` 을 비워 두면 DB 기본값(`'{}'`)이 들어간다 — 승인 코드는 고치지 않는다. 마이그레이션은 컬럼 추가뿐이라 기존 행은 `'{}'`(모두 없음)이다.

### 3-2. 편의시설 채우기 — `apps/admin-service/src/store/store.util.ts`

```ts
// apps/admin-service/src/store/store.constants.ts (추가)
/** 업체 편의시설 항목 키 — 저장할 때 이 키만 남긴다(STORE_DETAIL_DEFAULTS 의 키) */
export const STORE_DETAIL_KEYS = Object.keys(STORE_DETAIL_DEFAULTS) as (keyof StoreDetail)[];
```

```ts
// apps/admin-service/src/store/store.util.ts (추가)
/**
 * 저장할 업체 편의시설 — 알려진 항목(STORE_DETAIL_KEYS) 중 값이 있는 것만 남기고, 빠진 항목은 기본값(없음 0)으로 채워 전부 만든다.
 * 선언 안 된 키는 버린다(큐 경로는 다시 검증하지 않는다). 객실 그룹 상세의 buildRoomGroupDetail(room.util.ts:37)과 같은 규칙.
 *
 * @param dto 받은 항목
 * @returns 저장할 편의시설(7개 항목)
 */
export function buildStoreDetail(dto?: Partial<Record<keyof StoreDetail, number | null>> | null): StoreDetail {
    const detail: Record<keyof StoreDetail, number> = {...STORE_DETAIL_DEFAULTS};
    for (const key of STORE_DETAIL_KEYS) {
        const value = dto?.[key];
        if (value !== undefined && value !== null) {
            detail[key] = value;
        }
    }
    return detail as StoreDetail;
}
```

### 3-3. 검색 필터 — 객실 · 업체 항목 나누기 · 업체 조건 SQL (user-service discovery)

`detail_filter` 하나에 두 묶음의 키가 섞여 온다 — 객실 항목은 지금처럼 "조건을 모두 갖춘 객실 그룹이 있는 업체" EXISTS(discovery.repository.ts:284), 업체 항목은 업체 행 JSON 에 바로 건다. 두 정의의 키가 겹치지 않으므로(3-1) 키로 묶음을 가른다.

```ts
// apps/user-service/src/discovery/discovery.constants.ts (추가)
/** 추가정보 필터 묶음 — 객실 그룹 항목 · 업체 편의시설 항목 */
export const DISCOVERY_DETAIL_FILTER_GROUP = {ROOM_GROUP: 'ROOM_GROUP', STORE: 'STORE'} as const;
```

```ts
// apps/user-service/src/discovery/discovery.util.ts (isRoomGroupDetailFilterKey · toRoomGroupDetailFilterItems 를 바꾼다)
/**
 * 업체 편의시설의 필터 항목인지 — 정의(STORE_DETAIL_FILTERS)에 있는 키만
 *
 * @param key 항목 키
 * @returns 필터 항목이면 true
 */
export function isStoreDetailFilterKey(key: string): key is keyof StoreDetail {
    return Object.hasOwn(STORE_DETAIL_FILTERS, key);
}

/**
 * 추가정보 필터 항목인지 — 객실 그룹 항목 또는 업체 편의시설 항목
 *
 * @param key 항목 키
 * @returns 어느 한쪽 정의에 있으면 true
 */
export function isDetailFilterKey(key: string): boolean {
    return isRoomGroupDetailFilterKey(key) || isStoreDetailFilterKey(key);
}

/**
 * 추가정보 필터 항목 목록 — 객실 그룹 항목(정의 순서) 다음 업체 편의시설 항목(정의 순서), 묶음 표시
 *
 * @returns 항목 목록
 */
export function toDetailFilterItems(): DiscoveryDetailFilterItemResultDto[] {
    return [
        ...Object.entries(ROOM_GROUP_DETAIL_FILTERS).map(([key, filter]) => ({key, name: filter.name, group: DISCOVERY_DETAIL_FILTER_GROUP.ROOM_GROUP})),
        ...Object.entries(STORE_DETAIL_FILTERS).map(([key, filter]) => ({key, name: filter.name, group: DISCOVERY_DETAIL_FILTER_GROUP.STORE})),
    ];
}

// toStoreFilter — detail_keys 를 두 묶음으로 나눈다(바뀌는 줄)
export function toStoreFilter(latitude: number, longitude: number, radius_km: string, detail_keys: string[]): DiscoveryStoreFilter {
    const detail_conditions = detail_keys.filter(isRoomGroupDetailFilterKey).map((key) => ({
        key,
        operator: ROOM_GROUP_DETAIL_FILTERS[key].operator,
        value: ROOM_GROUP_DETAIL_FILTERS[key].value,
        default_value: ROOM_GROUP_DETAIL_DEFAULTS[key],
    }));
    const store_conditions = detail_keys.filter(isStoreDetailFilterKey).map((key) => ({
        key,
        operator: STORE_DETAIL_FILTERS[key].operator,
        value: STORE_DETAIL_FILTERS[key].value,
        default_value: STORE_DETAIL_DEFAULTS[key],
    }));
    // 이하 반경 · 사각형은 지금과 같고, 반환 객체에 store_conditions 를 더한다
}
```

`DiscoveryStoreFilter` 에 `store_conditions: DiscoveryDetailCondition[]`(업체 편의시설 JSON 항목 — 빠지면 기본값 0)을 더한다. 조건은 객실 EXISTS 와 같은 파라미터 방식이고, 키는 text 로 못 박는다(discovery.repository.ts:290 — 타입 없는 파라미터면 `->>` 가 배열 번호로 읽을 수 있다).

```ts
// apps/user-service/src/discovery/repositories/discovery.repository.ts — buildStoreRowsQuery 의 객실 조건 다음에 추가
        if (filter.store_conditions.length > 0) {
            const parameters: Record<string, string | number> = {};
            const conditions = filter.store_conditions.map((condition, index) => {
                parameters[`store_detail_key_${index}`] = condition.key;
                parameters[`store_detail_default_${index}`] = condition.default_value;
                parameters[`store_detail_value_${index}`] = condition.value;
                return `COALESCE(("s"."store_detail" ->> CAST(:store_detail_key_${index} AS text))::integer, :store_detail_default_${index}) = :store_detail_value_${index}`;
            });
            query.andWhere(conditions.join(' AND '), parameters);
        }
```

### 3-4. 테스트 데이터 — `sample-seed.data.ts` · `sample-seed.targets.ts`

`SampleStore` 에 `store_detail: Partial<StoreDetail>` 를 더하고, `buildSampleStores` 가 `store.store_detail = {...STORE_DETAIL_DEFAULTS, ...sample.store_detail}` 로 채운다(이미 넣은 개발 DB 는 다시 넣지 않는다 — 새 DB 부터). 서울 10곳은 도심이라 온천은 없음, 나머지는 업체마다 2 ~ 5개를 섞는다(예: 강남역점 편의점 · 카페 · 배달 · 주차 / 성수점 카페 · 반려동물 · 주차 / 여의도점 식사 · 카페). 온천 · 반려동물이 많은 지역 업체는 ② 전국 더미 업체에서 넣는다.

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| 마이그레이션 | `npm run db:generate -- StoreDetail` → `npm run db:check`(컬럼 · DEFAULT `'{}'` · COMMENT 확인) | `docs/data-layer.md` 마이그레이션 절 |
| `StoreMineDetailDto` | 7개 모두 선택 — `@ApiProperty({required: false, enum: [0, 1]})` → `@IsOptional()` → `@IsIn([0, 1], {message: '<항목> 여부가 올바르지 않습니다.'})`. 선언 안 된 항목은 `forbidNonWhitelisted` 로 400 | `libs/contracts/src/room/dto/room-group.dto.ts:8` |
| 큐 명령 · 핸들러 | `STORE_COMMAND.MINE_DETAIL`, 서비스 `@OnCommand` → `replaceMyStoreDetail(requireActor(command).user_id, command.payload)`, 게이트웨이 `@Put('/mine/detail')` · 매니저 가드 · `@ApiBody({type: StoreMineDetailDto})` · data 없음 | `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.queue.ts:133` · `apps/admin-service/src/store/controllers/store.controller.queue.ts:134` |
| 응답 `store_detail` | 각 응답 DTO 파일에 7개 항목 결과 DTO(기능당 DTO — 모양 같아도 따로), 매핑 함수에 `store_detail: {...entity.store_detail}` | `apps/admin-service/src/store/store.util.ts:373 · 464`, `apps/user-service/src/discovery/discovery.util.ts:270` |
| 필터 항목 라우트 | 가드 없는 동기 GET 한 핸들러 — 서비스 `@Get('/detail-filter')`, 게이트웨이 `@Get('/detail-filter')` + `DISCOVERY_INTERNAL_PATH.DETAIL_FILTER` | `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts:41` |
| 필터 항목 DTO | `{key, name, group}` 항목 · `{list}` 결과 | `libs/contracts/src/discovery/dto/discovery-room-group-detail-filter.dto.ts` |
| 프론트 요청서 | 이유 · 영향 화면(U1 지도 필터 팝업 · U2 업체 상세 · M7 내 업체 설정 · A4 업체 관리) · API 변경(추가 `PUT /mine/detail` · `GET /discovery/detail-filter`, 변경 응답 3개 · `detail_filter`, 삭제 `GET /discovery/room-group-detail-filter`) · 화면 구성 · DTO 사본 · 반영 순서(백엔드와 함께 — 옛 필터 주소가 사라진다) | `.beaver/output/frontend/changes/2026-11-22-discovery-filter.md` |

## 테스트

spec 의 "결과" 표에서 ✓ 표시된 6건과 "계산 규칙" 표 0건을 그대로 테스트로 옮긴다. 여기에는 추가분만 적는다.

파일 — admin-service `store/test/store-mine-detail.spec.ts`(신규 — 정상 · 404 · 검증 실패), user-service `discovery/test/discovery-detail-filter.spec.ts`(옛 `discovery-room-group-detail-filter.spec.ts` 를 바꾼다 — 11개 · 묶음 · 정의 순서 · DB 미호출), `discovery/test/discovery-store-list.spec.ts`(지금 `detail_filter` 정상 케이스에 업체 키를 섞어 `detail_conditions` · `store_conditions` 둘 다 단언, 검증 실패 케이스는 그대로 — 정의에 없는 키).

단언 포인트:
- 설정 — `findStoreByManager(user_id, true)`, `updateStore({store_id}, 엔티티)` 1회 · `toBeInstanceOf(StoreEntity)` · `store_detail` 이 7개(보낸 값 + 빠진 항목 0), 소속 업체 없으면 `updateStore` 미호출.
- 반경 업체 — `findStoreRows` 에 넘긴 필터의 `detail_conditions`(객실 키만) · `store_conditions`(업체 키만 — operator EQ · value 1 · default 0).

기존 spec 손보기 — 응답에 `store_detail` 이 생겨 전체 본문을 `toEqual` 로 보는 spec 이 깨진다: admin `store-mine.spec.ts` · `store-detail.spec.ts`, user `discovery-store-detail.spec.ts` 의 업체 픽스처에 `store_detail` 을 넣고 기대값에 더한다. `DiscoveryStoreFilter` 에 칸이 생겨 `discovery.repository.spec.ts` 의 필터 상수에 `store_conditions: []` 를 더한다(SQL 고정 문자열은 그대로여야 한다 — 업체 조건이 없으면 SQL 이 바뀌지 않음을 함께 보장).

| 종류 | 대상 | 이유 |
|---|---|---|
| 쿼리 스모크 | user-service discovery `buildStoreRowsQuery`(업체 항목 2개 + 객실 항목 1개) | `"s"."store_detail" ->> CAST(... AS text)` · 기본값 COALESCE · 파라미터 이름이 객실 조건과 겹치지 않음 · 객실 EXISTS 와 함께 걸림 |

## 만드는 순서

1. 엔티티(`StoreDetail` · 기본값 · 필터 정의 · 컬럼 · `@AfterLoad`) → `npm run db:generate -- StoreDetail` → `npm run db:check`
2. contracts — `store-mine-detail.dto.ts` · `MINE_DETAIL` · 응답 DTO 3개 · `discovery-detail-filter.dto.ts`(옛 DTO 삭제) · `DETAIL_FILTER` 경로
3. admin-service store — 상수 · util · service · 큐 핸들러 · 응답 매핑 2개
4. user-service discovery — 상수 · util · 인터페이스 · repository · service · 컨트롤러 · 상세 매핑
5. gateway — 매니저 `PUT /mine/detail`, 둘러보기 `GET /detail-filter`(옛 라우트 삭제)
6. 테스트 데이터 편의시설 값
7. 테스트 — 새 spec 2개 · 기존 spec 손보기 · 스모크
8. 문서 — AGENTS.md · docs/data-layer.md · sample-data 가이드 · 프론트 요청서 + 목록 한 줄

# Report — 업체 편의시설

## Feature Summary
- **Feature**: 업체 단위 편의시설 7개(편의점 · 카페 · 온천 · 반려동물 동반 · 식사 제공 · 배달 음식 · 주차 — 모두 0 · 1, 기본 0)를 업체 관리자가 통째로 설정하고, 이용자 업체 상세 · 내 업체 · 총관리자 업체 상세에 보여 주며, 업체 검색 추가정보 필터가 객실 항목과 한 목록으로 묶어 고른다. 지금의 객실 그룹 항목(방 2개 이상 · 샤워실 · TV · PC) 위에 더한다. 다음 작업 ③ AI 대화형 업체 검색이 이 값을 쓴다.
- **Entry point**:
  - `PUT /api/v1/admin-service/store/mine/detail` — 큐(`admin.store.mine-detail`) · 매니저, 통째로 교체(빠진 항목 0)
  - `GET /api/v1/user-service/discovery/detail-filter` — 동기 · 로그인 없음, `{list: [{key, name, group}]}`(객실 4 → 업체 7). 옛 `GET …/room-group-detail-filter` 는 삭제
  - `GET /api/v1/user-service/discovery/store` — `detail_filter` 에 업체 키를 섞어 받는다(객실 키 = 그룹 EXISTS, 업체 키 = `t_store.store_detail` JSON 조건)
  - 응답에 `store_detail` 추가 — `GET …/discovery/store/:store_id` · `GET /api/v1/admin-service/store/mine` · `GET /api/v1/admin-service/store/:store_id`
- **Domain**: store(admin-service) · discovery(user-service) · database(store 엔티티 · 마이그레이션 · 테스트 데이터)
- spec `.beaver/output/spec/store/store-facility-spec.md` · plan `.beaver/output/plan/store/store-facility-plan.md`

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `libs/database/src/entities/store/store.entity.ts` | modified | `StoreDetail` · `STORE_DETAIL_DEFAULTS` · `StoreDetailFilter` · `STORE_DETAIL_FILTERS`(`Record<keyof StoreDetail, …>`) · `store_detail` jsonb 컬럼(기본 `'{}'`) · `@AfterLoad fillDetailDefaults()` |
| `libs/database/src/migrations/1795525176585-StoreDetail.ts` | created | `t_store.store_detail` jsonb NOT NULL DEFAULT '{}' + COMMENT(`db:generate`) |
| `libs/database/src/migrations.ts` | modified | 마이그레이션 등록 |
| `libs/database/src/seeder/sample-seed.data.ts` · `sample-seed.targets.ts` | modified | 샘플 업체 10곳 편의시설 값 · `{...STORE_DETAIL_DEFAULTS, ...값}` 으로 7개 채워 넣기 |
| `libs/contracts/src/store/dto/store-mine-detail.dto.ts` | created | `StoreMineDetailDto` — 7개 선택 `@IsIn([0, 1])` · 항목별 한국어 메시지 |
| `libs/contracts/src/store/store.commands.ts` | modified | `STORE_COMMAND.MINE_DETAIL = 'admin.store.mine-detail'` |
| `libs/contracts/src/store/dto/store-mine.dto.ts` · `store-detail.dto.ts` | modified | `store_detail` 칸 + `StoreMineFacilityResultDto` · `StoreDetailFacilityResultDto` |
| `libs/contracts/src/discovery/dto/discovery-store-detail.dto.ts` | modified | `store_detail` 칸 + `DiscoveryStoreFacilityResultDto` |
| `libs/contracts/src/discovery/dto/discovery-detail-filter.dto.ts` | created | `DiscoveryDetailFilterItemResultDto {key, name, group}` · `DiscoveryDetailFilterListResultDto` |
| `libs/contracts/src/discovery/dto/discovery-room-group-detail-filter.dto.ts` | deleted | 위 DTO 로 바뀜 |
| `libs/contracts/src/discovery/discovery.commands.ts` | modified | `DETAIL_FILTER`(`/detail-filter`) — 옛 `ROOM_GROUP_DETAIL_FILTER` 삭제 |
| `libs/contracts/src/discovery/dto/discovery-store-list.dto.ts` | modified | `detail_filter` Swagger 설명(검증 그대로) |
| `apps/admin-service/src/store/store.constants.ts` · `store.util.ts` | modified | `STORE_DETAIL_KEYS` · `buildStoreDetail(dto)`(알려진 키만 · 빠진 항목 0) · `toStoreDetail` · `toMineDetail` 에 `store_detail` |
| `apps/admin-service/src/store/store.service.ts` | modified | `replaceMyStoreDetail`(`@Transactional` — 업체 행 잠금 조회 → 404 → `updateStore` 에 `store_detail` 만) |
| `apps/admin-service/src/store/controllers/store.controller.queue.ts` | modified | `@OnCommand(MINE_DETAIL)` 위임 |
| `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.queue.ts` | modified | `PUT /mine/detail`(매니저 가드 · SSE · Swagger) |
| `apps/user-service/src/discovery/discovery.constants.ts` | modified | `DISCOVERY_DETAIL_FILTER_GROUP`(`ROOM_GROUP` · `STORE`) |
| `apps/user-service/src/discovery/discovery.util.ts` | modified | `isStoreDetailFilterKey` · `isDetailFilterKey` · `toDetailFilterItems`(객실 → 업체, group) · `toStoreFilter` 가 키를 묶음별 `detail_conditions` · `store_conditions` 로 가름 · `toDiscoveryStoreDetail` 에 `store_detail` |
| `apps/user-service/src/discovery/interfaces/discovery.repository.interface.ts` | modified | `DiscoveryStoreFilter.store_conditions` |
| `apps/user-service/src/discovery/repositories/discovery.repository.ts` | modified | `buildStoreRowsQuery` — 업체 조건 `COALESCE(("s"."store_detail" ->> CAST(:키 AS text))::integer, :기본값) = :값`(파라미터 `store_detail_key_i` 등, 객실 조건과 이름 겹치지 않음) |
| `apps/user-service/src/discovery/discovery.service.ts` · `controllers/discovery.controller.ts` | modified | `getDetailFilters`(옛 `getRoomGroupDetailFilters` 대신) · `getStores` 가 `isDetailFilterKey` 로 검사 · `GET /detail-filter` |
| `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts` | modified | `GET /detail-filter`(옛 라우트 삭제) |
| `AGENTS.md` · `docs/data-layer.md` · `docs/guides/sample-data.md` | modified | 공개 라우트 목록 · jsonb 문단(업체 `store_detail` · 필터 묶음 · 업체 조건 SQL) · 샘플 업체 편의시설 값 |
| `README.md` | 확인 | 앱 소개 · 구조 · 명령 · 실행 방법 변화 없음, 필터 주소 · 편의시설을 적은 곳 없음 — 고치지 않음 |
| `.beaver/output/frontend/changes/2026-11-24-store-facility.md` · `changes/README.md` | created · modified | 프론트 수정 요청서(U1 · U2 · M7 · A4, 반영 순서 "프론트와 함께") + 목록 한 줄 |

## Tests Written
- `apps/admin-service/src/store/test/store-mine-detail.spec.ts`(새 — 큐 경로)
  - `[SUCCESS]` 일부 항목 + 선언 안 된 키 → `findStoreByManager(user, true)` 1회, `updateStore({store_id}, StoreEntity)` 1회 · 7개(보낸 값 · 빠진 항목 0) · 정의된 칸은 `store_detail` 하나
  - `[FAIL:service]` 소속 업체 없음 → failed 404 `소속 업체를 찾을 수 없습니다.` · `updateStore` 미호출
  - `[FAIL:validation]` 값 2 → `온천 여부가 올바르지 않습니다.`(`has_hot_spring`), 모르는 항목 400, 빈 본문 · 0/1 본문 통과
- `apps/user-service/src/discovery/test/discovery-detail-filter.spec.ts`(옛 `discovery-room-group-detail-filter.spec.ts` 를 바꿈) — 11개 `{key, name, group}` 정의 순서(객실 4 → 업체 7) · 묶음별 키 집합 = 각 DEFAULTS 키 · 중복 없음 · repository 미호출
- `apps/user-service/src/discovery/test/discovery-store-list.spec.ts` — 객실 · 업체 키를 섞은 `detail_filter` 가 `detail_conditions`(PC · 방 2개 — 기본 1) · `store_conditions`(온천 · 반려동물 — 기본 0)로 갈림(중복 한 번 · 순서 유지), ALL · 반경 케이스에 `store_conditions: []`
- `apps/user-service/src/discovery/test/discovery.repository.spec.ts` — Smoke: 업체 조건 2개 + 객실 조건 1개 SQL(업체 JSON 조건 2회 · 객실 EXISTS · 파라미터 값 · ORDER BY/LIMIT · select 별칭 그대로), 기존 필터 상수에 `store_conditions: []`
- 응답 칸 추가에 따른 기존 spec 손보기 — `store-mine.spec.ts` · `store-detail.spec.ts`(`store_detail` 기대값), `store-mine-profile.spec.ts`(편의시설이 섞여 와도 소개 · 연락처만 — ES2023 클래스 필드라 `new StoreEntity()` 가 `store_detail` 칸을 가져 속성 존재 대신 값 `undefined` 로 단언), `discovery-store-detail.spec.ts`, 테스트 도우미 `storeRow()` · `storeEntity()`

## Verification
- `npm run typecheck` · `npm run lint`(oxlint) · `npm run db:check`(엔티티와 마이그레이션이 일치) 통과, 바뀐 `.ts` 파일 Prettier 통과(새로 더한 긴 줄 3곳만 Prettier 로 정리 — discovery.util.ts 조건 map · discovery-store-list.dto.ts 설명 · store.entity.ts 컬럼 comment).
- 로드맵에 이 기능에 맞는 Phase 가 없어 진척 표시는 하지 않았다(사용자가 바로 요청한 3단계 작업 ①).
- 읽어서 확인: 통째로 교체(빠진 항목 0 · 모르는 키 버림 — 큐 경로는 재검증하지 않으므로 `buildStoreDetail` 이 키를 거른다) · 업체 행 잠금 아래 쓰기 · 조회 3곳 모두 `{...entity.store_detail}`(@AfterLoad 로 7개가 찬 값) · 필터 항목 순서와 묶음 · `detail_filter` 검증은 두 정의의 키만 허용 · 업체 조건 파라미터가 객실 조건과 겹치지 않음 · 기존 행은 마이그레이션 기본값 `'{}'` → 조회 때 모두 0.
- 테스트 실행은 `/beaver:test`(ship 뒤).

## Remaining Issues
- 이미 테스트 데이터가 들어간 개발 DB 는 시드가 고정 ID 행을 건너뛰어 편의시설이 모두 0 으로 보인다(새 DB 에서 넣거나 M7 에서 켠다) — 가이드 · 프론트 요청서에 적음.
- 마이그레이션 적용(`db:migrate` 또는 deskless 마이그레이션 Job)은 사용자 몫.

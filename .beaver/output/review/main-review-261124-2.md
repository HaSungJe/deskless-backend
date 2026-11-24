# Review — main — 261124-2

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — direct 모드(main 에 바로 커밋 · 푸쉬), 같은 날 두 번째 리뷰.

## Target
- stick: `main`(direct 모드) → origin: `main`
- Included features: 업체 편의시설(store-facility — AI 업체 검색 3단계 중 ①) — 설정 `PUT /mine/detail` · 상세 3곳 노출 · 검색 필터 한 목록(`/detail-filter`) · 업체 항목 검색 조건
- Change scope: 47 files, +1348 / −118 — 엔티티(`store_detail` jsonb) · 마이그레이션 1, contracts(DTO 신규 2 · 수정 5 · 삭제 1 · 명령 · 경로), admin-service store, user-service discovery, gateway 2곳, 테스트 신규 2 · 수정 8, 테스트 데이터, 문서(AGENTS · data-layer · sample-data · 프론트 요청서 · spec/plan/report)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | `store_detail` · `StoreDetail` · `STORE_DETAIL_DEFAULTS` · `STORE_DETAIL_FILTERS` 가 객실 그룹 상세(`room_group_detail` …)와 같은 꼴, 명령 `admin.store.mine-detail`, 서비스 `replaceMyStoreDetail`(통째 교체 PUT 형제 `replaceMyStoreHours`) |
| Structure & layering | pass | 업체 관리자 기능은 admin-service store, 이용자 조회 · 필터는 user-service discovery. 큐 · 동기 파일 분리, 게이트웨이 매니저 가드 |
| Shared logic extraction | pass | 채우기 `buildStoreDetail`(store.util.ts — `buildRoomGroupDetail` 형제), 필터 나누기 · 항목 목록은 discovery.util.ts. service private 헬퍼 없음 |
| Errors & responses | pass | 소속 업체 없음 404 `STORE_MANAGER_STORE_NOT_FOUND_MESSAGE`, 필터 키 400 은 기존 메시지 · `validation_errors`. 응답 `store_detail` 은 엔티티 `@AfterLoad` 로 7개가 늘 찬다 |
| Test strength | pass | 설정 spec(행 잠금 · 엔티티 값 · 미호출 · 검증), 필터 항목 spec(11개 · 묶음 · DB 미호출), 업체 검색 spec(두 묶음 조건 분리), 업체 조건 Data-Access Smoke(`"s"."store_detail" ->> CAST(... AS text)` 2회) |

## Intended Behavior Check (against plan/spec)
- spec 진입점 5개 · ✓ 6건 구현 · 테스트 작성. 옛 `room-group-detail-filter` 라우트 · DTO · 서비스 메서드 · spec 이 모두 빠졌다(저장소에 남은 참조 0).
- 편의시설 7개(편의점 · 카페 · 온천 · 반려동물 동반 · 식사 제공 · 배달 음식 · 주차)가 사용자 결정 그대로, 기본값 모두 없음(0).
- 업체 항목 조건 파라미터 이름이 객실 조건(`detail_*`)과 겹치지 않는다(`store_detail_*`).
- `npm run typecheck` 통과(이 리뷰에서 다시 실행), build report 기준 lint · `db:check` · Prettier 통과. 테스트 실행은 `/beaver:test`.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `libs/database/src/entities/store/store.entity.ts`(`fillDetailDefaults`) | `@AfterLoad` 는 `store_detail` 을 고르지 않은 부분 조회에서도 메모리에 기본값(모두 0)을 채운다. 지금 쓰기는 모두 `new StoreEntity()` 에 바꿀 칸만 넣어 `update` 하고 `save` 는 없어 DB 에 0 이 덮이지 않는다 | 그대로 — 나중에 업체 엔티티를 읽어 그대로 `save` 하는 코드가 생기면 이 점을 본다(객실 그룹 상세와 같은 성질) |
| 2 | Low | 테스트 데이터 | 이미 샘플 시드가 들어간 개발 DB 는 고정 ID 행을 건너뛰어 편의시설이 모두 없음으로 보인다 | 가이드 · 프론트 요청서에 적힘 — 새 DB 에서 넣거나 업체 관리자 화면에서 켠다 |

## Verdict
Pass — 차단할 문제 없음(Low 2건은 기록만).

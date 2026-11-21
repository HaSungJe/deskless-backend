# Review — main — 261122-2

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`
- Included features:
  - ① 내 예약 목록 상태 거르기(프론트 요청) — revision `reservation/reservation-booking-revision-261122-1`
  - ② 업체 검색 거리 제한 없음 · 추가정보 필터 + 필터 항목 API(사용자 요청) — revision `discovery/discovery-revision-261122-1`
- Change scope: 소스 · 테스트 · DTO(새 1) · 엔티티 파일 상수(스키마 변화 없음) · 문서(AGENTS.md · README · docs 2) · 프론트 수정 요청 2 · beaver 산출물(revision 2 · report 2 · 이 리뷰) — 35 경로, 삭제 없음

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | query 필드 snake(`reservation_state_id` · `detail_filter`), 코드 값 대문자(`ALL` · `EQ` · `GTE`), 새 라우트 kebab(`/room-group-detail-filter`), 새 DTO `DiscoveryRoomGroupDetailFilter…ResultDto` |
| Structure & layering | pass | controller 위임 한 줄(내부 · 게이트웨이), service 는 조건 · 검증만, 변환은 `discovery.util.ts`(private 헬퍼 없음), 동적 조립은 repository 빌더. 새 API 는 동기 · 가드 없음 — 형제 둘러보기 API 와 같다. 필터 정의는 상세 타입과 같은 엔티티 파일(jsonb 규칙 — 기본값 상수와 같은 자리) |
| Shared logic extraction | pass | 개수 조건은 기존 `countReservations(FindOptionsWhere)` 재사용(새 repository 메서드 없음), 그룹 노출 기준은 기존 `GROUP_HAS_BOOKABLE_ROOM_SQL` 재사용 + `GROUP_ON_SALE_SQL`(`isRoomGroupPlanOnSale` 과 같은 기준) |
| Errors & responses | pass | 검증 실패 모양 그대로 — DTO `@IsIn` · `@Matches`(게이트웨이), 정의에 없는 항목은 service 400 + `createValidationError('detail_filter', …)`(형제 manager.service.ts). 메시지는 DTO 리터럴 · service 상수(`DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE`) |
| Data layer | pass | 엔티티 파일에 상수 · 인터페이스만(컬럼 변화 없음 — `db:check` 일치, 마이그레이션 없음). 소프트 삭제 조건(`"g"."is_deleted" = 0` · 호실 `is_deleted`) 붙음. JSON 항목 키 · 기본값 · 비교 값은 파라미터(SQL 에 문자열 끼워 넣기 없음), 키는 `CAST(… AS text)` |
| Test strength | pass | 호출 횟수 · 인자(개수 · 목록 같은 조건, 필터 조건 객체 전체) · 미호출(검증 실패) · 응답 `toEqual`. **Data-Access Smoke** — 내 예약 상태 거르기 SQL(기존 목록 SQL + 조건) · 내 예약 수 상태 같음(관계 컬럼) · 반경 업체 거리 제한 없음 · 추가정보 EXISTS SQL 고정, 기존 반경 SQL 한 글자도 그대로. 새 API spec 은 항목 집합이 상세 기본값의 키와 같은지까지 |

## Intended Behavior Check (against plan/spec)
- ① query `reservation_state_id`(5개 값) — 개수 `dto.reservation_state_id ?? Not(EXPIRED)` · 목록 같은 상태, `EXPIRED` 는 고를 수 없고 늘 빠짐, 정렬 · 상세 그대로. 프론트 질문 2개의 답(만료 처리 최대 약 1분 · 개발 환경 scheduler 없음 / 정렬 그대로)을 수정 요청 문서에 실었다.
- ② `radius_km=ALL` → 반경 · 사각형 null(조건 없음), `detail_filter` → 정의 순서 · 중복 제거 · 조건(EQ · GTE) + 기본값, 한 그룹이 모두 갖춤 · 이용자에게 보이는 그룹만. 필터 항목 API 는 정의를 그대로(repository 미호출). 정의를 `Record<keyof RoomGroupDetail, …>` 로 두어 항목 추가 때 typecheck 가 정의를 강제한다 — DTO · 화면은 그대로.
- 사용자 확인: 재시작 뒤 업체 검색(거리 제한 없음 · 추가정보) 정상(2026-11-22 — "재시작하니 잘되네").
- README · AGENTS.md · docs 같은 변경에서 갱신. 검사: typecheck 0 · lint 0 · `db:check` 일치 · build(네 앱) · `npm test` 124 파일 1,376건 · prettier.
- 메모리(frontend): 공개 API 가 바뀐 ① ② 모두 수정 요청 문서 + 목록 줄 — 빠진 것 없음. 팝업 체크박스 안내는 사용자 요청이라 실었다(배치 · 디자인은 쓰지 않음).
- 메모리 reconcile: `AGENTS.md 반영: 미반영` 항목 없음.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `apps/user-service/src/discovery/repositories/discovery.repository.ts` `buildStoreRowsQuery` | 거리 제한 없음(ALL)은 사각형 인덱스를 못 써 활성 업체 전체의 거리 · 서브쿼리를 계산한다(LIMIT 301) | 지금 업체 수에서는 문제없음 — 업체가 많아지면 측정 뒤 다시 본다(revision 결정에 적음) |
| 2 | Info | `libs/database/src/entities/room/room-group.entity.ts` `ROOM_GROUP_DETAIL_FILTERS` | 숫자 항목(방 개수)은 체크박스 1개라 기준 값 하나("방 2개 이상")로 고정 — 쓰리룸 이상 같은 단계 선택은 없다 | 필요해지면 정의만 바꾼다(체크박스 이름 · 값) |
| 3 | Info | 배포 | gateway(검증 · 새 경로) · user-service(조회) 둘 다 새 이미지, user-service 먼저 — 사용자가 이미 재시작해 확인함. 마이그레이션 없음 | 운영 반영 때도 같은 순서 |

## Verdict
Pass — 코드 변경이 필요한 문제 없음(Low 1 · Info 2 는 운영 안내). 커밋 진행.

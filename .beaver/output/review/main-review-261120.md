# Review — main — 261120

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`
- Included features:
  - ① 문 열림 · 닫힘 상태 없앰 + 문마다 마지막으로 연 시각 + 소켓 잠금 알림 삭제 — revision `door/door-state-revision-261119-1`(1차 · 추가 결정)
  - ② 업체 관리자 바로 열기도 문 열림 기록 — 같은 revision 추가 결정 2(엔티티 · 마이그레이션)
  - ③ 객실 그룹 상세 `price_count` · `room_count` · `rooms`, 호실 목록 `floors`(프론트 요청) — revision `room/room-manage-revision-261120-1`
- Change scope: 소스 · 테스트 · DTO · 엔티티 · 마이그레이션 1 · 문서(AGENTS.md · README · docs 6) · 프론트 수정 요청 2 · beaver 산출물(revision 2 · report 3) — 49 경로, 삭제 2(`door-close.dto.ts` · `door-close.spec.ts`)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | Redis 키 `door-opened:<room_id>` · 포트 `getOpenedAt` · 연 방법 `open_type`/`DOOR_OPEN_TYPE`(`QR` · `MANAGER`) · repository 는 소유 도메인 어휘(`insertRoomDoorOpenLog` · `findRoomGroupRooms` · `findRoomFloors`) · 응답 필드 snake(`door_opened_at` · `price_count` · `room_count` · `floors`) |
| Structure & layering | pass | 문 정보는 포트(`DOOR_STORE`) 뒤 Redis 어댑터만, service 는 포트 · repository 만. admin-service room 이 t_door_open_log 를 room 어휘로 insert(도메인 간 데이터 접근 규칙). 바로 열기는 동기 + `@Transactional()` + 기록 insert — 형제 문 소켓 QR 확인과 같은 모양. 서버 명령은 연 시각 쓰기와 같은 Lua 에서 PUBLISH |
| Shared logic extraction | pass | `toDoorTime` 하나를 두 서비스가 같이 씀(1차에서 지웠다가 되살림), 변환은 util(`toRoomGroupRoomItem` · `toRoomListItem`) — service private 헬퍼 없음 |
| Errors & responses | pass | 실패 모양 그대로(404 · 400 · 503), 응답 필드 없을 때 null(`door_opened_at`), Redis 503 은 바로 열기 기록까지 롤백 |
| Data layer | pass | 엔티티 — nullable FK 는 RESTRICT, 조합은 CHECK `CHK_DoorOpenLog_OpenType`, 코드 값 컬럼은 룩업 없이 주석(docs/data-layer.md 에 추가). 마이그레이션 `db:generate` 결과(down 인덱스 칸 순서만 원래대로 손봄) · `db:check` 일치 |
| Test strength | pass | 호출 횟수 · 인자(기록 엔티티 컬럼 · `toBeInstanceOf`) · 순서(기록 → 명령) · 미호출(404) · 응답 `toEqual`. 문 시각 `[CASES:toDoorTime]` 5건 유지. **Data-Access Smoke** — 새 · 바뀐 쿼리 셋(그룹 상품 `price_count` 서브쿼리 · 그룹 호실 관계 필드 where · 층 DISTINCT) SQL 고정 + 별칭 키, `findRoomFloors` 숫자 변환. libs 어댑터(Redis Lua)는 규약대로 spec 없음 |

## Intended Behavior Check (against plan/spec)
- ① Redis 는 `door-qr`(현재 QR) + `door-opened`(마지막으로 연 시각, 한국 시각 yyyyMMddHHmmss) 둘. QR 확인이 맞을 때 · 바로 열기 때만 연 시각이 바뀌고 닫기는 없다. 소켓 `door.closed` · 내부 `/door/close` 삭제, 스냅샷은 호실만(Redis 안 봄). 호실 목록 `door_opened_at`, 바로 열기 `{room_id, door_opened_at}` — 프론트 수정 요청 `changes/2026-11-19-door-state-removed.md`(프론트와 함께 배포).
- ② 바로 열기 → 기록(MANAGER · 업체 관리자 · 시각) → Redis. QR 기록은 `QR` 명시. 공개 API 변화 없음.
- ③ 응답 값 셋 — 프론트 수정 요청 `changes/2026-11-20-room-group-detail-floors.md`.
- README · AGENTS.md · docs 같은 변경에서 갱신. 검사: typecheck 0 · lint 0 · `db:check` 일치 · build(네 앱) · `npm test` 123 파일 1,361건 통과(build 회차).
- 메모리(frontend): 공개 API 가 바뀐 ①③ 은 수정 요청 문서 + 목록 줄 있음, ② 는 공개 API 변화 없음 — 빠진 것 없음.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `apps/user-service/src/door/door.service.ts` `verifyStoreDoor` | QR 확인은 Redis(비교 + 연 시각 쓰기)가 먼저, 기록 insert 가 뒤다 — insert 가 실패하면 연 시각은 바뀌었는데 기록이 없다(바로 열기는 반대 순서라 롤백된다). QR 비교가 먼저여야 하는 흐름이라 순서를 바꿀 수 없다 | 그대로 둔다 — 연 시각은 표시용이고, DB 실패면 문 프로그램에도 오류가 가 문이 열리지 않는다 |
| 2 | Low | 운영(Redis) | 옛 `door:*` 키가 남는다 — 코드는 읽지 않는다 | 사용자 몫 정리 — docs/guides/redis-setup.md 3절에 방법 적음 |
| 3 | Info | 배포 순서 | 마이그레이션(`1795050011114-DoorOpenLogManager`) 이 있고, ①의 응답 변화는 프론트와 함께 나가야 한다 | `npm run docker:user-service`(마이그레이션) 먼저 → 나머지 앱. 프론트 반영과 맞춘다 |

## Verdict
Pass — 코드 변경이 필요한 문제 없음(Low 2 · Info 1 은 운영 안내). 커밋 진행.

# Report — door-state

## Feature Summary
- **Feature**: 문 상태(Phase 14 재정의) — 호실 문마다 QR 정보 · 열림/닫힘 · 마지막 시각을 Redis 에 두고(`door:<room_id>` = `QR:open|close:yyyyMMddHHmmss`, 기록 없음 `00000000000000`, `door-qr:<QR>` = room_id), 문 쪽 타 업체 프로그램이 부르는 문 열기(QR) · 문 닫기 API 2개를 만든다. Redis 를 Docker 묶음으로 관리하고 실행 가이드를 정리했다. 기기 제어(`t_device*` · `DeviceGateway`)는 하지 않는다(사용자 결정 2026-11-01).
- **Entry point**: `POST /api/v1/user-service/door/open` · `POST /api/v1/user-service/door/close` (게이트웨이 동기 — 인증 없음) → user-service `/internal/v1/user-service/door/open` · `/close`
- **Domain**: door (user-service 새 도메인) + `libs/integration` Redis 연결 · 문 정보 포트 `DOOR_STORE` (로드맵 Phase 14 — #107 · #108 · #109)
- **Plan**: [door-state-plan.md](../../plan/door/door-state-plan.md) · **Spec**: [door-state-spec.md](../../spec/door/door-state-spec.md)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `compose.redis.yml` | created | Redis 8 묶음 — AOF(`appendonly yes` · 매초) · 비밀번호(`REDIS_PASSWORD`) · `deskless-data` · 127.0.0.1:6379 · 볼륨 `deskless-redis-data` · healthcheck |
| `package.json` · `package-lock.json` | modified | 의존성 `redis`(node-redis 6.3.1), `docker:redis`, `docker:infra` · `docker:down` 에 redis |
| `compose.user-service.yml` | modified | `REDIS_URL` 필수 전달, `REDIS_PASSWORD` 빈 값, 네트워크 주석 |
| `compose.admin-service.yml` · `compose.scheduler.yml` · `compose.gateway.yml` | modified | 쓰지 않는 `REDIS_URL` · `REDIS_PASSWORD` 빈 값 |
| `scripts/docker-network.mjs` | modified | `deskless-data` 용도에 redis(· admin-service · scheduler), 머리 주석 |
| `.env.example` | modified | Redis 절 — `REDIS_PASSWORD` · `REDIS_PORT` · `REDIS_URL` |
| `libs/integration/src/integration.symbols.ts` · `integration.constants.ts` · `interfaces/integration.interface.ts` | modified | `DOOR_STORE`, `REDIS_UNAVAILABLE_MESSAGE` · `DOOR_QR_ISSUE_FAILED_MESSAGE` · `DOOR_STATE` · `DOOR_TIME_NONE` · `DOOR_QR_ISSUE_ATTEMPTS`, `DoorState` · `DoorRecord` · `DoorStoreInterface` |
| `libs/integration/src/redis/redis.connection.ts` · `redis.module.ts` | created | `RedisConnection`(부팅을 막지 않는 연결 · `disableOfflineQueue` · 준비 전 503 · `error` 리스너) · `RedisModule`(전역) |
| `libs/integration/src/door/redis-door.store.ts` · `door-store.module.ts` | created | `RedisDoorStore`(Lua 3개 — 열기 · 닫기 · QR 발급 `SET NX`, 실패 503) · `DoorStoreModule`(전역, RedisModule 포함) |
| `libs/contracts/src/door/door.commands.ts` · `dto/door-open.dto.ts` · `dto/door-close.dto.ts` | created | `DOOR_INTERNAL_PATH`(명령 없음), `DoorOpenDto` · `DoorOpenResultDto` · `DoorCloseDto` |
| `apps/user-service/src/door/` (symbols · util · interfaces · repositories · service · controllers · module) | created | `toDoorTime`(dayjs 한국 시각) · `DoorRepository.findDoorRoom`(t_room, `notDeleted`) · `DoorService.openDoor` · `closeDoor` · 내부 HTTP 2개 |
| `apps/user-service/src/user-service.module.ts` | modified | `DoorStoreModule` · `DoorModule` |
| `apps/gateway/src/api/v1/user-service/door/` (module · controllers) · `apps/gateway/src/gateway.module.ts` | created · modified | 공개 라우트 2개(가드 없음 · Swagger `문`) · `DoorModule` 등록 |
| `apps/user-service/src/door/test/` (helper · door-open · door-close · door.repository spec) | created | 28건 |
| `docs/guides/redis-setup.md` | created | 로컬 · 가상 운영(Docker) · 실제 운영(ElastiCache — 클러스터 모드 끔 · TLS · 백업) · 저장 모양 확인 · 문제 해결 |
| `README.md` | modified | 실행 절 정리(준비 → 전체 실행 8단계 → 로컬 개발 → 운영으로 옮길 때), 문 API · Redis 설명, 스택, 구조, 명령 표 |
| `docs/integration.md` · `docs/architecture.md` · `AGENTS.md` | modified | Redis · `DOOR_STORE` 절 · 실패 계약, door 도메인 · 전역 모듈, Docker 묶음 7개 · 네트워크 · 쓰지 않는 비밀값, 인증 없는 공개 라우트 |
| `.beaver/output/spec/door/door-state-spec.md` · `.beaver/output/plan/door/door-state-plan.md` | modified | 로드맵 변경(QR 발급 첫 사용처 Phase 15 #112) 반영, plan 코드 블록을 실제 파일과 맞춤 |

## Tests Written
- `door-open.spec.ts` — `[SUCCESS]` store.open(QR, 시각) 1회 · 응답 · 호실 조회 · 닫기 · 발급 미호출 / `[CASES:toDoorTime]` 5개(다음 날 · 09시 · 연도 경계 · 밀리초 버림 · 윤년) / `[FAIL:service]` 404(validation_errors null) · Redis 503 / `[FAIL:validation]` 4개(없음 · 대문자 · 31자 · hex 아님) / `[FAIL:internal]` 403 · 포트 미호출
- `door-close.spec.ts` — `[SUCCESS]` findDoorRoom({room_id}) · store.close(room_id, 시각) · 빈 본문 / `[CASES:toDoorTime]` 5개 / `[FAIL:service]` 호실 없음 404 → close 미호출 · Redis 503 / `[FAIL:repository]` 조회 500 → close 미호출 / `[FAIL:validation]` 3개 / `[FAIL:internal]` 403
- `door.repository.spec.ts` — `findDoorRoom` 이 `is_deleted: 0` · `loadRelationIds` 를 붙임, DB 실패 통일 500
- 어댑터(`RedisConnection` · `RedisDoorStore`) spec 은 두지 않는다(plan 테스트 생략 — docs/integration.md). Smoke 해당 없음(단순 findOne).

## Verification
- `npm run typecheck` · `npm run lint` · `npm run build`(4개 앱) · `npm run db:check`(엔티티 변경 없음) 통과, 새 코드 Prettier 적용.
- 테스트(AGENTS 허용 범위의 확인 실행): door 3파일 28건, 전체 83파일 746건 통과.
- compose 5개 문법 — `docker compose --env-file <빈 필수값만 채운 .env.example 사본> -f <파일> config --quiet` 통과(`.env` 값은 출력하지 않음). Redis command · healthcheck 의 `$$REDIS_PASSWORD` 가 컨테이너 셸 변수로 남는 것 확인.
- Lua 스크립트 3개를 소스에서 그대로 꺼내 Lua VM(fengari — scratch 전용, 커밋 안 함)에서 가짜 `redis.call`(GET · SET NX · DEL)로 실행 — 16/16: 색인 없음 nil · 기록 없는 문 발급(close · 00000000000000) · 열기(room_id · QR 보존) · 닫기(QR 보존 · 기록 없음은 QR 없이) · 재발급(이전 색인 삭제 · 상태 · 시각 보존 · 이전 QR 로 못 엶) · 충돌 0(변화 없음) · QR 없는 기록 발급(빈 색인 키 안 건드림).
- plan 과 다른 점: `RedisClient` 타입을 `ReturnType<typeof createClient>` 대신 클라이언트를 만드는 함수(`buildClient`)에서 얻는다 — node-redis 6 의 기본 RESP3 제네릭과 맞추기 위해. RESP3 에서 Lua `false` 는 `false` 로 오지만 `open` 의 `typeof room_id === 'string'` 판정이 그대로 null 로 바꾼다.

## Remaining Issues
- 사용자 — 배포 때 `.env` 에 `REDIS_PASSWORD` · `REDIS_URL` 을 넣고 `npm run docker:redis`(또는 `docker:infra`) → user-service 묶음 다시 띄우기. user-service compose 는 이제 `REDIS_URL` 이 없으면 뜨지 않는다. 로컬 실행은 hosts 에 `127.0.0.1 redis`.
- 실제 Redis 동작 확인은 사용자 몫 — [docs/guides/redis-setup.md](../../../../docs/guides/redis-setup.md) 3절(키를 직접 넣고 문 열기 · 닫기 호출). QR 발급은 Phase 15 #112 전까지 부르는 곳이 없다.
- 인증 없는 API 위험(spec Notes): 찍어 둔 QR 은 새로 발급되기 전까지 유효, 닫기는 누구나 아무 호실이나 닫힘 표시 가능(상태만). 남용이 보이면 문 쪽 프로그램 키를 붙인다.

## Modification - 261119-1

### Change summary
문 열림 · 닫힘 상태를 없애고 문마다 **마지막으로 연 시각**만 둔다(사용자 결정 2026-11-19 — revision `.beaver/output/revision/door/door-state-revision-261119-1.md`, door-state · door-manage 를 같이 고친다).
- Redis: `door:<room_id>`(`open|close:시각`) → 쓰지 · 읽지 않는다. `door-qr:<room_id>`(현재 QR) 그대로 + **`door-opened:<room_id>`** = 마지막으로 연 시각(한국 시각 `yyyyMMddHHmmss`, 만료 없음).
- 문 소켓: 잠금 알림 `door.closed` · 내부 `POST /internal/v1/user-service/door/close` 삭제(보내면 `error` 400). 스냅샷은 `{room_id, room_name, floor}` 만(Redis 를 보지 않는다). QR 확인은 같으면 연 시각까지 Lua 1개, 응답 그대로.
- 업체 관리자: 호실 목록 `door_state` · `door_changed_at` → **`door_opened_at`**(MGET, 없으면 null). 바로 열기 → 연 시각 쓰기 + 열기 명령 Lua 1개, 응답 **`{room_id, door_opened_at}`**.
- 포트: `getMany` · `close` · `DoorState` · `DoorRecord` · `DOOR_STATE` · `DOOR_TIME_NONE` 삭제, `getOpenedAt` 추가, `verify(room_id, qr, opened_at)` · `open(room_id, store_id, opened_at)`. `toDoorTime` 은 그대로(연 시각 형식).

### Changed files
| File | Change Type | Description |
|------|-----------|------|
| `libs/integration/src/door/redis-door.store.ts` · `interfaces/integration.interface.ts` · `integration.constants.ts` · `integration.util.ts` | modified | 문 상태 키 · 읽기 · 닫기 삭제, 연 시각 키 · MGET · Lua 2개(QR 확인 + 연 시각, 연 시각 + 열기 명령) |
| `libs/contracts/src/door/door.commands.ts` · `dto/door-snapshot.dto.ts` · `dto/door-verify.dto.ts` | modified | `door.closed` · `/close` 삭제, 스냅샷 항목에서 문 상태 삭제, 설명 |
| `libs/contracts/src/door/dto/door-close.dto.ts` | deleted | 잠금 알림 |
| `libs/contracts/src/room/dto/room-list.dto.ts` · `room-door-open.dto.ts` | modified | `door_opened_at` · 바로 열기 결과 `{room_id, door_opened_at}` |
| `apps/user-service/src/door/door.service.ts` · `door.util.ts` · `controllers/door.controller.ts` | modified | 스냅샷 Redis 안 봄 · QR 확인에 연 시각 · 잠금 알림 삭제 |
| `apps/admin-service/src/room/room.service.ts` · `room.util.ts` · `controllers/room.controller.ts` | modified | 목록 연 시각 · 바로 열기 연 시각 |
| `apps/gateway/src/modules/door-socket/door-socket.server.ts` · `door-socket.util.ts` · `api/v1/admin-service/room/controllers/room.controller.ts` | modified | 소켓은 `door.verify` 만 받음 · 바로 열기 Swagger 응답 |
| `apps/user-service/src/door/test/door-close.spec.ts` | deleted | 기능 삭제 |
| `apps/user-service/src/door/test/door-snapshot.spec.ts` · `door-verify.spec.ts` · `door.test-helper.ts` · `apps/admin-service/src/room/test/room-list.spec.ts` · `room-door-open.spec.ts` · `room.test-helper.ts` · `apps/admin-service/src/store/test/store.test-helper.ts` | modified | 문 상태 단언 → 연 시각, mock `getMany` · `close` → `getOpenedAt` |
| `docs/realtime.md` · `docs/integration.md` · `docs/guides/redis-setup.md` · `docs/architecture.md` · `AGENTS.md` · `README.md` | modified | 문 정보 = 현재 QR + 마지막으로 연 시각, 소켓 규격(잠금 알림 없음 · 스냅샷 모양), 옛 `door:*` 키 정리 방법 |
| `.beaver/output/frontend/changes/2026-11-19-door-state-removed.md` · `changes/README.md` | created · modified | 프론트 수정 요청 — M4 호실(프론트와 함께 배포) |

### Tests written
- door-snapshot — 결과 `{room_id, room_name, floor}` 만, 문 저장소를 부르지 않는다(실패 사례도 그대로).
- door-verify — `verify(room_id, qr, 한국 시각)` 1번(기존 사례 그대로 — 같으면 열림 기록 insert · 다르면 없음 · 503).
- door-close — 삭제.
- room-list — 기본 목록 `door_opened_at: null` · 그 페이지 호실을 한 번에 읽어 같은 순서로 `['20261104093012', null]` · 문 상태 필드 없음 · 빈 페이지 `getOpenedAt([])` · Redis 503.
- room-door-open — 응답 `{room_id, door_opened_at}` · `open(room_id, store_id, 시각)` · `[CASES:toDoorTime]` 5건(사용자 결정 2026-11-01 — 1차에서 지웠다가 되살림) · 404 · 400.
- 새 repository 메서드 없음 → 쿼리 스모크 변경 없음.

### Verification
- `npm run typecheck` 0건 · `npm run lint` 경고 0 · prettier(바꾼 파일) · `npm run build`(네 앱) 통과, `npm test` 123 파일 · 1,351건 통과(door-close 파일이 빠져 파일 수가 하나 줄었다).
- 남은 흔적 grep — `DOOR_STATE` · `DOOR_TIME_NONE` · `DoorRecord` · `door.closed` · `door/close` · `door_state` · `door_changed_at`(검증 단언 1곳 제외) 0건.
- Lua 두 개는 커밋돼 있던 스크립트와 같은 모양(비교 후 SET · SET 후 PUBLISH)에 값만 시각으로 — 실제 Redis 로는 돌려 보지 않았다(서버 · Redis 기동은 사용자 몫).

### Remaining issues
- 배포 — 프론트와 함께(호실 목록 · 바로 열기 응답 모양이 바뀐다). user-service · admin-service · gateway 새 이미지, 마이그레이션 없음.
- 문 쪽 프로그램 — `door.closed` 를 보내던 구현이 있다면 지워야 한다(이제 `error` 400). 스냅샷 항목에 문 상태가 없다. 규격 원본은 docs/realtime.md.
- 옛 `door:*` 키는 Redis 에 남아도 무해하다 — 지우는 방법은 docs/guides/redis-setup.md 3절(사용자 몫).

### Modification - 261119-1 추가 결정 2 — 바로 열기도 문 열림 기록
- `t_door_open_log` — `open_type`(`QR` · `MANAGER`, 기존 행 기본 `QR`) · `user_id`(바로 열기 한 업체 관리자, nullable FK RESTRICT) 추가, `reservation_id` · `room_qr_id` nullable(FK CASCADE → RESTRICT), CHECK `CHK_DoorOpenLog_OpenType`. 마이그레이션 `1795050011114-DoorOpenLogManager.ts`(`npm run db:generate` 결과 — down 의 인덱스 칸 순서만 원래대로 고침), `npm run db:check` 일치. 적용은 사용자.
- admin-service `openMyRoomDoor` — `@Transactional()`, 기록 insert(MANAGER · 업체 관리자 · 연 시각) → Redis 연 시각 + 열기 명령(마지막 단계 — 503 이면 롤백). room repository `insertRoomDoorOpenLog`(room 어휘, 통일 500). user-service QR 확인 기록은 `open_type: 'QR'` 명시.
- 테스트 — room-door-open: 기록 insert 1번(DoorOpenLogEntity · MANAGER · 업체 관리자 · 예약 · QR null · 시각) → open 순서, 404 면 기록 없음, Redis 503 → 503(기록 insert 는 불림 · 롤백). door-verify: 기록에 `QR` · user_id null. room.repository: insert 그대로 · 통일 500.
- 검증 — typecheck 0 · lint 0 · `db:check` 일치 · build · `npm test` 123 파일 · 1,354건 통과.
- 공개 API 변화 없음(프론트 수정 요청 대상 아님). 조회 API 는 여전히 없다.

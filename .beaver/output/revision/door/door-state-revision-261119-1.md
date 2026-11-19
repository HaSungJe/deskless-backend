# Revision — 문 상태 없애기(현재 QR 만) — 261119-1

> Change plan for an existing feature. The original spec.md / plan.md are not modified, only referenced.
> 원래 문서: `.beaver/output/spec/door/door-state-spec.md` · `plan/door/door-state-plan.md`(문 소켓 · 문 상태) · `spec/door/door-manage-spec.md` · `plan/door/door-manage-plan.md`(업체 관리자 문 상태 · 바로 열기). 이 revision 이 두 기능을 같이 고친다.

## Reason for Change Request
문 상태(Redis `door:<room_id>` = `open|close:시각`)는 실제 문을 비추지 못한다 — `open` 은 문이 열린 때가 아니라 서버가 "열어도 됨"을 답한 때, `close` 는 문 프로그램이 잠금 알림을 보낼 때만 바뀐다. 문을 여는 판단은 현재 QR(`door-qr:<room_id>`) 비교만으로 끝나고, QR 로 연 기록은 DB `t_door_open_log` 에 따로 남는다. 그래서 문 상태를 없애고 문 정보는 현재 QR 만 둔다(사용자 결정 2026-11-19 — "없애고 프론트에 전달할 문서 만들어줘").

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| Redis 문 정보 | `door:<room_id>` = `open\|close:yyyyMMddHHmmss` + `door-qr:<room_id>` = 현재 QR | **`door-qr:<room_id>` 만**(그대로). `door:` 키는 쓰지도 읽지도 않는다 |
| 업체 관리자 호실 목록 `GET /api/v1/admin-service/room` | 항목마다 `door_state` · `door_changed_at`(Redis MGET) | **두 필드 삭제** — Redis 를 보지 않는다(Redis 가 없어도 목록이 뜬다) |
| 바로 열기 `POST /api/v1/admin-service/room/:room_id/door-open` | `open` 기록 + 열기 명령, 200 `{room_id, door_state, door_changed_at}` | **열기 명령만**(Redis 채널 `door-commands` PUBLISH), **200 · 본문 없음**(돌려줄 것이 없는 기능은 ResultDto 없음 — AGENTS.md). 실패(404 · 401 · 503)는 그대로 |
| 문 소켓 접속 `door.snapshot` | `{store_id, list: [{room_id, room_name, floor, door_state, door_changed_at}]}` | `{store_id, list: [{room_id, room_name, floor}]}` — 문 프로그램이 업체 호실을 알기 위한 목록만. Redis 를 보지 않는다 |
| 문 소켓 QR 확인 `door.verify` → `door.verified {room_id, ok}` | 현재 QR 과 같으면 `open` 기록(Lua) + 열림 기록 DB | 현재 QR 과 같은지 비교만(GET) + 열림 기록 DB(그대로). 응답 모양 그대로 |
| 문 소켓 잠금 알림 `door.closed` | 문 프로그램 → 서버, `close` 기록 | **삭제** — 보내면 다른 모르는 메시지와 같이 `error {status_code: 400, message: '처리할 수 없는 메시지입니다.'}`(연결 유지) |
| 내부 HTTP `POST /internal/v1/user-service/door/close` | 잠금 알림 처리 | **삭제** |
| 바로 열기 기록 | Redis 문 상태에만 | 없음 — 문 열림 기록(`t_door_open_log`)은 QR 로 연 것만(기존 결정 그대로) |

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `libs/integration/src/door/redis-door.store.ts` | modify | `door:` 키 · `getMany` · `close` · 열림 쓰기 Lua 2개 · `parseDoorValue` 삭제, `verify` = GET 비교, `open` = PUBLISH |
| `libs/integration/src/interfaces/integration.interface.ts` | modify | `DoorState` · `DoorRecord` · `getMany` · `close` 삭제, `verify(room_id, qr)` · `open(room_id, store_id)` |
| `libs/integration/src/integration.constants.ts` · `integration.util.ts` | modify | `DOOR_STATE` · `DOOR_TIME_NONE` · `toDoorTime`(+ `DOOR_TIME_FORMAT`) 삭제 — 쓰는 곳이 없어진다 |
| `libs/contracts/src/door/door.commands.ts` | modify | `DOOR_SOCKET_EVENT.CLOSED` · `DOOR_INTERNAL_PATH.CLOSE` 삭제, 설명 고침 |
| `libs/contracts/src/door/dto/door-close.dto.ts` | delete | 잠금 알림 DTO |
| `libs/contracts/src/door/dto/door-snapshot.dto.ts` · `door-verify.dto.ts` | modify | 스냅샷 항목의 `door_state` · `door_changed_at` 삭제, 설명 고침 |
| `libs/contracts/src/room/dto/room-list.dto.ts` · `room-door-open.dto.ts` | modify | 목록 항목 두 필드 삭제, `RoomDoorOpenResultDto` 삭제 |
| `apps/user-service/src/door/door.service.ts` · `door.util.ts` · `controllers/door.controller.ts` | modify | 스냅샷 Redis 안 봄 · QR 확인 2인자 · `closeStoreDoor` 와 `/close` 삭제 |
| `apps/user-service/src/door/test/door-close.spec.ts` | delete | 기능 삭제 |
| `apps/user-service/src/door/test/door-snapshot.spec.ts` · `door-verify.spec.ts` · `door.test-helper.ts` | modify | 문 상태 단언 · mock 정리 |
| `apps/admin-service/src/room/room.service.ts` · `room.util.ts` | modify | 목록 Redis 안 봄 · 바로 열기 void |
| `apps/admin-service/src/room/test/room-list.spec.ts` · `room-door-open.spec.ts` · `room.test-helper.ts` · `apps/admin-service/src/store/test/store.test-helper.ts` | modify | 문 상태 단언 · mock 정리 |
| `apps/gateway/src/api/v1/admin-service/room/controllers/room.controller.ts` | modify | 바로 열기 `Promise<void>` · `@ApiOkResponse` 없음 |
| `apps/gateway/src/modules/door-socket/door-socket.server.ts` · `door-socket.util.ts` | modify | `door.closed` 처리 · 타입 삭제, 설명 고침 |
| `docs/realtime.md` · `docs/integration.md` · `docs/guides/redis-setup.md` · `docs/architecture.md` · `AGENTS.md` · `README.md` | modify | 문 정보 = 현재 QR 만, 소켓 규격(잠금 알림 없음 · 스냅샷 모양) |
| `.beaver/output/frontend/changes/2026-11-19-door-state-removed.md` · `changes/README.md` | add · modify | 프론트 수정 요청 — M4 호실 |
| `.beaver/output/report/door/door-state-report.md` · `door-manage-report.md` | modify | `## Modification - 261119-1` |

## Code Changes

```ts
// libs/integration/src/door/redis-door.store.ts — after (요지 — 키는 door-qr 하나, 스크립트는 REVOKE 하나)
/** 현재 QR 키 접두 — `door-qr:<room_id>` = QR (만료 = 유효 종료) */
const DOOR_QR_KEY_PREFIX = 'door-qr:';

/** 현재 QR 지우기 — KEYS[1] `door-qr:<room_id>` / ARGV[1] QR. 값이 같을 때만 지운다. */
const REVOKE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/**
 * 문 정보 어댑터 — Redis. `door-qr:<room_id>` = 현재 QR(만료 = 유효 종료), 바로 열기 · 연결 끊기 명령은 채널 `door-commands`.
 * 문 상태(열림 · 닫힘)는 두지 않는다(사용자 결정 2026-11-19 — 실제 문을 비추지 못한다). QR 이력은 DB(t_room_qr), QR 로 연 기록은 DB(t_door_open_log).
 */
export class RedisDoorStore implements DoorStoreInterface {
    // setQr · revokeQr · disconnect · subscribe · run 그대로

    /**
     * QR 확인 — 그 호실의 현재 QR 과 같은지(쓰기 없음).
     */
    async verify(room_id: string, qr: string): Promise<boolean> {
        const current = await this.run('QR 확인', (client) => client.get(doorQrKey(room_id)));
        return current === qr;
    }

    /**
     * 바로 열기 — 그 업체 문 소켓에 열기 명령을 보낸다(상태 쓰기 없음).
     */
    async open(room_id: string, store_id: string): Promise<void> {
        const command: DoorCommand = {store_id, room_id, command: DOOR_COMMAND.OPEN};
        await this.run('바로 열기', (client) => client.publish(DOOR_COMMAND_CHANNEL, JSON.stringify(command)));
    }
}
// 삭제: DOOR_KEY_PREFIX · doorKey · VERIFY_SCRIPT · OPEN_SCRIPT · parseDoorValue · getMany · close
```

```ts
// libs/integration/src/interfaces/integration.interface.ts — DoorStoreInterface after (삭제: DoorState · DoorRecord · getMany · close)
    /**
     * QR 확인 — 그 호실의 현재 QR 이 qr 인지(쓰기 없음). 없거나 다르면 false.
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    verify(room_id: string, qr: string): Promise<boolean>;

    /**
     * 바로 열기 — 그 업체 문 소켓에 열기 명령(DoorCommand)을 보낸다.
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    open(room_id: string, store_id: string): Promise<void>;
```

```ts
// apps/user-service/src/door/door.service.ts — getDoorSnapshot after (② Redis 를 보지 않는다)
        // 2. 호실 (업체 전체 — 페이지 없음)
        const rows = await this.doorRepository.findStoreDoorRoomRows(store.store_id);
        return {store_id: store.store_id, list: rows.map(toDoorSnapshotItem)};
```

```ts
// apps/user-service/src/door/door.service.ts — verifyStoreDoor ③ after
        // 3. Redis 현재 QR 과 비교(쓰기 없음)
        const ok = await this.doorStore.verify(room.room_id, dto.qr);

        // 4. 맞으면 QR 로 연 기록 한 줄 — 호실 · 예약 · QR · 시각
        if (ok) {
            const log = new DoorOpenLogEntity();
            log.door_open_log_id = generateId();
            log.room_id = room.room_id;
            log.reservation_id = roomQr.reservation_id;
            log.room_qr_id = roomQr.room_qr_id;
            log.opened_at = new Date();
            await this.doorRepository.insertDoorOpenLog(log);
        }
        return {room_id: room.room_id, ok};
// 삭제: closeStoreDoor 전체 · DOOR_STATE · toDoorTime · DoorClose* import
```

```ts
// apps/user-service/src/door/door.util.ts — after
/**
 * 문 소켓 접속 항목 — 호실만(문 상태 없음).
 *
 * @param row 업체 호실 문 행
 * @returns 항목
 */
export function toDoorSnapshotItem(row: DoorRoomRow): DoorSnapshotItemResultDto {
    return {room_id: row.room_id, room_name: row.room_name, floor: Number(row.floor)};
}
```

```ts
// apps/admin-service/src/room/room.service.ts — getMyRooms ④ after
        // 3. count → Pagination → 목록
        const total_count = await this.roomRepository.countRooms(where);
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.roomRepository.findRoomRows(filter, pagination.limit, pagination.offset);
        return {list: rows.map(toRoomListItem), pagination: pagination.getPagination()};
```

```ts
// apps/admin-service/src/room/room.service.ts — openMyRoomDoor after
    /**
     * 호실 문 바로 열기 (업체 관리자) — 내 업체의 지워지지 않은 호실이면 그 업체 문 소켓에 열기 명령(door.open)을 보낸다(Redis 채널).
     * 실제 문은 문 쪽 프로그램이 연다 — 서버는 문 상태를 두지 않는다. 사용중지 · 예약 여부는 보지 않는다(관리자 판단). DB 쓰기가 없어 `@Transactional()` 이 없다. (내부 HTTP: POST /internal/v1/admin-service/room/:room_id/door-open)
     *
     * @param user_id 로그인 매니저 ID
     * @param room_id 호실 ID
     * @throws NotFoundException 소속 업체 · 호실이 없을 때
     */
    async openMyRoomDoor(user_id: string, room_id: string): Promise<void> {
        // 1. 내 업체 · 그 호실
        const store = await this.roomRepository.findManagerStore(user_id, false);
        if (!store) {
            throw new NotFoundException({message: ROOM_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const room = await this.roomRepository.findRoom({room_id, store_id: store.store_id});
        if (!room) {
            throw new NotFoundException({message: ROOM_NOT_FOUND_MESSAGE});
        }

        // 2. 열기 명령
        await this.doorStore.open(room.room_id, store.store_id);
    }
```

```ts
// apps/admin-service/src/room/room.util.ts — toRoomListItem after (door 인자 · door_state · door_changed_at 삭제)
export function toRoomListItem(row: RoomRow): RoomListItemResultDto {
    return {
        room_id: row.room_id,
        room_group_id: row.room_group_id,
        room_group_name: row.room_group_name,
        room_name: row.room_name,
        floor: Number(row.floor),
        room_state_id: row.room_state_id,
        room_state_name: row.room_state_name,
        created_at: dayjs(row.created_at).toISOString(),
    };
}
```

```ts
// apps/gateway/src/modules/door-socket/door-socket.util.ts — after
/** 문 프로그램이 보낸 메시지 — QR 확인만 */
export type DoorSocketRequest = {event: typeof DOOR_SOCKET_EVENT.VERIFY; room_id: string; qr: string};

// readDoorSocketRequest — door.verify {room_id, qr}(32자 hex)만, 아니면 null(→ error 400)
        if (message.event !== DOOR_SOCKET_EVENT.VERIFY) {
            return null;
        }
        const qr = message.data?.qr;
        return typeof qr === 'string' && ID_PATTERN.test(qr) ? {event: DOOR_SOCKET_EVENT.VERIFY, room_id, qr} : null;
```

```ts
// apps/gateway/src/modules/door-socket/door-socket.server.ts — handleMessage after
        try {
            const result = await this.internalHttp.request<DoorVerifyResultDto>('user', 'POST', DOOR_INTERNAL_PATH.VERIFY, {body: {store_id, room_id: request.room_id, qr: request.qr}});
            this.send(client, buildVerifiedMessage(result));
        } catch (error) {
            this.send(client, buildErrorMessage(toDoorSocketFailure(error)));
        }
```

```ts
// apps/gateway/src/api/v1/admin-service/room/controllers/room.controller.ts — 바로 열기 after (@ApiOkResponse 없음)
    async openMyRoomDoor(@PassportActor() actor: Actor, @Param() param: RoomDoorOpenParamDto): Promise<void> {
        await this.internalHttp.request<void>('admin', 'POST', ROOM_INTERNAL_PATH.doorOpen(param.room_id), {actor});
    }
```
admin-service 내부 controller 의 같은 핸들러도 `Promise<void>` 로.

## Test Cases
- `door-snapshot.spec` — 접속 성공 결과가 `{room_id, room_name, floor}` 만이고 `doorStore` 를 부르지 않는다(Redis 가 없어도 접속된다).
- `door-verify.spec` — `doorStore.verify(room_id, qr)` 2인자로 1번, 같으면 ok true + 열림 기록 insert, 다르면 ok false + insert 없음(기존 사례 그대로, 인자만).
- `door-close.spec` — 삭제(기능 삭제).
- `room-list.spec` — 항목에 `door_state` · `door_changed_at` 이 없고 `doorStore` 를 부르지 않는다.
- `room-door-open.spec` — `doorStore.open(room_id, store_id)` 2인자로 1번, 200 · 본문 없음, 업체 · 호실이 없으면 404 + 명령 없음, Redis 503 은 그대로.
- 새 데이터 접근 메서드 없음 → 쿼리 스모크 변경 없음.

## Decisions
- [x] 바로 열기 응답은 본문 없는 200 — 돌려줄 것이 없는 기능은 ResultDto 를 두지 않는다(AGENTS.md DTO 규칙). 내부 HTTP 클라이언트는 빈 본문을 `undefined` 로 받는다(`apps/gateway/src/modules/transport/internal-http.client.ts:84`).
- [x] 잠금 알림 `door.closed` 는 받지 않는다 — 문 프로그램이 보내면 모르는 메시지처럼 `error` 400(연결 유지). 문 프로그램 쪽 규격 안내는 docs/realtime.md 가 원본이다.
- [x] 문 소켓 스냅샷은 남긴다 — 문 프로그램이 업체의 호실 ID 를 알아야 QR 확인에 넣는다.
- [x] Redis 에 남아 있는 옛 `door:*` 키는 코드가 더 읽지 않아 그대로 둬도 된다. 지우는 것은 사용자 몫(Redis 관리 도구에서 `door:*` — `door-qr:*` 와 다르다).

## 추가 결정 — 마지막으로 연 시각 (사용자 결정 2026-11-19, 같은 회차)

열림 · 닫힘 상태는 그대로 없애되, **문마다 마지막으로 연 시각만 Redis 에 둔다**("소켓으로 문 닫기도 없애고, 열기만 냅두자. 문 마지막으로 연 시간은 있으면 좋겠어. 각 문마다. redis에"). 아래가 위 표보다 우선한다.

| Item | 위 표(1차) | 최종 |
|------|-----------|------|
| Redis 문 정보 | `door-qr:<room_id>` 만 | `door-qr:<room_id>` + **`door-opened:<room_id>` = 마지막으로 연 시각**(한국 시각 `yyyyMMddHHmmss` — 예전 문 시각과 같은 모양, `toDoorTime` 그대로, 만료 없음). 옛 `door:<room_id>` 와 이름이 달라 섞이지 않는다 |
| 연 시각을 쓰는 때 | — | 문 소켓 QR 확인이 맞을 때(비교와 쓰기를 Lua 1개로) · 업체 관리자 바로 열기(쓰기와 `door-commands` PUBLISH 를 Lua 1개로). 실제로 문이 열린 시각이 아니라 서버가 열기를 허락 · 명령한 시각이다 |
| 닫기 | 없음 | 없음(문 소켓 `door.closed` 없음 — 열기만) |
| 호실 목록 `GET /api/v1/admin-service/room` | 문 필드 없음 · Redis 안 봄 | `door_state` · `door_changed_at` 삭제, **`door_opened_at: string | null` 추가**(그 페이지 호실을 MGET 한 번 — 연 적 없으면 null). Redis 에 닿지 못하면 지금처럼 503 |
| 바로 열기 `POST …/:room_id/door-open` | 200 · 본문 없음 | **200 `{room_id, door_opened_at}`** — 그 줄의 연 시각을 바로 바꿀 수 있게 |
| 문 소켓 스냅샷 | `{room_id, room_name, floor}` | 그대로(연 시각은 넣지 않는다) |
| QR 확인 | GET 비교만 | 같으면 `door-opened` 쓰기까지 Lua 1개(비교 + 쓰기), 응답 `{room_id, ok}` 그대로 |

포트(`DoorStoreInterface`) 최종: `getOpenedAt(room_ids): Promise<(string | null)[]>` · `verify(room_id, qr, opened_at)` · `open(room_id, store_id, opened_at)` · `setQr` · `revokeQr` · `disconnect` · `subscribe`. `toDoorTime` · `[CASES:toDoorTime]`(사용자 결정 2026-11-01)은 남긴다 — 1차에서 지우려던 것을 되돌린다.

```ts
// libs/integration/src/door/redis-door.store.ts — 연 시각 키 · 스크립트
/** 마지막으로 연 시각 키 접두 — `door-opened:<room_id>` = 한국 시각 yyyyMMddHHmmss */
const DOOR_OPENED_KEY_PREFIX = 'door-opened:';

/** QR 확인 + 연 시각 — KEYS[1] door-qr · KEYS[2] door-opened / ARGV[1] QR · ARGV[2] 시각. 같을 때만 쓰고 1, 아니면 0 */
const VERIFY_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
return 1
`;

/** 바로 열기 — KEYS[1] door-opened / ARGV[1] 시각 · ARGV[2] 채널 · ARGV[3] 명령(JSON). 쓰기와 명령을 한 번에 */
const OPEN_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1])
redis.call('PUBLISH', ARGV[2], ARGV[3])
return 1
`;

    async getOpenedAt(room_ids: string[]): Promise<(string | null)[]> {
        if (room_ids.length === 0) {
            return [];
        }
        const values = await this.run('연 시각 조회', (client) => client.mGet(room_ids.map(doorOpenedKey)));
        return values.map((value) => (typeof value === 'string' ? value : null));
    }
```

```ts
// apps/admin-service/src/room/room.service.ts — openMyRoomDoor ② 최종
        // 2. 연 시각 + 열기 명령 (포트가 스크립트 1개로)
        const opened_at = toDoorTime(new Date());
        await this.doorStore.open(room.room_id, store.store_id, opened_at);
        return {room_id: room.room_id, door_opened_at: opened_at};
```

```ts
// apps/user-service/src/door/door.service.ts — verifyStoreDoor ③ 최종
        // 3. Redis 현재 QR 과 비교 + 같으면 연 시각 기록 (포트가 스크립트 1개로)
        const opened_at = new Date();
        const ok = await this.doorStore.verify(room.room_id, dto.qr, toDoorTime(opened_at));
```

테스트(최종): room-list — 그 페이지 호실을 한 번에 읽어 같은 순서로 `door_opened_at`(없으면 null) · 빈 페이지 · Redis 503 / room-door-open — 응답 `{room_id, door_opened_at}` · `open(room_id, store_id, 시각)` · `[CASES:toDoorTime]` 5건 / door-verify — `verify(room_id, qr, 시각)` / door-snapshot — 문 저장소를 부르지 않음 / door-close — 삭제.

## 추가 결정 2 — 바로 열기도 문 열림 기록에 남긴다 (사용자 요청 2026-11-19, 같은 회차)

"바로 열기도 기록 남겨줘" — 사용자 결정 2026-11-07(문 열림 기록은 QR 로 연 것만)을 바꾼다. 업체 관리자가 이용 중인 객실을 포함해 언제든 열 수 있으므로 누가 · 언제 열었는지 남긴다.

| Item | Before | After |
|------|--------|-------|
| `t_door_open_log` | QR 로 연 것만 — `reservation_id` · `room_qr_id` 필수 | QR · 바로 열기 모두. **`open_type`** varchar(10) NOT NULL DEFAULT `'QR'`(`QR`: 이용자 QR — 문 소켓 확인이 맞음, `MANAGER`: 업체 관리자 바로 열기 — 기존 행은 모두 QR 이라 기본값), **`user_id`** FK `t_user` nullable(바로 열기를 한 업체 관리자 — QR 은 null, 예약으로 이용자를 안다), `reservation_id` · `room_qr_id` → **nullable**(바로 열기는 null). 조합은 CHECK `CHK_DoorOpenLog_OpenType` 로 묶는다. nullable FK 라 `onDelete: 'RESTRICT'`(AGENTS.md FK 규칙) |
| 연 방법 값 | — | `DOOR_OPEN_TYPE = {QR: 'QR', MANAGER: 'MANAGER'}` — 엔티티 파일에서 export(룩업 없는 코드 값 컬럼 — docs/data-layer.md, `login_scope` · `file_storage` 선례). user-service(QR) · admin-service(MANAGER) 가 같이 쓴다 |
| 바로 열기 `openMyRoomDoor` | DB 쓰기 없음 · `@Transactional()` 없음 | **`@Transactional()`** — 기록 insert(호실 · MANAGER · 업체 관리자 · 연 시각) → Redis 연 시각 + 열기 명령(마지막 단계 — Redis 503 이면 기록도 롤백). 동기 경로 그대로(형제: 문 소켓 QR 확인도 동기 + 기록 insert — `apps/user-service/src/door/door.service.ts` `verifyStoreDoor`). 응답 `{room_id, door_opened_at}` 그대로 |
| admin-service room repository | — | `insertRoomDoorOpenLog(entity)` — t_door_open_log 를 room 어휘로(도메인 간 데이터 접근 규칙), 실패는 통일 500 |
| QR 확인 기록 | 연 방법 없음 | `open_type = 'QR'` 를 명시 |
| 조회 API | 없음 | 그대로 없음(요청 범위 밖 — 기록만) |
| 공개 API · 프론트 | — | 바뀌지 않는다(응답 · 실패 그대로) — 프론트 수정 요청 문서 대상 아님 |

```ts
// libs/database/src/entities/door/door-open-log.entity.ts — 더하는 것
/** 문을 연 방법 — QR: 이용자 QR(문 소켓 확인이 맞음), MANAGER: 업체 관리자 바로 열기 */
export const DOOR_OPEN_TYPE = {QR: 'QR', MANAGER: 'MANAGER'} as const;

@Check('CHK_DoorOpenLog_OpenType', `("open_type" = 'QR' AND "reservation_id" IS NOT NULL AND "room_qr_id" IS NOT NULL AND "user_id" IS NULL) OR ("open_type" = 'MANAGER' AND "user_id" IS NOT NULL AND "reservation_id" IS NULL AND "room_qr_id" IS NULL)`)

    @Column({name: 'open_type', length: 10, nullable: false, default: 'QR', comment: '연 방법(QR: 이용자 QR — 문 소켓 확인이 맞음, MANAGER: 업체 관리자 바로 열기)'})
    open_type: string;

    @ManyToOne(() => UserEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_DoorOpenLog_User'})
    user_id: string | null;
```

```ts
// apps/admin-service/src/room/room.service.ts — openMyRoomDoor 최종
    @Transactional()
    async openMyRoomDoor(user_id: string, room_id: string): Promise<RoomDoorOpenResultDto> {
        // 1. 내 업체 · 그 호실
        const store = await this.roomRepository.findManagerStore(user_id, false);
        if (!store) {
            throw new NotFoundException({message: ROOM_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const room = await this.roomRepository.findRoom({room_id, store_id: store.store_id});
        if (!room) {
            throw new NotFoundException({message: ROOM_NOT_FOUND_MESSAGE});
        }

        // 2. 문 열림 기록 — 누가(업체 관리자) · 언제 · 바로 열기
        const opened_at = new Date();
        const log = new DoorOpenLogEntity();
        log.door_open_log_id = generateId();
        log.room_id = room.room_id;
        log.open_type = DOOR_OPEN_TYPE.MANAGER;
        log.user_id = user_id;
        log.reservation_id = null;
        log.room_qr_id = null;
        log.opened_at = opened_at;
        await this.roomRepository.insertRoomDoorOpenLog(log);

        // 3. 연 시각 + 열기 명령 (마지막 단계 — Redis 503 이면 기록도 롤백)
        const door_opened_at = toDoorTime(opened_at);
        await this.doorStore.open(room.room_id, store.store_id, door_opened_at);
        return {room_id: room.room_id, door_opened_at};
    }
```

테스트(추가 결정 2): room-door-open — 기록 insert 1번(DoorOpenLogEntity · `MANAGER` · 업체 관리자 ID · 예약 · QR null · 연 시각) → `open` 순서, 404 면 기록 · 명령 없음, Redis 503 이면 503(기록 insert 는 불렸고 트랜잭션이 롤백) / door-verify — 기록에 `open_type: 'QR'` / room.repository — `insertRoomDoorOpenLog` 그대로 insert · 통일 500. 마이그레이션 `npm run db:generate -- DoorOpenLogManager` + `db:check`(적용은 사용자).

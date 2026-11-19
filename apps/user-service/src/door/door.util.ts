import type {DoorSnapshotItemResultDto} from '@app/contracts/door/dto/door-snapshot.dto.js';
import type {DoorRoomRow} from './interfaces/door.repository.interface.js';

/**
 * 문 소켓 접속 항목 — 호실만(문 상태는 두지 않는다 — 사용자 결정 2026-11-19).
 *
 * @param row 업체 호실 문 행
 * @returns 항목
 */
export function toDoorSnapshotItem(row: DoorRoomRow): DoorSnapshotItemResultDto {
    return {room_id: row.room_id, room_name: row.room_name, floor: Number(row.floor)};
}

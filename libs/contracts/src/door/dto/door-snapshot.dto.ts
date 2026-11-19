import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, Matches} from 'class-validator';

/**
 * 문 소켓 접속 확인 — gateway 가 업그레이드 요청 헤더(x-store-id · x-store-secret)로 만든다(내부 HTTP — 내부 토큰만).
 * 지워지지 않고 탈퇴하지 않은 업체 · 시크릿이 정해져 있고 bcrypt 가 맞아야 한다(아니면 401)
 */
export class DoorSnapshotDto {
    @ApiProperty({description: '업체 ID (32자)'})
    @Matches(/^[a-f0-9]{32}$/, {message: '업체 ID가 올바르지 않습니다.'})
    @IsNotEmpty({message: '업체 ID를 입력해주세요.'})
    store_id: string;

    @ApiProperty({description: '업체 문 시크릿 코드 (영문 · 숫자 16 ~ 64자)'})
    @Matches(/^[A-Za-z0-9]{16,64}$/, {message: '시크릿 코드는 영문 · 숫자 16 ~ 64자로 입력해주세요.'})
    @IsNotEmpty({message: '시크릿 코드를 입력해주세요.'})
    door_secret: string;
}

/**
 * 업체 호실 1개 — 지워지지 않은 호실 · 그룹(문 상태는 두지 않는다 — 사용자 결정 2026-11-19)
 */
export class DoorSnapshotItemResultDto {
    @ApiProperty({description: '호실 ID'})
    room_id: string;

    @ApiProperty({description: '호실명 (예: 101호)'})
    room_name: string;

    @ApiProperty({description: '층 (지하는 음수, B1 = -1)'})
    floor: number;
}

/**
 * 문 소켓 접속 결과 — 소켓의 `door.snapshot` data 로 그대로 보낸다
 */
export class DoorSnapshotResultDto {
    @ApiProperty({description: '업체 ID'})
    store_id: string;

    @ApiProperty({description: '호실 (층 · 호실명 순)', type: () => [DoorSnapshotItemResultDto]})
    list: DoorSnapshotItemResultDto[];
}

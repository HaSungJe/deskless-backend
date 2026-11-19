import {BeforeInsert, Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn} from 'typeorm';
import {ReservationEntity} from '../reservation/reservation.entity.js';
import {RoomEntity} from '../room/room.entity.js';
import {UserEntity} from '../user/user.entity.js';
import {RoomQrEntity} from './room-qr.entity.js';

/** 문을 연 방법 — QR: 이용자 QR(문 소켓 확인이 맞음), MANAGER: 업체 관리자 바로 열기 */
export const DOOR_OPEN_TYPE = {QR: 'QR', MANAGER: 'MANAGER'} as const;

/**
 * 문을 연 기록 — 문 소켓 QR 확인이 맞을 때(QR) · 업체 관리자가 바로 열기를 할 때(MANAGER) 한 줄. 틀린 QR 은 남기지 않는다.
 * 사용자 결정 2026-11-07(QR 만) → 2026-11-19 바로 열기도(누가 · 언제). 체크인 · 체크아웃 시각 대신 이 기록만 쌓는다. 조회 API 는 아직 없다. 지우지 않는다.
 */
@Entity({name: 't_door_open_log', comment: '문을 연 기록(이용자 QR · 업체 관리자 바로 열기)'})
@Index('IDX_DoorOpenLog_RoomIdOpenedAt', ['room_id', 'opened_at'])
@Index('IDX_DoorOpenLog_ReservationId', ['reservation_id'])
@Check(
    'CHK_DoorOpenLog_OpenType',
    `("open_type" = 'QR' AND "reservation_id" IS NOT NULL AND "room_qr_id" IS NOT NULL AND "user_id" IS NULL) OR ("open_type" = 'MANAGER' AND "user_id" IS NOT NULL AND "reservation_id" IS NULL AND "room_qr_id" IS NULL)`,
)
export class DoorOpenLogEntity {
    @PrimaryColumn({name: 'door_open_log_id', length: 32, comment: '문 열림 기록 ID', primaryKeyConstraintName: 'PK_DoorOpenLog'})
    door_open_log_id: string;

    @ManyToOne(() => RoomEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'room_id', referencedColumnName: 'room_id', foreignKeyConstraintName: 'FK_DoorOpenLog_Room'})
    room_id: string;

    @Column({name: 'open_type', length: 10, nullable: false, default: 'QR', comment: '연 방법(QR: 이용자 QR — 문 소켓 확인이 맞음, MANAGER: 업체 관리자 바로 열기)'})
    open_type: string;

    @ManyToOne(() => ReservationEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'reservation_id', referencedColumnName: 'reservation_id', foreignKeyConstraintName: 'FK_DoorOpenLog_Reservation'})
    reservation_id: string | null;

    @ManyToOne(() => RoomQrEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'room_qr_id', referencedColumnName: 'room_qr_id', foreignKeyConstraintName: 'FK_DoorOpenLog_RoomQr'})
    room_qr_id: string | null;

    @ManyToOne(() => UserEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_DoorOpenLog_User'})
    user_id: string | null;

    @Column({name: 'opened_at', type: 'timestamptz', nullable: false, comment: '문을 연 시각(QR 확인이 맞은 시각 · 바로 열기를 한 시각 — 실제로 문이 열린 시각은 아니다)'})
    opened_at: Date;

    @Column({name: 'created_at', type: 'timestamptz', nullable: false, comment: '등록일'})
    created_at: Date;

    /**
     * insert 직전 등록일을 채운다.
     */
    @BeforeInsert()
    insertTimestamp(): void {
        this.created_at = new Date();
    }
}

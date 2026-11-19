import type {MigrationInterface, QueryRunner} from 'typeorm';

/**
 * 문 열림 기록에 업체 관리자 바로 열기도 남긴다(사용자 결정 2026-11-19) — 연 방법 open_type(QR · MANAGER, 기존 행은 기본값 QR) · 연 사람 user_id(바로 열기 · nullable FK), 예약 · QR 은 nullable(바로 열기는 없음, FK onDelete RESTRICT), 조합은 CHECK CHK_DoorOpenLog_OpenType.
 * (npm run db:generate 로 엔티티에서 생성 — 생성기가 IDX_DoorOpenLog_RoomIdOpenedAt 을 같은 모양으로 다시 만든다, down 은 원래 칸 순서 room_id · opened_at 으로 고침)
 */
export class DoorOpenLogManager1795050011114 implements MigrationInterface {
    name = 'DoorOpenLogManager1795050011114';

    /**
     * 적용
     *
     * @param queryRunner 쿼리 실행기
     */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP CONSTRAINT "FK_DoorOpenLog_Reservation"`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP CONSTRAINT "FK_DoorOpenLog_RoomQr"`);
        await queryRunner.query(`COMMENT ON TABLE "t_door_open_log" IS '문을 연 기록(이용자 QR · 업체 관리자 바로 열기)'`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD "open_type" character varying(10) NOT NULL DEFAULT 'QR'`);
        await queryRunner.query(`COMMENT ON COLUMN "t_door_open_log"."open_type" IS '연 방법(QR: 이용자 QR — 문 소켓 확인이 맞음, MANAGER: 업체 관리자 바로 열기)'`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD "user_id" character varying(32)`);
        await queryRunner.query(`COMMENT ON COLUMN "t_door_open_log"."user_id" IS '사용자 ID'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_DoorOpenLog_RoomIdOpenedAt"`);
        await queryRunner.query(`COMMENT ON COLUMN "t_door_open_log"."opened_at" IS '문을 연 시각(QR 확인이 맞은 시각 · 바로 열기를 한 시각 — 실제로 문이 열린 시각은 아니다)'`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ALTER COLUMN "reservation_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ALTER COLUMN "room_qr_id" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_DoorOpenLog_RoomIdOpenedAt" ON "t_door_open_log"  ("room_id", "opened_at") `);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD CONSTRAINT "CHK_DoorOpenLog_OpenType" CHECK (("open_type" = 'QR' AND "reservation_id" IS NOT NULL AND "room_qr_id" IS NOT NULL AND "user_id" IS NULL) OR ("open_type" = 'MANAGER' AND "user_id" IS NOT NULL AND "reservation_id" IS NULL AND "room_qr_id" IS NULL))`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD CONSTRAINT "FK_DoorOpenLog_Reservation" FOREIGN KEY ("reservation_id") REFERENCES "t_reservation"("reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD CONSTRAINT "FK_DoorOpenLog_RoomQr" FOREIGN KEY ("room_qr_id") REFERENCES "t_room_qr"("room_qr_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD CONSTRAINT "FK_DoorOpenLog_User" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    /**
     * 되돌리기
     *
     * @param queryRunner 쿼리 실행기
     */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP CONSTRAINT "FK_DoorOpenLog_User"`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP CONSTRAINT "FK_DoorOpenLog_RoomQr"`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP CONSTRAINT "FK_DoorOpenLog_Reservation"`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP CONSTRAINT "CHK_DoorOpenLog_OpenType"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_DoorOpenLog_RoomIdOpenedAt"`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ALTER COLUMN "room_qr_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ALTER COLUMN "reservation_id" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "t_door_open_log"."opened_at" IS '문을 연 시각(QR 확인이 맞은 시각)'`);
        await queryRunner.query(`CREATE INDEX "IDX_DoorOpenLog_RoomIdOpenedAt" ON "t_door_open_log"  ("room_id", "opened_at") `);
        await queryRunner.query(`COMMENT ON COLUMN "t_door_open_log"."user_id" IS '사용자 ID'`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP COLUMN "user_id"`);
        await queryRunner.query(`COMMENT ON COLUMN "t_door_open_log"."open_type" IS '연 방법(QR: 이용자 QR — 문 소켓 확인이 맞음, MANAGER: 업체 관리자 바로 열기)'`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" DROP COLUMN "open_type"`);
        await queryRunner.query(`COMMENT ON TABLE "t_door_open_log" IS 'QR 로 문을 연 기록'`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD CONSTRAINT "FK_DoorOpenLog_RoomQr" FOREIGN KEY ("room_qr_id") REFERENCES "t_room_qr"("room_qr_id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_door_open_log" ADD CONSTRAINT "FK_DoorOpenLog_Reservation" FOREIGN KEY ("reservation_id") REFERENCES "t_reservation"("reservation_id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }
}

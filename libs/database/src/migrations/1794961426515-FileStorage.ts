import type {MigrationInterface, QueryRunner} from 'typeorm';

/**
 * 파일 행 저장소 구분 — t_store_file · t_room_group_image 에 file_storage(S3 · LOCAL) 추가. 기존 행은 기본값 LOCAL(지금까지 버킷 없이 내부 파일 저장소에 올린 파일 · 시드 사진).
 * S3 로 바꾼 뒤에도 LOCAL 행은 내부 파일 저장소(게이트웨이 /files)에서 연다(사용자 결정 2026-11-18). (npm run db:generate 로 엔티티에서 생성)
 */
export class FileStorage1794961426515 implements MigrationInterface {
    name = 'FileStorage1794961426515';

    /**
     * 적용
     *
     * @param queryRunner 쿼리 실행기
     */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_room_group_image" ADD "file_storage" character varying(10) NOT NULL DEFAULT 'LOCAL'`);
        await queryRunner.query(`COMMENT ON COLUMN "t_room_group_image"."file_storage" IS '저장소(S3: Amazon S3, LOCAL: 내부 파일 저장소 — 게이트웨이 /files · 샘플 사진도 LOCAL) — 올릴 때의 저장소, 주소 · 열람 · 삭제가 이 값을 따른다'`);
        await queryRunner.query(`ALTER TABLE "t_store_file" ADD "file_storage" character varying(10) NOT NULL DEFAULT 'LOCAL'`);
        await queryRunner.query(`COMMENT ON COLUMN "t_store_file"."file_storage" IS '저장소(S3: Amazon S3, LOCAL: 내부 파일 저장소 — 게이트웨이 /files · 샘플 사진도 LOCAL) — 올릴 때의 저장소, 주소 · 열람 · 삭제가 이 값을 따른다'`);
    }

    /**
     * 되돌리기
     *
     * @param queryRunner 쿼리 실행기
     */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "t_store_file"."file_storage" IS '저장소(S3: Amazon S3, LOCAL: 내부 파일 저장소 — 게이트웨이 /files · 샘플 사진도 LOCAL) — 올릴 때의 저장소, 주소 · 열람 · 삭제가 이 값을 따른다'`);
        await queryRunner.query(`ALTER TABLE "t_store_file" DROP COLUMN "file_storage"`);
        await queryRunner.query(`COMMENT ON COLUMN "t_room_group_image"."file_storage" IS '저장소(S3: Amazon S3, LOCAL: 내부 파일 저장소 — 게이트웨이 /files · 샘플 사진도 LOCAL) — 올릴 때의 저장소, 주소 · 열람 · 삭제가 이 값을 따른다'`);
        await queryRunner.query(`ALTER TABLE "t_room_group_image" DROP COLUMN "file_storage"`);
    }
}

import type {MigrationInterface, QueryRunner} from 'typeorm';

/**
 * 문의를 더한다(사용자 결정 2026-11-24) — 문의 t_inquiry(작성자 · 대상 업체(NULL = 바로방) · 카테고리 · 제목 · 내용 · 상태 · 답변 · 블라인드, CHECK 2개)와 룩업 t_inquiry_category(정렬 순서 포함) · t_inquiry_state. 룩업 행은 SeederService 가 부팅 때 넣는다.
 */
export class Inquiry1795503980335 implements MigrationInterface {
    name = 'Inquiry1795503980335';

    /**
     * 적용
     *
     * @param queryRunner 쿼리 실행기
     */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "t_inquiry_category" ("inquiry_category_id" character varying(20) NOT NULL, "inquiry_category_name" character varying(50) NOT NULL, "sort_order" smallint NOT NULL, CONSTRAINT "PK_InquiryCategory" PRIMARY KEY ("inquiry_category_id")); COMMENT ON COLUMN "t_inquiry_category"."inquiry_category_id" IS '문의 카테고리 ID'; COMMENT ON COLUMN "t_inquiry_category"."inquiry_category_name" IS '문의 카테고리명'; COMMENT ON COLUMN "t_inquiry_category"."sort_order" IS '화면 정렬 순서(작은 값이 먼저)'`);
        await queryRunner.query(`COMMENT ON TABLE "t_inquiry_category" IS '문의 카테고리'`);
        await queryRunner.query(`CREATE TABLE "t_inquiry_state" ("inquiry_state_id" character varying(20) NOT NULL, "inquiry_state_name" character varying(50) NOT NULL, CONSTRAINT "PK_InquiryState" PRIMARY KEY ("inquiry_state_id")); COMMENT ON COLUMN "t_inquiry_state"."inquiry_state_id" IS '문의 상태 ID'; COMMENT ON COLUMN "t_inquiry_state"."inquiry_state_name" IS '문의 상태명'`);
        await queryRunner.query(`COMMENT ON TABLE "t_inquiry_state" IS '문의 상태'`);
        await queryRunner.query(`CREATE TABLE "t_inquiry" ("inquiry_id" character varying(32) NOT NULL, "title" character varying(100) NOT NULL, "content" character varying(2000) NOT NULL, "answer_content" character varying(2000), "answered_at" TIMESTAMP WITH TIME ZONE, "blinded_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "user_id" character varying(32) NOT NULL, "store_id" character varying(32), "inquiry_category_id" character varying(20) NOT NULL, "inquiry_state_id" character varying(20) NOT NULL, "answer_user_id" character varying(32), "blind_user_id" character varying(32), CONSTRAINT "CHK_Inquiry_Blind" CHECK (("inquiry_state_id" = 'BLIND') = ("blinded_at" IS NOT NULL) AND ("blinded_at" IS NULL) = ("blind_user_id" IS NULL)), CONSTRAINT "CHK_Inquiry_Answer" CHECK (("answer_content" IS NULL) = ("answered_at" IS NULL) AND ("answer_content" IS NULL) = ("answer_user_id" IS NULL) AND ("inquiry_state_id" = 'BLIND' OR ("inquiry_state_id" = 'ANSWERED') = ("answered_at" IS NOT NULL))), CONSTRAINT "PK_Inquiry" PRIMARY KEY ("inquiry_id")); COMMENT ON COLUMN "t_inquiry"."inquiry_id" IS '문의 ID'; COMMENT ON COLUMN "t_inquiry"."title" IS '제목(100자)'; COMMENT ON COLUMN "t_inquiry"."content" IS '내용(2000자)'; COMMENT ON COLUMN "t_inquiry"."answer_content" IS '답변(2000자 — 답변 전 NULL, 고치면 덮어쓴다)'; COMMENT ON COLUMN "t_inquiry"."answered_at" IS '마지막으로 답변(수정)한 시각 — 답변 전 NULL'; COMMENT ON COLUMN "t_inquiry"."blinded_at" IS '블라인드한 시각 — 블라인드가 아니면 NULL(해제하면 지운다)'; COMMENT ON COLUMN "t_inquiry"."created_at" IS '등록일(문의한 시각)'; COMMENT ON COLUMN "t_inquiry"."updated_at" IS '수정일'; COMMENT ON COLUMN "t_inquiry"."user_id" IS '사용자 ID'; COMMENT ON COLUMN "t_inquiry"."store_id" IS '업체 ID'; COMMENT ON COLUMN "t_inquiry"."inquiry_category_id" IS '문의 카테고리 ID'; COMMENT ON COLUMN "t_inquiry"."inquiry_state_id" IS '문의 상태 ID'; COMMENT ON COLUMN "t_inquiry"."answer_user_id" IS '사용자 ID'; COMMENT ON COLUMN "t_inquiry"."blind_user_id" IS '사용자 ID'`);
        await queryRunner.query(`CREATE INDEX "IDX_Inquiry_StoreIdCreatedAt" ON "t_inquiry"  ("store_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_Inquiry_UserIdCreatedAt" ON "t_inquiry"  ("user_id", "created_at") `);
        await queryRunner.query(`COMMENT ON TABLE "t_inquiry" IS '문의 — 이용자가 카테고리를 골라 업체 또는 바로방에 남긴 문의 · 답변 · 블라인드'`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" ADD CONSTRAINT "FK_Inquiry_User" FOREIGN KEY ("user_id") REFERENCES "t_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" ADD CONSTRAINT "FK_Inquiry_Store" FOREIGN KEY ("store_id") REFERENCES "t_store"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" ADD CONSTRAINT "FK_Inquiry_InquiryCategory" FOREIGN KEY ("inquiry_category_id") REFERENCES "t_inquiry_category"("inquiry_category_id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" ADD CONSTRAINT "FK_Inquiry_InquiryState" FOREIGN KEY ("inquiry_state_id") REFERENCES "t_inquiry_state"("inquiry_state_id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" ADD CONSTRAINT "FK_Inquiry_AnswerUser" FOREIGN KEY ("answer_user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" ADD CONSTRAINT "FK_Inquiry_BlindUser" FOREIGN KEY ("blind_user_id") REFERENCES "t_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    /**
     * 되돌리기
     *
     * @param queryRunner 쿼리 실행기
     */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_inquiry" DROP CONSTRAINT "FK_Inquiry_BlindUser"`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" DROP CONSTRAINT "FK_Inquiry_AnswerUser"`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" DROP CONSTRAINT "FK_Inquiry_InquiryState"`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" DROP CONSTRAINT "FK_Inquiry_InquiryCategory"`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" DROP CONSTRAINT "FK_Inquiry_Store"`);
        await queryRunner.query(`ALTER TABLE "t_inquiry" DROP CONSTRAINT "FK_Inquiry_User"`);
        await queryRunner.query(`COMMENT ON TABLE "t_inquiry" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_Inquiry_UserIdCreatedAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_Inquiry_StoreIdCreatedAt"`);
        await queryRunner.query(`DROP TABLE "t_inquiry"`);
        await queryRunner.query(`COMMENT ON TABLE "t_inquiry_state" IS NULL`);
        await queryRunner.query(`DROP TABLE "t_inquiry_state"`);
        await queryRunner.query(`COMMENT ON TABLE "t_inquiry_category" IS NULL`);
        await queryRunner.query(`DROP TABLE "t_inquiry_category"`);
    }
}

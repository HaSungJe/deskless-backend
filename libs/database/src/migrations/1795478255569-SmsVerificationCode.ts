import type {MigrationInterface, QueryRunner} from 'typeorm';

/**
 * SMS 인증 기록에 인증번호 원문 code 를 더한다(사용자 결정 2026-11-24 — SMS 없이 테스트할 때 DB 에서 번호를 보려고). 확인은 그대로 code_hash 로 하고, 이 컬럼이 생기기 전 행은 NULL 로 둔다(채우지 않는다).
 */
export class SmsVerificationCode1795478255569 implements MigrationInterface {
    name = 'SmsVerificationCode1795478255569';

    /**
     * 적용
     *
     * @param queryRunner 쿼리 실행기
     */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_sms_verification" ADD "code" character varying(6)`);
        await queryRunner.query(`COMMENT ON COLUMN "t_sms_verification"."code" IS '인증번호 원문(확인은 해시로 — 이 컬럼이 생기기 전 행은 NULL)'`);
    }

    /**
     * 되돌리기
     *
     * @param queryRunner 쿼리 실행기
     */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "t_sms_verification"."code" IS '인증번호 원문(확인은 해시로 — 이 컬럼이 생기기 전 행은 NULL)'`);
        await queryRunner.query(`ALTER TABLE "t_sms_verification" DROP COLUMN "code"`);
    }
}

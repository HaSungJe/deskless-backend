import type {MigrationInterface, QueryRunner} from 'typeorm';

/**
 * 업체 편의시설 컬럼 t_store.store_detail(jsonb, 기본 {})을 더한다(사용자 결정 2026-11-24) — 편의점 · 카페 · 온천 · 반려동물 동반 · 식사 제공 · 배달 음식 · 주차. 기존 업체는 빈 JSON(모두 없음)으로 시작한다.
 */
export class StoreDetail1795525176585 implements MigrationInterface {
    name = 'StoreDetail1795525176585';

    /**
     * 적용
     *
     * @param queryRunner 쿼리 실행기
     */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_store" ADD "store_detail" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`COMMENT ON COLUMN "t_store"."store_detail" IS '편의시설(JSON — has_convenience_store · has_cafe · has_hot_spring · is_pet_allowed · has_meal · is_delivery_allowed · has_parking, 항목은 바뀔 수 있다. 없는 항목은 조회 뒤 기본값 — 모두 없음 0)'`);
    }

    /**
     * 되돌리기
     *
     * @param queryRunner 쿼리 실행기
     */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "t_store"."store_detail" IS '편의시설(JSON — has_convenience_store · has_cafe · has_hot_spring · is_pet_allowed · has_meal · is_delivery_allowed · has_parking, 항목은 바뀔 수 있다. 없는 항목은 조회 뒤 기본값 — 모두 없음 0)'`);
        await queryRunner.query(`ALTER TABLE "t_store" DROP COLUMN "store_detail"`);
    }
}

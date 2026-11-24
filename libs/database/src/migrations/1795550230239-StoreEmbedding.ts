import type {MigrationInterface, QueryRunner} from 'typeorm';

/**
 * 업체 검색 벡터 t_store_embedding(AI 대화형 업체 검색 — 업체마다 검색용 글 · 내용 해시 · vector(768) · 모델) — 맨 앞에서 pgvector 확장을 켠다(손으로 더한 한 줄 — 연결 때의 자동 설치에 기대지 않는다).
 * 되돌리기는 표만 지우고 확장은 남긴다(다른 표가 쓸 수 있다). npm run db:generate 로 엔티티에서 생성
 */
export class StoreEmbedding1795550230239 implements MigrationInterface {
    name = 'StoreEmbedding1795550230239';

    /**
     * 적용
     *
     * @param queryRunner 쿼리 실행기
     */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
        await queryRunner.query(`CREATE TABLE "t_store_embedding" ("store_embedding_id" character varying(32) NOT NULL, "content" text NOT NULL, "content_hash" character varying(64) NOT NULL, "embedding_model" character varying(100) NOT NULL, "embedding" vector(768) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "store_id" character varying(32) NOT NULL, CONSTRAINT "UK_StoreEmbedding_StoreId" UNIQUE ("store_id"), CONSTRAINT "PK_StoreEmbedding" PRIMARY KEY ("store_embedding_id")); COMMENT ON COLUMN "t_store_embedding"."store_embedding_id" IS '업체 검색 벡터 ID'; COMMENT ON COLUMN "t_store_embedding"."content" IS '임베딩한 검색용 글(업체 · 편의시설 · 객실 · 판매 상품)'; COMMENT ON COLUMN "t_store_embedding"."content_hash" IS '검색용 글 SHA-256 — 같으면 다시 만들지 않는다'; COMMENT ON COLUMN "t_store_embedding"."embedding_model" IS '임베딩 모델 이름 — 바뀌면 다시 만든다'; COMMENT ON COLUMN "t_store_embedding"."embedding" IS '검색 벡터(768차원 — 코사인 거리)'; COMMENT ON COLUMN "t_store_embedding"."created_at" IS '등록일'; COMMENT ON COLUMN "t_store_embedding"."updated_at" IS '수정일'; COMMENT ON COLUMN "t_store_embedding"."store_id" IS '업체 ID'`);
        await queryRunner.query(`COMMENT ON TABLE "t_store_embedding" IS '업체 검색 벡터(AI 대화형 업체 검색 — 업체마다 1행)'`);
        await queryRunner.query(`ALTER TABLE "t_store_embedding" ADD CONSTRAINT "FK_StoreEmbedding_Store" FOREIGN KEY ("store_id") REFERENCES "t_store"("store_id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * 되돌리기
     *
     * @param queryRunner 쿼리 실행기
     */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "t_store_embedding" DROP CONSTRAINT "FK_StoreEmbedding_Store"`);
        await queryRunner.query(`COMMENT ON TABLE "t_store_embedding" IS NULL`);
        await queryRunner.query(`DROP TABLE "t_store_embedding"`);
    }
}

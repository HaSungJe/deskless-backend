import {BeforeInsert, BeforeUpdate, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique} from 'typeorm';
import {StoreEntity} from './store.entity.js';

/** 업체 검색 벡터 차원 — gemini-embedding-001 을 outputDimensionality 768 로 줄인다(libs/integration AI_EMBEDDING_DIMENSIONS 와 같다) */
export const STORE_EMBEDDING_DIMENSIONS = 768;

/**
 * 업체 검색 벡터 — AI 대화형 업체 검색이 쓴다. 업체마다 1행(검색용 글 · 내용 해시 · 벡터 · 모델), scheduler 가 바뀐 업체만 다시 만든다.
 * 지우는 동작이 없어 is_deleted 가 없다 — 지워진 · 활성이 아닌 업체 행은 남아도 추천 쿼리가 업체 상태로 거른다. 벡터는 pgvector(vector 확장 — 마이그레이션이 켠다).
 */
@Entity({name: 't_store_embedding', comment: '업체 검색 벡터(AI 대화형 업체 검색 — 업체마다 1행)'})
@Unique('UK_StoreEmbedding_StoreId', ['store_id'])
export class StoreEmbeddingEntity {
    @PrimaryColumn({name: 'store_embedding_id', length: 32, comment: '업체 검색 벡터 ID', primaryKeyConstraintName: 'PK_StoreEmbedding'})
    store_embedding_id: string;

    @ManyToOne(() => StoreEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'store_id', referencedColumnName: 'store_id', foreignKeyConstraintName: 'FK_StoreEmbedding_Store'})
    store_id: string;

    @Column({name: 'content', type: 'text', nullable: false, comment: '임베딩한 검색용 글(업체 · 편의시설 · 객실 · 판매 상품)'})
    content: string;

    @Column({name: 'content_hash', length: 64, nullable: false, comment: '검색용 글 SHA-256 — 같으면 다시 만들지 않는다'})
    content_hash: string;

    @Column({name: 'embedding_model', length: 100, nullable: false, comment: '임베딩 모델 이름 — 바뀌면 다시 만든다'})
    embedding_model: string;

    @Column({name: 'embedding', type: 'vector', length: STORE_EMBEDDING_DIMENSIONS, nullable: false, comment: '검색 벡터(768차원 — 코사인 거리)'})
    embedding: number[];

    @Column({name: 'created_at', type: 'timestamptz', nullable: false, comment: '등록일'})
    created_at: Date;

    @Column({name: 'updated_at', type: 'timestamptz', nullable: false, comment: '수정일'})
    updated_at: Date;

    /**
     * insert 직전 등록일 · 수정일을 채운다.
     */
    @BeforeInsert()
    insertTimestamp(): void {
        const now = new Date();
        this.created_at = now;
        this.updated_at = now;
    }

    /**
     * update 직전 수정일을 갱신한다(검색용 글 · 벡터를 다시 만들 때).
     */
    @BeforeUpdate()
    updateTimestamp(): void {
        this.updated_at = new Date();
    }
}

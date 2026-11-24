import {BeforeInsert, BeforeUpdate, Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn} from 'typeorm';
import {StoreEntity} from '../store/store.entity.js';
import {UserEntity} from '../user/user.entity.js';
import {InquiryCategoryEntity} from './inquiry-category.entity.js';
import {InquiryStateEntity} from './inquiry-state.entity.js';

/**
 * 문의 — 이용자가 카테고리를 골라 업체(store_id) 또는 바로방(store_id NULL — 운영)에 남긴 문의와 답변 · 블라인드(사용자 결정 2026-11-24).
 * 답변은 문의당 1개(고치면 덮어쓴다), 블라인드는 업체 관리자 · 관리자가 상세에서 한 건씩 하고 해제하면 블라인드 칸을 지운다. 지우지 않는다(is_deleted 없음).
 * t_user 를 가리키는 FK 가 셋이라 작성자만 user_id, 나머지는 역할을 붙인 answer_user_id · blind_user_id 다.
 */
@Entity({name: 't_inquiry', comment: '문의 — 이용자가 카테고리를 골라 업체 또는 바로방에 남긴 문의 · 답변 · 블라인드'})
@Index('IDX_Inquiry_UserIdCreatedAt', ['user_id', 'created_at'])
@Index('IDX_Inquiry_StoreIdCreatedAt', ['store_id', 'created_at'])
@Check(
    'CHK_Inquiry_Answer',
    `("answer_content" IS NULL) = ("answered_at" IS NULL) AND ("answer_content" IS NULL) = ("answer_user_id" IS NULL) AND ("inquiry_state_id" = 'BLIND' OR ("inquiry_state_id" = 'ANSWERED') = ("answered_at" IS NOT NULL))`,
)
@Check('CHK_Inquiry_Blind', `("inquiry_state_id" = 'BLIND') = ("blinded_at" IS NOT NULL) AND ("blinded_at" IS NULL) = ("blind_user_id" IS NULL)`)
export class InquiryEntity {
    @PrimaryColumn({name: 'inquiry_id', length: 32, comment: '문의 ID', primaryKeyConstraintName: 'PK_Inquiry'})
    inquiry_id: string;

    @ManyToOne(() => UserEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_Inquiry_User'})
    user_id: string;

    @ManyToOne(() => StoreEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'store_id', referencedColumnName: 'store_id', foreignKeyConstraintName: 'FK_Inquiry_Store'})
    store_id: string | null;

    @ManyToOne(() => InquiryCategoryEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'inquiry_category_id', referencedColumnName: 'inquiry_category_id', foreignKeyConstraintName: 'FK_Inquiry_InquiryCategory'})
    inquiry_category_id: string;

    @ManyToOne(() => InquiryStateEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'inquiry_state_id', referencedColumnName: 'inquiry_state_id', foreignKeyConstraintName: 'FK_Inquiry_InquiryState'})
    inquiry_state_id: string;

    @Column({name: 'title', type: 'varchar', length: 100, nullable: false, comment: '제목(100자)'})
    title: string;

    @Column({name: 'content', type: 'varchar', length: 2000, nullable: false, comment: '내용(2000자)'})
    content: string;

    @Column({name: 'answer_content', type: 'varchar', length: 2000, nullable: true, comment: '답변(2000자 — 답변 전 NULL, 고치면 덮어쓴다)'})
    answer_content: string | null;

    @ManyToOne(() => UserEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'answer_user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_Inquiry_AnswerUser'})
    answer_user_id: string | null;

    @Column({name: 'answered_at', type: 'timestamptz', nullable: true, comment: '마지막으로 답변(수정)한 시각 — 답변 전 NULL'})
    answered_at: Date | null;

    @ManyToOne(() => UserEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'blind_user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_Inquiry_BlindUser'})
    blind_user_id: string | null;

    @Column({name: 'blinded_at', type: 'timestamptz', nullable: true, comment: '블라인드한 시각 — 블라인드가 아니면 NULL(해제하면 지운다)'})
    blinded_at: Date | null;

    @Column({name: 'created_at', type: 'timestamptz', nullable: false, comment: '등록일(문의한 시각)'})
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
     * update 직전 수정일을 갱신한다.
     */
    @BeforeUpdate()
    updateTimestamp(): void {
        this.updated_at = new Date();
    }
}

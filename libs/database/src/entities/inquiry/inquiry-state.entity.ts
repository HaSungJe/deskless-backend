import {Column, Entity, PrimaryColumn} from 'typeorm';

/**
 * 문의 상태 (룩업) — 구조 컬럼만. 기본 데이터는 seeder.targets.ts(RECEIVED 접수 · ANSWERED 답변완료 · BLIND 블라인드)
 */
@Entity({name: 't_inquiry_state', comment: '문의 상태'})
export class InquiryStateEntity {
    @PrimaryColumn({name: 'inquiry_state_id', length: 20, comment: '문의 상태 ID', primaryKeyConstraintName: 'PK_InquiryState'})
    inquiry_state_id: string;

    @Column({name: 'inquiry_state_name', length: 50, nullable: false, comment: '문의 상태명'})
    inquiry_state_name: string;
}

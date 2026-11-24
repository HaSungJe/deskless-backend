import {Column, Entity, PrimaryColumn} from 'typeorm';

/**
 * 문의 카테고리 (룩업) — 기본 데이터는 seeder.targets.ts(예약 · 결제/환불 · 객실/시설 · 출입/QR · 회원/계정 · 입점 · 기타).
 * 업체 문의 · 바로방 문의가 같은 목록을 쓴다. 화면 순서는 sort_order(작은 값이 먼저 — 사용자 결정 2026-11-24).
 */
@Entity({name: 't_inquiry_category', comment: '문의 카테고리'})
export class InquiryCategoryEntity {
    @PrimaryColumn({name: 'inquiry_category_id', length: 20, comment: '문의 카테고리 ID', primaryKeyConstraintName: 'PK_InquiryCategory'})
    inquiry_category_id: string;

    @Column({name: 'inquiry_category_name', length: 50, nullable: false, comment: '문의 카테고리명'})
    inquiry_category_name: string;

    @Column({name: 'sort_order', type: 'smallint', nullable: false, comment: '화면 정렬 순서(작은 값이 먼저)'})
    sort_order: number;
}

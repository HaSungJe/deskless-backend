import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, Matches} from 'class-validator';

/**
 * 내 문의 상세 path param — 내가 쓴 문의만(아니면 404)
 */
export class InquiryDetailParamDto {
    @ApiProperty({description: '문의 ID'})
    @Matches(/^[a-f0-9]{32}$/, {message: '문의 ID가 올바르지 않습니다.'})
    @IsNotEmpty({message: '문의 ID를 입력해주세요.'})
    inquiry_id: string;
}

/**
 * 내 문의 상세 — 답변 포함. 블라인드된 문의도 그대로 보인다(안내 문구는 프론트).
 */
export class InquiryDetailResultDto {
    @ApiProperty({description: '문의 ID'})
    inquiry_id: string;

    @ApiProperty({description: '문의한 업체 ID (바로방 문의면 null)', nullable: true, type: String})
    store_id: string | null;

    @ApiProperty({description: '문의한 업체 상호명 (바로방 문의면 null)', nullable: true, type: String})
    store_name: string | null;

    @ApiProperty({description: '카테고리 ID'})
    inquiry_category_id: string;

    @ApiProperty({description: '카테고리 이름'})
    inquiry_category_name: string;

    @ApiProperty({description: '제목'})
    title: string;

    @ApiProperty({description: '내용'})
    content: string;

    @ApiProperty({description: '상태 (RECEIVED: 접수, ANSWERED: 답변완료, BLIND: 블라인드)'})
    inquiry_state_id: string;

    @ApiProperty({description: '상태 이름'})
    inquiry_state_name: string;

    @ApiProperty({description: '답변 (답변 전 null)', nullable: true, type: String})
    answer_content: string | null;

    @ApiProperty({description: '마지막으로 답변(수정)한 일시 (ISO 8601, 답변 전 null)', nullable: true, type: String})
    answered_at: string | null;

    @ApiProperty({description: '문의일시 (ISO 8601)'})
    created_at: string;
}

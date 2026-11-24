import {ApiProperty} from '@nestjs/swagger';

/**
 * 대화 보기 업체 카드 편의시설 · 객실 항목
 */
export class ChatDetailCardFacilityResultDto {
    @ApiProperty({description: '항목 키 (예: has_hot_spring · has_pc)'})
    key: string;

    @ApiProperty({description: '이름 (예: 온천 · PC)'})
    name: string;

    @ApiProperty({description: '묶음 (STORE: 업체 편의시설, ROOM_GROUP: 그 업체 객실 그룹에 있는 항목)', enum: ['STORE', 'ROOM_GROUP']})
    group: string;
}

/**
 * 대화 보기 업체 카드 — 그 답에 붙었던 추천 업체(답한 때의 값)
 */
export class ChatDetailCardResultDto {
    @ApiProperty({description: '업체 ID'})
    store_id: string;

    @ApiProperty({description: '상호명'})
    store_name: string;

    @ApiProperty({description: '주소'})
    address: string;

    @ApiProperty({description: '위도'})
    latitude: number;

    @ApiProperty({description: '경도'})
    longitude: number;

    @ApiProperty({description: '대표 사진 공개 주소 (없으면 null)', type: String, nullable: true})
    image_url: string | null;

    @ApiProperty({description: '있는 편의시설 · 객실 항목', type: () => [ChatDetailCardFacilityResultDto]})
    facilities: ChatDetailCardFacilityResultDto[];
}

/**
 * 대화 메시지 한 개 — 질문 한 건이 USER · AI 두 메시지로 펼쳐진다
 */
export class ChatDetailMessageResultDto {
    @ApiProperty({description: '주인 (USER: 이용자 질문, AI: 답)', enum: ['USER', 'AI']})
    role: string;

    @ApiProperty({description: '글'})
    content: string;

    @ApiProperty({description: '추천 업체 카드 (AI 답에만, 없으면 빈 배열)', type: () => [ChatDetailCardResultDto]})
    stores: ChatDetailCardResultDto[];

    @ApiProperty({description: '시각 (ISO 8601 — 질문은 물은 시각, 답은 답한 시각)'})
    created_at: string;
}

/**
 * 대화 보기의 남은 질문 수
 */
export class ChatDetailQuotaResultDto {
    @ApiProperty({description: '하루 질문 한도 (서버 설정 — 기본 5)'})
    daily_limit: number;

    @ApiProperty({description: '오늘(한국 날짜) 답을 받은 질문 수'})
    used_count: number;

    @ApiProperty({description: '오늘 남은 질문 수'})
    remaining_count: number;

    @ApiProperty({description: '다시 채워지는 시각 (ISO 8601 — 다음 날 한국 00:00)'})
    resets_at: string;

    @ApiProperty({description: '다른 질문에 답하는 중인지 (0 · 1)'})
    is_answering: number;
}

/**
 * 대화 보기 — 내 대화 이력(7일 안, 오래된 순) · 남은 질문 수
 */
export class ChatDetailResultDto {
    @ApiProperty({description: '대화 (오래된 순 — 대화한 적이 없거나 초기화했으면 빈 배열)', type: () => [ChatDetailMessageResultDto]})
    messages: ChatDetailMessageResultDto[];

    @ApiProperty({description: '남은 질문 수', type: () => ChatDetailQuotaResultDto})
    quota: ChatDetailQuotaResultDto;
}

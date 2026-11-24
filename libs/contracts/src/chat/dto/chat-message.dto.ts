import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, MaxLength} from 'class-validator';

/**
 * 메시지 보내기 — 질문 하나(100자). 응답은 SSE 스트림(progress → stores → delta … → done).
 */
export class ChatMessageDto {
    @ApiProperty({description: '질문 (1 ~ 100자)', example: '온천 가고 싶은데 반려동물이랑 같이 묵을 곳 있을까?'})
    @MaxLength(100, {message: '질문은 100자 이내로 입력해주세요.'})
    @IsNotEmpty({message: '질문을 입력해주세요.'})
    content: string;
}

/**
 * 업체 카드 편의시설 · 객실 항목 — 추가정보 필터 항목과 같은 이름(GET /discovery/detail-filter)
 */
export class ChatMessageCardFacilityResultDto {
    @ApiProperty({description: '항목 키 (예: has_hot_spring · has_pc)'})
    key: string;

    @ApiProperty({description: '이름 (예: 온천 · PC)'})
    name: string;

    @ApiProperty({description: '묶음 (STORE: 업체 편의시설, ROOM_GROUP: 그 업체 객실 그룹에 있는 항목)', enum: ['STORE', 'ROOM_GROUP']})
    group: string;
}

/**
 * 추천 업체 카드 — 누르면 업체 상세(U2)로
 */
export class ChatMessageCardResultDto {
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

    @ApiProperty({description: '있는 편의시설 · 객실 항목 (업체 편의시설 다음 객실 항목)', type: () => [ChatMessageCardFacilityResultDto]})
    facilities: ChatMessageCardFacilityResultDto[];
}

/**
 * stores 이벤트 data — 추천 업체 카드 0 ~ 3곳
 */
export class ChatMessageStoresResultDto {
    @ApiProperty({description: '업체 카드 (추천 순서)', type: () => [ChatMessageCardResultDto]})
    list: ChatMessageCardResultDto[];
}

/**
 * progress 이벤트 data — 진행 단계
 */
export class ChatMessageProgressResultDto {
    @ApiProperty({description: '진행 단계 (SEARCHING_WEB: 요청 읽기 · 웹 검색, SEARCHING_STORES: 업체 찾기, ANSWERING: 답 쓰기)', enum: ['SEARCHING_WEB', 'SEARCHING_STORES', 'ANSWERING']})
    phase: string;
}

/**
 * delta 이벤트 data — 답 글 조각(이어 붙이면 답 전체)
 */
export class ChatMessageDeltaResultDto {
    @ApiProperty({description: '답 글 조각'})
    text: string;
}

/**
 * 대화에 저장된 AI 답 한 개
 */
export class ChatMessageItemResultDto {
    @ApiProperty({description: '주인 (AI)', enum: ['USER', 'AI']})
    role: string;

    @ApiProperty({description: '답 글 전체'})
    content: string;

    @ApiProperty({description: '추천 업체 카드 (없으면 빈 배열)', type: () => [ChatMessageCardResultDto]})
    stores: ChatMessageCardResultDto[];

    @ApiProperty({description: '답한 시각 (ISO 8601)'})
    created_at: string;
}

/**
 * done 이벤트의 남은 질문 수 — 이번 질문까지 센 값
 */
export class ChatMessageQuotaResultDto {
    @ApiProperty({description: '하루 질문 한도 (서버 설정 — 기본 5)'})
    daily_limit: number;

    @ApiProperty({description: '오늘(한국 날짜) 답을 받은 질문 수 — 이번 질문 포함'})
    used_count: number;

    @ApiProperty({description: '오늘 남은 질문 수'})
    remaining_count: number;

    @ApiProperty({description: '다시 채워지는 시각 (ISO 8601 — 다음 날 한국 00:00)'})
    resets_at: string;

    @ApiProperty({description: '다른 질문에 답하는 중인지 (0 · 1 — 끝난 뒤라 0)'})
    is_answering: number;
}

/**
 * done 이벤트 data — 저장된 AI 답 · 남은 질문 수
 */
export class ChatMessageDoneResultDto {
    @ApiProperty({description: '저장된 AI 답', type: () => ChatMessageItemResultDto})
    message: ChatMessageItemResultDto;

    @ApiProperty({description: '남은 질문 수', type: () => ChatMessageQuotaResultDto})
    quota: ChatMessageQuotaResultDto;
}

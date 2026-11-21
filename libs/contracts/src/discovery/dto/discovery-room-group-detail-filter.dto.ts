import {ApiProperty} from '@nestjs/swagger';

/**
 * 추가정보 필터 항목 — 체크박스 1개
 */
export class DiscoveryRoomGroupDetailFilterItemResultDto {
    @ApiProperty({description: '항목 키 — 업체 검색 detail_filter 에 쉼표로 넣는다 (예: has_pc)'})
    key: string;

    @ApiProperty({description: '체크박스 이름 (예: PC · 방 2개 이상)'})
    name: string;
}

/**
 * 추가정보 필터 항목 목록 — 객실 그룹 상세 항목마다 1개, 보일 순서
 */
export class DiscoveryRoomGroupDetailFilterListResultDto {
    @ApiProperty({description: '필터 항목 (보일 순서)', type: () => [DiscoveryRoomGroupDetailFilterItemResultDto]})
    list: DiscoveryRoomGroupDetailFilterItemResultDto[];
}

import {Controller, Get, HttpCode, Param, Query} from '@nestjs/common';
import {InternalActor} from '@app/common/internal/internal-request.decorator.js';
import type {InquiryCategoryListResultDto} from '@app/contracts/inquiry/dto/inquiry-category-list.dto.js';
import {InquiryDetailParamDto, InquiryDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-detail.dto.js';
import {InquiryListDto, InquiryListResultDto} from '@app/contracts/inquiry/dto/inquiry-list.dto.js';
import {InquiryService} from '../inquiry.service.js';

/**
 * inquiry 내부 HTTP 인바운드 어댑터 (이용자 문의) — 게이트웨이의 동기 경로(카테고리 목록 · 내 문의 목록 · 상세)만 받는다(외부 비공개, Swagger 없음).
 * 로그인 이용자는 게이트웨이가 넘긴 actor 헤더에서 꺼낸다(카테고리 목록은 로그인 없음). 내부 토큰 검사는 전역 InternalAuthGuard 가 한다.
 * `/category` 는 `/:inquiry_id` 보다 먼저 둔다(뒤에 두면 inquiry_id = 'category' 로 잡힌다).
 */
@Controller('/internal/v1/user-service/inquiry')
export class InquiryController {
    /**
     * @param inquiryService inquiry 비즈니스 로직
     */
    constructor(private readonly inquiryService: InquiryService) {}

    /**
     * 문의 카테고리 목록 (인증 없음)
     */
    @Get('/category')
    @HttpCode(200)
    async getInquiryCategoryList(): Promise<InquiryCategoryListResultDto> {
        return this.inquiryService.getInquiryCategoryList();
    }

    /**
     * 내 문의 목록
     */
    @Get('/')
    @HttpCode(200)
    async getMyInquiryList(@InternalActor('user_id') user_id: string, @Query() query: InquiryListDto): Promise<InquiryListResultDto> {
        const dto = new InquiryListDto(query);
        return this.inquiryService.getMyInquiryList(user_id, dto);
    }

    /**
     * 내 문의 상세
     */
    @Get('/:inquiry_id')
    @HttpCode(200)
    async getMyInquiry(@InternalActor('user_id') user_id: string, @Param() param: InquiryDetailParamDto): Promise<InquiryDetailResultDto> {
        return this.inquiryService.getMyInquiry(user_id, param.inquiry_id);
    }
}

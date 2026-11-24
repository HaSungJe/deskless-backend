import {Controller, Get, HttpCode, Param, Query} from '@nestjs/common';
import {InternalActor} from '@app/common/internal/internal-request.decorator.js';
import {InquiryManageDetailParamDto, InquiryManageDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-detail.dto.js';
import {InquiryManageListDto, InquiryManageListResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-list.dto.js';
import {InquiryService} from '../inquiry.service.js';

/**
 * inquiry 내부 HTTP 인바운드 어댑터 (문의 관리) — 게이트웨이의 동기 경로(목록 · 상세)만 받는다(외부 비공개, Swagger 없음). 가드는 게이트웨이(`/mine` = 매니저, 그 밖 = 관리자).
 * `/mine` · `/mine/:inquiry_id` 는 `/:inquiry_id` 보다 먼저 둔다(뒤에 두면 inquiry_id = 'mine' 으로 잡힌다).
 */
@Controller('/internal/v1/admin-service/inquiry')
export class InquiryController {
    /**
     * @param inquiryService inquiry 비즈니스 로직
     */
    constructor(private readonly inquiryService: InquiryService) {}

    /**
     * 내 업체 문의 목록 (업체 관리자)
     */
    @Get('/mine')
    @HttpCode(200)
    async getMyStoreInquiryList(@InternalActor('user_id') user_id: string, @Query() query: InquiryManageListDto): Promise<InquiryManageListResultDto> {
        const dto = new InquiryManageListDto(query);
        return this.inquiryService.getMyStoreInquiryList(user_id, dto);
    }

    /**
     * 내 업체 문의 상세 (업체 관리자)
     */
    @Get('/mine/:inquiry_id')
    @HttpCode(200)
    async getMyStoreInquiry(@InternalActor('user_id') user_id: string, @Param() param: InquiryManageDetailParamDto): Promise<InquiryManageDetailResultDto> {
        return this.inquiryService.getMyStoreInquiry(user_id, param.inquiry_id);
    }

    /**
     * 바로방 문의 목록 (관리자)
     */
    @Get('/')
    @HttpCode(200)
    async getInquiryList(@Query() query: InquiryManageListDto): Promise<InquiryManageListResultDto> {
        const dto = new InquiryManageListDto(query);
        return this.inquiryService.getInquiryList(dto);
    }

    /**
     * 바로방 문의 상세 (관리자)
     */
    @Get('/:inquiry_id')
    @HttpCode(200)
    async getInquiry(@Param() param: InquiryManageDetailParamDto): Promise<InquiryManageDetailResultDto> {
        return this.inquiryService.getInquiry(param.inquiry_id);
    }
}

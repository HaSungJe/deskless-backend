import {Controller, Get, HttpCode, Param, Query, UseGuards} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiServiceUnavailableResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {ApiFailResultDto} from '@app/common/dto/global.result.dto.js';
import type {Actor} from '@app/contracts/actor.js';
import {InquiryCategoryListResultDto} from '@app/contracts/inquiry/dto/inquiry-category-list.dto.js';
import {InquiryDetailParamDto, InquiryDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-detail.dto.js';
import {InquiryListDto, InquiryListResultDto} from '@app/contracts/inquiry/dto/inquiry-list.dto.js';
import {INQUIRY_USER_INTERNAL_PATH} from '@app/contracts/inquiry/inquiry.commands.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.guard.js';
import {InternalHttpClient} from '../../../../../modules/transport/internal-http.client.js';

/**
 * 문의 공개 API (이용자) — 동기 경로(내부 HTTP → user-service inquiry 도메인). 카테고리 목록(가드 없음 — 관리 화면도 쓴다) · 내 문의 목록 · 상세(이용자 가드).
 * `/category` 는 `/:inquiry_id` 보다 먼저 둔다. 큐 경로(문의 등록)는 같은 경로 접두의 inquiry.controller.queue.ts(InquiryQueueController)에 둔다.
 */
@ApiTags('문의')
@Controller('/api/v1/user-service/inquiry')
export class InquiryController {
    /**
     * @param internalHttp 동기 경로 — user-service 내부 HTTP
     */
    constructor(private readonly internalHttp: InternalHttpClient) {}

    /**
     * 문의 카테고리 목록 (로그인 없음) — 보일 순서. 문의 등록의 카테고리 고르기 · 이용자 · 관리 목록의 카테고리 거르기가 같이 쓴다
     */
    @Get('/category')
    @HttpCode(200)
    @ApiOperation({summary: '문의 카테고리 목록'})
    @ApiOkResponse({type: InquiryCategoryListResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getInquiryCategoryList(): Promise<InquiryCategoryListResultDto> {
        return this.internalHttp.request<InquiryCategoryListResultDto>('user', 'GET', INQUIRY_USER_INTERNAL_PATH.CATEGORY_LIST);
    }

    /**
     * 내 문의 목록 — 카테고리 · 상태 거르기(없으면 전체), 블라인드된 문의도 블라인드 상태로 나온다, 최신순
     */
    @Get('/')
    @UseGuards(PassportJwtAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 문의 목록'})
    @ApiOkResponse({type: InquiryListResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getMyInquiryList(@PassportActor() actor: Actor, @Query() query: InquiryListDto): Promise<InquiryListResultDto> {
        const dto = new InquiryListDto(query);
        return this.internalHttp.request<InquiryListResultDto>('user', 'GET', INQUIRY_USER_INTERNAL_PATH.LIST, {actor, query: dto});
    }

    /**
     * 내 문의 상세 — 답변 포함, 블라인드된 문의도 내용 그대로(안내 문구는 화면이 띄운다). 남의 문의는 404
     */
    @Get('/:inquiry_id')
    @UseGuards(PassportJwtAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 문의 상세'})
    @ApiOkResponse({type: InquiryDetailResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getMyInquiry(@PassportActor() actor: Actor, @Param() param: InquiryDetailParamDto): Promise<InquiryDetailResultDto> {
        return this.internalHttp.request<InquiryDetailResultDto>('user', 'GET', INQUIRY_USER_INTERNAL_PATH.inquiry(param.inquiry_id), {actor});
    }
}

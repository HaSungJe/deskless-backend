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
import {InquiryManageDetailParamDto, InquiryManageDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-detail.dto.js';
import {InquiryManageListDto, InquiryManageListResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-list.dto.js';
import {INQUIRY_INTERNAL_PATH} from '@app/contracts/inquiry/inquiry.commands.js';
import {PassportJwtAdminAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.admin.guard.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtManagerAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.manager.guard.js';
import {InternalHttpClient} from '../../../../../modules/transport/internal-http.client.js';

/**
 * 문의 관리 공개 API — 동기 경로(내부 HTTP → admin-service inquiry). `/mine…` 은 매니저 가드(업체 총관리자 · 업체 관리자 — 소속 업체 문의), 그 밖은 관리자 가드(총관리자 · 관리자 — 바로방 문의).
 * `/mine` · `/mine/:inquiry_id` 는 `/:inquiry_id` 보다 먼저 둔다. 큐 경로(답변 · 블라인드 · 해제)는 같은 경로 접두의 inquiry.controller.queue.ts.
 */
@ApiTags('문의 관리')
@Controller('/api/v1/admin-service/inquiry')
export class InquiryController {
    /**
     * @param internalHttp 동기 경로 — admin-service 내부 HTTP
     */
    constructor(private readonly internalHttp: InternalHttpClient) {}

    /**
     * 내 업체 문의 목록 (업체 총관리자 · 업체 관리자) — 카테고리 · 상태(없으면 전체) · 검색어(제목 · 내용), 최신순
     */
    @Get('/mine')
    @UseGuards(PassportJwtManagerAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 업체 문의 목록'})
    @ApiOkResponse({type: InquiryManageListResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getMyStoreInquiryList(@PassportActor() actor: Actor, @Query() query: InquiryManageListDto): Promise<InquiryManageListResultDto> {
        const dto = new InquiryManageListDto(query);
        return this.internalHttp.request<InquiryManageListResultDto>('admin', 'GET', INQUIRY_INTERNAL_PATH.MINE_LIST, {actor, query: dto});
    }

    /**
     * 내 업체 문의 상세 (업체 총관리자 · 업체 관리자) — 작성자 · 카테고리 · 내용 · 답변 · 블라인드. 다른 업체 · 바로방 문의는 404
     */
    @Get('/mine/:inquiry_id')
    @UseGuards(PassportJwtManagerAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 업체 문의 상세'})
    @ApiOkResponse({type: InquiryManageDetailResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getMyStoreInquiry(@PassportActor() actor: Actor, @Param() param: InquiryManageDetailParamDto): Promise<InquiryManageDetailResultDto> {
        return this.internalHttp.request<InquiryManageDetailResultDto>('admin', 'GET', INQUIRY_INTERNAL_PATH.mineInquiry(param.inquiry_id), {actor});
    }

    /**
     * 바로방 문의 목록 (총관리자 · 관리자) — 업체 대상이 아닌 문의만, 카테고리 · 상태(없으면 전체) · 검색어(제목 · 내용), 최신순
     */
    @Get('/')
    @UseGuards(PassportJwtAdminAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: '바로방 문의 목록'})
    @ApiOkResponse({type: InquiryManageListResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getInquiryList(@PassportActor() actor: Actor, @Query() query: InquiryManageListDto): Promise<InquiryManageListResultDto> {
        const dto = new InquiryManageListDto(query);
        return this.internalHttp.request<InquiryManageListResultDto>('admin', 'GET', INQUIRY_INTERNAL_PATH.LIST, {actor, query: dto});
    }

    /**
     * 바로방 문의 상세 (총관리자 · 관리자) — 업체 문의는 404
     */
    @Get('/:inquiry_id')
    @UseGuards(PassportJwtAdminAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: '바로방 문의 상세'})
    @ApiOkResponse({type: InquiryManageDetailResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getInquiry(@PassportActor() actor: Actor, @Param() param: InquiryManageDetailParamDto): Promise<InquiryManageDetailResultDto> {
        return this.internalHttp.request<InquiryManageDetailResultDto>('admin', 'GET', INQUIRY_INTERNAL_PATH.inquiry(param.inquiry_id), {actor});
    }
}

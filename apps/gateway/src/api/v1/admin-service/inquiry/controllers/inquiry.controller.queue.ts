import {Body, Controller, Ip, Param, Patch, Put, Res, UseGuards} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiProduces,
    ApiServiceUnavailableResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {Response} from 'express';
import {ApiFailResultDto} from '@app/common/dto/global.result.dto.js';
import type {Actor} from '@app/contracts/actor.js';
import {InquiryAnswerDto, InquiryAnswerParamDto} from '@app/contracts/inquiry/dto/inquiry-answer.dto.js';
import {InquiryBlindParamDto} from '@app/contracts/inquiry/dto/inquiry-blind.dto.js';
import {InquiryUnblindParamDto} from '@app/contracts/inquiry/dto/inquiry-unblind.dto.js';
import {INQUIRY_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import {PassportJwtAdminAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.admin.guard.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtManagerAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.manager.guard.js';
import {CommandStreamService} from '../../../../../modules/transport/command-stream.service.js';

/**
 * 문의 관리 공개 API — 큐 경로(RabbitMQ `admin.inquiry.*` → admin-service + 요청 단위 SSE). `/mine…` 은 매니저 가드(소속 업체 문의), 그 밖은 관리자 가드(바로방 문의).
 * 블라인드 · 해제는 상세에서 한 건씩 한다(사용자 결정 2026-11-24). path param 은 payload 에 합쳐 보낸다. 조회(동기)는 같은 경로 접두의 inquiry.controller.ts.
 */
@ApiTags('문의 관리')
@Controller('/api/v1/admin-service/inquiry')
export class InquiryQueueController {
    /**
     * @param commandStream 명령 발행 + 요청 단위 SSE
     */
    constructor(private readonly commandStream: CommandStreamService) {}

    /**
     * 내 업체 문의 답변 (업체 총관리자 · 업체 관리자) — 답변을 달거나 통째로 고치고 답변완료로. 블라인드된 문의는 400. done 의 data 는 null.
     */
    @Put('/mine/:inquiry_id/answer')
    @UseGuards(PassportJwtManagerAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 업체 문의 답변'})
    @ApiBody({type: InquiryAnswerDto})
    @ApiProduces('text/event-stream')
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async answerMyStoreInquiry(@PassportActor() actor: Actor, @Param() param: InquiryAnswerParamDto, @Body() dto: InquiryAnswerDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_COMMAND.MINE_ANSWER, actor, payload: {...param, ...dto}, client_ip: ip});
    }

    /**
     * 내 업체 문의 블라인드 (업체 총관리자 · 업체 관리자) — 상세에서 본 부적절한 문의 한 건. 이미 블라인드면 400. done 의 data 는 null.
     */
    @Patch('/mine/:inquiry_id/blind')
    @UseGuards(PassportJwtManagerAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 업체 문의 블라인드'})
    @ApiProduces('text/event-stream')
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async blindMyStoreInquiry(@PassportActor() actor: Actor, @Param() param: InquiryBlindParamDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_COMMAND.MINE_BLIND, actor, payload: {...param}, client_ip: ip});
    }

    /**
     * 내 업체 문의 블라인드 해제 (업체 총관리자 · 업체 관리자) — 답변이 있으면 답변완료, 없으면 접수로. 블라인드가 아니면 400. done 의 data 는 null.
     */
    @Patch('/mine/:inquiry_id/unblind')
    @UseGuards(PassportJwtManagerAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '내 업체 문의 블라인드 해제'})
    @ApiProduces('text/event-stream')
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async unblindMyStoreInquiry(@PassportActor() actor: Actor, @Param() param: InquiryUnblindParamDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_COMMAND.MINE_UNBLIND, actor, payload: {...param}, client_ip: ip});
    }

    /**
     * 바로방 문의 답변 (총관리자 · 관리자) — 답변을 달거나 통째로 고치고 답변완료로. 업체 문의는 404, 블라인드된 문의는 400. done 의 data 는 null.
     */
    @Put('/:inquiry_id/answer')
    @UseGuards(PassportJwtAdminAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '바로방 문의 답변'})
    @ApiBody({type: InquiryAnswerDto})
    @ApiProduces('text/event-stream')
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async answerInquiry(@PassportActor() actor: Actor, @Param() param: InquiryAnswerParamDto, @Body() dto: InquiryAnswerDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_COMMAND.ANSWER, actor, payload: {...param, ...dto}, client_ip: ip});
    }

    /**
     * 바로방 문의 블라인드 (총관리자 · 관리자) — 상세에서 본 부적절한 문의 한 건. 업체 문의는 404, 이미 블라인드면 400. done 의 data 는 null.
     */
    @Patch('/:inquiry_id/blind')
    @UseGuards(PassportJwtAdminAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '바로방 문의 블라인드'})
    @ApiProduces('text/event-stream')
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async blindInquiry(@PassportActor() actor: Actor, @Param() param: InquiryBlindParamDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_COMMAND.BLIND, actor, payload: {...param}, client_ip: ip});
    }

    /**
     * 바로방 문의 블라인드 해제 (총관리자 · 관리자) — 답변이 있으면 답변완료, 없으면 접수로. 업체 문의는 404, 블라인드가 아니면 400. done 의 data 는 null.
     */
    @Patch('/:inquiry_id/unblind')
    @UseGuards(PassportJwtAdminAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '바로방 문의 블라인드 해제'})
    @ApiProduces('text/event-stream')
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async unblindInquiry(@PassportActor() actor: Actor, @Param() param: InquiryUnblindParamDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_COMMAND.UNBLIND, actor, payload: {...param}, client_ip: ip});
    }
}

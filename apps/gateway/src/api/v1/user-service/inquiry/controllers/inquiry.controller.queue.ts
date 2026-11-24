import {Body, Controller, Ip, Post, Res, UseGuards} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiProduces,
    ApiServiceUnavailableResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {Response} from 'express';
import {ApiFailResultDto} from '@app/common/dto/global.result.dto.js';
import type {Actor} from '@app/contracts/actor.js';
import {InquiryDto, InquiryResultDto} from '@app/contracts/inquiry/dto/inquiry.dto.js';
import {INQUIRY_USER_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.guard.js';
import {CommandStreamService} from '../../../../../modules/transport/command-stream.service.js';

/**
 * 문의 공개 API (이용자) — 큐 경로(RabbitMQ `user.inquiry.create` → user-service + 요청 단위 SSE). 이용자 가드.
 * 조회(동기)는 같은 경로 접두의 inquiry.controller.ts.
 */
@ApiTags('문의')
@Controller('/api/v1/user-service/inquiry')
export class InquiryQueueController {
    /**
     * @param commandStream 명령 발행 + 요청 단위 SSE
     */
    constructor(private readonly commandStream: CommandStreamService) {}

    /**
     * 문의 등록 — 업체를 고르면(업체 이름 검색) 그 업체, 안 고르면 바로방에 카테고리를 골라 접수. 동의 항목은 화면이 등록 전에 체크한다(보내지 않는다). done 의 data 는 문의 ID.
     */
    @Post('/')
    @UseGuards(PassportJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: '문의 등록'})
    @ApiBody({type: InquiryDto})
    @ApiProduces('text/event-stream')
    @ApiOkResponse({type: InquiryResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiNotFoundResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async createInquiry(@PassportActor() actor: Actor, @Body() dto: InquiryDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: INQUIRY_USER_COMMAND.CREATE, actor, payload: dto, client_ip: ip});
    }
}

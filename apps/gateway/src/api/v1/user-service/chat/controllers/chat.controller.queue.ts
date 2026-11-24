import {Controller, Delete, Ip, Res, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiInternalServerErrorResponse, ApiOperation, ApiProduces, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse} from '@nestjs/swagger';
import type {Response} from 'express';
import {ApiFailResultDto} from '@app/common/dto/global.result.dto.js';
import type {Actor} from '@app/contracts/actor.js';
import {CHAT_COMMAND} from '@app/contracts/chat/chat.commands.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.guard.js';
import {CommandStreamService} from '../../../../../modules/transport/command-stream.service.js';

/**
 * AI 대화형 업체 검색 공개 API (이용자) — 큐 경로(RabbitMQ `user.chat.clear` → user-service + 요청 단위 SSE). 이용자 가드.
 */
@ApiTags('AI 업체 검색')
@Controller('/api/v1/user-service/chat')
export class ChatQueueController {
    /**
     * @param commandStream 명령 발행 + 요청 단위 SSE
     */
    constructor(private readonly commandStream: CommandStreamService) {}

    /**
     * 대화 초기화 — 내 대화 이력을 7일 기다리지 않고 바로 모두 지운다. 오늘 남은 질문 수는 그대로. done 의 data 는 null.
     */
    @Delete('/')
    @UseGuards(PassportJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: 'AI 대화 초기화'})
    @ApiProduces('text/event-stream')
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async clearChat(@PassportActor() actor: Actor, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.commandStream.dispatch(res, {type: CHAT_COMMAND.CLEAR, actor, payload: {}, client_ip: ip});
    }
}

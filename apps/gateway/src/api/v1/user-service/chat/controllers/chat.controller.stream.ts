import {Body, Controller, Ip, Post, Res, UseGuards} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiConflictResponse,
    ApiInternalServerErrorResponse,
    ApiOkResponse,
    ApiOperation,
    ApiProduces,
    ApiServiceUnavailableResponse,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {Response} from 'express';
import {ApiFailResultDto} from '@app/common/dto/global.result.dto.js';
import type {Actor} from '@app/contracts/actor.js';
import {CHAT_INTERNAL_PATH} from '@app/contracts/chat/chat.commands.js';
import {ChatMessageDoneResultDto, ChatMessageDto} from '@app/contracts/chat/dto/chat-message.dto.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.guard.js';
import {InternalHttpClient} from '../../../../../modules/transport/internal-http.client.js';

/**
 * AI 대화형 업체 검색 공개 API (이용자) — 내부 HTTP 스트리밍(세 번째 전달 경로 — docs/streaming.md). user-service 의 SSE 스트림을 그대로 흘린다.
 * 응답이 스트림이라 동기(chat.controller.ts) · 큐(chat.controller.queue.ts) 컨트롤러와 파일을 나눈다.
 */
@ApiTags('AI 업체 검색')
@Controller('/api/v1/user-service/chat')
export class ChatStreamController {
    /**
     * @param internalHttp 내부 HTTP — user-service 스트림
     */
    constructor(private readonly internalHttp: InternalHttpClient) {}

    /**
     * 메시지 보내기 — SSE 스트림: progress(SEARCHING_WEB · SEARCHING_STORES · ANSWERING) → stores(업체 카드 0 ~ 3) → delta(글 조각, 여러 번) → done({message, quota}).
     * 시작 전 실패는 일반 HTTP 응답(다른 질문에 답하는 중 409 · 오늘 질문을 다 씀 429(resets_at) · 입력 400), 시작 뒤 실패는 failed 이벤트(저장 · 횟수 없음).
     */
    @Post('/message')
    @UseGuards(PassportJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: 'AI 메시지 보내기 (스트림)'})
    @ApiBody({type: ChatMessageDto})
    @ApiProduces('text/event-stream')
    @ApiOkResponse({type: ChatMessageDoneResultDto})
    @ApiBadRequestResponse({type: ApiFailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiConflictResponse({type: ApiFailResultDto})
    @ApiTooManyRequestsResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async sendMessage(@PassportActor() actor: Actor, @Body() dto: ChatMessageDto, @Ip() ip: string, @Res() res: Response): Promise<void> {
        await this.internalHttp.stream('user', CHAT_INTERNAL_PATH.MESSAGE, res, {actor, body: dto, client_ip: ip});
    }
}

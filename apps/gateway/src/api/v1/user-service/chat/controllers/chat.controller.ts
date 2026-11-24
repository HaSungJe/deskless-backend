import {Controller, Get, HttpCode, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse} from '@nestjs/swagger';
import {ApiFailResultDto} from '@app/common/dto/global.result.dto.js';
import type {Actor} from '@app/contracts/actor.js';
import {CHAT_INTERNAL_PATH} from '@app/contracts/chat/chat.commands.js';
import {ChatDetailResultDto} from '@app/contracts/chat/dto/chat-detail.dto.js';
import {ChatQuotaResultDto} from '@app/contracts/chat/dto/chat-quota.dto.js';
import {PassportActor} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.decorator.js';
import {PassportJwtAuthGuard} from '../../../../../guards/passport.jwt.auth/passport.jwt.auth.guard.js';
import {InternalHttpClient} from '../../../../../modules/transport/internal-http.client.js';

/**
 * AI 대화형 업체 검색 공개 API (이용자) — 동기 경로(내부 HTTP → user-service chat 도메인). 대화 보기 · 남은 질문 수(이용자 가드).
 * 메시지 보내기(스트림)는 chat.controller.stream.ts(ChatStreamController), 대화 초기화(큐)는 chat.controller.queue.ts(ChatQueueController).
 */
@ApiTags('AI 업체 검색')
@Controller('/api/v1/user-service/chat')
export class ChatController {
    /**
     * @param internalHttp 동기 경로 — user-service 내부 HTTP
     */
    constructor(private readonly internalHttp: InternalHttpClient) {}

    /**
     * 대화 보기 — 내 대화 이력(7일 안, 오래된 순 — 질문 한 건이 USER · AI 두 메시지) · 오늘 남은 질문 수
     */
    @Get('/')
    @UseGuards(PassportJwtAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: 'AI 대화 보기'})
    @ApiOkResponse({type: ChatDetailResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getChat(@PassportActor() actor: Actor): Promise<ChatDetailResultDto> {
        return this.internalHttp.request<ChatDetailResultDto>('user', 'GET', CHAT_INTERNAL_PATH.DETAIL, {actor});
    }

    /**
     * 남은 질문 수 — 하루(한국 자정 초기화) 한도 · 오늘 쓴 수 · 남은 수 · 초기화 시각 · 답하는 중인지
     */
    @Get('/quota')
    @UseGuards(PassportJwtAuthGuard)
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({summary: 'AI 남은 질문 수'})
    @ApiOkResponse({type: ChatQuotaResultDto})
    @ApiUnauthorizedResponse({type: ApiFailResultDto})
    @ApiServiceUnavailableResponse({type: ApiFailResultDto})
    @ApiInternalServerErrorResponse({type: ApiFailResultDto})
    async getQuota(@PassportActor() actor: Actor): Promise<ChatQuotaResultDto> {
        return this.internalHttp.request<ChatQuotaResultDto>('user', 'GET', CHAT_INTERNAL_PATH.QUOTA, {actor});
    }
}

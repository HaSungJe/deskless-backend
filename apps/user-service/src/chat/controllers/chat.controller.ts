import {Controller, Get, HttpCode} from '@nestjs/common';
import {InternalActor} from '@app/common/internal/internal-request.decorator.js';
import type {ChatDetailResultDto} from '@app/contracts/chat/dto/chat-detail.dto.js';
import type {ChatQuotaResultDto} from '@app/contracts/chat/dto/chat-quota.dto.js';
import {ChatService} from '../chat.service.js';

/**
 * chat 내부 HTTP 컨트롤러 (AI 대화형 업체 검색 — 이용자, 동기 조회) — 게이트웨이만 부른다(전역 InternalAuthGuard). 위임만.
 * 메시지 보내기(스트림)는 chat.controller.stream.ts, 대화 초기화(큐)는 chat.controller.queue.ts.
 */
@Controller('/internal/v1/user-service/chat')
export class ChatController {
    /**
     * @param chatService chat 비즈니스 로직
     */
    constructor(private readonly chatService: ChatService) {}

    /**
     * 대화 보기 — 내 대화 이력 · 남은 질문 수
     */
    @Get('/')
    @HttpCode(200)
    async getChat(@InternalActor('user_id') user_id: string): Promise<ChatDetailResultDto> {
        return this.chatService.getChat(user_id);
    }

    /**
     * 남은 질문 수
     */
    @Get('/quota')
    @HttpCode(200)
    async getQuota(@InternalActor('user_id') user_id: string): Promise<ChatQuotaResultDto> {
        return this.chatService.getQuota(user_id);
    }
}

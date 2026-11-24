import {Injectable} from '@nestjs/common';
import {CHAT_COMMAND} from '@app/contracts/chat/chat.commands.js';
import type {MessageEnvelope} from '@app/contracts/message-envelope.js';
import {requireActor} from '@app/messaging/messaging.util.js';
import {OnCommand} from '@app/messaging/on-command.decorator.js';
import {ChatService} from '../chat.service.js';

/**
 * chat 큐 경로 컨트롤러 (AI 대화형 업체 검색 — 이용자, RabbitMQ 인바운드 어댑터) — 게이트웨이가 발행한 `user.chat.*` 명령을 `@OnCommand` 로 받아 service 로 넘긴다(위임만).
 * 로그인 이용자 명령이라 actor 가 필요하다.
 */
@Injectable()
export class ChatQueueController {
    /**
     * @param chatService chat 비즈니스 로직
     */
    constructor(private readonly chatService: ChatService) {}

    /**
     * 대화 초기화 — 내 대화 이력을 바로 모두 지운다(본문 없음)
     *
     * @param command 명령 봉투 (actor 필수)
     */
    @OnCommand(CHAT_COMMAND.CLEAR)
    async clearChat(command: MessageEnvelope<Record<string, never>>): Promise<void> {
        return this.chatService.clearChat(requireActor(command).user_id);
    }
}

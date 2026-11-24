import {Body, Controller, Post, Res} from '@nestjs/common';
import type {Response} from 'express';
import {InternalActor} from '@app/common/internal/internal-request.decorator.js';
import {abortOnClose, writeSseStream} from '@app/common/utils/sse.js';
import {CHAT_STREAM_EVENT} from '@app/contracts/chat/chat.commands.js';
import {ChatMessageDto} from '@app/contracts/chat/dto/chat-message.dto.js';
import {ChatService} from '../chat.service.js';

/**
 * chat 스트림 컨트롤러 (내부 HTTP 스트리밍 — 세 번째 전달 경로, docs/streaming.md) — 응답이 SSE 스트림이라 동기 · 큐 컨트롤러와 파일을 나눈다.
 * service 의 이벤트 generator 를 writeSseStream 으로 이어 쓴다(시작 전 실패는 전역 필터가 HTTP 상태 · 실패 본문으로, 시작 뒤 실패는 failed 이벤트).
 * 연결이 끊기면 abortOnClose 신호로 service 의 AI 요청이 멈춘다. 위임만.
 */
@Controller('/internal/v1/user-service/chat')
export class ChatStreamController {
    /**
     * @param chatService chat 비즈니스 로직
     */
    constructor(private readonly chatService: ChatService) {}

    /**
     * 메시지 보내기 — SSE 스트림(progress → stores → delta … → done)
     */
    @Post('/message')
    async sendMessage(@InternalActor('user_id') user_id: string, @Body() dto: ChatMessageDto, @Res() res: Response): Promise<void> {
        await writeSseStream(res, this.chatService.sendMessage(user_id, dto, abortOnClose(res)), CHAT_STREAM_EVENT.FAILED);
    }
}

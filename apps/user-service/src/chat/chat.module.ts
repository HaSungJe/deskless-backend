import {Module} from '@nestjs/common';
import {ChatController} from './controllers/chat.controller.js';
import {ChatQueueController} from './controllers/chat.controller.queue.js';
import {ChatStreamController} from './controllers/chat.controller.stream.js';
import {CHAT_REPOSITORY} from './chat.symbols.js';
import {ChatService} from './chat.service.js';
import {ChatRepository} from './repositories/chat.repository.js';

/**
 * chat 도메인 (AI 대화형 업체 검색 — 이용자) — 인바운드 어댑터 3종이 같은 service 를 부른다.
 * - ChatController(controllers/chat.controller.ts): 내부 HTTP — 대화 보기 · 남은 질문 수
 * - ChatStreamController(controllers/chat.controller.stream.ts): 내부 HTTP 스트리밍 — 메시지 보내기(SSE)
 * - ChatQueueController(controllers/chat.controller.queue.ts): RabbitMQ — 대화 초기화 (`@OnCommand` provider 라 providers 에 등록)
 * 대화 저장소(CONVERSATION_STORE) · AI(AI_GATEWAY) · 파일 저장소(STORAGE_GATEWAY)는 전역 모듈(루트 모듈 import)이 준다.
 */
@Module({controllers: [ChatController, ChatStreamController], providers: [ChatService, ChatQueueController, {provide: CHAT_REPOSITORY, useClass: ChatRepository}]})
export class ChatModule {}

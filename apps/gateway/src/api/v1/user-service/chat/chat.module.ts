import {Module} from '@nestjs/common';
import {ChatController} from './controllers/chat.controller.js';
import {ChatQueueController} from './controllers/chat.controller.queue.js';
import {ChatStreamController} from './controllers/chat.controller.stream.js';

/**
 * AI 대화형 업체 검색 라우트 모듈(/api/v1/user-service/chat — 이용자 가드) — 동기(ChatController) · 큐(ChatQueueController) · 스트림(ChatStreamController) 컨트롤러를 [동기, 큐, 스트림] 순으로 등록한다.
 */
@Module({controllers: [ChatController, ChatQueueController, ChatStreamController]})
export class ChatModule {}

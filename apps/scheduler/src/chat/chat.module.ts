import {Module} from '@nestjs/common';
import {ChatPurgeCrontab} from './crontabs/chat-purge.crontab.js';

/**
 * AI 대화 도메인(scheduler) — 지난 대화 지우기(1시간마다 · 7일 지난 대화). 대화 저장소 포트(CONVERSATION_STORE)는 루트 모듈의 ConversationStoreModule(전역)이 준다.
 */
@Module({providers: [ChatPurgeCrontab]})
export class ChatModule {}

import {Global, Module} from '@nestjs/common';
import {CONVERSATION_STORE} from '../integration.symbols.js';
import {RedisModule} from '../redis/redis.module.js';
import {RedisConversationStore} from './redis-conversation.store.js';

/**
 * 대화 저장소 포트(CONVERSATION_STORE) — Redis(AI 대화 이력 · 하루 질문 수 · 답하는 중 잠금). Redis 연결(RedisModule)을 함께 가져온다.
 * 쓰는 앱의 루트 모듈에서 import 한다 — user-service(AI 대화형 업체 검색) · scheduler(지난 대화 지우기).
 * 전역 — 도메인 모듈은 import 없이 `@Inject(CONVERSATION_STORE)` 로 주입받는다.
 */
@Global()
@Module({imports: [RedisModule], providers: [{provide: CONVERSATION_STORE, useClass: RedisConversationStore}], exports: [CONVERSATION_STORE]})
export class ConversationStoreModule {}

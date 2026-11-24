import {Global, Module} from '@nestjs/common';
import {AI_GATEWAY} from '../integration.symbols.js';
import {GeminiAiGateway} from './gemini-ai.gateway.js';

/**
 * AI 포트(AI_GATEWAY) — Google Gemini(정해진 JSON 응답 · 글 스트리밍 · 임베딩).
 * 쓰는 앱의 루트 모듈에서 import 한다 — user-service(AI 대화형 업체 검색) · scheduler(업체 검색 벡터 갱신).
 * 전역 — 도메인 모듈은 import 없이 `@Inject(AI_GATEWAY)` 로 주입받는다.
 */
@Global()
@Module({providers: [{provide: AI_GATEWAY, useClass: GeminiAiGateway}], exports: [AI_GATEWAY]})
export class AiModule {}

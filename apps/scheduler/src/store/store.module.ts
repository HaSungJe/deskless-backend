import {Module} from '@nestjs/common';
import {StoreEmbeddingCrontab} from './crontabs/store-embedding.crontab.js';
import {StoreRepository} from './repositories/store.repository.js';
import {STORE_REPOSITORY} from './store.symbols.js';

/**
 * 업체 도메인(scheduler) — 업체 검색 벡터 갱신(1시간마다 · 바뀐 업체만, AI 대화형 업체 검색). AI 포트(AI_GATEWAY)는 루트 모듈의 AiModule(전역)이 준다.
 */
@Module({providers: [StoreEmbeddingCrontab, {provide: STORE_REPOSITORY, useClass: StoreRepository}]})
export class StoreModule {}

import {Inject, Injectable} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {sha256Hex} from '@app/common/utils/hash.js';
import {JobLockService} from '@app/database/job-lock/job-lock.service.js';
import {AI_EMBED_TASK, AI_REQUEST_TIMEOUT_MS} from '@app/integration/integration.constants.js';
import {AI_GATEWAY} from '@app/integration/integration.symbols.js';
import type {AiGatewayInterface} from '@app/integration/interfaces/integration.interface.js';
import type {StoreRepositoryInterface} from '../interfaces/store.repository.interface.js';
import {STORE_REPOSITORY} from '../store.symbols.js';
import {buildStoreEmbeddingContent, chunkArray, isEmbeddingStale, readEmbeddingModel, STORE_EMBEDDING_BATCH, toStoreEmbeddingEntity} from '../store.util.js';

/** 업체 검색 벡터 갱신 잠금 키 */
export const STORE_EMBEDDING_LOCK = 'store.embedding';

/** 업체 검색 벡터 갱신 주기 — 매시 30분(초 분 시 일 월 요일 — 지난 대화 지우기의 정각과 겹치지 않게). @nestjs/schedule 의 CronExpression 에 매시 30분 상수가 없어 파일 상수로 둔다 */
export const STORE_EMBEDDING_CRON = '0 30 * * * *';

/**
 * 업체 검색 벡터 갱신 스케줄러 — AI 대화형 업체 검색이 쓰는 업체 벡터(t_store_embedding)를 바뀐 업체만 다시 만든다(사용자 결정 2026-11-25 — 1시간마다 1회).
 * 운영 데이터(업체 · 예약)를 바꾸지 않는 검색 색인이라 개발 환경에서도 돈다(운영 가드 없음 — 개발 DB 에서 AI 검색을 시험할 수 있게).
 * 키(GEMINI_API_KEY)가 비거나 AI 가 실패하면 그 회차를 멈추고 다음 회차에 다시 한다(이미 저장한 묶음은 남는다).
 */
@Injectable()
export class StoreEmbeddingCrontab {
    /**
     * @param storeRepository 업체 repository 포트
     * @param aiGateway AI 포트 (Gemini 임베딩)
     * @param jobLock 인스턴스 1대 실행 잠금
     */
    constructor(
        @Inject(STORE_REPOSITORY) private readonly storeRepository: StoreRepositoryInterface,
        @Inject(AI_GATEWAY) private readonly aiGateway: AiGatewayInterface,
        private readonly jobLock: JobLockService,
    ) {}

    /**
     * 1시간마다(매시 30분) — 활성 업체의 검색용 글을 만들어 내용 해시 · 모델이 바뀐 업체만 임베딩해 저장한다.
     */
    @Cron(STORE_EMBEDDING_CRON)
    async refreshStoreEmbeddings(): Promise<void> {
        await this.jobLock.runExclusive(STORE_EMBEDDING_LOCK, async () => {
            // ① 검색용 글 만들기 — 업체 · 객실 그룹 · 판매 상품
            const stores = await this.storeRepository.findEmbeddingStores();
            if (stores.length === 0) {
                return;
            }
            const store_ids = stores.map((store) => store.store_id);
            const groups = await this.storeRepository.findEmbeddingRoomGroups(store_ids);
            const plans = await this.storeRepository.findEmbeddingRoomPlans(store_ids);
            const saved = new Map((await this.storeRepository.findStoreEmbeddings(store_ids)).map((row) => [row.store_id, row]));
            const model = readEmbeddingModel();

            // ② 바뀐 업체 고르기 — 해시 · 모델이 다르거나 벡터가 없는 업체
            const targets = stores
                .map((store) => {
                    const content = buildStoreEmbeddingContent(store, groups, plans);
                    return {store_id: store.store_id, content, content_hash: sha256Hex(content)};
                })
                .filter((target) => isEmbeddingStale(saved.get(target.store_id) ?? null, target.content_hash, model));

            // ③ 벡터 만들기 — 묶음마다 한 번 호출, 실패하면 이 회차를 멈춘다(다음 회차에 남은 업체부터 다시)
            for (const chunk of chunkArray(targets, STORE_EMBEDDING_BATCH)) {
                try {
                    const vectors = await this.aiGateway.embed({texts: chunk.map((target) => target.content), task: AI_EMBED_TASK.DOCUMENT, signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)});
                    await this.storeRepository.upsertStoreEmbeddings(chunk.map((target, index) => toStoreEmbeddingEntity(target.store_id, target.content, target.content_hash, vectors[index], model)));
                } catch {
                    return;
                }
            }
        });
    }
}

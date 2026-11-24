import {Inject, Injectable} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import {dayjs} from '@app/common/utils/dayjs.js';
import {JobLockService} from '@app/database/job-lock/job-lock.service.js';
import {CONVERSATION_STORE} from '@app/integration/integration.symbols.js';
import type {ConversationStoreInterface} from '@app/integration/interfaces/integration.interface.js';

/** 지난 대화 지우기 잠금 키 */
export const CHAT_PURGE_LOCK = 'chat.purge';

/** 대화 보관 일수 — 7일(24 × 7시간) 지난 대화를 지운다(user-service chat.constants.ts CHAT_TURN_KEEP_DAYS 와 같다) */
export const CHAT_PURGE_KEEP_DAYS = 7;

/**
 * 지난 대화 지우기 스케줄러 — AI 대화형 업체 검색의 대화 이력(Redis)에서 7일 지난 대화를 지운다(사용자 결정 2026-11-24).
 * 대화는 DB 가 아니라 Redis 라 실제로 지운다(소프트 삭제 규칙은 DB 에만). 하루 질문 수 한 줄은 건드리지 않는다.
 * 운영 데이터(업체 · 예약)를 바꾸지 않아 개발 환경에서도 돈다. Redis 가 없으면 그 회차를 건너뛴다.
 */
@Injectable()
export class ChatPurgeCrontab {
    /**
     * @param conversationStore 대화 저장소 포트 (Redis)
     * @param jobLock 인스턴스 1대 실행 잠금
     */
    constructor(
        @Inject(CONVERSATION_STORE) private readonly conversationStore: ConversationStoreInterface,
        private readonly jobLock: JobLockService,
    ) {}

    /**
     * 1시간마다(매시 정각) — 이력이 있는 이용자마다 7일 지난 대화를 지우고, 대화가 남지 않은 이용자는 목록에서 뺀다.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async purgeConversations(): Promise<void> {
        await this.jobLock.runExclusive(CHAT_PURGE_LOCK, async () => {
            try {
                await this.conversationStore.purgeTurns(dayjs().subtract(CHAT_PURGE_KEEP_DAYS, 'day').toDate());
            } catch {
                // Redis 503 — 다음 회차에 다시
            }
        });
    }
}

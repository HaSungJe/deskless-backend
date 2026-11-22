import {HttpException, Injectable, Logger, Optional} from '@nestjs/common';
import type {Histogram} from 'prom-client';
import {toFailResult} from '@app/common/utils/fail-result.js';
import type {MessageEnvelope, ResultPayload} from '@app/contracts/message-envelope.js';
import {RESULT_STATUS} from '@app/contracts/message-envelope.js';
import {MetricsService} from '@app/monitoring/metrics.service.js';
import {CommandHandlerRegistry} from './command-handler.registry.js';
import {MAX_REDELIVERY} from './messaging.constants.js';
import {buildResultEnvelope, decodeEnvelope} from './messaging.util.js';

/** 명령 1건의 처리 결과(지표 라벨) — done: 성공, failed: 실패 회신(비즈니스 · 커밋 뒤 실패 · 마지막 인프라 실패), retry: 재시도, invalid: 형식 오류 · 핸들러 없음 */
type CommandOutcome = 'done' | 'failed' | 'retry' | 'invalid';

/** 메시지 처리 후 브로커에 할 일 */
export type DeliveryAction = 'ack' | 'requeue' | 'dead';

/** 명령 1건 처리 결과 — 브로커 조작과 회신할 결과를 분리해 돌려준다 */
export interface DispatchDecision {
    /** ack: 완료, requeue: 재시도, dead: DLQ 로 보냄 */
    action: DeliveryAction;
    /** 게이트웨이로 회신할 결과 (회신 대상이 없거나 재시도면 null) */
    result: MessageEnvelope<ResultPayload<unknown>> | null;
}

/**
 * 명령 1건을 핸들러에 넘기고 결과를 판정한다. 브로커를 직접 만지지 않아 단위 테스트할 수 있다.
 *
 * - 형식 오류 · 핸들러 없음 → dead (회신 불가)
 * - 성공 → done 결과 + ack
 * - 핸들러가 HttpException 을 반환(service 가 쓰기를 커밋한 뒤 실패를 return) → failed 결과 + ack — 이미 커밋됐으므로 상태 코드와 무관하게 재시도하지 않는다
 * - 비즈니스 실패(4xx throw) → failed 결과 + ack — 재시도해도 결과가 같으므로
 * - 인프라 실패(5xx throw) → 재시도 여유가 있으면 requeue, 마지막 시도면 failed 결과 + dead
 *
 * 비즈니스 규칙 위반은 service 가 HttpException(4xx)으로 던지고, repository 의 DB 장애는 500 으로 던진다는 기존 규약을 그대로 쓴다.
 */
@Injectable()
export class CommandDispatcher {
    private readonly logger = new Logger(CommandDispatcher.name);
    private readonly duration: Histogram<'type' | 'outcome'> | null;

    /**
     * @param registry 명령 핸들러 표
     * @param metrics 지표 레지스트리(모니터링 모듈이 없으면 없음 — 테스트)
     */
    constructor(
        private readonly registry: CommandHandlerRegistry,
        @Optional() metrics?: MetricsService,
    ) {
        this.duration =
            metrics?.histogram({name: 'messaging_command_duration_seconds', help: '큐 명령 1건 처리 시간(초) — outcome: done · failed · retry · invalid', labelNames: ['type', 'outcome']}) ?? null;
    }

    /**
     * 명령 1건을 처리한다 — 처리 시간 · 결과를 지표로 남긴다.
     *
     * @param content 메시지 내용
     * @param deliveryCount 이전 전달 횟수 (quorum queue 의 x-delivery-count, 첫 전달은 0)
     * @returns 판정
     */
    async dispatch(content: Buffer, deliveryCount: number): Promise<DispatchDecision> {
        const end = this.duration?.startTimer();
        const {type, outcome, decision} = await this.decide(content, deliveryCount);
        end?.({type, outcome});
        return decision;
    }

    /**
     * 명령 1건을 핸들러에 넘기고 판정한다.
     *
     * @param content 메시지 내용
     * @param deliveryCount 이전 전달 횟수
     * @returns 명령 type(형식 오류 · 핸들러 없음은 UNKNOWN — 라벨이 끝없이 늘지 않게) · 처리 결과 · 판정
     */
    private async decide(content: Buffer, deliveryCount: number): Promise<{type: string; outcome: CommandOutcome; decision: DispatchDecision}> {
        const command = decodeEnvelope<unknown>(content);
        if (!command) {
            this.logger.warn('형식이 올바르지 않은 명령을 DLQ 로 보냄');
            return {type: 'UNKNOWN', outcome: 'invalid', decision: {action: 'dead', result: null}};
        }

        const handler = this.registry.get(command.type);
        if (!handler) {
            this.logger.warn(`처리할 핸들러가 없는 명령을 DLQ 로 보냄: ${command.type}`);
            return {type: 'UNKNOWN', outcome: 'invalid', decision: {action: 'dead', result: null}};
        }

        const attempt = deliveryCount + 1;
        const canReply = Boolean(command.meta?.reply_to);
        try {
            const value = await handler(command);
            if (value instanceof HttpException) {
                // 커밋 뒤 실패 — 같은 실패 본문(toFailResult)으로 회신하고 재시도하지 않는다
                const fail = toFailResult(value);
                const failed = canReply ? buildResultEnvelope(command, RESULT_STATUS.FAILED, {result: null, error: {status_code: fail.status_code, body: fail.body}}, attempt) : null;
                return {type: command.type, outcome: 'failed', decision: {action: 'ack', result: failed}};
            }
            const result = canReply ? buildResultEnvelope(command, RESULT_STATUS.DONE, {result: value ?? null, error: null}, attempt) : null;
            return {type: command.type, outcome: 'done', decision: {action: 'ack', result}};
        } catch (error) {
            const fail = toFailResult(error);
            const isInfraFailure = fail.status_code >= 500;
            if (isInfraFailure) {
                this.logger.error(`명령 처리 실패(${attempt}회차): ${command.type}`, (error as Error)?.stack);
                if (deliveryCount < MAX_REDELIVERY) return {type: command.type, outcome: 'retry', decision: {action: 'requeue', result: null}};
            }
            const result = canReply ? buildResultEnvelope(command, RESULT_STATUS.FAILED, {result: null, error: {status_code: fail.status_code, body: fail.body}}, attempt) : null;
            return {type: command.type, outcome: 'failed', decision: {action: isInfraFailure ? 'dead' : 'ack', result}};
        }
    }
}

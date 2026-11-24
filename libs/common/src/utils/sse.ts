import type {Response} from 'express';
import {toFailResult} from '@app/common/utils/fail-result.js';

/** SSE 응답 헤더 — 버퍼링 끔(x-accel-buffering — 앞단 프록시가 모아 두지 않게) */
export const SSE_HEADERS = {'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no'} as const;

/** SSE 로 이어 쓸 이벤트 한 건 */
export interface SseEvent {
    event: string;
    data: unknown;
}

/**
 * SSE 이벤트 1건을 직렬화한다.
 *
 * @param event 이벤트 이름
 * @param data 본문 (JSON 직렬화)
 * @returns `event: <이름>\ndata: <JSON>\n\n`
 */
export function formatSseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data ?? null)}\n\n`;
}

/**
 * 클라이언트가 응답이 끝나기 전에 연결을 끊으면 멈추는 신호 — 스트림 controller 가 service 에 값으로 넘긴다(service 는 전송 객체를 받지 않는다).
 *
 * @param res 응답
 * @returns 끊기 신호
 */
export function abortOnClose(res: Response): AbortSignal {
    const controller = new AbortController();
    res.on('close', () => {
        if (!res.writableFinished) {
            controller.abort();
        }
    });
    return controller.signal;
}

/**
 * 이벤트를 SSE 로 이어 쓴다(내부 HTTP 스트리밍 — 스트림 controller 의 한 줄).
 * 첫 이벤트 전 실패는 예외를 그대로 던져 전역 필터가 HTTP 상태 · 실패 본문으로 답하게 하고(헤더를 아직 쓰지 않았다),
 * 첫 이벤트 뒤 실패는 failed_event 이벤트(`{status_code, ...실패 본문}` — 큐 경로 SSE failed 와 같은 모양)를 쓰고 닫는다.
 * 연결이 이미 끊겼으면 아무것도 쓰지 않고 generator 를 닫아 그 finally(잠금 풀기 등)가 돌게 한다.
 *
 * @param res 응답
 * @param events 이벤트 generator
 * @param failed_event 시작 뒤 실패를 알릴 이벤트 이름
 */
export async function writeSseStream(res: Response, events: AsyncGenerator<SseEvent>, failed_event: string): Promise<void> {
    // 여기서 던지면 시작 전 실패 — 그대로 위로
    const first = await events.next();
    res.status(200).set(SSE_HEADERS);
    res.flushHeaders();
    try {
        for (let item = first; !item.done; item = await events.next()) {
            if (res.writableEnded || res.destroyed) {
                await events.return(undefined);
                return;
            }
            res.write(formatSseEvent(item.value.event, item.value.data));
        }
    } catch (error) {
        if (!res.destroyed) {
            const fail = toFailResult(error);
            res.write(formatSseEvent(failed_event, {status_code: fail.status_code, ...fail.body}));
        }
    }
    if (!res.writableEnded) {
        res.end();
    }
}

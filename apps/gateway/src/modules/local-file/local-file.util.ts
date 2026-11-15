import {Transform} from 'node:stream';
import type {Response} from 'express';
import {PRIVATE_FILE_KEY_PREFIX} from '@app/integration/integration.constants.js';

/** 업로드 한도를 넘었을 때 스트림 오류 코드 */
export const LOCAL_FILE_TOO_LARGE_CODE = 'LOCAL_FILE_TOO_LARGE';

/**
 * 받은 바이트가 한도를 넘으면 오류를 내는 통과 스트림 — Content-Length 가 없거나 틀려도 디스크를 지킨다.
 *
 * @param max 한도(바이트)
 * @returns Transform 스트림
 */
export function createByteLimit(max: number): Transform {
    let received = 0;
    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length;
            if (received > max) {
                callback(Object.assign(new Error('파일이 한도를 넘었습니다.'), {code: LOCAL_FILE_TOO_LARGE_CODE}));
                return;
            }
            callback(null, chunk);
        },
    });
}

/**
 * 한도 초과 오류인지.
 *
 * @param error 스트림 오류
 * @returns 한도 초과면 true
 */
export function isTooLarge(error: unknown): boolean {
    return (error as {code?: string})?.code === LOCAL_FILE_TOO_LARGE_CODE;
}

/**
 * 쿼리 값 하나(문자열이 아니면 빈 문자열).
 *
 * @param value req.query 의 값
 * @returns 문자열
 */
export function readQueryValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

/**
 * 공개 경로(`/files/<키>`)의 키 — 앞의 / 를 떼고 디코드한다. 잘못된 인코딩 · 비공개 키(private/)는 빈 문자열(공개로 내주지 않는다).
 *
 * @param path req.path(`/files` 뒤)
 * @returns 저장 키 또는 빈 문자열
 */
export function readPublicKey(path: string): string {
    let key: string;
    try {
        key = decodeURIComponent(path.replace(/^\/+/, ''));
    } catch {
        return '';
    }
    return key.startsWith(PRIVATE_FILE_KEY_PREFIX) ? '' : key;
}

/**
 * 공통 실패 본문으로 답한다 — `{message, validation_errors: null}`.
 *
 * @param res 응답
 * @param status 상태 코드
 * @param message 한국어 메시지
 */
export function sendFail(res: Response, status: number, message: string): void {
    if (!res.headersSent) {
        res.status(status).json({message, validation_errors: null});
    }
}

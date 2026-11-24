import {HttpException, Injectable, ServiceUnavailableException} from '@nestjs/common';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {ReadableStream} from 'node:stream/web';
import type {Response as ExpressResponse} from 'express';
import type {Actor} from '@app/contracts/actor.js';
import {INTERNAL_HEADER} from '@app/contracts/actor.js';
import {readPositiveInt} from '@app/common/utils/env.js';
import {SSE_HEADERS} from '@app/common/utils/sse.js';
import {DEFAULT_INTERNAL_HTTP_TIMEOUT_MS, SERVICE_UNAVAILABLE_MESSAGE} from './transport.util.js';

/** 게이트웨이가 동기 호출하는 내부 서비스 — user: user-service(이용자), admin: admin-service(매니저 · 관리자) */
export type InternalService = 'user' | 'admin';

/** 서비스별 주소 환경변수와 기본값 */
const SERVICE_URL: Record<InternalService, {env: string; fallback: string}> = {
    user: {env: 'USER_SERVICE_URL', fallback: 'http://localhost:3010'},
    admin: {env: 'ADMIN_SERVICE_URL', fallback: 'http://localhost:3020'},
};

/** 내부 HTTP 요청 옵션 */
export interface InternalRequestOptions {
    /** JSON 본문 */
    body?: unknown;
    /** 로그인 회원 (헤더로 전달) */
    actor?: Actor | null;
    /** 클라이언트 IP (헤더로 전달) */
    client_ip?: string | null;
    /** 쿼리 문자열 — 값이 undefined · null 인 키는 뺀다(목록 Query DTO) */
    query?: object;
}

/**
 * 동기 경로 아웃바운드 어댑터 — 게이트웨이 → 서비스 내부 HTTP(+ 내부 HTTP 스트리밍 — stream).
 * 내부 토큰 · actor · 클라이언트 IP 헤더를 붙이고, 서비스의 실패 응답(상태 코드 + 본문)을 그대로 HttpException 으로 되던진다.
 * 그래서 게이트웨이 필터를 거쳐도 클라이언트는 서비스가 만든 실패 본문을 그대로 받는다.
 */
@Injectable()
export class InternalHttpClient {
    /**
     * 내부 서비스를 호출한다.
     *
     * @param service 대상 서비스
     * @param method HTTP 메서드
     * @param path 경로 (예: /internal/v1/user-service/user/login)
     * @param options 본문 · actor · 클라이언트 IP · 쿼리 문자열
     * @returns 응답 본문 (204 면 undefined)
     * @throws HttpException 서비스가 실패 응답을 주면 같은 상태 코드 · 본문으로
     * @throws ServiceUnavailableException 접속 실패 · 타임아웃
     */
    async request<T>(service: InternalService, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, options: InternalRequestOptions = {}): Promise<T> {
        const init: RequestInit = {
            method,
            headers: buildInternalHeaders(options),
            signal: AbortSignal.timeout(readPositiveInt(process.env.INTERNAL_HTTP_TIMEOUT_MS, DEFAULT_INTERNAL_HTTP_TIMEOUT_MS)),
        };
        if (options.body !== undefined && method !== 'GET') {
            init.body = JSON.stringify(options.body);
        }

        let response: Response;
        try {
            response = await fetch(`${serviceBaseUrl(service)}${path}${toQueryString(options.query)}`, init);
        } catch {
            throw new ServiceUnavailableException({message: SERVICE_UNAVAILABLE_MESSAGE});
        }

        const text = await response.text();
        const data = parseJson(text);
        if (!response.ok) {
            throw new HttpException(data && typeof data === 'object' ? data : {message: text || response.statusText}, response.status);
        }
        return data as T;
    }

    /**
     * 내부 서비스의 SSE 스트림 응답을 그대로 흘린다(내부 HTTP 스트리밍 — docs/streaming.md). POST 본문을 보내고,
     * 서비스가 시작 전에 실패하면(4xx · 5xx JSON) 같은 상태 코드 · 본문으로 던진다(게이트웨이 필터가 그대로 답한다).
     * 시작하면 SSE 헤더(버퍼링 끔)를 쓰고 본문을 그대로 넘긴다 — 조각이 계속 오므로 대기 시간을 두지 않고, 클라이언트가 끊으면 서비스 요청도 끊는다.
     *
     * @param service 대상 서비스
     * @param path 경로 (예: /internal/v1/user-service/chat/message)
     * @param res 클라이언트 응답
     * @param options 본문 · actor · 클라이언트 IP
     * @throws HttpException 서비스가 시작 전에 실패 응답을 주면 같은 상태 코드 · 본문으로
     * @throws ServiceUnavailableException 접속 실패
     */
    async stream(service: InternalService, path: string, res: ExpressResponse, options: InternalRequestOptions = {}): Promise<void> {
        const controller = new AbortController();
        res.on('close', () => {
            if (!res.writableFinished) {
                controller.abort();
            }
        });

        let response: Response;
        try {
            response = await fetch(`${serviceBaseUrl(service)}${path}`, {method: 'POST', headers: buildInternalHeaders(options), body: JSON.stringify(options.body ?? {}), signal: controller.signal});
        } catch {
            throw new ServiceUnavailableException({message: SERVICE_UNAVAILABLE_MESSAGE});
        }
        if (!response.ok || !response.body) {
            const text = await response.text();
            const data = parseJson(text);
            throw new HttpException(data && typeof data === 'object' ? data : {message: text || response.statusText}, response.status);
        }

        res.status(200).set(SSE_HEADERS);
        res.flushHeaders();
        try {
            await pipeline(Readable.fromWeb(response.body as ReadableStream<Uint8Array>), res);
        } catch {
            // 클라이언트 또는 서비스가 끊었다 — 헤더를 이미 썼으니 닫기만 한다
            if (!res.writableEnded) {
                res.end();
            }
        }
    }
}

/**
 * 서비스 주소 — 환경변수, 없으면 기본값.
 *
 * @param service 대상 서비스
 * @returns 주소
 */
function serviceBaseUrl(service: InternalService): string {
    return process.env[SERVICE_URL[service].env] || SERVICE_URL[service].fallback;
}

/**
 * 내부 요청 헤더 — JSON · 내부 토큰 · actor · 클라이언트 IP.
 *
 * @param options actor · 클라이언트 IP
 * @returns 헤더
 */
function buildInternalHeaders(options: InternalRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {'content-type': 'application/json', [INTERNAL_HEADER.TOKEN]: process.env.INTERNAL_API_TOKEN ?? ''};
    if (options.actor) {
        headers[INTERNAL_HEADER.ACTOR_USER_ID] = options.actor.user_id;
        headers[INTERNAL_HEADER.ACTOR_AUTH_ID] = options.actor.auth_id;
    }
    if (options.client_ip) {
        headers[INTERNAL_HEADER.CLIENT_IP] = options.client_ip;
    }
    return headers;
}

/**
 * 응답 본문을 JSON 으로 읽는다. 비었거나 JSON 이 아니면 undefined.
 *
 * @param text 응답 본문
 * @returns 파싱 결과
 */
function parseJson(text: string): unknown {
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/**
 * 쿼리 객체를 `?a=1&b=2` 로 바꾼다 — undefined · null 인 값은 뺀다. 없으면 빈 문자열.
 *
 * @param query 쿼리 객체
 * @returns 쿼리 문자열
 */
function toQueryString(query: object | undefined): string {
    if (!query) {
        return '';
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
            params.append(key, String(value));
        }
    }
    const text = params.toString();
    return text ? `?${text}` : '';
}

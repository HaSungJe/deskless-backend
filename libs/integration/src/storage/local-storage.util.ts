import {createHmac, timingSafeEqual} from 'node:crypto';
import {isAbsolute, resolve, sep} from 'node:path';
import {LOCAL_FILE_STORAGE_DIR_DEFAULT} from '../integration.constants.js';

/** 서명할 내부 파일 저장소 요청 — 업로드(PUT, Content-Type 포함) · 열람(GET, Content-Type 빈 값) */
export interface LocalFileRequest {
    method: 'PUT' | 'GET';
    key: string;
    content_type: string;
    /** 만료 — unix 초 */
    expires: number;
}

/**
 * 내부 파일 저장소 폴더 절대 경로 — FILE_STORAGE_DIR(없으면 storage/files)를 실행 위치 기준으로. 게이트웨이 · user-service · admin-service 가 같은 폴더를 봐야 한다.
 *
 * @param env 환경변수
 * @returns 절대 경로
 */
export function localFileStorageDir(env: NodeJS.ProcessEnv = process.env): string {
    return resolve(env.FILE_STORAGE_DIR || LOCAL_FILE_STORAGE_DIR_DEFAULT);
}

/**
 * 업로드 · 열람 주소 서명 — HMAC-SHA256(비밀값, 용도 · 메서드 · 키 · Content-Type · 만료). 업로드는 Content-Type 이 들어가 다른 형식으로는 올릴 수 없다(S3 presigned 와 같다).
 *
 * @param secret 비밀값(INTERNAL_API_TOKEN)
 * @param request 서명할 요청
 * @returns hex 서명
 */
export function signLocalFileRequest(secret: string, request: LocalFileRequest): string {
    return createHmac('sha256', secret)
        .update(['roomless-local-file', request.method, request.key, request.content_type, String(request.expires)].join('\n'))
        .digest('hex');
}

/**
 * 받은 서명이 맞고 아직 만료 전인지 — 시간차 안전 비교. 비밀값 · 키가 비었거나 만료가 정수가 아니면 false.
 *
 * @param secret 비밀값(INTERNAL_API_TOKEN)
 * @param request 받은 요청(메서드 · 키 · Content-Type · 만료)
 * @param signature 받은 hex 서명
 * @param now 지금 — unix 초
 * @returns 맞으면 true
 */
export function isValidLocalFileSignature(secret: string, request: LocalFileRequest, signature: string, now: number): boolean {
    if (!secret || !request.key || !Number.isInteger(request.expires) || request.expires < now) {
        return false;
    }
    const expected = Buffer.from(signLocalFileRequest(secret, request), 'hex');
    const received = Buffer.from(signature, 'hex');
    return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * 저장 키 → 폴더 안 파일 경로. 폴더 밖으로 나가는 키(`..` · 절대 경로 · 역슬래시 · NUL)는 null.
 *
 * @param root 폴더 절대 경로
 * @param key 저장 키
 * @returns 파일 절대 경로 또는 null
 */
export function resolveLocalFilePath(root: string, key: string): string | null {
    if (!key || isAbsolute(key) || key.includes('\\') || key.includes('\0')) {
        return null;
    }
    const path = resolve(root, key);
    return path.startsWith(root + sep) ? path : null;
}

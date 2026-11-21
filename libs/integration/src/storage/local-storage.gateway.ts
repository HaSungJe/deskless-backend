import {rm, stat} from 'node:fs/promises';
import {Injectable, InternalServerErrorException, Logger, OnApplicationBootstrap, ServiceUnavailableException} from '@nestjs/common';
import {dayjs} from '@app/common/utils/dayjs.js';
import {LOCAL_FILE_ROUTE, STORAGE_DOWNLOAD_URL_TTL_SECONDS, STORAGE_PUBLIC_URL_MISSING_MESSAGE, STORAGE_UNAVAILABLE_MESSAGE, STORAGE_UPLOAD_URL_TTL_SECONDS} from '../integration.constants.js';
import {gatewayPublicUrl} from '../integration.util.js';
import type {StorageBackendInterface, StorageDownloadResult, StorageUploadInput, StorageUploadResult} from '../interfaces/integration.interface.js';
import {localFileStorageDir, resolveLocalFilePath, signLocalFileRequest} from './local-storage.util.js';
import type {LocalFileRequest} from './local-storage.util.js';

/**
 * 파일 저장소 어댑터 — 내부 파일 저장소. 실제로 저장 · 제공한다(가짜 저장소가 아니다).
 * 저장소 포트(RoutingStorageGateway)가 AWS_S3_BUCKET 이 빌 때 업로드 저장소로(사용자 결정 2026-11-15), 버킷이 있어도 file_storage 가 LOCAL 인 행(S3 로 바꾸기 전에 올린 파일)을 읽고 지울 때 쓴다(사용자 결정 2026-11-18). 샘플 키는 라우터가 맡는다.
 * 파일은 FILE_STORAGE_DIR(기본 storage/files — Docker 는 공용 볼륨 deskless-files)에 있고, 받기 · 내주기는 게이트웨이 /files(modules/local-file), 확인 · 삭제는 이 어댑터가 같은 폴더에서 한다.
 * 업로드 · 열람 주소는 INTERNAL_API_TOKEN 으로 서명한다(S3 presigned 와 같은 쓰임 — 10분, 업로드는 Content-Type 까지). 키 · DB 행 모양은 S3 와 같다.
 * 세팅: docs/guides/aws-setup.md "AWS 없이 돌리기"
 */
@Injectable()
export class LocalStorageGateway implements StorageBackendInterface, OnApplicationBootstrap {
    private readonly logger = new Logger(LocalStorageGateway.name);
    private readonly root = localFileStorageDir();

    /**
     * 내부 파일 저장소를 업로드 저장소로 쓴다고 부팅 때 한 번 알리고(그때만 라우터가 부른다), GATEWAY_PUBLIC_URL 이 비어 있으면 경고한다. 부팅은 막지 않고 파일 주소 요청만 실패한다.
     */
    onApplicationBootstrap(): void {
        this.logger.log(`AWS_S3_BUCKET 이 비어 있어 내부 파일 저장소를 씁니다 — ${this.root} (게이트웨이 ${LOCAL_FILE_ROUTE})`);
        if (!gatewayPublicUrl()) {
            this.logger.warn('GATEWAY_PUBLIC_URL 이 비어 있어 파일 업로드 · 열람 · 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md');
        }
    }

    /**
     * 키 하나에 쓸 업로드 주소 — 게이트웨이 `/files/upload?key&expires&signature`(PUT, 같은 Content-Type 헤더).
     *
     * @param input 저장 키 · MIME 타입
     * @returns 업로드 주소 · 만료 시각
     * @throws ServiceUnavailableException GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 이 비어 주소를 만들지 못할 때
     */
    async createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult> {
        const expiresAt = dayjs().add(STORAGE_UPLOAD_URL_TTL_SECONDS, 'second');
        const upload_url = buildSignedUrl(this.logger, 'upload', {method: 'PUT', key: input.key, content_type: input.content_type, expires: expiresAt.unix()});
        return {upload_url, expires_at: expiresAt.toDate()};
    }

    /**
     * 폴더에 그 키의 파일이 있는지 — 폴더 밖 키는 false.
     *
     * @param key 저장 키
     * @returns 있으면 true
     * @throws ServiceUnavailableException 없음이 아닌 파일 시스템 오류
     */
    async exists(key: string): Promise<boolean> {
        const path = resolveLocalFilePath(this.root, key);
        if (!path) {
            return false;
        }
        try {
            return (await stat(path)).isFile();
        } catch (error) {
            if (isMissing(error)) {
                return false;
            }
            throw toUnavailable(this.logger, '파일 확인', error);
        }
    }

    /**
     * 공개 주소 — GATEWAY_PUBLIC_URL + `/files/<키>`.
     *
     * @param key 저장 키
     * @returns 공개 주소
     * @throws InternalServerErrorException GATEWAY_PUBLIC_URL 이 비어 있을 때
     */
    getPublicUrl(key: string): string {
        const base = gatewayPublicUrl();
        if (!base) {
            this.logger.error('GATEWAY_PUBLIC_URL 이 비어 있어 파일 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md');
            throw new InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE});
        }
        return `${base}${LOCAL_FILE_ROUTE}/${key}`;
    }

    /**
     * 비공개 파일 열람 주소 — 게이트웨이 `/files/download?key&expires&signature`(10분).
     *
     * @param key 저장 키
     * @returns 열람 주소 · 만료 시각
     * @throws ServiceUnavailableException GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 이 비어 주소를 만들지 못할 때
     */
    async createDownloadUrl(key: string): Promise<StorageDownloadResult> {
        const expiresAt = dayjs().add(STORAGE_DOWNLOAD_URL_TTL_SECONDS, 'second');
        const download_url = buildSignedUrl(this.logger, 'download', {method: 'GET', key, content_type: '', expires: expiresAt.unix()});
        return {download_url, expires_at: expiresAt.toDate()};
    }

    /**
     * 파일을 지운다 — 없어도 성공.
     *
     * @param key 저장 키
     * @throws ServiceUnavailableException 파일 시스템 오류
     */
    async remove(key: string): Promise<void> {
        const path = resolveLocalFilePath(this.root, key);
        if (!path) {
            return;
        }
        try {
            await rm(path, {force: true});
        } catch (error) {
            throw toUnavailable(this.logger, '파일 삭제', error);
        }
    }
}

/**
 * 게이트웨이 `/files/<action>` 서명 주소를 만든다.
 *
 * @param logger 어댑터 로거
 * @param action upload · download
 * @param request 서명할 요청
 * @returns 주소
 * @throws ServiceUnavailableException GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 이 비어 있을 때
 */
function buildSignedUrl(logger: Logger, action: 'upload' | 'download', request: LocalFileRequest): string {
    const base = gatewayPublicUrl();
    const secret = process.env.INTERNAL_API_TOKEN ?? '';
    if (!base || !secret) {
        logger.error(`GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 중 비어 있는 값이 있어 ${action === 'upload' ? '업로드' : '열람'} 주소를 만들 수 없습니다 — docs/guides/aws-setup.md`);
        throw new ServiceUnavailableException({message: STORAGE_UNAVAILABLE_MESSAGE});
    }
    const query = new URLSearchParams({key: request.key, expires: String(request.expires), signature: signLocalFileRequest(secret, request)});
    return `${base}${LOCAL_FILE_ROUTE}/${action}?${query.toString()}`;
}

/**
 * 파일이 없다는 오류인지(ENOENT · ENOTDIR).
 *
 * @param error 파일 시스템 오류
 * @returns 없음이면 true
 */
function isMissing(error: unknown): boolean {
    const code = (error as {code?: string})?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * 파일 시스템 오류를 로그로 남기고 503 으로 바꾼다.
 *
 * @param logger 어댑터 로거
 * @param action 실패한 작업
 * @param error 오류
 * @returns 던질 예외
 */
function toUnavailable(logger: Logger, action: string, error: unknown): ServiceUnavailableException {
    logger.error(`내부 파일 저장소 ${action} 실패: ${(error as Error)?.message ?? error}`);
    return new ServiceUnavailableException({message: STORAGE_UNAVAILABLE_MESSAGE});
}

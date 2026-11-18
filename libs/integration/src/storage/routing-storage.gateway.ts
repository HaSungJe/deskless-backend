import {Injectable, InternalServerErrorException, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {FILE_STORAGE, STORAGE_PUBLIC_URL_MISSING_MESSAGE} from '../integration.constants.js';
import {gatewayPublicUrl, isS3StorageConfigured, isSampleFileKey} from '../integration.util.js';
import type {FileStorage, StorageBackendInterface, StorageDownloadResult, StorageGatewayInterface, StorageUploadInput, StorageUploadResult, StoredFile} from '../interfaces/integration.interface.js';
import {LocalStorageGateway} from './local-storage.gateway.js';
import {S3StorageGateway} from './s3-storage.gateway.js';

/**
 * 파일 저장소 포트(STORAGE_GATEWAY) — S3 · 내부 파일 저장소 어댑터를 둘 다 두고 나눠 보낸다(사용자 결정 2026-11-18).
 * - 업로드 주소 · 업로드 확인: 지금 업로드 저장소(AWS_S3_BUCKET 이 있으면 S3, 비면 내부) — 그 값(getUploadStorage)을 service 가 파일 행 file_storage 에 적는다
 * - 공개 주소 · 열람 주소 · 삭제: 행의 file_storage(S3 → S3 어댑터, 그 밖 → 내부 어댑터) — S3 로 바꾼 뒤에도 그 전에 올린 파일은 내부에서 연다
 * - 샘플 키(`sample/` — 테스트 데이터 시드 사진): 저장소와 상관없이 GATEWAY_PUBLIC_URL/sample/…, 삭제는 건너뛴다(파일은 게이트웨이 assets)
 */
@Injectable()
export class RoutingStorageGateway implements StorageGatewayInterface, OnApplicationBootstrap {
    private readonly logger = new Logger(RoutingStorageGateway.name);
    private readonly s3 = new S3StorageGateway();
    private readonly local = new LocalStorageGateway();
    private readonly uploadStorage: FileStorage = isS3StorageConfigured() ? FILE_STORAGE.S3 : FILE_STORAGE.LOCAL;

    /**
     * 지금 업로드 저장소의 어댑터만 부팅 안내를 한다(쓰지 않는 쪽의 "값 비어 있음" 경고를 내지 않게).
     */
    onApplicationBootstrap(): void {
        this.backendOf(this.uploadStorage).onApplicationBootstrap();
    }

    /**
     * 새 파일을 올리는 저장소.
     *
     * @returns S3 · LOCAL
     */
    getUploadStorage(): FileStorage {
        return this.uploadStorage;
    }

    /**
     * 지금 업로드 저장소의 업로드 주소.
     *
     * @param input 저장 키 · MIME 타입
     * @returns 업로드 주소 · 만료 시각
     */
    createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult> {
        return this.backendOf(this.uploadStorage).createUploadUrl(input);
    }

    /**
     * 지금 업로드 저장소에 그 키로 올라왔는지.
     *
     * @param key 저장 키
     * @returns 있으면 true
     */
    exists(key: string): Promise<boolean> {
        return this.backendOf(this.uploadStorage).exists(key);
    }

    /**
     * 공개 주소 — 샘플 키는 GATEWAY_PUBLIC_URL/sample/…, 그 밖은 행의 저장소대로.
     *
     * @param file 파일 행(저장 키 · 저장소)
     * @returns 공개 주소
     * @throws InternalServerErrorException 기준 주소가 비어 있을 때
     */
    getPublicUrl(file: StoredFile): string {
        if (isSampleFileKey(file.file_key)) {
            const base = gatewayPublicUrl();
            if (!base) {
                this.logger.error('GATEWAY_PUBLIC_URL 이 비어 있어 샘플 사진 주소를 만들 수 없습니다 — docs/guides/sample-data.md');
                throw new InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE});
            }
            return `${base}/${file.file_key}`;
        }
        return this.backendOf(file.file_storage).getPublicUrl(file.file_key);
    }

    /**
     * 비공개 파일 열람 주소 — 행의 저장소대로.
     *
     * @param file 파일 행(저장 키 · 저장소)
     * @returns 열람 주소 · 만료 시각
     */
    createDownloadUrl(file: StoredFile): Promise<StorageDownloadResult> {
        return this.backendOf(file.file_storage).createDownloadUrl(file.file_key);
    }

    /**
     * 파일 삭제 — 행의 저장소에서. 샘플 키는 건너뛴다(파일은 게이트웨이 assets).
     *
     * @param file 파일 행(저장 키 · 저장소)
     */
    async remove(file: StoredFile): Promise<void> {
        if (isSampleFileKey(file.file_key)) {
            return;
        }
        await this.backendOf(file.file_storage).remove(file.file_key);
    }

    /**
     * 저장소 구분 → 어댑터(S3 가 아니면 내부 — 구분이 없던 행 포함).
     *
     * @param storage file_storage
     * @returns 어댑터
     */
    private backendOf(storage: string | null): StorageBackendInterface {
        return storage === FILE_STORAGE.S3 ? this.s3 : this.local;
    }
}

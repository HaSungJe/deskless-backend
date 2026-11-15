import {Global, Module} from '@nestjs/common';
import {STORAGE_GATEWAY} from '../integration.symbols.js';
import {isS3StorageConfigured} from '../integration.util.js';
import type {StorageGatewayInterface} from '../interfaces/integration.interface.js';
import {LocalStorageGateway} from './local-storage.gateway.js';
import {S3StorageGateway} from './s3-storage.gateway.js';

/**
 * 파일 저장소 포트(STORAGE_GATEWAY) — AWS_S3_BUCKET 이 있으면 Amazon S3, 비면 내부 파일 저장소(게이트웨이 /files — 사용자 결정 2026-11-15).
 * 파일을 다루는 앱의 루트 모듈에서 import 한다(전역 — 도메인 모듈은 import 없이 `@Inject(STORAGE_GATEWAY)` 로 주입받는다).
 */
@Global()
@Module({
    providers: [{provide: STORAGE_GATEWAY, useFactory: (): StorageGatewayInterface => (isS3StorageConfigured() ? new S3StorageGateway() : new LocalStorageGateway())}],
    exports: [STORAGE_GATEWAY],
})
export class StorageModule {}

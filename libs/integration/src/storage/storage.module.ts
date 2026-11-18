import {Global, Module} from '@nestjs/common';
import {STORAGE_GATEWAY} from '../integration.symbols.js';
import {RoutingStorageGateway} from './routing-storage.gateway.js';

/**
 * 파일 저장소 포트(STORAGE_GATEWAY) — RoutingStorageGateway 가 S3 · 내부 파일 저장소 어댑터를 나눠 쓴다.
 * 업로드는 AWS_S3_BUCKET 이 있으면 Amazon S3, 비면 내부 파일 저장소(게이트웨이 /files — 사용자 결정 2026-11-15), 읽기 · 삭제는 파일 행의 file_storage(사용자 결정 2026-11-18).
 * 파일을 다루는 앱의 루트 모듈에서 import 한다(전역 — 도메인 모듈은 import 없이 `@Inject(STORAGE_GATEWAY)` 로 주입받는다).
 */
@Global()
@Module({providers: [{provide: STORAGE_GATEWAY, useClass: RoutingStorageGateway}], exports: [STORAGE_GATEWAY]})
export class StorageModule {}

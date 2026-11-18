# Revision — 테스트 데이터 시드 + AWS 미설정 개발 모드(sample-data) — 261118-1

> 원래 spec · plan(`.beaver/output/spec/seed/sample-data-spec.md` · `plan/seed/sample-data-plan.md`)은 고치지 않고 참고만 한다.

## Reason for Change Request
지금 저장소는 "둘 중 하나" 라 `AWS_S3_BUCKET` 을 채워 S3 로 바꾸는 순간 내부 파일 저장소(`roomless-files` 볼륨)에 올려 둔 사진 주소가 모두 CloudFront 로 만들어져 깨진다(게이트웨이 `/files` 도 꺼진다). 사용자 결정(2026-11-18): S3 로 바꾼 뒤에도 내부 저장소에 남은 파일은 계속 내부에서 연다 — **어느 저장소의 파일인지는 파일 행에 구분값(`file_storage`)으로 적는다**(폴더에 있는지 매번 확인하는 안 대신 — 판단이 명시적이고, 볼륨이 빠졌을 때 조용히 S3 로 넘어가지 않는다).

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| 파일 행(`t_store_file` · `t_room_group_image`) | 저장 키만 | **`file_storage` 컬럼 추가** — `S3` · `LOCAL`(내부 파일 저장소, 시드 사진도 LOCAL). 기존 행은 마이그레이션 기본값으로 `LOCAL`(지금까지 버킷 없이 올린 것) |
| 업로드 등록(사진 · 업체 정보 파일 3곳) | 키 · 이름 · 형식 | + `file_storage` = 지금 업로드 저장소(`storageGateway.getUploadStorage()` — 버킷이 있으면 `S3`, 비면 `LOCAL`) |
| 저장소 포트 `getPublicUrl` · `createDownloadUrl` · `remove` | 키(`string`)를 받는다 | **파일 행(`{file_key, file_storage}`)을 받는다** — 엔티티 · 조회 행을 그대로 넘긴다. 행의 저장소대로 S3(CloudFront · S3 서명 · S3 삭제) 또는 내부(게이트웨이 `/files` · 서명 `/files/download` · 폴더 삭제) |
| `createUploadUrl` · `exists` | 키 | 그대로 — 지금 업로드 저장소 하나로 |
| 저장소 어댑터 | 버킷 유무로 S3 · 내부 중 하나만 등록(`useFactory`) | **`RoutingStorageGateway` 하나를 등록** — 안에 S3 · 내부 어댑터를 둘 다 두고, 업로드는 지금 저장소로, 읽기 · 삭제는 행의 저장소로 보낸다. 샘플 키(`sample/`)는 저장소와 상관없이 `/sample/`(삭제 건너뜀) — 두 어댑터에서 이 분기를 빼 라우터 한 곳으로 |
| 대표 사진 조회(객실 그룹 목록 · 반경 업체) | 하위 쿼리로 `cover_file_key` | + 같은 하위 쿼리로 `cover_file_storage` |
| 업체 정보 파일 조회 행(admin · user store) | `file_key` … `is_private` | + `file_storage` |
| 게이트웨이 `/files` (S3 모드) | 경로 없음(404) | **읽기만 연다** — 공개 · 서명 열람은 동작, 업로드(`PUT /files/upload`)는 다음 처리(404) |
| 공개 API(주소 · 요청 · 응답 · 실패 모양) | — | 그대로. 사진 주소 호스트가 행마다 게이트웨이 또는 CloudFront(프론트는 두 호스트를 이미 `remotePatterns` 에 둔다 — changes/2026-11-13) |

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `libs/database/src/entities/store/store-file.entity.ts` · `entities/room/room-group-image.entity.ts` | modify | `file_storage` 컬럼 |
| `libs/database/src/migrations/<ts>-FileStorage.ts` · `migrations.ts` | add · modify | `npm run db:generate -- FileStorage` 결과(컬럼 추가 · 기본값 LOCAL · COMMENT) — 적용은 사용자 |
| `libs/database/src/seeder/sample-seed.targets.ts` | modify | 시드 파일 행 `file_storage = 'LOCAL'` |
| `libs/integration/src/integration.constants.ts` | modify | `FILE_STORAGE` |
| `libs/integration/src/interfaces/integration.interface.ts` | modify | `FileStorage` · `StoredFile` · 포트(`getUploadStorage` · 행을 받는 세 메서드) · 어댑터용 `StorageBackendInterface`(키를 받는 옛 모양) |
| `libs/integration/src/storage/routing-storage.gateway.ts` | add | `RoutingStorageGateway` — 업로드는 지금 저장소, 읽기 · 삭제는 행의 저장소, 샘플 키 |
| `libs/integration/src/storage/s3-storage.gateway.ts` · `local-storage.gateway.ts` | modify | `StorageBackendInterface` 구현으로, 샘플 키 분기 삭제(라우터로) |
| `libs/integration/src/storage/storage.module.ts` | modify | `useClass: RoutingStorageGateway`(`useFactory` 삭제) |
| `apps/gateway/src/modules/local-file/local-file.server.ts` · `local-file.module.ts` | modify | S3 모드에서도 경로를 붙이고 업로드만 막는다, 주석 · 시작 로그 |
| `apps/admin-service/src/room/room.service.ts` | modify | 목록 대표 사진 · 상세 사진 · 그룹 삭제 · 사진 등록 · 사진 삭제 |
| `apps/admin-service/src/room/repositories/room.repository.ts` · `interfaces/room.repository.interface.ts` | modify | `cover_file_storage` 하위 쿼리 · `RoomGroupRow` |
| `apps/admin-service/src/store/store.service.ts` | modify | 신청 상세 · 업체 상세 · 내 업체 · 업체 사진 등록 · 삭제 |
| `apps/admin-service/src/store/repositories/store.repository.ts` · `interfaces/store.repository.interface.ts` | modify | `buildStoreFileRowsQuery` 에 `file_storage` · `StoreFileRow` |
| `apps/user-service/src/discovery/discovery.service.ts` · `repositories/discovery.repository.ts` · `interfaces/discovery.repository.interface.ts` | modify | 반경 업체 대표 사진 · 업체 사진 · 그룹 사진, `cover_file_storage` · `DiscoveryStoreRow` |
| `apps/user-service/src/store/store.service.ts` · `repositories/store.repository.ts` · `interfaces/store.repository.interface.ts` | modify | 내 신청 상세 · 파일 등록 · 파일 삭제 · 신청 취소, `file_storage` · `StoreFileRow` |
| spec(admin room · store, user discovery · store)과 `*.test-helper.ts` | modify | 저장소 mock 에 `getUploadStorage`, 호출 단언을 행 객체로, 등록 엔티티의 `file_storage`, Data-Access Smoke 의 대표 사진 · 파일 행 SQL |
| `docs/guides/aws-setup.md` · `docs/integration.md` · `docs/architecture.md` · `docs/data-layer.md` · `AGENTS.md` · `README.md` | modify | 저장소 구분값 · S3 전환 뒤 옛 파일 · `/files` 읽기 |
| `.beaver/output/report/seed/sample-data-report.md` | modify | `## Modification - 261118-1` |

## Code Changes

### 엔티티 · 시드 (libs/database)

```ts
// libs/database/src/entities/store/store-file.entity.ts · room/room-group-image.entity.ts — file_key 아래에 추가 (두 파일 같은 모양)
    @Column({
        name: 'file_storage',
        length: 10,
        nullable: false,
        default: 'LOCAL',
        comment: '저장소(S3: Amazon S3, LOCAL: 내부 파일 저장소 — 게이트웨이 /files · 샘플 사진도 LOCAL) — 올릴 때의 저장소, 주소 · 열람 · 삭제가 이 값을 따른다',
    })
    file_storage: string;
```
기본값 `LOCAL` 은 마이그레이션이 기존 행(버킷 없이 올린 파일 · 시드)을 채우는 값이다 — 새 행은 service 가 늘 직접 넣는다. 코드 값 컬럼은 룩업 없이 주석으로 값을 적는 선례(`t_user.login_scope`)를 따른다.

```ts
// libs/database/src/seeder/sample-seed.targets.ts — buildSampleStoreFiles · buildSampleRoomGroupImages 의 file_key 아래
            file.file_storage = 'LOCAL'; // 게이트웨이가 내주는 파일 — libs/integration FILE_STORAGE.LOCAL (샘플 키는 /sample/)
            image.file_storage = 'LOCAL';
```

### 저장소 포트 · 라우터 (libs/integration)

```ts
// libs/integration/src/integration.constants.ts — 추가
/** 파일 저장소 구분 — 파일 행(t_store_file · t_room_group_image)의 file_storage. S3 로 바꾼 뒤에도 LOCAL 행은 내부 파일 저장소(게이트웨이 /files)에서 연다 */
export const FILE_STORAGE = {S3: 'S3', LOCAL: 'LOCAL'} as const;
```

```ts
// libs/integration/src/interfaces/integration.interface.ts — 파일 저장소 부분 after
/** 파일 저장소 구분 — FILE_STORAGE 값 */
export type FileStorage = (typeof FILE_STORAGE)[keyof typeof FILE_STORAGE];

/** 저장소에 있는 파일 하나 — 파일 행의 저장 키 + 저장소 구분(엔티티 · 조회 행을 그대로 넘긴다, 구분이 없으면 LOCAL) */
export interface StoredFile {
    file_key: string;
    file_storage: string | null;
}

/**
 * 파일 저장소 포트 — 공개 파일(업체 · 객실 그룹 사진 — 공개 주소)과 비공개 파일(사업자등록증 — private/, 서명된 열람 주소).
 * 새 파일은 지금 업로드 저장소(AWS_S3_BUCKET 이 있으면 S3, 비면 내부 파일 저장소)로 올리고, 그 값을 파일 행 file_storage 에 적는다.
 * 읽기 · 삭제는 행의 file_storage 를 따른다 — S3 로 바꾼 뒤에도 그 전에 올린 파일은 내부에서 연다(사용자 결정 2026-11-18).
 * 어느 쪽이든 클라이언트가 createUploadUrl 의 주소로 직접 올리고, 등록 명령에는 키만 보낸다(파일 본문은 서비스 · 브로커를 거치지 않는다).
 */
export interface StorageGatewayInterface {
    /** 새 파일을 올리는 저장소 — 파일 행을 등록할 때 file_storage 에 넣는다 */
    getUploadStorage(): FileStorage;
    /** 지금 업로드 저장소에 키 하나의 1회용 업로드 주소 @throws ServiceUnavailableException */
    createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult>;
    /** 지금 업로드 저장소에 그 키로 올라왔는지 — 등록 명령에서 저장 전에 부른다 @throws ServiceUnavailableException */
    exists(key: string): Promise<boolean>;
    /** 화면에 보일 공개 주소 — 행의 저장소대로(샘플 키는 /sample/) @throws InternalServerErrorException 기준 주소가 없을 때 */
    getPublicUrl(file: StoredFile): string;
    /** 비공개 파일 열람 주소(10분) — 행의 저장소대로 @throws ServiceUnavailableException */
    createDownloadUrl(file: StoredFile): Promise<StorageDownloadResult>;
    /** 파일을 지운다 — 행의 저장소에서, 없는 키여도 실패하지 않는다(샘플 키는 건너뜀) @throws ServiceUnavailableException */
    remove(file: StoredFile): Promise<void>;
}

/** 저장소 하나의 어댑터(S3 · 내부) — 라우터(RoutingStorageGateway)만 쓴다. 키를 받는다 */
export interface StorageBackendInterface {
    createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult>;
    exists(key: string): Promise<boolean>;
    getPublicUrl(key: string): string;
    createDownloadUrl(key: string): Promise<StorageDownloadResult>;
    remove(key: string): Promise<void>;
}
```
(`FILE_STORAGE` 는 `import type` 이 아니라 `typeof` 로만 쓰므로 `import type {FILE_STORAGE}` 대신 `import {FILE_STORAGE}` — 인터페이스 파일은 값 import 를 피하려고 `FileStorage = 'S3' | 'LOCAL'` 리터럴로 둬도 같다. build 에서 typecheck 에 맞는 쪽을 쓴다.)

```ts
// libs/integration/src/storage/routing-storage.gateway.ts — 새 파일 전체
import {Injectable, InternalServerErrorException, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {FILE_STORAGE, STORAGE_PUBLIC_URL_MISSING_MESSAGE} from '../integration.constants.js';
import {gatewayPublicUrl, isS3StorageConfigured, isSampleFileKey} from '../integration.util.js';
import type {FileStorage, StorageBackendInterface, StorageDownloadResult, StorageGatewayInterface, StorageUploadInput, StorageUploadResult, StoredFile} from '../interfaces/integration.interface.js';
import {LocalStorageGateway} from './local-storage.gateway.js';
import {S3StorageGateway} from './s3-storage.gateway.js';

/**
 * 파일 저장소 포트(STORAGE_GATEWAY) — S3 · 내부 파일 저장소 어댑터를 둘 다 두고 나눠 보낸다(사용자 결정 2026-11-18).
 * - 업로드 주소 · 업로드 확인: 지금 업로드 저장소(AWS_S3_BUCKET 이 있으면 S3, 비면 내부) — 그 값을 service 가 파일 행 file_storage 에 적는다
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
        (this.uploadStorage === FILE_STORAGE.S3 ? this.s3 : this.local).onApplicationBootstrap();
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
     * 지금 업로드 저장소에 올라왔는지.
     *
     * @param key 저장 키
     * @returns 있으면 true
     */
    exists(key: string): Promise<boolean> {
        return this.backendOf(this.uploadStorage).exists(key);
    }

    /**
     * 공개 주소 — 샘플 키는 /sample/, 그 밖은 행의 저장소대로.
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
     * 파일 삭제 — 행의 저장소에서. 샘플 키는 건너뛴다.
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
```

```ts
// libs/integration/src/storage/storage.module.ts — after
@Global()
@Module({providers: [{provide: STORAGE_GATEWAY, useClass: RoutingStorageGateway}], exports: [STORAGE_GATEWAY]})
export class StorageModule {}
```
(주석: "업로드는 AWS_S3_BUCKET 이 있으면 S3, 비면 내부 파일 저장소 — 읽기 · 삭제는 파일 행의 file_storage". `isS3StorageConfigured` · 두 어댑터 import 는 라우터로 옮긴다.)

```ts
// libs/integration/src/storage/s3-storage.gateway.ts — 바뀌는 부분
// - implements StorageGatewayInterface → StorageBackendInterface, 클래스 주석의 샘플 키 줄 삭제(라우터가 한다)
// - getPublicUrl: 샘플 분기 삭제
    getPublicUrl(key: string): string {
        const base = (process.env.AWS_S3_PUBLIC_URL ?? '').replace(/\/+$/, '');
        if (!base) {
            this.logger.error('AWS_S3_PUBLIC_URL 이 비어 있어 파일 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md');
            throw new InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE});
        }
        return `${base}/${key}`;
    }
// - remove: 샘플 분기 삭제(맨 앞의 if (isSampleFileKey(key)) return;) — import 에서 gatewayPublicUrl · isSampleFileKey 삭제
```

```ts
// libs/integration/src/storage/local-storage.gateway.ts — 바뀌는 부분
// - implements StorageGatewayInterface → StorageBackendInterface, OnApplicationBootstrap 는 그대로(라우터가 부른다)
// - getPublicUrl: 샘플 분기 삭제 → 늘 /files/<키>
    getPublicUrl(key: string): string {
        const base = gatewayPublicUrl();
        if (!base) {
            this.logger.error('GATEWAY_PUBLIC_URL 이 비어 있어 파일 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md');
            throw new InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE});
        }
        return `${base}${LOCAL_FILE_ROUTE}/${key}`;
    }
// - remove: 샘플 분기 삭제 — import 에서 isSampleFileKey 삭제
// - 클래스 주석: "AWS_S3_BUCKET 이 비었을 때" → "내부 파일 저장소 — 버킷이 비면 업로드 저장소, 버킷이 있어도 LOCAL 행을 읽고 지운다(RoutingStorageGateway)"
```

### 게이트웨이 `/files` (apps/gateway)

```ts
// apps/gateway/src/modules/local-file/local-file.server.ts — before
    onModuleInit(): void {
        if (isS3StorageConfigured()) {
            return;
        }
        const app = this.httpAdapterHost.httpAdapter.getInstance<Express>();
        app.use(LOCAL_FILE_ROUTE, (req: Request, res: Response, next: NextFunction) => void this.handle(req, res, next));
        this.logger.log(`내부 파일 저장소 경로 ${LOCAL_FILE_ROUTE} — ${this.root}`);
    }
```

```ts
// apps/gateway/src/modules/local-file/local-file.server.ts — after
    /**
     * express 앱에 `/files` 경로를 붙인다(Nest 라우트 뒤 · 404 처리 앞) — S3 모드여도 LOCAL 행의 파일을 내주려고 늘 붙인다.
     */
    onModuleInit(): void {
        const app = this.httpAdapterHost.httpAdapter.getInstance<Express>();
        app.use(LOCAL_FILE_ROUTE, (req: Request, res: Response, next: NextFunction) => void this.handle(req, res, next));
        this.logger.log(isS3StorageConfigured() ? `내부 파일 저장소 경로 ${LOCAL_FILE_ROUTE}(읽기만 — S3 로 바꾸기 전에 올린 파일) — ${this.root}` : `내부 파일 저장소 경로 ${LOCAL_FILE_ROUTE} — ${this.root}`);
    }

    private async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (req.method === 'PUT' && req.path === '/upload') {
            // 업로드는 버킷이 빌 때만 — S3 모드의 업로드 주소는 S3 로 나간다
            if (isS3StorageConfigured()) {
                next();
                return;
            }
            await this.upload(req, res);
            return;
        }
        // … 열람 · 공개 그대로 …
```
(클래스 · 모듈 주석: "받기(업로드)는 AWS_S3_BUCKET 이 빌 때만, 읽기(공개 · 서명 열람)는 늘 — S3 로 바꾼 뒤에도 LOCAL 행 파일을 내준다(사용자 결정 2026-11-18)".)

### 서비스 · 조회 (apps)

```ts
// apps/admin-service/src/room/room.service.ts — before → after
// 목록
rows.map((row) => toRoomGroupListItem(row, row.cover_file_key ? this.storageGateway.getPublicUrl(row.cover_file_key) : null))
rows.map((row) => toRoomGroupListItem(row, row.cover_file_key ? this.storageGateway.getPublicUrl({file_key: row.cover_file_key, file_storage: row.cover_file_storage}) : null))
// 상세
images.map((image) => toRoomGroupImageItem(image, this.storageGateway.getPublicUrl(image.file_key)))
images.map((image) => toRoomGroupImageItem(image, this.storageGateway.getPublicUrl(image)))
// 그룹 삭제 · 사진 삭제
await this.storageGateway.remove(image.file_key);
await this.storageGateway.remove(image);
// 사진 등록 — file_key 아래
        image.file_key = dto.file_key;
        image.file_storage = this.storageGateway.getUploadStorage();
```

```ts
// apps/admin-service/src/room/repositories/room.repository.ts — buildRoomGroupRowsQuery 의 cover_file_key 하위 쿼리 뒤에 추가(같은 조건 · 정렬)
            .addSelect(
                (sub) =>
                    sub
                        .select('"i"."file_storage"')
                        .from(RoomGroupImageEntity, 'i')
                        .where('"i"."room_group_id" = "g"."room_group_id"')
                        .andWhere('"i"."is_deleted" = 0')
                        .orderBy('"i"."sort_order"', 'ASC')
                        .addOrderBy('"i"."created_at"', 'ASC')
                        .limit(1),
                'cover_file_storage',
            );
// interfaces/room.repository.interface.ts RoomGroupRow — cover_file_key 아래
    cover_file_storage: string | null;
```
(대표 사진의 키 · 저장소를 같은 조건의 하위 쿼리 두 개로 — 기존 하위 쿼리 모양 그대로, 한 행에서 두 값을 꺼내는 LATERAL 조인보다 기존 Smoke 와 맞추기 쉽다.)

```ts
// apps/admin-service/src/store/store.service.ts — before → after (세 곳 같은 모양: 신청 상세 · 업체 상세 · 내 업체)
const file_url = Number(row.is_private) === 1 ? (await this.storageGateway.createDownloadUrl(row.file_key)).download_url : this.storageGateway.getPublicUrl(row.file_key);
const file_url = Number(row.is_private) === 1 ? (await this.storageGateway.createDownloadUrl(row)).download_url : this.storageGateway.getPublicUrl(row);
// 업체 사진 등록 — file_key 아래
        file.file_key = dto.file_key;
        file.file_storage = this.storageGateway.getUploadStorage();
// 업체 사진 삭제
await this.storageGateway.remove(file.file_key);
await this.storageGateway.remove(file);
```

```ts
// apps/admin-service/src/store/repositories/store.repository.ts · apps/user-service/src/store/repositories/store.repository.ts — buildStoreFileRowsQuery, file_key 다음
            .addSelect('f.file_storage', 'file_storage')
// 두 interfaces/store.repository.interface.ts 의 StoreFileRow — file_key 아래
    file_storage: string;
```

```ts
// apps/user-service/src/discovery/discovery.service.ts — before → after
rows.slice(0, DISCOVERY_STORE_LIMIT).map((row) => toDiscoveryStoreItem(row, row.cover_file_key ? this.storageGateway.getPublicUrl(row.cover_file_key) : null))
rows.slice(0, DISCOVERY_STORE_LIMIT).map((row) => toDiscoveryStoreItem(row, row.cover_file_key ? this.storageGateway.getPublicUrl({file_key: row.cover_file_key, file_storage: row.cover_file_storage}) : null))
images.map((image) => toDiscoveryImage(this.storageGateway.getPublicUrl(image.file_key), image.sort_order))
images.map((image) => toDiscoveryImage(this.storageGateway.getPublicUrl(image), image.sort_order))
images.map((image) => ({room_group_id: image.room_group_id, ...toDiscoveryImage(this.storageGateway.getPublicUrl(image.file_key), image.sort_order)}))
images.map((image) => ({room_group_id: image.room_group_id, ...toDiscoveryImage(this.storageGateway.getPublicUrl(image), image.sort_order)}))
```

```ts
// apps/user-service/src/discovery/repositories/discovery.repository.ts — 반경 업체 쿼리의 cover_file_key 하위 쿼리 뒤에 추가
            .addSelect(
                (sub) =>
                    sub
                        .select('"f"."file_storage"')
                        .from(StoreFileEntity, 'f')
                        .where('"f"."store_id" = "s"."store_id"')
                        .andWhere('"f"."store_file_purpose_id" = :image_purpose')
                        .andWhere('"f"."is_deleted" = 0')
                        .orderBy('"f"."sort_order"', 'ASC')
                        .addOrderBy('"f"."created_at"', 'ASC')
                        .limit(1),
                'cover_file_storage',
            )
// interfaces/discovery.repository.interface.ts DiscoveryStoreRow — cover_file_key 아래
    cover_file_storage: string | null;
```
(업체 사진 · 그룹 사진은 `find` 로 엔티티를 읽어 `file_storage` 가 함께 온다 — select 제한 없음 확인.)

```ts
// apps/user-service/src/store/store.service.ts — before → after
const file_url = Number(row.is_private) === 1 ? (await this.storageGateway.createDownloadUrl(row.file_key)).download_url : this.storageGateway.getPublicUrl(row.file_key);
const file_url = Number(row.is_private) === 1 ? (await this.storageGateway.createDownloadUrl(row)).download_url : this.storageGateway.getPublicUrl(row);
// 파일 등록 — file_key 아래
        file.file_key = dto.file_key;
        file.file_storage = this.storageGateway.getUploadStorage();
// 파일 삭제 · 신청 취소
await this.storageGateway.remove(file.file_key);   →   await this.storageGateway.remove(file);
await this.storageGateway.remove(row.file_key);    →   await this.storageGateway.remove(row);
```

### 문서

```md
<!-- docs/guides/aws-setup.md — "AWS 없이 돌리기" 의 "나중에 S3 를 켜면 …" 줄 → 교체 -->
- 나중에 S3 를 켜도 **이미 내부 저장소에 올린 사진은 그대로 열린다** — 파일 행마다 올릴 때의 저장소(`file_storage` — `LOCAL` · `S3`)가 적혀 있어, `LOCAL` 행은 계속 게이트웨이(`/files/…`)로, 새로 올린 `S3` 행은 CloudFront 로 나간다. 삭제도 그 행의 저장소에서 한다. 그래서 S3 로 바꾼 뒤에도 볼륨(`roomless-files`)을 지우지 않는다.
- 옛 사진까지 S3 로 옮기고 싶으면 볼륨 내용을 같은 키(경로)로 버킷에 올리고, 그 행의 `file_storage` 를 `S3` 로 바꾼다(`UPDATE t_store_file SET file_storage = 'S3' WHERE file_storage = 'LOCAL' AND file_key NOT LIKE 'sample/%'` — `t_room_group_image` 도 같이). 그 뒤 볼륨에서 지운다.
```

나머지 문서(같은 변경):
- `docs/integration.md` — 파일 저장 절: 포트가 파일 행(`{file_key, file_storage}`)을 받는다, `RoutingStorageGateway`(업로드 = 지금 저장소 · 읽기 · 삭제 = 행의 저장소 · 샘플 키), 게이트웨이 `/files` 는 S3 모드에서 읽기만, 구성 표의 storage 줄
- `docs/data-layer.md` — 파일 행의 `file_storage`(코드 값 컬럼 — 룩업 없이 주석, `login_scope` 선례) 한 줄
- `AGENTS.md` — 구조 트리 `modules/local-file` 줄(받기는 버킷이 빌 때만 · 읽기는 늘), `libs/integration` 줄(`RoutingStorageGateway`), 외부 연동 예외 · 사진 · 열람 주소 줄(파일 행의 `file_storage` 로 고른다 · 등록 때 `getUploadStorage()` 를 적는다)
- `docs/architecture.md` — 게이트웨이 구성의 `LocalFileModule` 설명 · 트리 줄
- `README.md` 외부 연동 줄 — "S3 로 바꿔도 이미 올린 사진은 그대로 열린다(파일마다 저장소를 적어 둔다)"

## Test Cases
- 기존 service 기능 spec 을 바뀐 계약에 맞춘다(동작이 같은 곳은 단언 모양만):
  - 저장소 mock(`createStorageGatewayMock` 4곳)에 `getUploadStorage`(기본 `'LOCAL'`)를 더한다.
  - `getPublicUrl` · `createDownloadUrl` · `remove` 호출 단언을 키 문자열 대신 행 객체(`{file_key, file_storage}` 를 담은 엔티티 · 조회 행)로.
  - 등록 spec(그룹 사진 · 업체 사진 · 신청 파일)의 insert 엔티티 단언에 `file_storage: 'LOCAL'`.
  - **[SUCCESS] 업로드 저장소가 S3 면 등록 행에 `S3` 를 적는다** — 그룹 사진 등록 spec 1건(`getUploadStorage` 를 `'S3'` 로).
- repository spec Data-Access Smoke — 객실 그룹 목록 · 반경 업체의 `cover_file_storage` 하위 쿼리, 업체 정보 파일 행의 `file_storage` select 를 고정한 SQL 에 반영.
- 테스트 생략(위임형): `RoutingStorageGateway` · 두 어댑터 · 게이트웨이 `/files`(libs · 게이트웨이 인프라 — AGENTS.md Testing 이 spec 을 두지 않는다). build 확인(scratchpad): 빌드 결과로 라우터를 불러(S3 클라이언트 `send` 가로챔) — 업로드 저장소 고르기, LOCAL 행 → 게이트웨이 주소 · 서명 열람 · 폴더 삭제, S3 행 → CloudFront · S3 삭제 호출, 샘플 키 → `/sample/` · 삭제 건너뜀. 게이트웨이 S3 모드 — 공개 · 서명 열람 200, 업로드 404. 기존 내부 저장소 점검(check-local-file · check-sample) 다시 통과.
- `npm run db:generate -- FileStorage` · `npm run db:check` · typecheck · lint · build · `npm test`(AGENTS.md 가 Claude 실행을 허용).

## Decisions
- [x] 파일 행에 저장소 구분값을 둔다(사용자 결정 2026-11-18 — 폴더 확인안 대신). 이름 `file_storage`(`file_key` 와 짝), 값 `S3` · `LOCAL`, 룩업 없이 주석(`login_scope` 선례), 기본값 `LOCAL`(기존 행 채움 — 새 행은 service 가 늘 넣는다)
- [x] 포트는 파일 행(`{file_key, file_storage}`)을 받는다 — 엔티티 · 조회 행을 그대로 넘겨 호출부 변경을 최소로(키 · 저장소를 따로 넘기면 두 값을 섞어 넘길 수 있다)
- [x] 라우터 하나 + 저장소별 어댑터 둘 — 업로드는 지금 저장소, 읽기 · 삭제는 행의 저장소. 샘플 키 분기는 라우터 한 곳으로 모은다(두 어댑터에서 지운다 — §1.7)
- [x] 시드 사진은 `LOCAL`(게이트웨이가 내주는 파일) — 샘플 키 판단은 지금처럼 키 접두로
- [x] 게이트웨이 `/files` 는 S3 모드에서 읽기만 — 업로드 서명은 내부 저장소가 업로드 저장소일 때만 나간다
- [x] 공개 API · 응답 모양 그대로 — 프론트 수정 요청 문서 없음(두 사진 호스트는 changes/2026-11-13 에 이미 안내)
- [x] 마이그레이션 적용은 사용자 몫 — Claude 는 생성 · `db:check` 까지

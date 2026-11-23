import {randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir, rename, rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {HttpAdapterHost} from '@nestjs/core';
import type {Express, NextFunction, Request, Response} from 'express';
import {dayjs} from '@app/common/utils/dayjs.js';
import {
    LOCAL_FILE_MAX_BYTES,
    LOCAL_FILE_NOT_FOUND_MESSAGE,
    LOCAL_FILE_ROUTE,
    LOCAL_FILE_SIGNATURE_INVALID_MESSAGE,
    LOCAL_FILE_TOO_LARGE_MESSAGE,
    STORAGE_UNAVAILABLE_MESSAGE,
} from '@app/integration/integration.constants.js';
import {isS3StorageConfigured} from '@app/integration/integration.util.js';
import {isValidLocalFileSignature, localFileStorageDir, resolveLocalFilePath} from '@app/integration/storage/local-storage.util.js';
import {createByteLimit, isTooLarge, readPublicKey, readQueryValue, sendFail} from './local-file.util.js';

/**
 * 내부 파일 저장소 경로(/files) — AWS_S3_BUCKET 이 비었을 때 게이트웨이가 S3 자리를 대신한다(사용자 결정 2026-11-15).
 * S3 로 바꾼 뒤에도 file_storage 가 LOCAL 인 행(그 전에 올린 파일)은 계속 여기서 내준다 — 읽기(공개 · 서명 열람)는 늘 열고, 받기(업로드)만 버킷이 빌 때 연다(사용자 결정 2026-11-18).
 * - `PUT /files/upload?key&expires&signature` — 버킷이 빌 때만. 서명(INTERNAL_API_TOKEN · Content-Type 포함) · 만료 확인 → 임시 파일에 받아(10MB 까지) 이름 바꾸기 → 200
 * - `GET /files/download?key&expires&signature` — 비공개 파일(private/) 열람, 캐시 안 함
 * - `GET /files/<키>` — 공개 파일(업체 · 그룹 사진), private/ 키는 내주지 않는다(다음 처리 → 404), 하루 캐시
 * 폴더는 FILE_STORAGE_DIR(user-service · admin-service 의 LocalStorageGateway 와 같은 폴더 — 쿠버네티스는 deskless 차트의 공용 파일 볼륨). 공개 API 가 아니라 Swagger 에 없다.
 */
@Injectable()
export class LocalFileServer implements OnModuleInit {
    private readonly logger = new Logger(LocalFileServer.name);
    private readonly root = localFileStorageDir();

    /**
     * @param httpAdapterHost Nest HTTP 어댑터(express 앱)
     */
    constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

    /**
     * express 앱에 `/files` 경로를 붙인다(Nest 라우트 뒤 · 404 처리 앞) — S3 모드여도 LOCAL 행의 파일을 내주려고 늘 붙인다.
     */
    onModuleInit(): void {
        const app = this.httpAdapterHost.httpAdapter.getInstance<Express>();
        app.use(LOCAL_FILE_ROUTE, (req: Request, res: Response, next: NextFunction) => void this.handle(req, res, next));
        this.logger.log(
            isS3StorageConfigured() ? `내부 파일 저장소 경로 ${LOCAL_FILE_ROUTE}(읽기만 — S3 로 바꾸기 전에 올린 파일) — ${this.root}` : `내부 파일 저장소 경로 ${LOCAL_FILE_ROUTE} — ${this.root}`,
        );
    }

    /**
     * 메서드 · 경로로 나눈다 — 업로드는 버킷이 빌 때만, 나머지는 다음 처리(404).
     *
     * @param req 요청
     * @param res 응답
     * @param next 다음 처리
     */
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
        if ((req.method === 'GET' || req.method === 'HEAD') && req.path === '/download') {
            this.download(req, res);
            return;
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
            this.servePublic(req, res, next);
            return;
        }
        next();
    }

    /**
     * 업로드 받기 — 서명 · 만료 · Content-Type 확인 → 한도 확인 → 임시 파일 → 이름 바꾸기.
     *
     * @param req 요청(본문 = 파일)
     * @param res 응답
     */
    private async upload(req: Request, res: Response): Promise<void> {
        const key = readQueryValue(req.query.key);
        const path = resolveLocalFilePath(this.root, key);
        const request = {method: 'PUT' as const, key, content_type: req.headers['content-type'] ?? '', expires: Number(readQueryValue(req.query.expires))};
        if (!path || !isValidLocalFileSignature(process.env.INTERNAL_API_TOKEN ?? '', request, readQueryValue(req.query.signature), dayjs().unix())) {
            sendFail(res, 403, LOCAL_FILE_SIGNATURE_INVALID_MESSAGE);
            return;
        }
        if (Number(req.headers['content-length'] ?? 0) > LOCAL_FILE_MAX_BYTES) {
            sendFail(res, 413, LOCAL_FILE_TOO_LARGE_MESSAGE);
            return;
        }
        const temp = `${path}.${randomUUID()}.uploading`;
        try {
            await mkdir(dirname(path), {recursive: true});
            await pipeline(req, createByteLimit(LOCAL_FILE_MAX_BYTES), createWriteStream(temp));
            await rename(temp, path);
            res.status(200).end();
        } catch (error) {
            // 임시 파일 정리 실패는 무시한다(처리 안 된 예외로 프로세스가 죽지 않게 — 남은 .uploading 파일은 공개 키와 겹치지 않는다)
            await rm(temp, {force: true}).catch(() => undefined);
            if (isTooLarge(error)) {
                sendFail(res, 413, LOCAL_FILE_TOO_LARGE_MESSAGE);
                return;
            }
            this.logger.error(`내부 파일 저장 실패: ${(error as Error)?.message ?? error}`);
            sendFail(res, 503, STORAGE_UNAVAILABLE_MESSAGE);
        }
    }

    /**
     * 비공개 파일 열람 — 서명 · 만료 확인 후 파일, 캐시 안 함.
     *
     * @param req 요청
     * @param res 응답
     */
    private download(req: Request, res: Response): void {
        const key = readQueryValue(req.query.key);
        const path = resolveLocalFilePath(this.root, key);
        const request = {method: 'GET' as const, key, content_type: '', expires: Number(readQueryValue(req.query.expires))};
        if (!path || !isValidLocalFileSignature(process.env.INTERNAL_API_TOKEN ?? '', request, readQueryValue(req.query.signature), dayjs().unix())) {
            sendFail(res, 403, LOCAL_FILE_SIGNATURE_INVALID_MESSAGE);
            return;
        }
        res.sendFile(path, {headers: {'Cache-Control': 'private, no-store'}, dotfiles: 'deny'}, (error) => {
            if (error) {
                sendFail(res, 404, LOCAL_FILE_NOT_FOUND_MESSAGE);
            }
        });
    }

    /**
     * 공개 파일 — private/ 가 아닌 키만, 하루 캐시. 없거나 내줄 수 없으면 다음 처리(Nest 404).
     *
     * @param req 요청
     * @param res 응답
     * @param next 다음 처리
     */
    private servePublic(req: Request, res: Response, next: NextFunction): void {
        const key = readPublicKey(req.path);
        const path = key ? resolveLocalFilePath(this.root, key) : null;
        if (!path) {
            next();
            return;
        }
        res.sendFile(path, {maxAge: '1d', dotfiles: 'deny'}, (error) => {
            if (error && !res.headersSent) {
                next();
            }
        });
    }
}

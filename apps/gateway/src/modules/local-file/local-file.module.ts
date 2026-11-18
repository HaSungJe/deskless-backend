import {Module} from '@nestjs/common';
import {LocalFileServer} from './local-file.server.js';

/**
 * 내부 파일 저장소 경로(/files) — 받기(업로드)는 AWS_S3_BUCKET 이 빌 때만(사용자 결정 2026-11-15), 읽기(공개 · 서명 열람)는 늘 — S3 로 바꾼 뒤에도 그 전에 올린 LOCAL 행 파일을 내준다(사용자 결정 2026-11-18).
 */
@Module({providers: [LocalFileServer]})
export class LocalFileModule {}

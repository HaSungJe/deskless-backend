import {Module} from '@nestjs/common';
import {LocalFileServer} from './local-file.server.js';

/**
 * 내부 파일 저장소 경로(/files) — AWS_S3_BUCKET 이 비었을 때 게이트웨이가 업로드를 받고 파일을 내준다(사용자 결정 2026-11-15). S3 면 경로를 열지 않는다.
 */
@Module({providers: [LocalFileServer]})
export class LocalFileModule {}

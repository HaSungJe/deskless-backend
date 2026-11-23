import 'dotenv/config';
import {ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {CustomErrorFilter} from '@app/common/exception/custom-error.filter.js';
import {validationExceptionFactory} from '@app/common/utils/validation.js';
import {UserServiceModule} from './user-service.module.js';

/**
 * user-service 부트스트랩 — 게이트웨이만 접근한다.
 * USER_SERVICE_HOST 기본값 127.0.0.1 로 같은 머신의 게이트웨이만 닿게 하고, 쿠버네티스 파드에서는 0.0.0.0(값은 deskless 차트)으로 열되 닿는 범위는 Service · NetworkPolicy 가 게이트웨이로 좁힌다.
 * 전역 예외 필터 → 전역 ValidationPipe → 종료 훅(DB · RabbitMQ 연결 정리) → listen.
 */
async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(UserServiceModule);

    app.useGlobalFilters(new CustomErrorFilter());
    app.useGlobalPipes(new ValidationPipe({transform: true, forbidNonWhitelisted: true, exceptionFactory: validationExceptionFactory}));
    app.enableShutdownHooks();

    await app.listen(process.env.USER_SERVICE_PORT ?? 3010, process.env.USER_SERVICE_HOST || '127.0.0.1');
}

await bootstrap();

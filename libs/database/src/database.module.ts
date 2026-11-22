import {Global, Module} from '@nestjs/common';
import {getDataSourceToken, TypeOrmModule} from '@nestjs/typeorm';
import {ClsPluginTransactional} from '@nestjs-cls/transactional';
import {TransactionalAdapterTypeOrm} from '@nestjs-cls/transactional-adapter-typeorm';
import {ClsModule} from 'nestjs-cls';
import {DatabasePoolMetrics} from './database-pool.metrics.js';
import {JobLockService} from './job-lock/job-lock.service.js';
import {buildDataSourceOptions} from './typeorm.config.js';

/**
 * 비즈니스 DB 연결 + 트랜잭션 — DB 를 쓰는 서비스 앱의 루트 모듈에서 import 한다.
 * - TypeOrmModule: 기본 DataSource (전역)
 * - ClsModule + ClsPluginTransactional(TransactionalAdapterTypeOrm):
 *   service 의 `@Transactional()` 이 트랜잭션을 열고, repository 의 `txHost.tx`(EntityManager)가 이어받는다.
 * - JobLockService: 인스턴스가 여러 대여도 crontab 회차를 1대만 실행하는 잠금 (전역 — 도메인 모듈이 import 없이 주입)
 * - DatabasePoolMetrics: 커넥션 풀 지표(모니터링 모듈이 있을 때만)
 */
@Global()
@Module({
    imports: [
        TypeOrmModule.forRootAsync({useFactory: () => buildDataSourceOptions()}),
        ClsModule.forRoot({global: true, plugins: [new ClsPluginTransactional({adapter: new TransactionalAdapterTypeOrm({dataSourceToken: getDataSourceToken()})})]}),
    ],
    providers: [JobLockService, DatabasePoolMetrics],
    exports: [JobLockService],
})
export class DatabaseModule {}

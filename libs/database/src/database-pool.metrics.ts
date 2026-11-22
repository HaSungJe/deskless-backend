import {Injectable, Optional} from '@nestjs/common';
import type {OnModuleInit} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {MetricsService} from '@app/monitoring/metrics.service.js';

/** pg 풀에서 읽는 값 — TypeORM postgres 드라이버의 master 풀 */
interface PgPoolCounts {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
}

/**
 * DB 커넥션 풀 지표 — 긁을 때 pg 풀의 전체 · 놀고 있는 · 기다리는 수를 읽는다.
 * 풀이 차서 기다림이 생기면 인스턴스를 늘려도 빨라지지 않는다(늘리면 DB 연결이 오히려 모자란다) — 증설 판단 때 같이 본다.
 */
@Injectable()
export class DatabasePoolMetrics implements OnModuleInit {
    /**
     * @param dataSource 기본 DataSource
     * @param metrics 지표 레지스트리(모니터링 모듈이 없으면 없음 — 테스트 · 마이그레이션)
     */
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @Optional() private readonly metrics?: MetricsService,
    ) {}

    /**
     * 풀 게이지 등록 — 값은 긁을 때 읽는다(연결 전이면 비어 있다).
     */
    onModuleInit(): void {
        const driver = this.dataSource.driver as unknown as {master?: PgPoolCounts};
        this.metrics?.gauge({
            name: 'db_client_connections',
            help: 'DB 커넥션 풀 — state: total(열린) · idle(놀고 있는) · waiting(연결을 기다리는 요청)',
            labelNames: ['state'],
            collect() {
                const pool = driver.master;
                if (pool) {
                    this.set({state: 'total'}, pool.totalCount);
                    this.set({state: 'idle'}, pool.idleCount);
                    this.set({state: 'waiting'}, pool.waitingCount);
                }
            },
        });
    }
}

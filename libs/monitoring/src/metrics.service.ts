import {Inject, Injectable} from '@nestjs/common';
import {performance} from 'node:perf_hooks';
import {collectDefaultMetrics, Gauge, Histogram, Registry} from 'prom-client';
import type {GaugeConfiguration, HistogramConfiguration} from 'prom-client';
import {DURATION_BUCKETS, MONITORING_OPTIONS} from './monitoring.constants.js';
import type {MonitoringOptions} from './monitoring.constants.js';

/**
 * 앱 하나의 지표 레지스트리 — 기본 지표(CPU · 메모리 · 이벤트 루프 지연 · GC) + 이벤트 루프 누적 시간 + 부품이 만드는 지표.
 * 모든 지표에 service 라벨이 붙는다(쿠버네티스로 가도 같은 이름 · 라벨). 지표 정의는 그 지표를 내는 부품 안에 둔다 — 목록은 docs/monitoring.md.
 */
@Injectable()
export class MetricsService {
    readonly registry = new Registry();

    /**
     * @param options 모니터링 옵션
     */
    constructor(@Inject(MONITORING_OPTIONS) options: MonitoringOptions) {
        this.registry.setDefaultLabels({service: options.service});
        collectDefaultMetrics({register: this.registry});
        // 부하율의 원천 — 이벤트 루프가 일한 · 쉰 누적 시간(초). 비율은 Prometheus 기록 규칙이 rate 로 계산한다(긁는 쪽이 여럿이어도 맞다)
        this.gauge({
            name: 'nodejs_eventloop_time_seconds',
            help: '이벤트 루프 누적 시간(초) — state: active(일함) · idle(쉼)',
            labelNames: ['state'],
            collect() {
                const elu = performance.eventLoopUtilization();
                this.set({state: 'active'}, elu.active / 1000);
                this.set({state: 'idle'}, elu.idle / 1000);
            },
        });
    }

    /**
     * 게이지를 만들어 이 앱 레지스트리에 등록한다.
     *
     * @param config 이름 · 설명 · 라벨 · collect(긁을 때 값을 채운다)
     * @returns 게이지
     */
    gauge<T extends string>(config: Omit<GaugeConfiguration<T>, 'registers'>): Gauge<T> {
        return new Gauge<T>({...config, registers: [this.registry]});
    }

    /**
     * 히스토그램을 만들어 이 앱 레지스트리에 등록한다.
     *
     * @param config 이름 · 설명 · 라벨 · 구간(기본 DURATION_BUCKETS)
     * @returns 히스토그램
     */
    histogram<T extends string>(config: Omit<HistogramConfiguration<T>, 'registers'>): Histogram<T> {
        return new Histogram<T>({buckets: DURATION_BUCKETS, ...config, registers: [this.registry]});
    }
}

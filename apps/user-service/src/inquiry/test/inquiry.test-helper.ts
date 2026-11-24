import {BadRequestException, INestApplication, Type, ValidationPipe} from '@nestjs/common';
import {APP_GUARD, APP_INTERCEPTOR, DiscoveryModule} from '@nestjs/core';
import {Test, TestingModule} from '@nestjs/testing';
import type {Mock} from 'vitest';
import {CustomErrorFilter} from '@app/common/exception/custom-error.filter.js';
import {ReturnedExceptionInterceptor} from '@app/common/exception/returned-exception.interceptor.js';
import {InternalAuthGuard} from '@app/common/internal/internal-auth.guard.js';
import {validationExceptionFactory} from '@app/common/utils/validation.js';
import type {Actor} from '@app/contracts/actor.js';
import {INTERNAL_HEADER} from '@app/contracts/actor.js';
import type {MessageEnvelope, ResultPayload} from '@app/contracts/message-envelope.js';
import {CommandHandlerRegistry} from '@app/messaging/command-handler.registry.js';
import {CommandDispatcher, DispatchDecision} from '@app/messaging/command.dispatcher.js';
import {buildCommandEnvelope, encodeEnvelope} from '@app/messaging/messaging.util.js';
import {InquiryController} from '../controllers/inquiry.controller.js';
import {InquiryQueueController} from '../controllers/inquiry.controller.queue.js';
import {InquiryService} from '../inquiry.service.js';
import {INQUIRY_REPOSITORY} from '../inquiry.symbols.js';
import type {InquiryRepositoryInterface} from '../interfaces/inquiry.repository.interface.js';

/** 테스트용 게이트웨이 인스턴스 ID (결과 회신 주소) */
export const TEST_REPLY_TO = 'gw-test';

/** 테스트용 내부 요청 토큰 */
export const TEST_INTERNAL_TOKEN = 'test-internal-token';

/** 문의한 이용자 */
export const USER_ACTOR: Actor = {user_id: 'u'.repeat(32), auth_id: 'USER'};

/** 문의 ID */
export const INQUIRY_ID = 'a'.repeat(32);

/** 업체 ID */
export const STORE_ID = 'b'.repeat(32);

/** 문의일 · 답변일 */
export const CREATED_AT = new Date('2026-01-01T01:00:00.000Z');
export const ANSWERED_AT = new Date('2026-01-02T03:00:00.000Z');

/** inquiry repository mock — 모든 메서드가 vi.fn() */
export type InquiryRepositoryMock = {[K in keyof InquiryRepositoryInterface]: Mock};

/**
 * inquiry repository mock 을 만든다(이용자 문의 포트).
 *
 * @returns 메서드별 vi.fn()
 */
export function createInquiryRepositoryMock(): InquiryRepositoryMock {
    return {
        findInquiryCategories: vi.fn().mockResolvedValue([]),
        findInquiryStore: vi.fn(),
        insertInquiry: vi.fn(),
        countMyInquiryRows: vi.fn().mockResolvedValue(0),
        findMyInquiryRows: vi.fn().mockResolvedValue([]),
        findMyInquiryDetailRow: vi.fn().mockResolvedValue(null),
    };
}

/**
 * 큐 경로 부팅 — 실제 InquiryQueueController · InquiryService · CommandHandlerRegistry · CommandDispatcher 에 repository 만 mock.
 * registry 가 @OnCommand 를 찾도록 DiscoveryModule + module.init() 이 필수다.
 *
 * @param repo repository mock
 * @returns 디스패처와 테스트 모듈
 */
export async function bootCommandPath(repo: InquiryRepositoryMock): Promise<{dispatcher: CommandDispatcher; module: TestingModule}> {
    const module = await Test.createTestingModule({
        imports: [DiscoveryModule],
        providers: [InquiryService, InquiryQueueController, CommandHandlerRegistry, CommandDispatcher, {provide: INQUIRY_REPOSITORY, useValue: repo}],
    }).compile();
    await module.init();
    return {dispatcher: module.get(CommandDispatcher), module};
}

/**
 * 동기 경로 부팅 — 실제 내부 InquiryController · InquiryService · ValidationPipe · 필터 · 전역 InternalAuthGuard · ReturnedExceptionInterceptor(user-service.module 과 같다)에 repository 만 mock.
 *
 * @param repo repository mock
 * @returns Nest 앱
 */
export async function bootHttpPath(repo: InquiryRepositoryMock): Promise<INestApplication> {
    process.env.INTERNAL_API_TOKEN = TEST_INTERNAL_TOKEN;
    const module = await Test.createTestingModule({
        controllers: [InquiryController],
        providers: [
            InquiryService,
            {provide: INQUIRY_REPOSITORY, useValue: repo},
            {provide: APP_GUARD, useClass: InternalAuthGuard},
            {provide: APP_INTERCEPTOR, useClass: ReturnedExceptionInterceptor},
        ],
    }).compile();
    const app = module.createNestApplication();
    app.useGlobalFilters(new CustomErrorFilter());
    app.useGlobalPipes(new ValidationPipe({transform: true, forbidNonWhitelisted: true, exceptionFactory: validationExceptionFactory}));
    await app.init();
    return app;
}

/**
 * 게이트웨이가 붙이는 내부 요청 헤더 — actor 가 있으면 로그인 회원 헤더도.
 *
 * @param actor 로그인 회원
 * @returns 헤더
 */
export function internalHeaders(actor: Actor | null = null): Record<string, string> {
    const headers: Record<string, string> = {[INTERNAL_HEADER.TOKEN]: TEST_INTERNAL_TOKEN, [INTERNAL_HEADER.CLIENT_IP]: '10.0.0.1'};
    if (actor) {
        headers[INTERNAL_HEADER.ACTOR_USER_ID] = actor.user_id;
        headers[INTERNAL_HEADER.ACTOR_AUTH_ID] = actor.auth_id;
    }
    return headers;
}

/**
 * 게이트웨이가 발행하는 것과 같은 명령 봉투를 디스패처에 넣는다.
 *
 * @param dispatcher 디스패처
 * @param params 명령 type · 본문 · actor
 * @returns 판정 + 명령 봉투 + 결과
 */
export async function runCommand(
    dispatcher: CommandDispatcher,
    params: {type: string; payload: unknown; actor?: Actor | null},
): Promise<{decision: DispatchDecision; command: MessageEnvelope<unknown>; result: ResultPayload<unknown> | null}> {
    const command = buildCommandEnvelope({type: params.type, actor: params.actor ?? null, payload: params.payload, reply_to: TEST_REPLY_TO, client_ip: '10.0.0.1'});
    const decision = await dispatcher.dispatch(encodeEnvelope(command), 0);
    return {decision, command, result: decision.result?.payload ?? null};
}

/**
 * 게이트웨이 ValidationPipe 로 본문 · 쿼리를 검증한다(큐 경로는 서비스가 다시 검증하지 않는다).
 *
 * @param metatype DTO 클래스
 * @param body 입력
 * @param type 입력 위치
 * @returns 실패 본문 또는 null
 */
export async function validateBody(metatype: Type<unknown>, body: unknown, type: 'body' | 'query' = 'body'): Promise<Record<string, unknown> | null> {
    const pipe = new ValidationPipe({transform: true, forbidNonWhitelisted: true, exceptionFactory: validationExceptionFactory});
    try {
        await pipe.transform(body, {type, metatype});
        return null;
    } catch (error) {
        return (error as BadRequestException).getResponse() as Record<string, unknown>;
    }
}

/**
 * 내 문의 목록 행 (업체 문의 · 접수)
 *
 * @param override 바꿀 필드
 * @returns 행
 */
export function myInquiryRow(override: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        inquiry_id: INQUIRY_ID,
        store_id: STORE_ID,
        store_name: '바로방 강남점',
        inquiry_category_id: 'RESERVATION',
        inquiry_category_name: '예약',
        title: '예약 시간 변경 문의',
        inquiry_state_id: 'RECEIVED',
        inquiry_state_name: '접수',
        answered_at: null,
        created_at: CREATED_AT,
        ...override,
    };
}

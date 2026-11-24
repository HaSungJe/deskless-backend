import {INestApplication, ValidationPipe} from '@nestjs/common';
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
import {AI_GATEWAY, CONVERSATION_STORE, STORAGE_GATEWAY} from '@app/integration/integration.symbols.js';
import type {AiGatewayInterface, ConversationStoreInterface, ConversationTurn} from '@app/integration/interfaces/integration.interface.js';
import {CommandHandlerRegistry} from '@app/messaging/command-handler.registry.js';
import {CommandDispatcher, DispatchDecision} from '@app/messaging/command.dispatcher.js';
import {buildCommandEnvelope, encodeEnvelope} from '@app/messaging/messaging.util.js';
import {CHAT_REPOSITORY} from '../chat.symbols.js';
import {ChatService} from '../chat.service.js';
import {ChatController} from '../controllers/chat.controller.js';
import {ChatQueueController} from '../controllers/chat.controller.queue.js';
import {ChatStreamController} from '../controllers/chat.controller.stream.js';
import type {ChatRepositoryInterface} from '../interfaces/chat.repository.interface.js';

/** 테스트용 게이트웨이 인스턴스 ID (결과 회신 주소) */
export const TEST_REPLY_TO = 'gw-test';

/** 테스트용 내부 요청 토큰 */
export const TEST_INTERNAL_TOKEN = 'test-internal-token';

/** 대화하는 이용자 */
export const USER_ACTOR: Actor = {user_id: 'u'.repeat(32), auth_id: 'USER'};

/** 지금 — 한국 시각 2026-11-25 12:00 (UTC 03:00) */
export const NOW = new Date('2026-11-25T03:00:00.000Z');

/** 오늘(한국 날짜) · 초기화 시각(다음 날 한국 00:00) */
export const TODAY = '2026-11-25';
export const RESETS_AT = '2026-11-25T15:00:00.000Z';

/** chat repository mock — 모든 메서드가 vi.fn() */
export type ChatRepositoryMock = {[K in keyof ChatRepositoryInterface]: Mock};

/** 대화 저장소 포트 mock */
export type ConversationStoreMock = {[K in keyof ConversationStoreInterface]: Mock};

/** AI 포트 mock */
export type AiGatewayMock = {[K in keyof AiGatewayInterface]: Mock};

/** 파일 저장소 포트 mock — 공개 주소만 */
export type StorageGatewayMock = {getPublicUrl: Mock};

/** 포트 mock 묶음 */
export interface ChatMocks {
    repo: ChatRepositoryMock;
    store: ConversationStoreMock;
    ai: AiGatewayMock;
    storage: StorageGatewayMock;
}

/**
 * chat repository mock 을 만든다.
 *
 * @returns 메서드별 vi.fn()
 */
export function createChatRepositoryMock(): ChatRepositoryMock {
    return {findRecommendStoreRows: vi.fn().mockResolvedValue([]), findCardRoomGroups: vi.fn().mockResolvedValue([])};
}

/**
 * 대화 저장소 포트 mock — 기본은 이력 없음 · 질문 수 줄 없음 · 잠금 잡힘.
 *
 * @returns 메서드별 vi.fn()
 */
export function createConversationStoreMock(): ConversationStoreMock {
    return {
        getTurns: vi.fn().mockResolvedValue([]),
        appendTurn: vi.fn().mockResolvedValue(1),
        clearTurns: vi.fn().mockResolvedValue(undefined),
        getUsage: vi.fn().mockResolvedValue({date: null, count: 0, is_answering: false}),
        acquireBusy: vi.fn().mockResolvedValue(true),
        releaseBusy: vi.fn().mockResolvedValue(undefined),
        purgeTurns: vi.fn().mockResolvedValue(undefined),
    };
}

/**
 * 글 조각을 차례로 내는 async generator — AI 포트 streamText mock 의 반환값.
 *
 * @param chunks 글 조각
 * @param error 다 낸 뒤 던질 오류(없으면 정상 끝)
 * @returns async generator
 */
export async function* textStream(chunks: string[], error?: unknown): AsyncGenerator<string> {
    for (const chunk of chunks) {
        yield chunk;
    }
    if (error) {
        throw error;
    }
}

/**
 * AI 포트 mock — 기본은 여행 이야기(카드 없음) · 답 "안녕하세요" · 벡터 3차원.
 *
 * @returns 메서드별 vi.fn()
 */
export function createAiGatewayMock(): AiGatewayMock {
    return {
        generateJson: vi.fn().mockResolvedValue({kind: 'TRAVEL_TALK', areas: [], area_match: 'ANY', detail_keys: [], search_text: ''}),
        streamText: vi.fn(() => textStream(['안녕', '하세요'])),
        embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };
}

/**
 * 파일 저장소 포트 mock — 공개 주소는 키를 CDN 주소에 붙인다.
 *
 * @returns 메서드별 vi.fn()
 */
export function createStorageGatewayMock(): StorageGatewayMock {
    return {getPublicUrl: vi.fn((file: {file_key: string}) => `https://cdn.test/${file.file_key}`)};
}

/**
 * 포트 mock 묶음을 만든다.
 *
 * @returns mock 묶음
 */
export function createChatMocks(): ChatMocks {
    return {repo: createChatRepositoryMock(), store: createConversationStoreMock(), ai: createAiGatewayMock(), storage: createStorageGatewayMock()};
}

/**
 * 포트 mock providers.
 *
 * @param mocks mock 묶음
 * @returns providers
 */
function mockProviders(mocks: ChatMocks) {
    return [
        {provide: CHAT_REPOSITORY, useValue: mocks.repo},
        {provide: CONVERSATION_STORE, useValue: mocks.store},
        {provide: AI_GATEWAY, useValue: mocks.ai},
        {provide: STORAGE_GATEWAY, useValue: mocks.storage},
    ];
}

/**
 * 동기 · 스트림 경로 부팅 — 실제 내부 ChatController · ChatStreamController · ChatService · ValidationPipe · 필터 · 전역 InternalAuthGuard · ReturnedExceptionInterceptor(user-service.module 과 같다)에 포트만 mock.
 *
 * @param mocks 포트 mock 묶음
 * @returns Nest 앱
 */
export async function bootHttpPath(mocks: ChatMocks): Promise<INestApplication> {
    process.env.INTERNAL_API_TOKEN = TEST_INTERNAL_TOKEN;
    const module = await Test.createTestingModule({
        controllers: [ChatController, ChatStreamController],
        providers: [ChatService, ...mockProviders(mocks), {provide: APP_GUARD, useClass: InternalAuthGuard}, {provide: APP_INTERCEPTOR, useClass: ReturnedExceptionInterceptor}],
    }).compile();
    const app = module.createNestApplication();
    app.useGlobalFilters(new CustomErrorFilter());
    app.useGlobalPipes(new ValidationPipe({transform: true, forbidNonWhitelisted: true, exceptionFactory: validationExceptionFactory}));
    await app.init();
    return app;
}

/**
 * 큐 경로 부팅 — 실제 ChatQueueController · ChatService · CommandHandlerRegistry · CommandDispatcher 에 포트만 mock.
 * registry 가 @OnCommand 를 찾도록 DiscoveryModule + module.init() 이 필수다.
 *
 * @param mocks 포트 mock 묶음
 * @returns 디스패처와 테스트 모듈
 */
export async function bootCommandPath(mocks: ChatMocks): Promise<{dispatcher: CommandDispatcher; module: TestingModule}> {
    const module = await Test.createTestingModule({
        imports: [DiscoveryModule],
        providers: [ChatService, ChatQueueController, CommandHandlerRegistry, CommandDispatcher, ...mockProviders(mocks)],
    }).compile();
    await module.init();
    return {dispatcher: module.get(CommandDispatcher), module};
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
 * @returns 판정 + 결과
 */
export async function runCommand(
    dispatcher: CommandDispatcher,
    params: {type: string; payload: unknown; actor?: Actor | null},
): Promise<{decision: DispatchDecision; result: ResultPayload<unknown> | null}> {
    const command: MessageEnvelope<unknown> = buildCommandEnvelope({type: params.type, actor: params.actor ?? null, payload: params.payload, reply_to: TEST_REPLY_TO, client_ip: '10.0.0.1'});
    const decision = await dispatcher.dispatch(encodeEnvelope(command), 0);
    return {decision, result: decision.result?.payload ?? null};
}

/**
 * SSE 본문을 이벤트 목록으로 나눈다.
 *
 * @param text 응답 본문
 * @returns 이벤트(이름 · data JSON)
 */
export function parseSse(text: string): {event: string; data: unknown}[] {
    return text
        .split('\n\n')
        .filter((block) => block.trim() !== '')
        .map((block) => {
            const event = /^event: (.+)$/m.exec(block)?.[1] ?? '';
            const data = /^data: (.*)$/m.exec(block)?.[1] ?? 'null';
            return {event, data: JSON.parse(data) as unknown};
        });
}

/**
 * 저장된 대화 한 건.
 *
 * @param override 바꿀 필드
 * @returns 한 건
 */
export function turnFixture(override: Partial<ConversationTurn> = {}): ConversationTurn {
    return {
        turn_id: 't'.repeat(32),
        user_id: USER_ACTOR.user_id,
        question: '제주 여행 숙소 찾아줘',
        answer: '바로방 성산점을 추천드려요.',
        stores: [{store_id: 'old-store', store_name: '바로방 성산점'}],
        asked_at: '2026-11-25T01:00:00.000Z',
        answered_at: '2026-11-25T01:00:20.000Z',
        ...override,
    };
}

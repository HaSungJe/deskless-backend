import {ConflictException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException} from '@nestjs/common';
import {dayjs} from '@app/common/utils/dayjs.js';
import {generateId} from '@app/common/utils/id.js';
import type {SseEvent} from '@app/common/utils/sse.js';
import {CHAT_PROGRESS_PHASE, CHAT_STREAM_EVENT} from '@app/contracts/chat/chat.commands.js';
import type {ChatDetailResultDto} from '@app/contracts/chat/dto/chat-detail.dto.js';
import type {ChatMessageCardResultDto, ChatMessageDto} from '@app/contracts/chat/dto/chat-message.dto.js';
import type {ChatQuotaResultDto} from '@app/contracts/chat/dto/chat-quota.dto.js';
import {AI_EMBED_TASK, AI_UNAVAILABLE_MESSAGE} from '@app/integration/integration.constants.js';
import {AI_GATEWAY, CONVERSATION_STORE, STORAGE_GATEWAY} from '@app/integration/integration.symbols.js';
import type {AiGatewayInterface, ConversationStoreInterface, StorageGatewayInterface} from '@app/integration/interfaces/integration.interface.js';
import {
    CHAT_ANSWER_SYSTEM,
    CHAT_BUSY_MESSAGE,
    CHAT_BUSY_TTL_MS,
    CHAT_CARD_LIMIT,
    CHAT_HISTORY_LIMIT,
    CHAT_QUOTA_EXCEEDED_MESSAGE,
    CHAT_TURN_KEEP_DAYS,
    CHAT_TURN_KEEP_MS,
    CHAT_UNDERSTAND_KIND,
    CHAT_UNDERSTAND_SCHEMA,
    CHAT_UNDERSTAND_SYSTEM,
    CHAT_VIEW_LIMIT,
} from './chat.constants.js';
import {CHAT_REPOSITORY} from './chat.symbols.js';
import {
    readChatDailyLimit,
    toAiHistory,
    toAnswerContent,
    toChatCards,
    toChatDetail,
    toChatDone,
    toChatQuota,
    toChatTurn,
    toChatUnderstanding,
    toKstToday,
    toRecommendedStoreIds,
    toRecommendFilter,
} from './chat.util.js';
import type {ChatRepositoryInterface} from './interfaces/chat.repository.interface.js';

/**
 * chat 비즈니스 로직 (AI 대화형 업체 검색 — 이용자). 대화 이력 · 하루 질문 수 · 답하는 중 잠금은 CONVERSATION_STORE(Redis), 요청 읽기 · 답 쓰기 · 검색 벡터는 AI_GATEWAY(Gemini),
 * 추천 업체는 repository(업체 · 객실 · 업체 검색 벡터). DB 쓰기가 없어 @Transactional() 이 없다.
 */
@Injectable()
export class ChatService {
    /**
     * @param chatRepository chat repository 포트
     * @param conversationStore 대화 저장소 포트 (Redis)
     * @param aiGateway AI 포트 (Gemini)
     * @param storageGateway 파일 저장소 포트 (대표 사진 공개 주소)
     */
    constructor(
        @Inject(CHAT_REPOSITORY)
        private readonly chatRepository: ChatRepositoryInterface,
        @Inject(CONVERSATION_STORE)
        private readonly conversationStore: ConversationStoreInterface,
        @Inject(AI_GATEWAY)
        private readonly aiGateway: AiGatewayInterface,
        @Inject(STORAGE_GATEWAY)
        private readonly storageGateway: StorageGatewayInterface,
    ) {}

    /**
     * 대화 보기 — 이 이용자의 대화 이력(7일 안, 오래된 순 — 한 건을 USER · AI 두 메시지로 펼친다) · 오늘 남은 질문 수. (내부 HTTP: GET /internal/v1/user-service/chat)
     *
     * @param user_id 로그인 이용자 ID
     * @returns 대화 · 남은 질문 수
     */
    async getChat(user_id: string): Promise<ChatDetailResultDto> {
        const now = new Date();
        // ① 이력 읽기 — 7일 안(초기화했으면 빈 이력)
        const turns = await this.conversationStore.getTurns(user_id, dayjs(now).subtract(CHAT_TURN_KEEP_DAYS, 'day').toDate(), CHAT_VIEW_LIMIT);
        // ② 횟수 읽기 — 한 줄(날짜:횟수), 줄이 없거나 날짜가 오늘이 아니면 0회
        const usage = await this.conversationStore.getUsage(user_id);
        return toChatDetail(turns, toChatQuota(usage, readChatDailyLimit(), toKstToday(now)));
    }

    /**
     * 남은 질문 수 — 이용자의 질문 수 한 줄로 오늘 쓴 수 · 남은 수 · 초기화 시각(다음 날 한국 00:00) · 답하는 중인지. (내부 HTTP: GET /internal/v1/user-service/chat/quota)
     *
     * @param user_id 로그인 이용자 ID
     * @returns 하루 한도 · 쓴 수 · 남은 수 · 초기화 시각 · 답하는 중
     */
    async getQuota(user_id: string): Promise<ChatQuotaResultDto> {
        // ① 오늘 정하기 · ② 한 줄 읽기 · ③ 남은 수 — 줄이 없거나 저장된 날짜가 오늘이 아니면 0회
        const usage = await this.conversationStore.getUsage(user_id);
        return toChatQuota(usage, readChatDailyLimit(), toKstToday(new Date()));
    }

    /**
     * 메시지 보내기 — 답하는 중 잠금 → 오늘 남은 수 확인 → 요청 읽기(AI · 웹 검색) → 업체 찾기(벡터 · 조건) → 답 흘리기(AI) → 이력 저장 + 질문 수.
     * 첫 이벤트 전 실패(409 · 429)는 일반 HTTP 응답, 그 뒤 실패는 failed 이벤트(writeSseStream). 끊기 신호로 AI 가 멈추고, finally 가 잠금을 푼다.
     * 이벤트: progress → stores → delta … → done. (내부 HTTP 스트리밍: POST /internal/v1/user-service/chat/message)
     *
     * @param user_id 로그인 이용자 ID
     * @param dto 질문(100자)
     * @param signal 연결이 끊기면 멈춘다
     * @returns 스트림 이벤트
     */
    async *sendMessage(user_id: string, dto: ChatMessageDto, signal: AbortSignal): AsyncGenerator<SseEvent> {
        // ① 답하는 중 잠금 — 비어 있을 때만(값 = 이번 요청 ID, 최대 3분). 이미 있으면 409
        const lock_id = generateId();
        if (!(await this.conversationStore.acquireBusy(user_id, lock_id, CHAT_BUSY_TTL_MS))) {
            throw new ConflictException({message: CHAT_BUSY_MESSAGE});
        }
        try {
            // ② 횟수 확인 — 물은 시각의 한국 날짜로, 한도면 429
            const asked_at = new Date();
            const today = toKstToday(asked_at);
            const quota = toChatQuota(await this.conversationStore.getUsage(user_id), readChatDailyLimit(), today);
            if (quota.remaining_count === 0) {
                throw new HttpException({message: CHAT_QUOTA_EXCEEDED_MESSAGE, resets_at: quota.resets_at}, HttpStatus.TOO_MANY_REQUESTS);
            }

            // ③ 요청 읽기 — 최근 이력으로 AI 가 웹 검색을 써서 종류 · 지역 · 조건 · 검색 문장을 뽑는다
            yield {event: CHAT_STREAM_EVENT.PROGRESS, data: {phase: CHAT_PROGRESS_PHASE.SEARCHING_WEB}};
            const history = await this.conversationStore.getTurns(user_id, dayjs(asked_at).subtract(CHAT_TURN_KEEP_DAYS, 'day').toDate(), CHAT_HISTORY_LIMIT);
            const understanding = toChatUnderstanding(
                await this.aiGateway.generateJson({system: CHAT_UNDERSTAND_SYSTEM, history: toAiHistory(history), content: dto.content, schema: CHAT_UNDERSTAND_SCHEMA, use_search: true, signal}),
            );

            // ④ 업체 찾기 — 숙소를 찾아야 할 때만(무관한 말 · 지역 추천 · 되묻기는 카드 없이 답만), 이력에서 추천한 업체는 뺀다
            let cards: ChatMessageCardResultDto[] = [];
            if (understanding.kind === CHAT_UNDERSTAND_KIND.STORE_SEARCH) {
                yield {event: CHAT_STREAM_EVENT.PROGRESS, data: {phase: CHAT_PROGRESS_PHASE.SEARCHING_STORES}};
                const vectors = understanding.search_text ? await this.aiGateway.embed({texts: [understanding.search_text], task: AI_EMBED_TASK.QUERY, signal}) : [];
                const rows = await this.chatRepository.findRecommendStoreRows(toRecommendFilter(understanding, vectors[0] ?? null, toRecommendedStoreIds(history)), CHAT_CARD_LIMIT);
                const groups = rows.length > 0 ? await this.chatRepository.findCardRoomGroups(rows.map((row) => row.store_id)) : [];
                cards = toChatCards(rows, groups, (file) => this.storageGateway.getPublicUrl(file));
                yield {event: CHAT_STREAM_EVENT.STORES, data: {list: cards}};
            }

            // ⑤ 답 쓰기 — 글자 조각을 흘린다(지역 추천 · 여행 이야기는 웹 검색을 다시 쓴다)
            yield {event: CHAT_STREAM_EVENT.PROGRESS, data: {phase: CHAT_PROGRESS_PHASE.ANSWERING}};
            let answer = '';
            for await (const text of this.aiGateway.streamText({
                system: CHAT_ANSWER_SYSTEM,
                history: toAiHistory(history),
                content: toAnswerContent(dto.content, understanding, cards),
                use_search: understanding.kind === CHAT_UNDERSTAND_KIND.TRAVEL_TALK,
                signal,
            })) {
                answer += text;
                yield {event: CHAT_STREAM_EVENT.DELTA, data: {text}};
            }
            // 글이 하나도 오지 않은 답(안전 필터 · 검색 결과만)은 실패 — 빈 답을 저장하면 다음 질문마다 이력의 빈 글을 AI 가 거절한다
            if (answer.trim() === '') {
                throw new ServiceUnavailableException({message: AI_UNAVAILABLE_MESSAGE});
            }

            // ⑥ 이력 저장 + 질문 수 — user_id · 질문 + 답 · 시각 한 건, 질문 수 한 줄은 물은 날짜로(없으면 등록 · 어제면 오늘:1 · 오늘이면 +1)
            const turn = toChatTurn(user_id, dto.content, answer, cards, asked_at, new Date());
            const used_count = await this.conversationStore.appendTurn(user_id, turn, today.date, CHAT_TURN_KEEP_MS);
            yield {event: CHAT_STREAM_EVENT.DONE, data: toChatDone(turn, toChatQuota({date: today.date, count: used_count, is_answering: false}, readChatDailyLimit(), today))};
        } finally {
            // 성공 · 실패 · 끊김 모두 — 내 잠금일 때만 푼다(만료 뒤 다른 요청이 잡은 잠금은 건드리지 않는다)
            await this.conversationStore.releaseBusy(user_id, lock_id);
        }
    }

    /**
     * 대화 초기화 — 이 이용자의 대화 이력을 7일 기다리지 않고 바로 모두 지운다. 질문 수 한 줄은 남긴다 — 초기화로 하루 한도를 넘기지 않게. (RabbitMQ: user.chat.clear)
     *
     * @param user_id 로그인 이용자 ID
     */
    async clearChat(user_id: string): Promise<void> {
        // ① 이력 지우기 · ② 질문 수는 남긴다
        await this.conversationStore.clearTurns(user_id);
    }
}

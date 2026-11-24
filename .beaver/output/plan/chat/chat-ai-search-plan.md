# Plan — AI 대화형 업체 검색

> 무엇을·왜는 [spec](../../spec/chat/chat-ai-search-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 진입점마다 비즈니스 로직 전체 ② 계산 함수 ③ 규약만으로 예측할 수 없는 데이터 규칙·쿼리
> **싣지 않는 것** 진입점 껍데기, 입력 검증 객체, 등록·배선, 형제 코드와 같은 조회 — 따르는 패턴을 표 한 줄로 가리킨다

## 선행 조건

없음 — Gemini 키 · deskless 의 pgvector 는 build 를 막지 않는다(키가 비면 AI 요청만 503, 마이그레이션 생성 · 검사는 PGlite 의 pgvector 확장으로 DB 없이 돈다).

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `package.json` | 수정 | 의존성 `@google/genai`, 개발 의존성 `@electric-sql/pglite-pgvector` | 생략 |
| `libs/database/src/entities/store/store-embedding.entity.ts` · `entities.ts` | 신규 · 수정 | `t_store_embedding`(업체마다 1행 — 검색용 글 · 내용 해시 · `vector(768)` · 모델) | 아래 3-1 |
| `libs/database/src/migrations/<ts>-StoreEmbedding.ts` · `migrations.ts` | 신규 · 수정 | `npm run db:generate -- StoreEmbedding` 결과 + 맨 앞 `CREATE EXTENSION IF NOT EXISTS vector` 한 줄 | 아래 3-1 |
| `scripts/db-schema.mjs` | 수정 | PGlite 에 pgvector 확장을 더한다(생성 · 검사) | 아래 3-1 |
| `libs/integration/src/ai/gemini-ai.gateway.ts` · `ai.module.ts` | 신규 | AI 포트 `AI_GATEWAY` 어댑터(Gemini — 정해진 JSON 응답 · 글 스트리밍 · 임베딩), 전역 모듈 | 아래 3-3 |
| `libs/integration/src/conversation/redis-conversation.store.ts` · `conversation-store.module.ts` | 신규 | 대화 포트 `CONVERSATION_STORE` 어댑터(Redis — 이용자별 이력 · 횟수 한 줄 · 답하는 중 잠금, 함께 바꾸는 일은 Lua 하나), 전역 모듈(RedisModule 포함) | 아래 3-2 |
| `libs/integration/src/interfaces/integration.interface.ts` · `integration.symbols.ts` · `integration.constants.ts` | 수정 | `AiGatewayInterface` · `ConversationStoreInterface` 와 그 입출력 타입, `AI_GATEWAY` · `CONVERSATION_STORE`, `AI_UNAVAILABLE_MESSAGE` · 임베딩 차원 768 · 요청 대기 시간 | 아래 3-2 · 3-3 |
| `libs/common/src/utils/sse.ts` | 신규 | `formatSseEvent`(게이트웨이 transport.util 에서 옮김) · `writeSseStream`(이벤트 이어 쓰기 — 시작 전 실패는 예외 그대로, 시작 뒤 실패는 `failed` 이벤트) | 아래 3-5 |
| `apps/gateway/src/modules/transport/transport.util.ts` · `command-stream.service.ts` | 수정 | `formatSseEvent` 를 libs/common 에서 가져온다(동작 그대로) | 생략 |
| `apps/gateway/src/modules/transport/internal-http.client.ts` | 수정 | `stream()` — 서비스의 SSE 응답을 그대로 흘린다(시작 전 실패는 같은 상태 · 본문, 끊기면 서비스 요청도 끊는다) | 아래 3-5 |
| `libs/contracts/src/chat/chat.commands.ts` | 신규 | `CHAT_INTERNAL_PATH`(`/internal/v1/user-service/chat` · `/quota` · `/message`) · `CHAT_COMMAND.CLEAR`(`user.chat.clear`) · `CHAT_STREAM_EVENT` · `CHAT_PROGRESS_PHASE` · `CHAT_MESSAGE_ROLE` | 생략 |
| `libs/contracts/src/chat/dto/chat-detail.dto.ts` · `chat-quota.dto.ts` · `chat-message.dto.ts` | 신규 | 대화 보기 결과 · 남은 질문 수 결과 · 메시지 입력(100자) · 스트림 이벤트 data(진행 · 카드 · 조각 · done) — 초기화는 data 없음(void) | 생략 |
| `apps/user-service/src/chat/chat.service.ts` | 신규 | `getChat` · `getQuota` · `sendMessage`(async generator — 스트림 이벤트) · `clearChat` | 아래 1-1 ~ 1-4 |
| `apps/user-service/src/chat/chat.util.ts` · `chat.constants.ts` | 신규 | 오늘 · 남은 수 `toKstToday` · `toChatQuota`, AI 지시문 · 응답 JSON 형식 · 응답 읽기, 검색 조건 · 카드 만들기, 결과 변환, `readChatDailyLimit` | 아래 2-1 · 3-4 · 3-6 |
| `apps/user-service/src/chat/repositories/chat.repository.ts` · `interfaces/chat.repository.interface.ts` · `chat.symbols.ts` | 신규 | 추천 업체 쿼리(벡터 거리 · 지역 · 편의시설 · 객실 조건) · 카드 객실 그룹 | 아래 3-4 |
| `apps/user-service/src/chat/controllers/chat.controller.ts` · `chat.controller.stream.ts` · `chat.controller.queue.ts` · `chat.module.ts` | 신규 | 내부 HTTP `GET /` · `GET /quota` · 스트림 `POST /message` · 큐 `user.chat.clear` | 아래 3-5 · 생략 |
| `apps/user-service/src/user-service.module.ts` | 수정 | `AiModule` · `ConversationStoreModule` · `ChatModule` | 생략 |
| `apps/gateway/src/api/v1/user-service/chat/controllers/chat.controller.ts` · `chat.controller.stream.ts` · `chat.controller.queue.ts` · `chat.module.ts` · `gateway.module.ts` | 신규 · 수정 | 공개 `GET /api/v1/user-service/chat` · `GET /quota`(동기) · `POST /message`(스트림) · `DELETE /api/v1/user-service/chat`(큐 — 대화 초기화) — 이용자 가드 · Swagger | 아래 3-5 · 생략 |
| `apps/scheduler/src/store/**` | 신규 | 업체 정보 벡터 갱신 — `crontabs/store-embedding.crontab.ts` · repository(대상 업체 · 객실 · 상품 읽기, 벡터 저장) · `store.util.ts`(검색용 글 · 해시) | 아래 1-5 · 3-6 |
| `apps/scheduler/src/chat/**` | 신규 | 지난 대화 지우기 — `crontabs/chat-purge.crontab.ts` · `chat.module.ts` | 아래 1-6 |
| `apps/scheduler/src/scheduler.module.ts` | 수정 | `AiModule` · `ConversationStoreModule` · `StoreModule` · `ChatModule` | 생략 |
| `apps/user-service/src/chat/test/*` · `apps/scheduler/src/store/test/store.repository.spec.ts` | 신규 | service 기능 spec 4개(대화 보기 · 남은 질문 수(+ 계산 4줄) · 메시지 · 대화 초기화) · repository spec 2개(Smoke) | 아래 "테스트" |
| `.env.example` | 수정 | AI 절(`GEMINI_API_KEY` · `GEMINI_CHAT_MODEL` · `GEMINI_EMBEDDING_MODEL`) · 대화 절(`CHAT_DAILY_LIMIT=5` — 하루 질문 수) — 키 묶음당 한 줄 주석 | 생략 |
| `docs/guides/gemini-setup.md` | 신규 | Gemini 키 만들기 · 결제 · 모델 고르기(Gemini 3 계열 — 검색 + JSON) · 넣을 앱(user-service · scheduler) · 확인 | 생략 |
| `docs/streaming.md` · `AGENTS.md` · `docs/architecture.md` · `docs/integration.md` · `docs/data-layer.md` · `docs/testing.md` · `README.md` | 신규 · 수정 | 세 번째 전달 경로(내부 HTTP 스트리밍) 규약 — draft 표시(§4.5), 트리 · 도메인 · 포트 · 설정 표(`CHAT_DAILY_LIMIT` 포함) · 실행 · 배포 표(스트리밍 경로 · pgvector) · vector 컬럼 · Smoke 목록 · 외부 연동 | 생략 |
| `.beaver/output/frontend/changes/<날짜>-chat-ai-search.md` · `changes/README.md` | 신규 · 수정 | 프론트 요청서 — "가까운 순" 빼고 AI 검색, 스트림 읽기(fetch + SSE 이벤트) · 카드 · 남은 질문 수 · 100자 · 답하는 중 · 초기화, DTO 사본. ship 뒤 파일로 건넨다 | 생략 |

---

## 1. 비즈니스 로직 — 진입점별 코드

### 1-1. 대화 보기 — `ChatService.getChat` (user-service)

```ts
// apps/user-service/src/chat/chat.service.ts
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
```

### 1-2. 남은 질문 수 — `ChatService.getQuota` (user-service)

```ts
// apps/user-service/src/chat/chat.service.ts
/**
 * 남은 질문 수 — 이용자의 횟수 한 줄로 오늘 쓴 수 · 남은 수 · 초기화 시각(다음 날 한국 00:00) · 답하는 중인지. (내부 HTTP: GET /internal/v1/user-service/chat/quota)
 *
 * @param user_id 로그인 이용자 ID
 * @returns 하루 한도 · 쓴 수 · 남은 수 · 초기화 시각 · 답하는 중
 */
async getQuota(user_id: string): Promise<ChatQuotaResultDto> {
    // ① 오늘 정하기 · ② 한 줄 읽기 · ③ 남은 수 — 줄이 없거나 저장된 날짜가 오늘이 아니면 0회
    const usage = await this.conversationStore.getUsage(user_id);
    return toChatQuota(usage, readChatDailyLimit(), toKstToday(new Date()));
}
```

### 1-3. 메시지 보내기 — `ChatService.sendMessage` (user-service, async generator)

스트림 이벤트를 하나씩 내보내는 generator 다. **첫 이벤트 전에 던진 예외는 일반 HTTP 응답**(409 · 429)이 되고, 그 뒤 예외는 `failed` 이벤트가 된다(3-5 `writeSseStream`). service 는 전송 객체를 받지 않는다 — 연결이 끊기면 controller 가 넘긴 `signal` 로 AI 요청이 멈추고, generator 의 `finally` 가 잠금을 푼다(`for await` 를 도중에 그만둬도 `finally` 는 돈다). DB 쓰기가 없어 `@Transactional()` 이 없다(대화는 Redis).

횟수는 **⑥에서 이력 저장과 같은 Lua 로 올린다**(3-2 `APPEND_SCRIPT` — 줄 없음 → `오늘:1` 등록, 어제 날짜 → `오늘:1` 로 바꿈, 오늘 날짜 → +1). 실패 · 끊김은 ⑥까지 가지 않으니 오르지 않는다. 확인(②)과 올리기(⑥) 사이에 다른 질문이 끼지 않는 것은 ① 잠금이 맡는다.

```ts
// apps/user-service/src/chat/chat.service.ts
/**
 * 메시지 보내기 — 답하는 중 잠금 → 오늘 남은 수 확인 → 요청 읽기(AI · 웹 검색) → 업체 찾기(벡터 · 조건) → 답 흘리기(AI) → 이력 저장 + 횟수 올리기.
 * 이벤트: progress → stores → delta … → done. (내부 HTTP 스트리밍: POST /internal/v1/user-service/chat/message)
 *
 * @param user_id 로그인 이용자 ID
 * @param dto 질문(100자)
 * @param signal 연결이 끊기면 멈춘다
 * @returns 스트림 이벤트
 */
async *sendMessage(user_id: string, dto: ChatMessageDto, signal: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    // ① 답하는 중 잠금 — SET NX(값 = 이번 요청 ID, 최대 3분). 이미 있으면 409
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
        let cards: ChatCardResultDto[] = [];
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

        // ⑥ 이력 저장 + 횟수 — user_id · 질문 + 답 · 시각 한 건, 횟수 한 줄은 물은 날짜로(없으면 등록 · 어제면 오늘:1 · 오늘이면 +1)
        const turn = toChatTurn(user_id, dto.content, answer, cards, asked_at, new Date());
        const used_count = await this.conversationStore.appendTurn(user_id, turn, today.date, CHAT_TURN_KEEP_MS);
        yield {event: CHAT_STREAM_EVENT.DONE, data: toChatDone(turn, toChatQuota({date: today.date, count: used_count, is_answering: false}, readChatDailyLimit(), today))};
    } finally {
        // 성공 · 실패 · 끊김 모두 — 내 잠금일 때만 푼다(만료 뒤 다른 요청이 잡은 잠금은 건드리지 않는다)
        await this.conversationStore.releaseBusy(user_id, lock_id);
    }
}
```

- 횟수는 **물은 시각**(`asked_at`)의 날짜로 센다 — 밤 11시 59분에 물어 자정이 지나 답이 끝나도 그날 1회다. 그 사이 다음 날 질문은 ① 잠금이 막고 있어 섞이지 않는다.

### 1-4. 대화 초기화 — `ChatService.clearChat` (user-service)

```ts
// apps/user-service/src/chat/chat.service.ts
/**
 * 대화 초기화 — 이 이용자의 대화 이력을 7일 기다리지 않고 바로 모두 지운다(지우기용 목록에서도 뺀다). 횟수 한 줄은 남긴다 — 초기화로 하루 한도를 넘기지 않게. (RabbitMQ: user.chat.clear)
 *
 * @param user_id 로그인 이용자 ID
 */
async clearChat(user_id: string): Promise<void> {
    // ① 이력 지우기 · ② 횟수는 남긴다
    await this.conversationStore.clearTurns(user_id);
}
```

### 1-5. 업체 정보 벡터 갱신 — `StoreEmbeddingCrontab.refreshStoreEmbeddings` (scheduler)

운영 데이터(업체 · 예약)를 바꾸지 않는 검색 색인이라 **개발 환경에서도 돈다**(AGENTS "운영 가드" 는 운영 데이터를 바꾸는 crontab 규칙) — 개발 DB 에서 AI 검색을 시험할 수 있게. 키가 비면 어댑터가 503 이라 그 회차를 건너뛴다.

```ts
// apps/scheduler/src/store/crontabs/store-embedding.crontab.ts
/** 업체 정보 벡터 갱신 잠금 키 */
export const STORE_EMBEDDING_LOCK = 'store.embedding';

/** 업체 정보 벡터 갱신 주기 — 매시 30분(초 분 시 일 월 요일) */
export const STORE_EMBEDDING_CRON = '0 30 * * * *';

/**
 * 1시간마다(매시 30분 — 지난 대화 지우기의 정각과 겹치지 않게) — 영업 중인 업체의 검색용 글을 만들어 바뀐 업체만 임베딩해 저장한다(내용 해시 · 모델이 같으면 건너뜀).
 */
@Cron(STORE_EMBEDDING_CRON) // '0 30 * * * *' — @nestjs/schedule 의 CronExpression 에 매시 30분 상수가 없어 파일 상수로 둔다
async refreshStoreEmbeddings(): Promise<void> {
    await this.jobLock.runExclusive(STORE_EMBEDDING_LOCK, async () => {
        // ① 검색용 글 만들기 — 업체 · 객실 그룹 · 판매 상품
        const stores = await this.storeRepository.findEmbeddingStores();
        if (stores.length === 0) {
            return;
        }
        const ids = stores.map((store) => store.store_id);
        const groups = await this.storeRepository.findEmbeddingRoomGroups(ids);
        const plans = await this.storeRepository.findEmbeddingRoomPlans(ids);
        const saved = await this.storeRepository.findStoreEmbeddings(ids);
        const model = readEmbeddingModel();
        // ② 바뀐 업체 고르기 — 해시 · 모델이 다르거나 벡터가 없는 업체
        const targets = stores
            .map((store) => ({store, content: buildStoreEmbeddingContent(store, groups, plans)}))
            .filter(({store, content}) => isEmbeddingStale(saved.get(store.store_id) ?? null, sha256Hex(content), model));
        // ③ 벡터 만들기 — 묶음마다 한 번 호출, 실패하면 이 회차를 멈추고 다음 회차에 다시
        for (const chunk of chunkArray(targets, STORE_EMBEDDING_BATCH)) {
            try {
                const vectors = await this.aiGateway.embed({texts: chunk.map((item) => item.content), task: AI_EMBED_TASK.DOCUMENT, signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)});
                await this.storeRepository.upsertStoreEmbeddings(chunk.map((item, index) => toStoreEmbeddingEntity(item.store.store_id, item.content, vectors[index], model)));
            } catch {
                return;
            }
        }
    });
}
```

### 1-6. 지난 대화 지우기 — `ChatPurgeCrontab.purgeConversations` (scheduler)

```ts
// apps/scheduler/src/chat/crontabs/chat-purge.crontab.ts
/** 지난 대화 지우기 잠금 키 */
export const CHAT_PURGE_LOCK = 'chat.purge';

/**
 * 1시간마다(매시 정각) — 이력이 있는 이용자마다 7일(24 × 7시간) 지난 대화를 지우고, 대화가 남지 않은 이용자는 목록에서 뺀다.
 */
@Cron(CronExpression.EVERY_HOUR)
async purgeConversations(): Promise<void> {
    await this.jobLock.runExclusive(CHAT_PURGE_LOCK, async () => {
        try {
            await this.conversationStore.purgeTurns(dayjs().subtract(CHAT_TURN_KEEP_DAYS, 'day').toDate());
        } catch {
            // Redis 503 — 다음 회차에 다시
        }
    });
}
```

---

## 2. 계산 함수

### 2-1. 오늘 남은 질문 수 — `toKstToday` · `toChatQuota` (apps/user-service/src/chat/chat.util.ts)

spec 계산 규칙 4줄을 먼저 테스트로 쓴다(TDD — 서버 시간대를 UTC 로 두고 `vi.useFakeTimers({toFake: ['Date']})` 로 한국 23:59 · 00:00 경계를 만든다). 날짜는 **한국 시각**으로 — `dayjs(now).tz(KST_TIMEZONE)`(직접 +9시간 계산 ❌ — AGENTS 날짜 규칙).

```ts
// apps/user-service/src/chat/chat.util.ts
/** 오늘 — 한국 날짜(yyyy-MM-dd) · 초기화 시각(다음 날 한국 00:00) */
export interface ChatToday {
    date: string;
    resets_at: Date;
}

/**
 * 지금 시각의 한국 날짜와 다음 날 00:00. 서버 시간대와 상관없다(dayjs tz).
 *
 * @param now 지금
 * @returns 오늘
 */
export function toKstToday(now: Date): ChatToday {
    const kst = dayjs(now).tz(KST_TIMEZONE);
    return {date: kst.format('YYYY-MM-DD'), resets_at: kst.startOf('day').add(1, 'day').toDate()};
}

/**
 * 오늘 남은 질문 수 — 횟수 한 줄의 날짜가 오늘이면 그 횟수, 줄이 없거나 다른 날짜면 0회. 남은 수는 한도에서 뺀 값(0 아래로 가지 않는다).
 *
 * @param usage 횟수 한 줄(날짜 · 횟수 — 줄이 없으면 날짜 null · 0) · 답하는 중
 * @param daily_limit 하루 한도(CHAT_DAILY_LIMIT)
 * @param today 오늘
 * @returns 남은 질문 수 결과
 */
export function toChatQuota(usage: ConversationUsage, daily_limit: number, today: ChatToday): ChatQuotaResultDto {
    const used_count = usage.date === today.date ? usage.count : 0;
    return {
        daily_limit,
        used_count,
        remaining_count: Math.max(0, daily_limit - used_count),
        resets_at: today.resets_at.toISOString(),
        is_answering: usage.is_answering ? 1 : 0,
    };
}

/**
 * 하루 질문 한도 — `.env` CHAT_DAILY_LIMIT(양의 정수), 비거나 잘못되면 5.
 *
 * @returns 하루 한도
 */
export function readChatDailyLimit(): number {
    return readPositiveInt(process.env.CHAT_DAILY_LIMIT, CHAT_DAILY_LIMIT_DEFAULT);
}
```

---

## 3. 데이터 규칙 — 규약만으로 예측할 수 없는 부분

### 3-1. 업체 벡터 테이블 — `t_store_embedding` · pgvector

- 업체마다 1행(UK `store_id`). 지우는 동작이 없어 `is_deleted` 도 없다 — 지워진 · 활성이 아닌 업체 행은 남아도 추천 쿼리가 업체 상태로 거른다.
- `vector(768)` — `gemini-embedding-001` 을 `outputDimensionality: 768` 로 줄인다(pgvector 인덱스 한도 2,000 차원 안, 저장 · 거리 계산이 가볍다). 업체 71곳이라 HNSW 인덱스는 두지 않는다(전체 거리 계산이 1ms 안).
- 마이그레이션은 생성기 결과 맨 앞에 `CREATE EXTENSION IF NOT EXISTS vector` 를 손으로 더한다 — TypeORM 은 연결 때 확장을 만들려 하지만(PostgresDriver.js:399) 마이그레이션 실행 계정 · 순서에 기대지 않게. deskless 의 PostgreSQL 이미지에 pgvector 가 있어야 한다(사용자에게 알림).

```ts
// libs/database/src/entities/store/store-embedding.entity.ts
/** 업체 검색 벡터 — AI 대화형 검색이 쓴다(scheduler 가 바뀐 업체만 다시 만든다) */
@Entity({name: 't_store_embedding', comment: '업체 검색 벡터(AI 대화형 검색 — 업체마다 1행)'})
@Unique('UK_StoreEmbedding_StoreId', ['store_id'])
export class StoreEmbeddingEntity {
    @PrimaryColumn({name: 'store_embedding_id', length: 32, comment: '업체 검색 벡터 ID', primaryKeyConstraintName: 'PK_StoreEmbedding'})
    store_embedding_id: string;

    @Column({name: 'store_id', length: 32, nullable: false, comment: '업체 ID'})
    store_id: string;

    @ManyToOne(() => StoreEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'store_id', foreignKeyConstraintName: 'FK_StoreEmbedding_Store'})
    store?: never;

    @Column({name: 'content', type: 'text', nullable: false, comment: '임베딩한 검색용 글(업체 · 편의시설 · 객실 · 상품)'})
    content: string;

    @Column({name: 'content_hash', length: 64, nullable: false, comment: '검색용 글 SHA-256 — 같으면 다시 만들지 않는다'})
    content_hash: string;

    @Column({name: 'embedding_model', length: 100, nullable: false, comment: '임베딩 모델 이름 — 바뀌면 다시 만든다'})
    embedding_model: string;

    @Column({name: 'embedding', type: 'vector', length: 768, nullable: false, comment: '검색 벡터(768차원 — 코사인 거리)'})
    embedding: string;

    @Column({name: 'created_at', type: 'timestamptz', nullable: false, comment: '등록일'})
    created_at: Date;

    @Column({name: 'updated_at', type: 'timestamptz', nullable: false, comment: '수정일'})
    updated_at: Date;

    /** 등록일 · 수정일 — insert 할 때 */
    @BeforeInsert()
    insertTimestamp(): void {
        this.created_at = new Date();
        this.updated_at = new Date();
    }

    /** 수정일 — update 할 때 */
    @BeforeUpdate()
    updateTimestamp(): void {
        this.updated_at = new Date();
    }
}
```

`store?: never` 는 형제 엔티티의 FK 관계 속성 꼴을 따른다(관계 속성을 엔티티 타입으로 두지 않는다 — build 때 형제(`store-file.entity.ts`)의 실제 꼴로 맞춘다). 벡터 값은 pgvector 문자열(`'[0.1,0.2,…]'`)로 넣고 읽는다 — `toVectorLiteral(numbers)`(scheduler store.util · user-service chat.util).

```js
// scripts/db-schema.mjs — PGlite 에 pgvector 확장
import {vector} from '@electric-sql/pglite-pgvector';
// …
const db = await PGlite.create({extensions: {btree_gist, vector}});
```

### 3-2. 대화 저장소 — Redis 키 · Lua (`libs/integration/src/conversation/redis-conversation.store.ts`)

대화창 · 벌점 · 정지 키는 없다. 이력은 이용자마다 하나, 횟수는 **이용자마다 한 줄**(사용자 결정 — `user_id` · 날짜 · 횟수).

| 키 | 꼴 | 값 · 만료 |
|---|---|---|
| `chat-turns:<user_id>` | ZSET | 점수 = 물은 시각(ms), 값 = 한 건 JSON `{turn_id, user_id, question, answer, stores, asked_at, answered_at}`(`turn_id` 로 같은 글이어도 겹치지 않게). 7일 동안 질문이 없으면 키 만료, 초기화하면 `DEL` |
| `chat-users` | ZSET | 점수 = 마지막 질문 시각, 값 = user_id — 지난 대화 지우기가 훑는다 |
| `chat-usage:<user_id>` | STRING | `yyyy-MM-dd:횟수`(예: `2026-11-25:3`) — 키가 user_id 라 이용자마다 한 줄. 초기화해도 남고, 7일 동안 안 쓰면 만료 |
| `chat-busy:<user_id>` | STRING | 이번 요청 ID — `SET NX PX 180000`(ship 리뷰에서 2분 → 3분), 끝나면 값이 같을 때만 지운다 |

**횟수 한 줄 규칙**(사용자 결정 2026-11-25) — 읽을 때: 줄이 없거나 날짜가 오늘이 아니면 0회(`toChatQuota`, 읽기는 줄을 바꾸지 않는다). 답을 저장할 때(`APPEND_SCRIPT`):

| 저장된 줄 | 바뀐 줄 |
|---|---|
| 없음 | `오늘:1` 등록 |
| 어제(오늘이 아닌) 날짜 | `오늘:1` 로 바꿈 |
| 오늘 날짜 | 횟수 +1 |

```ts
// libs/integration/src/conversation/redis-conversation.store.ts
/** 횟수 한 줄 · 답하는 중 — 한 번에 읽는다(날짜 비교는 service 의 toChatQuota) */
const USAGE_SCRIPT = `
return {redis.call('GET', KEYS[1]) or '', redis.call('EXISTS', KEYS[2])}
`;

/** 한 건 저장 + 횟수 — 이력 · 이력 만료 7일 · 지우기 목록 · 횟수 한 줄(없음 → 오늘:1, 다른 날짜 → 오늘:1, 오늘 → +1). 새 횟수를 돌려준다 */
const APPEND_SCRIPT = `
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[1], ARGV[4])
local date, count = string.match(redis.call('GET', KEYS[3]) or '', '^(%d%d%d%d%-%d%d%-%d%d):(%d+)$')
local used = 1
if date == ARGV[5] then used = tonumber(count) + 1 end
redis.call('SET', KEYS[3], ARGV[5] .. ':' .. used, 'PX', ARGV[3])
return used
`;

/** 초기화 — 이력 키를 지우고 지우기 목록에서 뺀다(횟수 한 줄은 그대로) */
const CLEAR_SCRIPT = `
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[1])
return 1
`;

/** 잠금 풀기 — 값이 내 요청 ID 일 때만 */
const RELEASE_BUSY_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;
```

- `getUsage` 는 `USAGE_SCRIPT` 의 첫 값을 `yyyy-MM-dd:횟수` 로 나눠 `{date, count, is_answering}`(값이 없거나 모양이 틀리면 `{date: null, count: 0}` — 0회와 같다).
- `acquireBusy` = `SET chat-busy:<id> <lock_id> NX PX <ttl>`.
- `purgeTurns(before)` — `chat-users` 를 `ZSCAN` 으로 500명씩 훑어 이용자마다 `ZREMRANGEBYSCORE chat-turns:<id> -inf (before` 뒤 `ZCARD` 가 0 이면 `ZREM chat-users <id>`(이용자 하나씩 — Lua 하나에 전부 넣지 않는다, Redis 를 오래 막지 않게). 횟수 한 줄은 건드리지 않는다.
- `getTurns(user_id, since, limit)` — `ZRANGE … BYSCORE since +inf` 뒤 끝에서 `limit` 건(대화 보기 50건 · AI 기록 10건 — 한 건이 질문 + 답).
- 포트 메서드: `getTurns` · `appendTurn` · `clearTurns` · `getUsage` · `acquireBusy` · `releaseBusy` · `purgeTurns`. Redis 가 없으면 `REDIS_UNAVAILABLE_MESSAGE` 503(문 정보 `run()` 과 같은 감싸기).

### 3-3. AI 포트 — `AI_GATEWAY` (`libs/integration/src/ai/gemini-ai.gateway.ts`)

지시문 · 응답 형식은 도메인(chat.constants.ts)이 들고, 어댑터는 Gemini 호출만 한다(어떤 기능이든 쓰게).

```ts
// libs/integration/src/interfaces/integration.interface.ts
/** AI 대화 한 줄 — 이용자 · AI */
export interface AiHistoryItem {
    role: 'user' | 'model';
    text: string;
}

/** AI 입력 공통 — 지시문 · 대화 기록 · 이번 말 · 웹 검색 사용 · 끊기 신호 */
export interface AiTextInput {
    system: string;
    history: AiHistoryItem[];
    content: string;
    use_search: boolean;
    signal: AbortSignal;
}

/** 임베딩 입력 — 문서(업체) · 질의(검색 문장) */
export interface AiEmbedInput {
    texts: string[];
    task: 'DOCUMENT' | 'QUERY';
    signal: AbortSignal;
}

/** AI 포트 — 구현 GeminiAiGateway. 키가 비거나 Gemini 가 실패하면 503 AI_UNAVAILABLE_MESSAGE, 끊기 신호면 AbortError 그대로 */
export interface AiGatewayInterface {
    /** 정해진 JSON 형식의 답 하나(웹 검색 그라운딩을 같이 쓸 수 있다 — Gemini 3 계열) */
    generateJson(input: AiTextInput & {schema: object}): Promise<unknown>;
    /** 답 글을 조각으로 흘린다 */
    streamText(input: AiTextInput): AsyncIterable<string>;
    /** 글마다 벡터(768차원) */
    embed(input: AiEmbedInput): Promise<number[][]>;
}
```

```ts
// libs/integration/src/ai/gemini-ai.gateway.ts (핵심만)
async generateJson(input: AiTextInput & {schema: object}): Promise<unknown> {
    const response = await this.call(() =>
        this.client().models.generateContent({
            model: readChatModel(),
            contents: toGeminiContents(input.history, input.content),
            config: {
                systemInstruction: input.system,
                tools: input.use_search ? [{googleSearch: {}}] : undefined,
                responseMimeType: 'application/json',
                responseJsonSchema: input.schema,
                abortSignal: withTimeout(input.signal, AI_REQUEST_TIMEOUT_MS),
            },
        }),
    );
    return parseJsonOrThrow(response.text); // JSON 이 아니면 503
}

async *streamText(input: AiTextInput): AsyncIterable<string> {
    const stream = await this.call(() =>
        this.client().models.generateContentStream({
            model: readChatModel(),
            contents: toGeminiContents(input.history, input.content),
            config: {systemInstruction: input.system, tools: input.use_search ? [{googleSearch: {}}] : undefined, abortSignal: input.signal},
        }),
    );
    try {
        for await (const chunk of stream) {
            if (chunk.text) yield chunk.text;
        }
    } catch (error) {
        throw toAiFailure(error); // 중간 실패도 503(끊기 신호는 그대로)
    }
}

async embed(input: AiEmbedInput): Promise<number[][]> {
    const response = await this.call(() =>
        this.client().models.embedContent({
            model: readEmbeddingModel(),
            contents: input.texts,
            config: {taskType: input.task === 'DOCUMENT' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY', outputDimensionality: AI_EMBEDDING_DIMENSIONS, abortSignal: withTimeout(input.signal, AI_REQUEST_TIMEOUT_MS)},
        }),
    );
    return (response.embeddings ?? []).map((item) => item.values ?? []);
}
```

- `client()` 는 `GEMINI_API_KEY` 가 비면 503(부팅은 된다 — 토스 어댑터처럼 부팅 때 한 번 경고). 모델은 `GEMINI_CHAT_MODEL`(Gemini 3 Flash 계열 — 검색 + JSON 을 같이 쓰려면 Gemini 3 필요) · `GEMINI_EMBEDDING_MODEL`(기본 `gemini-embedding-001`). 정확한 모델 ID 는 build 때 공식 모델 페이지로 확인해 `.env.example` · 가이드에 적는다.
- 실패 분류 `toAiFailure` — `AbortError` 는 그대로, 그 밖(키 오류 · 한도 · 5xx · 네트워크)은 모두 503 `AI_UNAVAILABLE_MESSAGE`(이용자가 고칠 수 있는 것이 없다 — 400 을 두지 않는다).

### 3-4. 추천 업체 쿼리 — `ChatRepository.buildRecommendStoreQuery` (user-service chat)

반경 업체 쿼리(discovery `buildStoreRowsQuery`)의 거리 · 편의시설 · 객실 EXISTS 조건을 같은 꼴로 쓰고, **정렬만 벡터 거리**다. 지역은 여러 개(`ALL` 은 모두의 반경 안 — "여행지 두 곳 사이", `ANY` 는 하나라도 — "온천 있는 도시들"). 벡터가 없는 업체(새로 들어와 아직 임베딩 전)도 조건이 맞으면 뒤에 나온다(`NULLS LAST`).

```ts
// apps/user-service/src/chat/repositories/chat.repository.ts
buildRecommendStoreQuery(filter: ChatRecommendFilter, limit: number): SelectQueryBuilder<StoreEntity> {
    const query = this.stores
        .createQueryBuilder('s')
        .leftJoin(StoreEmbeddingEntity, 'e', '"e"."store_id" = "s"."store_id"')
        .select('s.store_id', 'store_id')
        .addSelect('s.store_name', 'store_name')
        .addSelect('s.address', 'address')
        .addSelect('s.latitude', 'latitude')
        .addSelect('s.longitude', 'longitude')
        .addSelect('s.store_detail', 'store_detail')
        .addSelect(/* 대표 사진 키 · 저장소 서브쿼리 2개 — discovery 와 같은 꼴 */)
        .where('s.store_state_id = :active_state')
        .andWhere('s.is_open = 1')
        .andWhere('s.is_deleted = 0');
    // 지역 — ALL 은 모두 AND, ANY 는 OR(괄호로 묶는다)
    if (filter.areas.length > 0) {
        const parameters: Record<string, number> = {};
        const conditions = filter.areas.map((area, index) => {
            parameters[`area_latitude_${index}`] = area.latitude;
            parameters[`area_longitude_${index}`] = area.longitude;
            parameters[`area_radius_m_${index}`] = area.radius_m;
            return `${distanceSql(`:area_latitude_${index}`, `:area_longitude_${index}`)} <= :area_radius_m_${index}`;
        });
        query.andWhere(`(${conditions.join(filter.area_match === CHAT_AREA_MATCH.ALL ? ' AND ' : ' OR ')})`, parameters);
    }
    // 객실 항목 · 업체 편의시설 — discovery 와 같은 조건 SQL(키는 text 로 못 박는다)
    applyDetailConditions(query, filter.detail_conditions, filter.store_conditions);
    // 이 대화에서 추천한 업체 빼기
    if (filter.excluded_store_ids.length > 0) {
        query.andWhere('s.store_id NOT IN (:...excluded_store_ids)', {excluded_store_ids: filter.excluded_store_ids});
    }
    // 벡터 거리(코사인) 가까운 순 — 검색 문장이 없으면 첫 지역에서 가까운 순
    if (filter.query_vector) {
        query.orderBy('"e"."embedding" <=> CAST(:query_vector AS vector)', 'ASC', 'NULLS LAST').setParameter('query_vector', filter.query_vector);
    } else if (filter.areas.length > 0) {
        query.orderBy(distanceSql(':area_latitude_0', ':area_longitude_0'), 'ASC');
    }
    return query.addOrderBy('s.store_id', 'ASC').limit(limit).setParameters({active_state: CHAT_STORE_STATE_ACTIVE, image_purpose: CHAT_STORE_IMAGE_PURPOSE});
}
```

- `query_vector` 는 pgvector 문자열(`'[0.1,…]'` — `toVectorLiteral`).
- `distanceSql(lat, lng)` · `applyDetailConditions` 는 repository 파일 전용 헬퍼(export 안 함) — discovery repository 의 `DISTANCE_SQL` · 조건 블록과 같은 식이다(도메인이 달라 가져다 쓰지 않는다 — service → service ❌ 와 같은 이유로 repository 도 도메인마다).
- AI 가 준 값은 믿지 않는다 — `toRecommendFilter`(chat.util): 지역은 최대 3개 · 위경도는 한국 범위(위도 33 ~ 39 · 경도 124 ~ 132) 밖이면 버림 · 반경 1 ~ 50km 로 자름, 편의시설 · 객실 키는 `ROOM_GROUP_DETAIL_FILTERS` · `STORE_DETAIL_FILTERS` 에 있는 것만 조건으로(정의의 연산 · 값 · 기본값), 검색 문장 200자.
- 카드 객실 항목: `findCardRoomGroups(store_ids)` = 지워지지 않은 객실 그룹(`room_group_detail`) — 카드마다 그룹 하나라도 필터 조건을 만족하면 그 객실 항목을 넣는다(`toChatCards` — 업체 편의시설 7개 중 1 인 것 다음 객실 항목, `{key, name, group}` 은 `/detail-filter` 와 같은 이름).

### 3-5. 스트리밍 전달 — 게이트웨이 `stream()` · 서비스 `writeSseStream`

새 전달 경로(내부 HTTP 스트리밍)의 핵심 두 곳. 게이트웨이 · 서비스 controller 는 세 번째 파일 `controllers/chat.controller.stream.ts`(`ChatStreamController`)에 둔다 — 동기 · 큐 파일과 섞지 않는다.

```ts
// libs/common/src/utils/sse.ts
/**
 * 이벤트를 SSE 로 이어 쓴다 — 첫 이벤트 전 실패는 예외를 그대로 던져 전역 필터가 HTTP 상태 · 실패 본문으로 답하게 하고,
 * 첫 이벤트 뒤 실패는 failed 이벤트(`{status_code, ...실패 본문}`)를 쓰고 닫는다. 연결이 이미 끊겼으면 아무것도 쓰지 않는다.
 * 연결이 끊기면 generator 를 return() 으로 닫아 그 finally(잠금 풀기)가 돌게 한다.
 *
 * @param res 응답
 * @param events 이벤트
 */
export async function writeSseStream(res: Response, events: AsyncGenerator<{event: string; data: unknown}>): Promise<void> {
    const first = await events.next(); // 여기서 던지면 시작 전 실패 — 그대로 위로
    res.status(200).set({'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no'});
    res.flushHeaders();
    try {
        for (let item = first; !item.done; item = await events.next()) {
            if (res.writableEnded || res.destroyed) {
                await events.return(undefined);
                return;
            }
            res.write(formatSseEvent(item.value.event, item.value.data));
        }
    } catch (error) {
        if (!res.destroyed) {
            const fail = toFailResult(error);
            res.write(formatSseEvent(SSE_FAILED_EVENT, {status_code: fail.status_code, ...fail.body}));
        }
    }
    res.end();
}

// apps/user-service/src/chat/controllers/chat.controller.stream.ts
@Post('/message')
async sendMessage(@InternalActor('user_id') user_id: string, @Body() dto: ChatMessageDto, @Res() res: Response): Promise<void> {
    await writeSseStream(res, this.chatService.sendMessage(user_id, dto, abortOnClose(res)));
}
```

```ts
// apps/gateway/src/modules/transport/internal-http.client.ts — 더하는 메서드
/**
 * 내부 서비스의 SSE 스트림을 그대로 흘린다 — 서비스가 시작 전에 실패하면(4xx · 5xx JSON) 같은 상태 · 본문으로 던지고,
 * 시작하면 헤더(text/event-stream · 버퍼링 끔)를 쓰고 본문을 그대로 넘긴다. 클라이언트가 끊으면 서비스 요청도 끊는다. 대기 시간은 두지 않는다(조각이 계속 온다).
 */
async stream(service: InternalService, path: string, res: Response, options: InternalRequestOptions = {}): Promise<void> {
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    let response: globalThis.Response;
    try {
        response = await fetch(`${baseUrl(service)}${path}`, {method: 'POST', headers: buildInternalHeaders(options), body: JSON.stringify(options.body ?? {}), signal: controller.signal});
    } catch {
        throw new ServiceUnavailableException({message: SERVICE_UNAVAILABLE_MESSAGE});
    }
    if (!response.ok || !response.body) {
        const text = await response.text();
        const data = parseJson(text);
        throw new HttpException(data && typeof data === 'object' ? data : {message: text || response.statusText}, response.status);
    }
    res.status(200).set({'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no'});
    res.flushHeaders();
    try {
        await pipeline(Readable.fromWeb(response.body as ReadableStream), res);
    } catch {
        // 클라이언트가 끊었거나 서비스가 끊었다 — 이미 헤더를 썼으니 닫기만
    }
}
```

- 기존 `request()` 의 헤더 · 주소 만들기는 파일 전용 헬퍼(`buildInternalHeaders` · `baseUrl`)로 뽑아 두 메서드가 같이 쓴다(동작 그대로).
- 게이트웨이 `ChatStreamController` 본문은 `this.internalHttp.stream('user', CHAT_INTERNAL_PATH.MESSAGE, res, {actor, body: dto, client_ip: ip})` 한 줄. Swagger `@ApiProduces('text/event-stream')` · `@ApiOkResponse({type: ChatMessageDoneResultDto})` · 409 · 429 · 400 · 401 · 503.
- 게이트웨이 HTTP 지표 · API 로그는 그대로 걸린다(API 로그는 SSE 본문을 이미 다룬다 — api-log.util.ts:145).

### 3-6. AI 지시문 · 응답 형식 · 검색용 글 (`chat.constants.ts` · scheduler `store.util.ts`)

- **요청 읽기 지시문**(`CHAT_UNDERSTAND_SYSTEM`) — 숙소 찾기 도우미, 한국 안 여행만. 종류를 고른다: `STORE_SEARCH`(숙소를 찾아야 함) · `TRAVEL_TALK`(지역 추천 · 되묻기 · 여행 이야기 — 숙소 검색은 아직) · `OFF_TOPIC`(여행지 · 숙소 찾기와 무관). 지역은 웹 검색으로 알아낸 실제 위경도 · 반경(km), 두 곳 사이면 `ALL`, 후보 여러 곳 중 아무 데나면 `ANY`. 조건 키는 아래 목록에서만(목록은 `toDetailFilterKeys()` 가 `ROOM_GROUP_DETAIL_FILTERS` · `STORE_DETAIL_FILTERS` 로 만든다 — 항목이 늘면 지시문에도 자동으로).
- **응답 형식**(`CHAT_UNDERSTAND_SCHEMA` — JSON Schema): `{kind, search_text, areas: [{name, latitude, longitude, radius_km}], area_match, detail_keys: string[]}`.
- **답 쓰기 지시문**(`CHAT_ANSWER_SYSTEM`) — 한국어 존댓말, 600자 안. 카드 업체만 숙소로 말하고 없는 업체를 지어내지 않는다, 카드 순서대로 1 ~ 3곳 각각 왜 맞는지 한두 문장. 카드가 없으면(조건에 맞는 업체 없음) 조건을 넓혀 보라고. 지역 추천은 한 번에 3곳 · 지역 특징. 여행과 무관한 말이면 한두 문장으로 여행 · 숙소 이야기로 돌린다(불이익 · 벌점 언급 없음).
- **이번 말 꾸미기**(`toAnswerContent`) — 이용자 말 + 요청 읽기 결과 요약 + 카드 JSON(이름 · 주소 · 편의시설 — 카드에 있는 것만).
- **검색용 글**(`buildStoreEmbeddingContent`, scheduler) — `업체: 이름 / 주소 / 소개 / 편의시설: 있는 것 이름 / 객실: 그룹 이름(설명, 방 n개, PC 있음) … / 판매: 시간 이용 · 1박 · 연박` 를 줄바꿈으로. 해시는 이 글의 `sha256Hex`.

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| 공개 · 내부 대화 보기 · 남은 질문 수 라우트 | 이용자 가드 동기 GET 한 핸들러씩 — 게이트웨이 `InternalHttpClient.request` · 서비스 `@InternalActor('user_id')` | `apps/gateway/src/api/v1/user-service/inquiry/controllers/inquiry.controller.ts` · `apps/user-service/src/inquiry/controllers/inquiry.controller.ts:25` |
| 대화 초기화 큐 | `CHAT_COMMAND.CLEAR`(`user.chat.clear`) — 서비스 `@OnCommand` → `clearChat(requireActor(command).user_id)`, 게이트웨이 `@Delete('/')` + `commandStream.dispatch`, 본문 없음(`payload: {}`) · done data 없음 | `apps/gateway/src/api/v1/user-service/inquiry/controllers/inquiry.controller.queue.ts:51` |
| 입력 · 결과 DTO | `ChatMessageDto.content` — `@MaxLength(100)` → `@IsNotEmpty`(한국어 메시지 `질문은 100자 이내로 입력해주세요.` · `질문을 입력해주세요.`), 결과 DTO 는 시각 ISO 문자열 · 없으면 null, 카드 · 편의시설 · 남은 질문 수는 파일마다 따로 | `libs/contracts/src/inquiry/dto/inquiry.dto.ts` · `apps/user-service/src/inquiry/inquiry.util.ts:56` |
| 대화 포트 어댑터 · 모듈 | `RedisConnection.ready()` + `run()` 감싸기(503), Lua `client.eval(script, {keys, arguments})`, 전역 모듈이 `RedisModule` 을 import | `libs/integration/src/door/redis-door.store.ts` · `door-store.module.ts` |
| AI 어댑터 · 모듈 | 키가 비면 부팅 때 경고 · 요청만 503, 실패 분류 util, 전역 모듈 | `libs/integration/src/payment/toss-payment.gateway.ts:45` · `payment.module.ts` |
| scheduler 도메인 · crontab | `JobLockService.runExclusive(<잠금 키>)` · 건별 · 회차 실패 건너뜀 · repository 포트 · 모듈 providers | `apps/scheduler/src/reservation/crontabs/reservation-qr-sync.crontab.ts` |
| 벡터 저장 | `upsertStoreEmbeddings` — `insert … ON CONFLICT ("store_id") DO UPDATE`(`orUpdate`) 한 번 | `apps/scheduler/src/reservation/repositories/reservation.repository.ts`(QR 발급 ON CONFLICT — Smoke 고정) |
| 설정 값 읽기 | `readPositiveInt(process.env.CHAT_DAILY_LIMIT, 5)` | `libs/common/src/utils/env.ts` |
| 게이트웨이 · 서비스 모듈 등록 | 도메인 모듈 `controllers: [동기, 스트림]` · `providers: [service, 큐 컨트롤러, repository]`, 루트 모듈 import | `apps/user-service/src/inquiry/inquiry.module.ts` |
| 프론트 요청서 | 이유 · 영향 화면(U1 메인 — "가까운 순" 빼고 AI 검색 · 새 AI 대화 화면 · U2 로 가는 카드) · API 추가 4개(대화 보기 · 남은 질문 수 · 메시지 스트림 · 대화 초기화 DELETE) · 스트림 이벤트 · 실패(409 · 429 · 100자) · 남은 질문 수 표시 · DTO 사본 · 반영 순서(백엔드 먼저 — 새 API 뿐) | `.beaver/output/frontend/changes/2026-11-24-inquiry.md` |

## 테스트

spec 의 "결과" 표에서 ✓ 표시된 7건(대화 보기 1 · 남은 질문 수 1 · 메시지 4 · 대화 초기화 1)과 "계산 규칙" 표 4건을 그대로 테스트로 옮긴다. 여기에는 추가분만 적는다.

| 종류 | 대상 | 이유 |
|---|---|---|
| 스트림 경로 spec 형식 | `chat-message.spec.ts` — 실제 `ChatStreamController` + `ChatService` + ValidationPipe · 필터 · 내부 가드를 부팅, `CONVERSATION_STORE` · `AI_GATEWAY` · `STORAGE_GATEWAY` · repository 만 mock(`streamText` 는 조각 배열을 내는 async generator). supertest 로 본문을 받아 SSE 이벤트를 순서대로 나눠 단언 | 새 전달 경로라 형제 spec 이 없다 — 시작 전 실패(409 · 429 · 400)는 상태 코드 · 본문 · AI 미호출, 시작 뒤 실패는 `failed` 이벤트 · `appendTurn`(이력 + 횟수) 미호출, 정상은 `appendTurn` 에 물은 날짜(`yyyy-MM-dd`) 1회, **모든 경우 `releaseBusy` 가 같은 잠금 ID 로 1회**(잠금을 잡지 못한 409 는 미호출) |
| 계산 규칙 | `toKstToday` · `toChatQuota` 4줄 — `chat-quota.spec.ts` 안 표(`[CASES]` util spec 을 따로 두지 않는다 — AGENTS Testing). `process.env.TZ` 를 UTC 로 두고 `vi.useFakeTimers({toFake: ['Date']})` 로 한국 23:59 · 00:00 을 만든 뒤, `getUsage` mock 이 준 한 줄(`2026-11-25:2` · `:5` · 어제 날짜 · 줄 없음)에 대한 응답 `used_count` · `remaining_count` · `resets_at` 을 본다 | 한국 날짜 경계가 서버 시간대와 섞이면 틀리기 쉽다 |
| 쿼리 스모크 | user-service `ChatRepository.buildRecommendStoreQuery` — 지역 2개 `ALL` · `ANY` · 객실 1 · 편의시설 1 · 제외 2 · 벡터 정렬 / 벡터 없음 | `<=> CAST(:query_vector AS vector)` · `NULLS LAST` · 지역 괄호 AND/OR · 파라미터 이름 안 겹침 · 상태 · 영업 · 삭제 조건 |
| 쿼리 스모크 | scheduler `StoreRepository` — 대상 업체(활성 · 지워지지 않음) · 객실 그룹 · 상품(조인) 조회 조건 · `upsertStoreEmbeddings`(ON CONFLICT store_id DO UPDATE) | 관계 조건 · 조인 · upsert 매핑 민감 |

## 만드는 순서

1. 의존성 · 엔티티 · `db-schema.mjs` pgvector → `npm run db:generate -- StoreEmbedding`(+ `CREATE EXTENSION` 한 줄) → `npm run db:check` → 2. libs/integration 포트 · 어댑터(AI · 대화) · libs/common `sse.ts`(게이트웨이 `formatSseEvent` 옮기기) → 3. contracts(경로 · 명령 · 이벤트 · DTO) → 4. 남은 질문 수 계산 테스트 → `toKstToday` · `toChatQuota` → 5. user-service chat(repository + Smoke → util · 지시문 → service → controller 3종 · 모듈) + service spec 4개 → 6. 게이트웨이(`InternalHttpClient.stream` · controller 3종 · 모듈) → 7. scheduler(store 벡터 갱신 + repository Smoke · chat 지우기) → 8. `.env.example` · 가이드 · 문서(streaming.md draft · AGENTS · architecture · integration · data-layer · testing · README) · 프론트 요청서 · report → `npm run typecheck` · `lint` · `db:check`

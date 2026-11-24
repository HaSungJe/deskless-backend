# Report — AI 대화형 업체 검색

## Feature Summary
- **Feature**: 로그인한 이용자가 대화로 여행지 · 숙소를 찾는다 — Gemini 가 요청을 읽고(Google 검색 그라운딩) 업체 검색 벡터(pgvector) + 지역 · 편의시설 · 객실 조건으로 최대 3곳을 골라 카드로 보내고, 답을 글자 조각으로 흘린다. 대화는 Redis 에 7일, 하루 `CHAT_DAILY_LIMIT`(기본 5)회 · 100자, 대화창 · 벌점 · 정지 없음.
- **Entry point**: `POST /api/v1/user-service/chat/message` (스트림 — 세 번째 전달 경로) 외 `GET /api/v1/user-service/chat` · `GET /api/v1/user-service/chat/quota`(동기) · `DELETE /api/v1/user-service/chat`(큐) · scheduler crontab 2개(업체 검색 벡터 매시 30분 · 지난 대화 지우기 매시)
- **Domain**: chat (user-service · scheduler) + store(scheduler — 업체 검색 벡터)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `package.json` · `package-lock.json` | modified | `@google/genai` · 개발 `@electric-sql/pglite-pgvector` |
| `libs/database/src/entities/store/store-embedding.entity.ts` · `entities.ts` | created · modified | `t_store_embedding`(업체마다 1행 — 검색용 글 · 내용 해시 · 모델 · `vector(768)`, `UK_StoreEmbedding_StoreId` · `FK_StoreEmbedding_Store` CASCADE) |
| `libs/database/src/migrations/1795550230239-StoreEmbedding.ts` · `migrations.ts` | created · modified | `db:generate -- StoreEmbedding` 결과 + 맨 앞 `CREATE EXTENSION IF NOT EXISTS vector`(손으로) |
| `scripts/db-schema.mjs` | modified | PGlite 에 `vector` 확장(생성 · 검사) |
| `libs/integration/src/ai/gemini-ai.gateway.ts` · `ai.module.ts` | created | `AI_GATEWAY` 어댑터 — `generateJson`(JSON 응답 + 검색 그라운딩) · `streamText` · `embed`(768), 키 없음 503 · 부팅 경고, 끊기 신호 그대로 · 그 밖 503, 전역 모듈 |
| `libs/integration/src/conversation/redis-conversation.store.ts` · `conversation-store.module.ts` | created | `CONVERSATION_STORE` 어댑터(Redis Lua — 이력 + 질문 수 한 줄 · 초기화 · 질문 수 읽기 · 잠금 · 지난 대화 지우기), 전역 모듈 |
| `libs/integration/src/integration.interface.ts` · `integration.symbols.ts` · `integration.constants.ts` | modified | AI · 대화 포트 인터페이스 · 토큰 · 상수(`AI_UNAVAILABLE_MESSAGE` · 모델 기본값 · 30초 · 768) |
| `libs/common/src/utils/sse.ts` | created | `SSE_HEADERS` · `formatSseEvent`(게이트웨이에서 옮김) · `writeSseStream` · `abortOnClose` |
| `apps/gateway/src/modules/transport/transport.util.ts` · `command-stream.service.ts` · `api-log/api-log.util.ts` | modified | `formatSseEvent` 를 libs/common 에서 가져온다(동작 그대로) · 주석 |
| `apps/gateway/src/modules/transport/internal-http.client.ts` | modified | `stream()` — 서비스 SSE 를 그대로 흘림(시작 전 실패는 같은 상태 · 본문, 끊기면 서비스 요청도 끊음) |
| `libs/contracts/src/chat/chat.commands.ts` · `dto/chat-detail.dto.ts` · `chat-quota.dto.ts` · `chat-message.dto.ts` | created | 내부 경로 · 명령 `user.chat.clear` · 스트림 이벤트 · 진행 단계 · DTO |
| `apps/user-service/src/chat/**` | created | service(`getChat` · `getQuota` · `sendMessage` async generator · `clearChat`) · util · constants(지시문 · JSON 형식) · repository(추천 업체 쿼리 · 카드 객실 그룹) · controllers 3개(동기 · 스트림 · 큐) · module |
| `apps/user-service/src/user-service.module.ts` | modified | `AiModule` · `ConversationStoreModule` · `ChatModule` |
| `apps/gateway/src/api/v1/user-service/chat/**` · `gateway.module.ts` | created · modified | 공개 라우트 동기 2 · 큐 1 · 스트림 1(이용자 가드) |
| `apps/scheduler/src/store/**` | created | 업체 검색 벡터 갱신 crontab(매시 30분 · 바뀐 업체만 · 50개씩) · repository · util · module · repository spec |
| `apps/scheduler/src/chat/**` | created | 지난 대화 지우기 crontab(매시 · 7일) · module |
| `apps/scheduler/src/scheduler.module.ts` | modified | `AiModule` · `ConversationStoreModule` · `StoreModule` · `ChatModule` |
| `.env.example` | modified | Redis 절 제목 · "AI 대화형 업체 검색 (Gemini)" 절(`GEMINI_API_KEY` · `GEMINI_CHAT_MODEL` · `GEMINI_EMBEDDING_MODEL` · `CHAT_DAILY_LIMIT`) |
| `docs/streaming.md` · `docs/guides/gemini-setup.md` | created | 세 번째 전달 경로 규칙(draft — ship 이 확정) · Gemini 세팅 |
| `AGENTS.md` · `README.md` · `docs/architecture.md` · `docs/integration.md` · `docs/data-layer.md` · `docs/testing.md` · `docs/messaging.md` · `docs/conventions.md` · `docs/api.md` · `docs/guides/redis-setup.md` | modified | 세 전달 경로 · 스트림 controller 파일 규칙 · 트리 · 포트 · 전역 모듈 · Redis 키 · vector · 운영 가드 예외 · 스트림 핸들러 · Smoke 목록 · 체크리스트 · 설정 · 배포 표 |
| `.beaver/output/frontend/changes/2026-11-25-chat-ai-search.md` · `changes/README.md` | created · modified | 프론트 요청서("가까운 순" 빼고 AI 검색 · 스트림 읽기 · 카드 · 남은 질문 수 · 100자 · 초기화 · DTO 사본) + 목록 한 줄 |

## Tests Written
spec ✓ 7건 + 계산 규칙 4줄 + plan 추가분. 실행은 `/beaver:test`(build 는 돌리지 않았다).
- `apps/user-service/src/chat/test/chat-detail.spec.ts` — 대화 보기(이력 펼치기 · 남은 수 · 빈 이력)
- `chat-quota.spec.ts` — 남은 질문 수(env `CHAT_DAILY_LIMIT` · 줄 없음) + `[CASES]` 4줄(줄 없음 · 오늘 2회 · 어제 날짜 · 한국 23:59 — `TZ=UTC` + 가짜 Date)
- `chat-message.spec.ts` — 스트림 경로: 숙소 질문 전체 이벤트 순서 · mock 인자(검색 그라운딩 · 임베딩 QUERY · 추천 필터 · 저장 날짜), 무관한 말(카드 없음 · 1회), 429(`resets_at`) · 409, 입력 400(빈 값 · 101자), 답 중 AI 실패 → `failed` 503 · 저장 없음, 모든 경우 잠금 풀기 횟수 · 같은 ID
- `chat-clear.spec.ts` — 큐 경로 초기화 done · 이력만 지움
- `chat.repository.spec.ts` — 카드 객실 그룹 find 조건 · 통일 500 · Smoke(지역 ALL · ANY 괄호 · 객실 EXISTS · 업체 JSON · NOT IN · `<=> CAST(… AS vector)` NULLS LAST · 벡터 없음)
- `apps/scheduler/src/store/test/store.repository.spec.ts` — 대상 find 조건 · 통일 500 · 빈 저장 미실행 · Smoke(ON CONFLICT store_id DO UPDATE — 등록일 · ID 그대로, 벡터 문자열)

## Verification
- `npm run typecheck` · `npm run lint` · `npm run db:check` 통과(문서 단계 뒤 다시 확인 — 아래 마지막 단계).
- 새 SQL 두 개는 빌드된 dist 로 조립해 확인했다 — 추천 업체 쿼리 `ORDER BY "e"."embedding" <=> CAST($18 AS vector) ASC NULLS LAST`, 벡터 저장 `ON CONFLICT ( "store_id" ) DO UPDATE SET …`.
- 읽어서 맞춘 것: 질문 수 한 줄 Lua(없음 · 다른 날 → `오늘:1`, 오늘 → +1)와 읽기(오늘이 아니면 0) · 초기화가 질문 수 줄을 남김 · 답을 끝까지 받은 질문만 저장 · 셈 · 시작 전 409 · 429 는 HTTP 응답, 시작 뒤 실패는 `failed` · `finally` 가 같은 잠금 ID 로만 풀기 · 이미 추천한 업체 제외 · 카드 ≤ 3 · 벌점 · 대화창 코드 없음.
- plan 과 다른 점(코드가 맞고 문서를 맞췄다):
  - `toStoreEmbeddingEntity(store_id, content, content_hash, vector, model)` — 해시를 밖에서 받는다(변경 판정과 같은 값을 저장하려고).
  - 업체 검색 벡터 cron 은 Nest 에 "매시 30분" 상수가 없어 파일 상수 `STORE_EMBEDDING_CRON = '0 30 * * * *'`.
  - `writeSseStream(res, events, failed_event)` — 실패 이벤트 이름을 받는다(도메인마다 contracts 의 이름).
  - 게이트웨이 chat 모듈 controllers 는 `[동기, 큐, 스트림]` 순(규칙으로 문서화).
  - scheduler 상품 읽기는 조인 대신 `find({store_id: In, is_used: 1})`(조인이 필요 없었다).

## Ship Review Fixes (2026-11-25)
- 빈 답(글 조각 없음)은 503 `failed` — 저장 · 횟수 없음(빈 글이 이력에 남아 다음 질문마다 AI 가 거절하던 문제), spec 1건 추가.
- 글 스트리밍 전체 60초 제한(`AI_STREAM_TIMEOUT_MS`) · 답하는 중 잠금 2분 → 3분 — 멈춘 스트림이 잠금보다 오래 가 하루 한도를 넘기지 않게.
- 프론트 요청서에 `done` · `failed` 없이 끝날 때의 처리.
- 리뷰: `.beaver/output/review/main-review-261125.md`

## Remaining Issues
- 실행 검증은 `/beaver:test` 몫 — 실제 Gemini · Redis · pgvector 로는 돌려 보지 않았다(키 · 인프라는 사용자).
- deskless 에 알릴 것: PostgreSQL 이미지에 pgvector(마이그레이션이 `CREATE EXTENSION vector`), Ingress 의 스트림 경로 버퍼링 끔 · 읽기 대기 120초, `GEMINI_API_KEY` 는 user-service · scheduler 에만.
- 마이그레이션 적용은 사용자(`db:migrate` 또는 deskless 마이그레이션 Job).

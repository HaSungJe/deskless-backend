# Review — main — 261125

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — direct 모드(main 에 바로 커밋 · 푸쉬).

## Target
- stick: `main`(direct 모드) → origin: `main`
- Included features: AI 대화형 업체 검색(chat-ai-search — AI 업체 검색 3단계 중 ③) — 대화 보기 · 남은 질문 수 · 메시지 스트림 · 대화 초기화, 업체 검색 벡터(pgvector) 갱신 · 지난 대화 지우기(scheduler), 세 번째 전달 경로(내부 HTTP 스트리밍)
- Change scope: 수정 29 파일(+781 / −85, package-lock 포함) + 새 폴더 · 파일 16곳(user-service chat · scheduler store · chat · gateway chat 라우트 · contracts chat · libs/integration ai · conversation · sse util · 엔티티 · 마이그레이션 · streaming.md · gemini-setup.md · spec · plan · report · 프론트 요청서)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 도메인 레이어 `chat.<role>.ts` · 스트림 controller `controllers/chat.controller.stream.ts`(`ChatStreamController` — 이번에 규칙으로 문서화), crontab `store-embedding.crontab.ts` · `chat-purge.crontab.ts`, 엔티티 `t_store_embedding` · `UK_StoreEmbedding_StoreId` · `FK_StoreEmbedding_Store`, 명령 `user.chat.clear`, 응답 `*ResultDto` |
| Structure & layering | pass | 서버는 행위자 기준(이용자 → user-service), controller → service → repository · crontab → repository/포트. service 는 전송 객체 대신 끊기 신호(`abortOnClose`)를 값으로 받는다. 외부 연동은 포트(`AI_GATEWAY` · `CONVERSATION_STORE`) + 실제 어댑터(mock 없음) + 세팅 가이드. 앱끼리 import 없음(scheduler 는 `CHAT_PURGE_KEEP_DAYS` 를 따로 둔다) |
| Shared logic extraction | pass | service private 헬퍼 0건 — 계산은 `chat.util.ts` · `store.util.ts`, SSE 는 `libs/common/src/utils/sse.ts`(게이트웨이 `formatSseEvent` 를 옮겨 큐 · 스트림이 같이 쓴다). 날짜는 dayjs tz. 작은 중복 1건은 아래 #4 |
| Errors & responses | pass | 시작 전 409 · 429(`resets_at` 추가 필드) · 400 은 HTTP 실패 본문, 시작 뒤는 `failed {status_code, …}`(`toFailResult`). 어댑터 실패는 503 `*_UNAVAILABLE_MESSAGE`, repository 는 try/catch + 통일 500. 응답 필드 생략 없음(`image_url: null`) |
| Test strength | pass | service 기능 spec 4개(API 1개당 1개 — 스트림은 이벤트 순서 · data · mock 인자 · 잠금 풀기 횟수 · 저장 미호출까지), 계산 규칙 4줄 `[CASES]`(TZ=UTC + 가짜 Date), repository spec 2개 + Data-Access Smoke(추천 업체 — 지역 괄호 AND/OR · 객실 EXISTS · 업체 JSON · NOT IN · `<=> CAST(… AS vector)` NULLS LAST, 벡터 저장 — ON CONFLICT store_id DO UPDATE). 실행은 `/beaver:test` |

- memory: `git`(산출물 커밋 포함 — 이 리뷰 · spec · plan · report 를 같이 커밋) · `frontend`(요청서 `2026-11-25-chat-ai-search.md` + 목록 한 줄 — 있음) · `api-log`(해당 없음) · `cache`(미반영 code rule — 캐시 코드가 아직 없어 이번에도 옮길 대상 아님).
- draft 확정: `docs/streaming.md` 를 코드와 대조(게이트웨이 `stream()` · `writeSseStream(res, events, failed_event)` · `abortOnClose` · 잠금 `SET NX` 2분 · 값이 같을 때만 풀기 · 저장은 마지막) — 일치, `beaver:draft` 표시를 지워 확정했다.

## Intended Behavior Check (against plan/spec)
- spec 진입점 6개 그대로 — `GET /chat` · `GET /chat/quota` · `POST /chat/message`(스트림) · `DELETE /chat`(큐) · crontab 업체 검색 벡터(매시 30분 · 바뀐 업체만) · 지난 대화 지우기(매시 · 7일).
- 사용자 결정대로: 대화창 · 벌점 · 정지 없음, 하루 `CHAT_DAILY_LIMIT`(기본 5) · 한국 자정, 100자, 질문 수는 이용자마다 한 줄 `chat-usage:<user_id>` = `yyyy-MM-dd:횟수`(없음 · 다른 날 → `오늘:1`, 오늘 → +1 — 한 Lua 에서 이력 저장과 함께), 읽을 때 오늘이 아니면 0, 초기화는 이력만 바로 전부 지우고 질문 수 줄은 남김, 답을 끝까지 받은 질문만 셈, 무관한 말도 돌리는 답 · 1회, 카드 ≤ 3(대표 사진 · 업체명 · 주소 · 위경도 · 편의시설 · 객실 항목), 이미 추천한 업체 제외, 답하는 중 한 번에 하나(409).
- plan 과 다른 곳 5가지는 report 에 이유와 함께(해시를 밖에서 받는 `toStoreEmbeddingEntity` · cron 파일 상수 · `writeSseStream` 실패 이벤트 이름 인자 · 게이트웨이 `[동기, 큐, 스트림]` 순서 · 상품 읽기 find).
- 문서: AGENTS.md · README · docs 9개 · 가이드 2개 · 프론트 요청서 · report — 세 전달 경로 · 스트림 controller 규칙 · 포트 · Redis 키 · vector · 운영 가드 예외까지 반영.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Medium | `apps/user-service/src/chat/chat.service.ts:146` | 답 글 조각이 하나도 오지 않으면(Gemini 가 안전 필터 · 검색 결과만 주고 글이 비는 경우) 빈 답을 저장하고 1회를 센다. 그 뒤 이 이용자의 질문마다 이력에 빈 `model` 글이 실려 Gemini 가 400(빈 text) 을 돌려주고, 어댑터가 503 으로 바꿔 **대화를 초기화하거나 7일이 지날 때까지 모든 질문이 실패**한다 | 스트림이 끝난 뒤 답이 비었으면(공백만 포함) 503 `AI_UNAVAILABLE_MESSAGE` 를 던진다 — `failed` 이벤트 · 저장 · 횟수 없음. spec 에 한 경우 추가 |
| 2 | Low | `libs/integration/src/ai/gemini-ai.gateway.ts:116` | 글 스트리밍에 제한 시간이 없는데 답하는 중 잠금은 2분 뒤 풀린다. Gemini 스트림이 멈춰 2분을 넘기면 같은 이용자의 다음 질문이 들어와 둘 다 남은 수 확인을 지나 하루 한도를 1회 넘길 수 있고, 앞단(Ingress 120초)이 없는 로컬에서는 요청이 끝나지 않는다 | 스트리밍 전체에 60초 제한(`AI_STREAM_TIMEOUT_MS`) — 요청 읽기 30초 + 임베딩 30초 + 스트리밍 60초 ≤ 잠금 2분이 되도록 잠금을 3분으로. 넘기면 503 `failed`. integration.md · streaming.md 문구 맞춤 |
| 3 | Low | `.beaver/output/frontend/changes/2026-11-25-chat-ai-search.md:30` | 스트림이 `done` · `failed` 없이 끊길 때(네트워크 · 서비스 재시작 — 게이트웨이는 닫기만 한다) 프론트가 어떻게 할지가 없다 | "done · failed 없이 끝나면 실패로 보고 `GET …/chat` 으로 다시 맞춘다" 한 줄 |
| 4 | Nit | `apps/scheduler/src/store/store.util.ts:26` | 임베딩 모델 읽기가 어댑터(`gemini-ai.gateway.ts` 파일 함수)와 scheduler util 에 같은 식으로 두 벌 — 기본값 상수는 같이 써서 어긋날 위험은 작다 | 그대로 둔다(다음에 AI 포트를 쓰는 기능이 늘면 `libs/integration` 에 export 함수 하나로) |

## Verdict
Changes needed(경미) — #1 은 이용자 한 명의 AI 검색을 며칠 막을 수 있어 커밋 전에 고치기를 권한다. #2 · #3 은 같이 고치면 좋은 작은 수정, #4 는 그대로 둔다. 고치면 같은 리뷰 문서에 결과를 덧붙이고 커밋한다.

## Fix Result (사용자 결정 2026-11-25 — ①②③ 고치고 커밋)
| # | Result | 바꾼 곳 |
|---|--------|--------|
| 1 | fixed | `chat.service.ts` — 스트림이 끝난 뒤 답이 비었으면(공백만) 503 `AI_UNAVAILABLE_MESSAGE` → `failed` 이벤트 · 저장 · 횟수 없음 · 잠금 풀림. `chat-message.spec.ts` 에 경우 1건(공백 조각만 → `failed` 503 · `appendTurn` 미호출 · 같은 잠금 ID 로 풀기) |
| 2 | fixed | `integration.constants.ts` `AI_STREAM_TIMEOUT_MS = 60000` · `gemini-ai.gateway.ts` 글 스트리밍에 끊기 신호 + 60초, `chat.constants.ts` `CHAT_BUSY_TTL_MS` 2분 → 3분(30 + 30 + 60초보다 길게). spec 잠금 값 단언 180000. 문서 integration.md · streaming.md · redis-setup.md · spec · plan 의 2분 → 3분 · 제한 시간 문구 |
| 3 | fixed | 프론트 요청서 — `done` · `failed` 없이 끝나면 실패로 보고 `GET …/chat` 으로 다시 맞춘다(끊기기 직전에 저장됐을 수도 있다) · 서버가 한 질문을 2분 남짓에서 끊는다 |
| 4 | 그대로 | 임베딩 모델 읽기 두 벌 — AI 포트를 쓰는 기능이 늘 때 `libs/integration` 함수 하나로 |

고친 뒤 `npm run typecheck` · `npm run lint` 통과. 테스트 실행은 `/beaver:test`.

## Verdict (re-review)
Pass — 남은 지적 #4(Nit)는 의도적으로 둔다.

# Gemini 세팅 (AI 대화형 업체 검색)

AI 대화형 업체 검색(`/api/v1/user-service/chat`)과 업체 검색 벡터(scheduler)가 Google Gemini API 를 쓴다. 키가 없으면 앱은 뜨고 AI 질문 · 벡터 갱신만 503 이다(부팅 때 경고 한 줄).

## 1. API 키 만들기

1. [Google AI Studio](https://aistudio.google.com/) 에 로그인 → **Get API key** → 프로젝트를 고르거나 새로 만든다 → 키를 만든다.
2. 운영에서 쓸 키는 결제(유료 등급)를 켠 프로젝트에서 만든다 — 무료 등급은 요청 한도가 낮고, 입력이 모델 개선에 쓰이며, **웹 검색 그라운딩을 쓸 수 없다**(아래 `GEMINI_SEARCH_ENABLED`).
   - 결제를 연결한 프로젝트(유료 등급)는 **선불 잔액**이 있어야 요청을 받는다. AI Studio 프로젝트 목록의 상태가 "선불 결제 필요" 면 결제 등급 칸의 "선불 결제 설정" 에서 충전한다(최소 $10). 잔액이 없으면 모든 요청이 402 `Your prepayment credits are depleted` 다.
   - 결제를 연결하면 그 프로젝트에는 무료 등급이 적용되지 않는다 — 무료로 쓰려면 결제를 연결하지 않은 프로젝트에서 키를 만든다.
3. 키는 비밀값이다 — 저장소 · 프론트에 넣지 않는다.

## 2. `.env`

```
GEMINI_API_KEY=<키>
GEMINI_CHAT_MODEL=gemini-3-flash-preview
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_SEARCH_ENABLED=1
CHAT_DAILY_LIMIT=5
```

- `GEMINI_API_KEY` 는 **user-service · scheduler 만** 넣는다(게이트웨이 · admin-service 는 쓰지 않는다 — 쿠버네티스는 deskless 차트의 Secret).
- `GEMINI_CHAT_MODEL` — 웹 검색을 켜면(`GEMINI_SEARCH_ENABLED=1`) 요청 읽기에서 **Google 검색 그라운딩과 정해진 JSON 응답을 한 요청에 같이** 쓰므로 Gemini 3 계열이어야 한다. 더 새 Flash 모델이 나오면 [모델 목록](https://ai.google.dev/gemini-api/docs/models)에서 "structured outputs" · "search grounding" 을 지원하는지 보고 바꾼다.
- `GEMINI_SEARCH_ENABLED` — 웹 검색(Google 검색 그라운딩). **무료 등급 키는 그라운딩을 쓸 수 없으므로 `0`** — 켜 두면 질문마다 503 이다. 끄면 요청 읽기 · 답 쓰기가 도구 없이 불려 지역 · 관광지 위치를 모델이 아는 지식으로만 잡는다(최신 정보 · 덜 알려진 장소에 약하다). 끄면 "검색 + JSON 을 한 요청에" 조건이 없어져 Gemini 3 가 아닌 모델도 쓸 수 있다. 유료 등급은 `1`(비어도 켬).
- `GEMINI_EMBEDDING_MODEL` — 업체 · 질문을 768차원 벡터로 만든다(`outputDimensionality` 768 — DB 컬럼 `vector(768)` 과 같아야 한다). 모델을 바꾸면 scheduler 가 다음 회차(매시 30분)에 모든 업체 벡터를 다시 만든다.
- `CHAT_DAILY_LIMIT` — 이용자 하루 질문 수(한국 시각 자정에 다시 채움, 답을 다 받은 질문만 센다).

## 3. 요금 · 한도

- 질문 하나에 Gemini 를 최대 세 번 부른다 — 요청 읽기(웹 검색 그라운딩 — Gemini 3 는 모델이 실제로 한 검색만큼 요금이 붙는다) · 검색 문장 임베딩 · 답 스트리밍. 하루 질문 수(`CHAT_DAILY_LIMIT`)가 이 비용의 상한이다.
- 업체 벡터는 바뀐 업체만 다시 만든다(내용 해시) — 업체 수만큼 매시간 부르지 않는다.
- 무료 등급 — 모델 호출 · 임베딩은 무료(한도는 AI Studio 의 rate limit 화면 — 미리보기 모델은 더 낮다), 웹 검색 그라운딩은 없다. 유료 등급 — 웹 검색은 월 5,000건 무료(Gemini 3 이상 모델 공유) 뒤 1,000건당 $14, 하루 1,500건 한도.
- 한도(429) · 선불 잔액 없음(402) · 장애(5xx)는 이용자에게 503 `AI 답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.` 로 보이고, 그 질문은 횟수에서 빠지지 않는다.

## 4. 확인

1. user-service · scheduler 를 다시 띄운다(부팅 로그에 `GEMINI_API_KEY 가 비어 …` 경고가 없어야 한다).
2. DB 에 마이그레이션(`StoreEmbedding` — pgvector 확장 포함)이 적용돼 있어야 한다.
3. scheduler 가 매시 30분에 업체 벡터를 만든다 — 바로 보려면 30분 회차를 기다리거나 scheduler 를 그 시각 전후로 띄워 둔다. `t_store_embedding` 에 업체 수만큼 행이 생기면 된다.
4. 이용자로 로그인해 `POST /api/v1/user-service/chat/message` 에 `{"content": "온천 가고 싶은데 반려동물이랑 묵을 곳 있을까?"}` 를 보낸다 — `progress` → `stores` → `delta` … → `done` 이 흘러오면 된다(Swagger 는 스트림을 끝까지 보여 주지 못할 수 있다 — `curl -N` 으로 본다).

## 5. 문제 해결

질문이 "AI 답을 만들지 못했습니다" 로 끝나면(스트림의 `failed` 503 — HTTP 상태는 200 이라 오류율 지표에는 잡히지 않는다) **user-service 로그의 `GeminiAiGateway` 줄**이 원인을 말한다. 쿠버네티스(deskless)면 user-service 파드 로그(대시보드 · `kubectl logs`), 로컬이면 `npm run start:user-service` 터미널.

| 로그 | 원인 · 할 일 |
|---|---|
| 부팅 때 `GEMINI_API_KEY 가 비어 있어 …`, 질문 때는 줄 없음 | 키가 그 앱에 안 들어갔다 — 쿠버네티스는 deskless 저장소의 `backend/.env` 가 Secret 이 된다 |
| `JSON 응답 실패: … 402 … prepayment credits are depleted` | 유료 등급 프로젝트의 선불 잔액 0 — 충전하거나, 결제 없는 프로젝트의 키 + `GEMINI_SEARCH_ENABLED=0` |
| `JSON 응답 실패: …` 에 search · grounding · tool 관련 거절 | 무료 등급 키에 웹 검색 — `GEMINI_SEARCH_ENABLED=0` |
| `JSON 응답 실패: … API key not valid …` | 키 값이 틀렸다 |
| `JSON 응답 실패: … 404 … is not found for API version v1 …` | API 버전 — 코드는 v1beta 로 고정돼 있다(`AI_API_VERSION`). 2026-11-25 이전 이미지면 다시 올린다. v1beta 인데도 404 면 그 모델이 없어졌거나 이 키에서 쓸 수 없다 — `GEMINI_CHAT_MODEL` 을 [모델 목록](https://ai.google.dev/gemini-api/docs/models)의 정식 모델(예: `gemini-3.8-flash`)로 |
| `JSON 응답 실패: … 429 …` | 요청 한도 — 잠시 뒤 다시, 자주 나면 유료 등급 |

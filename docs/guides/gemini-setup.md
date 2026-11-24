# Gemini 세팅 (AI 대화형 업체 검색)

AI 대화형 업체 검색(`/api/v1/user-service/chat`)과 업체 검색 벡터(scheduler)가 Google Gemini API 를 쓴다. 키가 없으면 앱은 뜨고 AI 질문 · 벡터 갱신만 503 이다(부팅 때 경고 한 줄).

## 1. API 키 만들기

1. [Google AI Studio](https://aistudio.google.com/) 에 로그인 → **Get API key** → 프로젝트를 고르거나 새로 만든다 → 키를 만든다.
2. 운영에서 쓸 키는 결제(유료 등급)를 켠 프로젝트에서 만든다 — 무료 등급은 요청 한도가 낮고 입력이 모델 개선에 쓰일 수 있다.
3. 키는 비밀값이다 — 저장소 · 프론트에 넣지 않는다.

## 2. `.env`

```
GEMINI_API_KEY=<키>
GEMINI_CHAT_MODEL=gemini-3-flash-preview
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
CHAT_DAILY_LIMIT=5
```

- `GEMINI_API_KEY` 는 **user-service · scheduler 만** 넣는다(게이트웨이 · admin-service 는 쓰지 않는다 — 쿠버네티스는 deskless 차트의 Secret).
- `GEMINI_CHAT_MODEL` — 요청 읽기에서 **Google 검색 그라운딩과 정해진 JSON 응답을 한 요청에 같이** 쓰므로 Gemini 3 계열이어야 한다. 더 새 Flash 모델이 나오면 [모델 목록](https://ai.google.dev/gemini-api/docs/models)에서 "structured outputs" · "search grounding" 을 지원하는지 보고 바꾼다.
- `GEMINI_EMBEDDING_MODEL` — 업체 · 질문을 768차원 벡터로 만든다(`outputDimensionality` 768 — DB 컬럼 `vector(768)` 과 같아야 한다). 모델을 바꾸면 scheduler 가 다음 회차(매시 30분)에 모든 업체 벡터를 다시 만든다.
- `CHAT_DAILY_LIMIT` — 이용자 하루 질문 수(한국 시각 자정에 다시 채움, 답을 다 받은 질문만 센다).

## 3. 요금 · 한도

- 질문 하나에 Gemini 를 최대 세 번 부른다 — 요청 읽기(웹 검색 그라운딩 — Gemini 3 는 모델이 실제로 한 검색만큼 요금이 붙는다) · 검색 문장 임베딩 · 답 스트리밍. 하루 질문 수(`CHAT_DAILY_LIMIT`)가 이 비용의 상한이다.
- 업체 벡터는 바뀐 업체만 다시 만든다(내용 해시) — 업체 수만큼 매시간 부르지 않는다.
- 한도(429) · 장애(5xx)는 이용자에게 503 `AI 답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.` 로 보이고, 그 질문은 횟수에서 빠지지 않는다.

## 4. 확인

1. user-service · scheduler 를 다시 띄운다(부팅 로그에 `GEMINI_API_KEY 가 비어 …` 경고가 없어야 한다).
2. DB 에 마이그레이션(`StoreEmbedding` — pgvector 확장 포함)이 적용돼 있어야 한다.
3. scheduler 가 매시 30분에 업체 벡터를 만든다 — 바로 보려면 30분 회차를 기다리거나 scheduler 를 그 시각 전후로 띄워 둔다. `t_store_embedding` 에 업체 수만큼 행이 생기면 된다.
4. 이용자로 로그인해 `POST /api/v1/user-service/chat/message` 에 `{"content": "온천 가고 싶은데 반려동물이랑 묵을 곳 있을까?"}` 를 보낸다 — `progress` → `stores` → `delta` … → `done` 이 흘러오면 된다(Swagger 는 스트림을 끝까지 보여 주지 못할 수 있다 — `curl -N` 으로 본다).

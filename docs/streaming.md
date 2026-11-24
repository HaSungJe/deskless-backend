# 내부 HTTP 스트리밍 — 세 번째 전달 경로

답을 조각으로 흘려야 하는 긴 요청(AI 대화형 업체 검색 — 사용자 결정 2026-11-24)을 위한 전달 경로다. 동기(내부 HTTP) · 큐(RabbitMQ + 요청 단위 SSE)와 나란히 두고, **"상태를 바꾸는 쓰기는 큐" 의 예외**로 쓴다 — 큐는 결과를 한 번에(done) 돌려주는 구조라 글자 조각을 흘릴 수 없고, 브라우저 WebSocket 은 접속 헤더에 토큰을 넣을 수 없어 소켓 인증 규칙(헤더 인증 · 쿼리 ❌ — [realtime.md](realtime.md))과 맞지 않는다.

## 언제 쓰나

- 응답이 오래 걸리고(10 ~ 30초) 그동안 이용자에게 진행 · 조각을 보여 줘야 할 때만. 지금은 `POST /api/v1/user-service/chat/message` 하나.
- 조회는 동기, 그 밖의 쓰기는 지금처럼 큐 — 스트리밍이 필요 없는 쓰기를 이 길로 옮기지 않는다(재시도 · 대기열이 없다).

## 흐름

```
클라이언트 ──POST (fetch, Authorization)──▶ gateway ChatStreamController
                                            │ InternalHttpClient.stream() — POST + 내부 토큰 · actor 헤더
                                            ▼
                                  user-service ChatStreamController
                                            │ writeSseStream(res, service.sendMessage(…, abortOnClose(res)), 'failed')
                                            ▼
                                  ChatService.sendMessage — async generator(이벤트를 yield)
◀── text/event-stream 그대로 흘림 ──────────┘
```

| 단계 | 하는 일 |
|---|---|
| 게이트웨이 | 가드 · ValidationPipe 를 지난 뒤 `InternalHttpClient.stream(service, path, res, {actor, body, client_ip})` 한 줄. 서비스가 **시작 전에 실패**하면(4xx · 5xx JSON) 같은 상태 코드 · 본문으로 던져 게이트웨이 필터가 그대로 답하고, 시작하면 SSE 헤더(`content-type: text/event-stream` · `cache-control: no-cache` · `x-accel-buffering: no`)를 쓴 뒤 본문을 그대로 넘긴다(`pipeline(Readable.fromWeb(body), res)`). 대기 시간은 두지 않는다. 클라이언트가 끊으면 서비스 요청도 끊는다(AbortController) |
| 서비스 controller | `controllers/<domain>.controller.stream.ts`(`<Domain>StreamController`) — `@Res()` 를 받아 `writeSseStream(res, events, failed_event)` 한 줄. 끊기 신호는 `abortOnClose(res)`(응답이 끝나기 전에 닫히면 abort)로 만들어 service 에 값으로 넘긴다 |
| service | 이벤트 async generator(`AsyncGenerator<SseEvent>`) — 전송 객체를 받지 않는다. **첫 이벤트 전에 던진 예외는 일반 HTTP 응답**(헤더를 아직 쓰지 않았다), 그 뒤 예외는 `failed` 이벤트. 정리할 것(잠금 등)은 `try … finally` — 끊겨 generator 가 닫혀도 `finally` 가 돈다 |
| 공통 util | `libs/common/src/utils/sse.ts` — `formatSseEvent`(큐 경로 SSE 와 같은 `event: x\ndata: {...}\n\n`) · `writeSseStream` · `abortOnClose` · `SSE_HEADERS` |

## 규칙

- **이벤트 이름 · data 는 contracts** — `libs/contracts/src/<domain>/<domain>.commands.ts` 의 `<DOMAIN>_STREAM_EVENT`(chat: `progress` · `stores` · `delta` · `done` · `failed`), data 는 DTO(snake_case). 실패 이벤트 data 는 큐 경로 SSE `failed` 와 같은 `{status_code, …실패 본문}`(`toFailResult`).
- **저장은 마지막에** — 스트림이 끝까지 간 뒤에만 상태를 바꾼다(chat: 이력 저장 + 하루 질문 수). 중간 실패 · 끊김은 저장하지 않는다 — 재시도가 없으므로 "반쯤 저장" 이 남지 않게.
- **동시 요청은 잠금으로** — 큐의 경쟁 소비 · 재시도가 없어 같은 이용자의 겹친 요청은 service 가 막는다(chat: Redis `SET NX` 잠금 · 만료 3분(AI 제한 시간 합보다 길게) · 값이 같을 때만 풀기).
- **여러 대 전제 그대로** — 요청 하나가 연결 하나라 sticky session 이 필요 없다. 인스턴스 메모리에 상태를 두지 않는다.
- **API 로그 · HTTP 지표** — 게이트웨이 미들웨어가 그대로 건다(API 로그는 SSE 본문을 이미 다룬다 — api-log.util.ts).
- **Swagger** — 게이트웨이 핸들러에 `@ApiProduces('text/event-stream')` · `@ApiOkResponse({type: done 의 data DTO})` · 시작 전 실패 응답들. `@HttpCode` 없음(큐 핸들러와 같다).
- **테스트** — service 기능 spec 이 스트림 controller 까지 부팅해 supertest 본문을 이벤트로 나눠 단언한다([testing.md](testing.md) "스타일 ②-b").

## 배포 (deskless 가 맞춘다)

- 앞단(Ingress) — 스트림 경로도 버퍼링 끔(`x-accel-buffering: no` 를 보낸다) · 읽기 대기 120초(웹 검색 단계는 조각 없이 30초까지 걸릴 수 있다). 서비스(user-service)는 클러스터 안이라 게이트웨이 → 서비스 사이에 프록시가 없다.

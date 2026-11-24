# 외부 연동 (`libs/integration`)

> 사용처: user-service 의 휴대폰 SMS 인증 · 아이디 찾기 · 문 소켓 QR 확인 · 내 예약 QR · 결제 확인 QR · 취소 때 QR 지우기(문 정보 — Redis) · 입점 신청 업체 정보 파일(업로드 주소 · 존재 확인 · 삭제 · 열람 주소) · 업체 둘러보기 사진(공개 주소 — `StorageModule`), admin-service 의 매니저 아이디 찾기 · 비밀번호 초기화 · 입점 승인 · 업체 취소 · 호실 이동 · 이용 중 취소 요청(승인 링크) SMS · 업체 정보 파일 · 객실 그룹 사진 · 호실 문 상태 · 바로 열기(문 정보 — Redis), gateway 의 문 소켓 명령 구독, scheduler 의 이용 시작 · QR 동기화(문 정보 — Redis) · QR 확인 링크 SMS(루트 모듈이 `SmsModule` · `DoorStoreModule` 중 쓰는 것을 import 한다). 결제(`PaymentModule`)는 user-service 예약(결제 환경 — 예약 · 연장 신청, 결제 확인 `getPayment` — 기본 · 연장 구간)과 scheduler(결제 대기 만료(기본 · 연장 구간) · 늦은 승인 재확인 `findByPaymentId` · 환불 `cancel`)가 쓴다. AWS 세팅은 [guides/aws-setup.md](guides/aws-setup.md), Redis 는 [guides/redis-setup.md](guides/redis-setup.md), 토스는 [guides/toss-setup.md](guides/toss-setup.md).

## 원칙

- **mock · 가짜 어댑터를 두지 않는다** — 외부 연동은 처음부터 실제 서비스에 붙는 코드다. 서비스를 만드는 방법은 `docs/guides/` 에 가이드로 남긴다. 세팅 전에는 `.env` 값이 비어 있어 요청만 실패한다(부팅은 된다).
- **예외 — AWS 미설정 개발 모드(사용자 결정 2026-11-15)**: AWS 값이 비면 AWS 없이 돈다([guides/aws-setup.md](guides/aws-setup.md) "AWS 없이 돌리기").
  - **SMS 생략** — `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` 가 비면 `SnsSmsSender` 가 SNS 를 부르지 않고 받는 번호 · 본문을 경고 로그로 남긴 뒤 성공으로 끝난다(인증번호는 DB `t_sms_verification.code` 에도 남는다 — 임시 비밀번호는 로그에서 본다). 서비스는 그대로 마지막 단계에서 `send` 를 부른다.
  - **내부 파일 저장소** — `AWS_S3_BUCKET` 이 비면 저장소 포트(`RoutingStorageGateway`)가 새 업로드를 `LocalStorageGateway` 로 보낸다(`isS3StorageConfigured`). 실제로 저장 · 제공하는 두 번째 어댑터다(가짜 아님). 업로드 · 열람 주소는 게이트웨이 `/files/upload` · `/files/download`(HMAC-SHA256 `INTERNAL_API_TOKEN` 서명 — 업로드는 Content-Type 포함 · 10분 · 10MB), 공개 파일 `/files/<키>`(`private/` 는 공개 경로로 안 나간다). 받기 · 내주기는 게이트웨이 인프라 `modules/local-file`, 확인 · 삭제는 어댑터 — 같은 폴더(`FILE_STORAGE_DIR`, 기본 `storage/files` · 쿠버네티스는 deskless 차트의 공용 파일 볼륨). 키 · DB 행 모양은 S3 와 같다.
  - S3 일 때 "파일 본문은 게이트웨이 · 브로커를 거치지 않는다" 는 그대로이고, 내부 저장소일 때는 게이트웨이가 저장소다(브로커 · 서비스는 거치지 않는다).
- **파일 행마다 저장소를 적는다(`file_storage` — `S3` · `LOCAL`, 사용자 결정 2026-11-18)** — S3 로 바꾼 뒤에도 그 전에 내부 저장소에 올린 파일을 계속 열기 위해서다. 저장소 포트 `STORAGE_GATEWAY` = `RoutingStorageGateway` 가 두 어댑터(`S3StorageGateway` · `LocalStorageGateway` — 어댑터 인터페이스 `StorageBackendInterface`)를 둘 다 들고 나눠 보낸다.
  - 업로드 주소 · 업로드 확인(`createUploadUrl` · `exists`) — 지금 업로드 저장소(버킷이 있으면 S3, 비면 내부). service 는 등록 때 `getUploadStorage()` 값을 행의 `file_storage` 에 적는다(`t_store_file` · `t_room_group_image`).
  - 공개 주소 · 열람 주소 · 삭제(`getPublicUrl` · `createDownloadUrl` · `remove`) — 파일 행(`StoredFile` = `{file_key, file_storage}`)을 받아 그 행의 저장소로(S3 가 아니면 내부 — 구분이 없는 행 포함). 조회 행(대표 사진 서브쿼리 · 업체 정보 파일 raw select)도 `file_storage` 를 같이 읽는다(`cover_file_storage`).
  - 게이트웨이 `/files` 는 늘 붙는다 — 읽기(공개 파일 · 서명 열람)는 S3 모드에서도 열고, 받기(`PUT /files/upload`)만 버킷이 빌 때 연다(S3 모드면 다음 처리 → 404).
  - 옛 파일을 S3 로 옮기는 방법(볼륨 → 버킷 + `UPDATE … file_storage = 'S3'`)은 [guides/aws-setup.md](guides/aws-setup.md) "AWS 없이 돌리기".
- **샘플 키(`sample/` — 테스트 데이터 시드 사진)** 는 저장소 파일이 아니다(시드 행의 `file_storage` 는 `LOCAL`) — 라우터(`RoutingStorageGateway`)가 어댑터보다 먼저 가른다: `getPublicUrl` 은 `GATEWAY_PUBLIC_URL` 뒤에 키(게이트웨이 `/sample/` 정적 경로, 비면 500 `STORAGE_PUBLIC_URL_MISSING_MESSAGE`), `remove` 는 건너뛴다(행 소프트 삭제만). 업로드 키 검사가 `store/<업체>/…` 접두만 받아 API 로는 샘플 키를 등록할 수 없다. [guides/sample-data.md](guides/sample-data.md)
- **발송은 SMS 하나** — `SMS_SENDER`(Amazon SNS). 이메일 · 알림톡 · 푸시는 쓰지 않는다. 아래 발송이 모두 이 포트로 나간다.
  - 휴대폰 인증
  - 아이디 찾기 · 비밀번호 초기화
  - 업체 계정 안내
  - 예약 변경 안내(업체 취소 · 호실 이동)
  - QR 확인 링크(scheduler — 이용 시작 5분 전, `USER_WEB_URL/reservation/<예약 ID>`, 예약당 1번)
  - 이용 중 취소 요청 승인 링크(admin-service — `USER_WEB_URL/reservation/<예약 ID>/cancel-request`)
- **파일은 `STORAGE_GATEWAY`(Amazon S3 — 버킷이 비면 내부 파일 저장소), 업로드는 서명된 주소(S3 presigned URL)** — S3 면 파일 본문은 게이트웨이 · 브로커를 거치지 않는다. 흐름은 네 단계다(내부 저장소도 같다).
  1. 업로드 주소 요청(동기)
  2. 클라이언트가 `upload_url` 로 PUT — 요청 때 보낸 `content_type` 과 같은 `Content-Type` 헤더로(서명에 들어간다)
  3. 등록 명령에 키만 보낸다 → service 가 `exists(key)` 확인 후 저장(`file_storage` = `getUploadStorage()`)
  4. 열람 주소는 파일 용도 룩업의 `is_private` 로 고른다 — 0 이면 `getPublicUrl(행)`(공개 주소 — S3 행은 CDN, LOCAL 행은 게이트웨이 `/files/<키>`), 1 이면 `createDownloadUrl(행)`(서명된 열람 주소, `STORAGE_DOWNLOAD_URL_TTL_SECONDS` 600초)
- **결제는 `PAYMENT_GATEWAY`(토스페이먼츠)** — 결제창 · 승인은 프론트(Next.js), 서버는 토스에서 다시 읽어 `verifyPaymentLookup`(결제됨 · 미결제 · 금액 불일치 · 다른 주문)으로 대조하고, 환불은 금액을 지정한 취소(`cancel({…, amount})` — 전액 또는 일부, `Idempotency-Key: cancel-<payment_id>`)로 한다. 서버 요청 안에서는 환불 신청만 기록하고 토스 취소는 scheduler crontab 이 한다. 프론트가 넘긴 값만 믿지 않는다.
- service 는 포트(Symbol 토큰 + 인터페이스)만 안다. AWS SDK · 자격증명은 어댑터 안에만 둔다.

## 구성

| 파일 | 내용 |
|---|---|
| `integration.symbols.ts` | `SMS_SENDER` · `STORAGE_GATEWAY` · `DOOR_STORE` · `PAYMENT_GATEWAY` · `AI_GATEWAY` · `CONVERSATION_STORE` |
| `interfaces/integration.interface.ts` | `SmsSenderInterface` · `SmsMessage` · `StorageGatewayInterface` · `StorageBackendInterface` · `FileStorage` · `StoredFile` · `StorageUploadInput` · `StorageUploadResult` · `StorageDownloadResult` · `DoorStoreInterface` · `DoorRecord` · `DoorState` · `DoorCommand`(`DoorOpenCommand` · `DoorDisconnectCommand`) · `PaymentGatewayInterface` · `PaymentEnvironment` · `PaymentLookupResult` · `PaymentCancelInput` · `PaymentCancelResult` · `AiGatewayInterface` · `AiHistoryItem` · `AiTextInput` · `AiJsonInput` · `AiEmbedInput` · `ConversationStoreInterface` · `ConversationTurn` · `ConversationUsage` |
| `integration.constants.ts` | `SMS_UNAVAILABLE_MESSAGE` · `STORAGE_UNAVAILABLE_MESSAGE` · `STORAGE_PUBLIC_URL_MISSING_MESSAGE` · `STORAGE_UPLOAD_URL_TTL_SECONDS` · `STORAGE_DOWNLOAD_URL_TTL_SECONDS` · `FILE_STORAGE` · `REDIS_UNAVAILABLE_MESSAGE` · `DOOR_STATE` · `DOOR_TIME_NONE` · `DOOR_COMMAND_CHANNEL` · `DOOR_COMMAND` · `PAYMENT_UNAVAILABLE_MESSAGE` · `PAYMENT_FAILED_MESSAGE` · `TOSS_API_BASE_URL` · `PAYMENT_REQUEST_TIMEOUT_MS` · `TOSS_PAYMENT_STATUS_DONE` · `AI_UNAVAILABLE_MESSAGE` · `AI_REQUEST_TIMEOUT_MS` · `AI_EMBEDDING_DIMENSIONS` · `AI_CHAT_MODEL_DEFAULT` · `AI_EMBEDDING_MODEL_DEFAULT` · `AI_EMBED_TASK` |
| `integration.util.ts` | `toDoorTime` — 시각 → 문 시각(한국 시각 yyyyMMddHHmmss) · `toE164KrPhone` — 국내 번호 → `+82…` · `classifyTossFailure` — 토스 실패 → 업무 · 일시 · 결제 없음 · `verifyPaymentLookup` — 토스 조회 결과 ↔ 우리 결제 행 대조 · `isSampleFileKey` · `isS3StorageConfigured` · `isAwsKeyConfigured` · `gatewayPublicUrl` |
| `sms/sns-sms.sender.ts` · `sms/sms.module.ts` | `SnsSmsSender`(SNS `Publish`, Transactional — AWS 키가 비면 생략 · 로그) · `SmsModule`(`@Global`) |
| `storage/routing-storage.gateway.ts` · `storage/s3-storage.gateway.ts` · `storage/local-storage.gateway.ts` · `storage/local-storage.util.ts` · `storage/storage.module.ts` | `RoutingStorageGateway`(저장소 포트 — 업로드는 지금 저장소, 읽기 · 삭제는 행의 `file_storage`, 샘플 키) · `S3StorageGateway`(presigned PutObject — Content-Type 서명 · presigned GetObject · HeadObject · DeleteObject) · `LocalStorageGateway`(내부 파일 저장소 — 게이트웨이 `/files` 서명 주소 · 폴더 확인 · 삭제) · `signLocalFileRequest` · `isValidLocalFileSignature` · `resolveLocalFilePath` · `localFileStorageDir` · `StorageModule`(`@Global`, `STORAGE_GATEWAY` = `RoutingStorageGateway`) |
| `redis/redis.connection.ts` · `redis/redis.module.ts` | `RedisConnection`(node-redis — 부팅을 막지 않는 연결 · 끊긴 동안 명령을 쌓지 않음 · 준비 전 503 · `subscribe(channel, listener)` — 채널마다 구독 전용 연결) · `RedisModule`(`@Global`) |
| `door/redis-door.store.ts` · `door/door-store.module.ts` | `RedisDoorStore`(`getMany` · `setQr` · `revokeQr` · `verify` · `open` · `close` · `disconnect` · `subscribe` — Lua 스크립트 3개: QR 확인 + 열림 · 바로 열기 + PUBLISH · QR 지우기) · `DoorStoreModule`(`@Global`, RedisModule 포함) |
| `payment/toss-payment.gateway.ts` · `payment/payment.module.ts` | `TossPaymentGateway`(fetch — Basic 인증 · 30초 제한 · 조회 · 전액 취소) · `PaymentModule`(`@Global`, 앱 등록은 Phase 17) |
| `ai/gemini-ai.gateway.ts` · `ai/ai.module.ts` | `GeminiAiGateway`(공식 SDK `@google/genai` — `generateJson`(정해진 JSON 응답 + Google 검색 그라운딩) · `streamText`(글 조각) · `embed`(768차원) — 키가 비면 503 · 부팅 때 경고, 끊기 신호는 그대로 · 그 밖 실패는 503) · `AiModule`(`@Global` — user-service · scheduler) |
| `conversation/redis-conversation.store.ts` · `conversation/conversation-store.module.ts` | `RedisConversationStore`(AI 대화 이력 · 하루 질문 수 한 줄 · 답하는 중 잠금 — Lua: 저장 + 질문 수 · 초기화 · 잠금 · 지난 대화 지우기) · `ConversationStoreModule`(`@Global`, RedisModule 포함 — user-service · scheduler) |

설정은 `.env` 의 `AWS_REGION` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `AWS_S3_BUCKET` · `AWS_S3_PUBLIC_URL`(AWS — S3 자격증명은 SDK 기본 체인이 읽는다, SMS 는 키가 비면 생략), `GATEWAY_PUBLIC_URL` · `FILE_STORAGE_DIR`(내부 파일 저장소 · 샘플 사진 주소), `REDIS_URL`(Redis), `TOSS_SECRET_KEY`(토스 — 비어 있으면 부팅 경고 · 결제 요청만 503) 이다.

## S3 클라이언트 설정

- `new S3Client({region, requestChecksumCalculation: 'WHEN_REQUIRED'})` — SDK 기본값(`WHEN_SUPPORTED`)이면 presigned PutObject 주소에 빈 본문의 CRC32(`x-amz-checksum-crc32`)가 박힌다. 그러면 실제 파일을 올릴 때 체크섬이 맞지 않아 S3 가 거부한다.
- `getSignedUrl(..., {expiresIn, signableHeaders: new Set(['content-type'])})` — 기본값이면 서명 헤더가 `host` 뿐이라 아무 타입이나 올릴 수 있다. Content-Type 을 서명에 넣어 요청한 타입으로만 올리게 한다.
- 공개 주소는 `AWS_S3_PUBLIC_URL` 로만 만든다. 비어 있으면 주소를 지어내지 않고 실패한다. 기본 구성은 CloudFront 배포 주소다([guides/aws-setup.md](guides/aws-setup.md)).

## 저장 키 · CDN

- **키는 서버가 만든다**(업로드 주소 요청 때) — `<접두>/<리소스 ID>/<uuid 32자>.<jpg|png>`. 업로드마다 새 키이고 같은 키를 덮어쓰지 않는다. 그래서 CDN · 브라우저 캐시를 길게 두고 무효화하지 않는다.
- **접두가 공개 여부를 가른다** — 공개 `store/…`(CloudFront 가 OAC 로 읽는다), 비공개 `private/…`(버킷 정책이 CloudFront 에 열지 않는다 → 서명된 열람 주소로만). 접두는 파일 용도 룩업의 `is_private` 로 정한다(store.util.ts `buildApplicationFileKey`).
- **등록 명령은 키 모양을 다시 확인한다** — 그 리소스 · 공개 여부 · 형식으로 발급한 키인지(`isApplicationFileKey`) 본 뒤 `exists(key)`. 남의 리소스 키나 다른 접두를 막는다.
- 파일 삭제는 행을 지운 뒤 저장소 파일을 지운다(마지막 단계 — 503 이면 재시도). S3 삭제는 없는 키에도 성공하므로 재시도해도 안전하다.

## AI (`AI_GATEWAY` · Google Gemini)

- **지시문 · 응답 형식은 쓰는 도메인이 들고** 어댑터는 호출 · 실패 분류만 한다(user-service chat 의 요청 읽기 · 답 쓰기, scheduler 의 업체 검색 벡터) — 다른 기능도 같은 포트를 쓸 수 있게.
- **세 가지 호출** — `generateJson`(정해진 JSON 응답 `responseJsonSchema` · 필요하면 Google 검색 그라운딩 `googleSearch` — 둘을 한 요청에 같이 쓰는 것은 Gemini 3 계열만이라 `GEMINI_CHAT_MODEL` 기본값이 `gemini-3-flash-preview`) · `streamText`(`generateContentStream` 조각) · `embed`(`embedContent` — `outputDimensionality` 768, 업체는 `RETRIEVAL_DOCUMENT` · 질문은 `RETRIEVAL_QUERY`).
- **실패** — 키(`GEMINI_API_KEY`)가 비면 503(부팅은 된다 — 부팅 때 한 번 경고), 이용자가 연결을 끊어 넘긴 끊기 신호가 울린 것은 그 오류 그대로(503 으로 바꾸지 않는다), 그 밖(한도 · 5xx · 네트워크 · 제한 시간 30초 · JSON 아님 · 벡터 수 · 차원이 다름)은 모두 503 `AI_UNAVAILABLE_MESSAGE` — 이용자가 고칠 것이 없어 400 을 두지 않는다. 글 스트리밍은 전체 60초(`AI_STREAM_TIMEOUT_MS` — 멈춘 스트림이 답하는 중 잠금 3분보다 오래 가지 않게, 넘기면 503). 글이 하나도 오지 않은 답은 쓰는 쪽(user-service chat)이 503 으로 끝낸다(빈 답을 이력에 남기면 다음 요청마다 거절된다).
- **웹 검색 끄기** — `GEMINI_SEARCH_ENABLED=0` 이면 도메인이 검색을 원해도(`use_search`) 도구 없이 부른다(파일 함수 `isSearchEnabled`, 부팅 때 한 번 알림). 무료 등급 키는 그라운딩을 쓸 수 없어서다(가격표 무료 등급 "Not available") — 끄면 지역 · 위치를 모델 지식으로만 잡는다. 유료 등급은 `1`(비어도 켬).
- 웹 검색 그라운딩은 모델이 실제로 한 검색만큼 요금이 붙는다(Gemini 3) — 하루 질문 수(`CHAT_DAILY_LIMIT`)로 부르는 횟수를 묶는다. 세팅: [guides/gemini-setup.md](guides/gemini-setup.md)

## AI 대화 (`CONVERSATION_STORE` · Redis)

- **저장 모양** — `chat-turns:<user_id>`(ZSET — 점수 = 물은 시각 ms, 값 = 질문 + 답 한 건 JSON `{turn_id, user_id, question, answer, stores, asked_at, answered_at}`, 7일 동안 질문이 없으면 키 만료) · `chat-users`(ZSET — 이력이 있는 이용자, 지난 대화 지우기가 훑는다) · `chat-usage:<user_id>`(STRING — 하루 질문 수 한 줄 `yyyy-MM-dd:횟수`) · `chat-busy:<user_id>`(STRING — 답하는 중 잠금, 값 = 요청 ID · 3분 만료). 대화창 · 벌점 · 정지 키는 없다(사용자 결정 2026-11-25).
- **하루 질문 수 한 줄** — 저장할 때(`appendTurn` 의 Lua): 줄이 없으면 `오늘:1` 등록 · 다른 날짜면 `오늘:1` 로 바꿈 · 같은 날짜면 +1. 읽을 때는 줄을 바꾸지 않고 쓰는 쪽(user-service `toChatQuota`)이 날짜가 오늘이 아니면 0회로 본다 — 날짜를 바꾸는 별도 작업이 없다. 대화 초기화(`clearTurns`)는 이력만 지우고 이 줄은 남긴다(초기화로 하루 한도를 넘기지 않게).
- **원자적 동작** — 이력 저장 + 질문 수 · 초기화(이력 키 · 목록) · 잠금 잡기(`SET NX PX`) · 잠금 풀기(값이 같을 때만) · 이용자 한 명의 지난 대화 지우기는 Lua 하나씩. 지난 대화 지우기(`purgeTurns`)는 이용자 목록을 500명씩 훑어 이용자 하나씩 Lua 를 돌린다(Redis 를 오래 막지 않게).
- 대화는 DB 가 아니라 실제로 지운다(소프트 삭제 규칙은 DB 에만). Redis 가 없으면 503(부팅은 된다). 문 정보와 같은 단일 노드 Redis 를 쓴다.

## 문 정보 (`DOOR_STORE` · Redis)

- **저장 모양** — `door-qr:<room_id>` = 그 호실의 현재 QR(만료 PXAT = QR 유효 끝 → 이용 끝에 저절로 사라진다), `door-opened:<room_id>` = 문을 마지막으로 연 시각(한국 시각 yyyyMMddHHmmss — `toDoorTime`, 만료 없음, 연 적 없으면 키가 없고 `getOpenedAt` 이 null). **열림 · 닫힘 상태는 두지 않는다**(사용자 결정 2026-11-19 — 서버가 아는 열림은 "열어도 됨" 을 답한 때뿐이고 닫힘은 문 프로그램이 알려 줄 때뿐이라 실제 문을 비추지 못한다, 닫기 · 잠금 알림 없음). 연 시각도 실제로 문이 열린 때가 아니라 서버가 열기를 허락 · 명령한 때다. 옛 `door:<room_id>` 키는 코드가 읽지 않는다.
- **QR 이력 · 유효 시간의 원본은 DB `t_room_qr`** — 예약당 1행(시작 · 끝), 이용 시작 때 발급하고 이용 중 예약이 취소되면(사용중지 호실 이용자 취소 · 이용 중 취소 승인) 끝을 지금으로 당긴다. 문을 연 기록은 `t_door_open_log`(문 소켓 QR 확인이 맞을 때 `QR` — 이력에 없는 QR 이면 Redis 를 보지 않는다, 업체 관리자 바로 열기 때 `MANAGER` + 연 사람 — 기록 insert 뒤 Redis 가 마지막 단계). Redis 는 문이 비교할 현재 값만 든다 — 발급 · 조회 때마다 `setQr` 로 다시 쓰고(scheduler `reservation-qr-sync` 가 매분 맞춘다), 취소는 `revokeQr`(값이 같을 때만 지운다).
- **원자적 3동작** — QR 확인(`verify` — 현재 QR 이 같을 때만 연 시각을 쓴다, 아니면 아무것도 바꾸지 않는다) · 바로 열기(`open` — 연 시각을 쓰고 같은 스크립트에서 `door-commands` 채널에 `{store_id, room_id, command: 'open'}` PUBLISH) · QR 지우기(`revokeQr` — 값이 같을 때만)는 Lua 스크립트 1개씩이다. 여러 문의 연 시각은 MGET 1번(`getOpenedAt`), 연결 끊기(`disconnect`)는 PUBLISH, QR 쓰기(`setQr`)는 SET PXAT.
- **서버 명령은 Redis 채널** — gateway 인스턴스마다 `subscribe` 로 `door-commands` 를 구독해 그 업체의 자기 소켓 연결에 적용한다([realtime.md](realtime.md)) — 바로 열기 `{store_id, room_id, command: 'open'}` → `door.open`, 연결 끊기 `{store_id, command: 'disconnect'}`(`disconnect` — 업체 문 시크릿 변경 뒤 store service 가 마지막 단계에서 보낸다) → 그 업체 연결을 모두 1008 로 끊는다. 구독은 구독 전용 연결이라 명령 연결과 섞이지 않는다.
- **단일 노드 전제** — QR 확인 스크립트가 두 키(`door-qr:` · `door-opened:`)를 함께 쓰므로 클러스터 모드가 아닌 Redis(ElastiCache 는 클러스터 모드 끔)여야 한다.
- **영속은 켠다** — 현재 QR 은 DB(`t_room_qr`)에서 다시 만들 수 있지만(scheduler 가 매분 다시 쓴다) 그 사이 이용 중인 문이 안 열리지 않게, 그리고 마지막으로 연 시각은 Redis 에만 있으므로 AOF 영속(deskless 인프라 묶음)을 켜고, 관리형(ElastiCache 등)은 백업을 켠다([guides/redis-setup.md](guides/redis-setup.md)).
- 서버는 문을 직접 움직이지 않는다 — 문 쪽 타 업체 프로그램이 읽은 QR 을 문 소켓으로 묻고, `door.verified ok` 면 문을 연다. HTTP 문 열기 · 닫기 API 는 없다.

## 쓰는 법

```ts
// 앱 루트 모듈 — 쓰는 포트의 모듈만 1회
@Module({imports: [DatabaseModule, SmsModule, /* ... */]})

// service — 포트만 안다
constructor(@Inject(SMS_SENDER) private readonly smsSender: SmsSenderInterface) {}
await this.smsSender.send({to: phone, text: `[바로방] 인증번호 ${code}`});
```

## 실패 계약

- AWS 가 접수하지 못하거나 닿지 못하면, 어댑터가 오류를 로그로 남기고 `ServiceUnavailableException({message: SMS_UNAVAILABLE_MESSAGE | STORAGE_UNAVAILABLE_MESSAGE})`(503)를 던진다. 형제는 `RabbitMqConnection.publish` 의 503 이다.
- Redis 가 준비되지 않았거나 명령이 실패하면 `ServiceUnavailableException({message: REDIS_UNAVAILABLE_MESSAGE})`(503, "상태 저장소에 연결할 수 없습니다") — `RedisConnection.ready()` · `RedisDoorStore` 가 던진다. 구독(`subscribe`)은 실패해도 던지지 않고 로그만 남긴다(부팅을 막지 않는다).
- 결제는 둘로 나눈다 — 토스 업무 실패(4xx)는 `BadRequestException({message: 토스 메시지, payment_error_code: 토스 code})`(400 — 큐 재시도 없음), 일시 실패(5xx · `PROVIDER_ERROR` · 409 · 401 · 네트워크 · 30초 초과 · 키 없음)는 `ServiceUnavailableException({message: PAYMENT_UNAVAILABLE_MESSAGE})`(503 — 재시도, 환불은 멱등키로 중복 없음). 조회의 결제 없음(404 `NOT_FOUND_PAYMENT`)은 null, 취소의 결제 없음은 400.
- `exists` 만 예외다. 404 면 false 를 돌려준다.
- `getPublicUrl` 은 `AWS_S3_PUBLIC_URL` 이 비어 있으면 `InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE})`(500, "설정된 파일 공개 주소가 없습니다") 를 던진다.
- service 는 잡지 않는다. 큐 경로에서는 5xx 라 재시도(최대 3회) 후 failed + DLQ 로 간다.
- 재시도되면 앞서 성공한 발송이 다시 나갈 수 있다. 그래서 발송은 그 명령의 마지막 단계(쓰기 뒤)에 둔다.

## SMS 길이 · 표시

- 한국행은 국제 경로다. 수신 화면에 국제발신으로 보이고, 발신번호를 지정할 수 없다.
- 한글은 70자 단위로 나뉘어 건마다 과금된다. 인증번호 · 안내 문구는 70자 안에 맞춘다. 주소가 들어가는 SMS(입장 QR 링크)는 짧은 주소로 쓴다.

## 새 연동 추가

1. `docs/guides/<서비스>-setup.md` 에 계정 · 리소스 · 권한 · `.env` 키를 적는다.
2. `<기능>/<서비스>-<기능>.<role>.ts` 로 포트 인터페이스를 구현한다. 외부 실패는 503 으로 바꿔 던진다.
3. `.env.example` 의 그 기능 절에 키를 추가하고(한 줄 주석) [architecture.md](architecture.md) "설정" 표에 뜻을 한 줄 더한다. 배포에서 그 키를 넣는 일(그 연동을 쓰는 앱에만 비밀값을 준다)은 deskless 차트에 더한다(deskless 저장소 작업).

## 테스트

- **포트를 쓰는 service spec** — repository 처럼 Symbol 토큰으로 mock 을 주입한다: `{provide: SMS_SENDER, useValue: {send: vi.fn()}}`.
  - 호출 인자(번호 · 본문)를 단언한다.
  - 앞 단계 실패 후 미호출(`.not.toHaveBeenCalled()`)을 단언한다.
- **어댑터 spec 은 두지 않는다** — spec 은 service 기능 · repository 만([testing.md](testing.md)). 실제 AWS 호출은 테스트에서 하지 않는다.

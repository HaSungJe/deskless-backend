/** SMS 1통 */
export interface SmsMessage {
    /** 받는 번호 — 국내 휴대폰 번호 (예: 01012345678, 010-1234-5678) */
    to: string;
    /** 본문 — 한글은 70자 단위로 나뉘어 건마다 과금된다 */
    text: string;
}

/**
 * SMS 발송 포트 — 서비스의 모든 발송이 이 포트 하나로 나간다(이메일 · 알림톡 · 푸시 없음).
 * 휴대폰 인증 · 아이디 찾기 · 비밀번호 초기화 · 업체 계정 안내 · 예약 변경 안내 · 입장 QR 링크.
 * AWS 키가 비어 있으면 어댑터가 보내지 않고 로그만 남긴다(성공 — AWS 미설정 개발 모드).
 */
export interface SmsSenderInterface {
    /**
     * SMS 1통을 보낸다. AWS 가 접수하면 끝난다(휴대폰 도착은 기다리지 않는다).
     *
     * @throws ServiceUnavailableException `{message: SMS_UNAVAILABLE_MESSAGE}` — AWS 가 접수하지 못했을 때
     */
    send(message: SmsMessage): Promise<void>;
}

/** 업로드 주소 요청 */
export interface StorageUploadInput {
    /** 저장 키 — 예: `store/<store_id>/<uuid>.jpg` (키 규칙은 쓰는 도메인의 util 이 만든다) */
    key: string;
    /** 올릴 파일의 MIME 타입 (예: image/jpeg) — 서명 헤더에 들어가 다른 타입으로는 올릴 수 없다 */
    content_type: string;
}

/** 업로드 주소 */
export interface StorageUploadResult {
    /** 클라이언트가 파일을 PUT 으로 올릴 주소 (STORAGE_UPLOAD_URL_TTL_SECONDS 동안 유효, 같은 Content-Type 헤더로 올린다) */
    upload_url: string;
    /** upload_url 이 만료되는 시각 */
    expires_at: Date;
}

/** 열람 주소 */
export interface StorageDownloadResult {
    /** 비공개 파일을 GET 으로 볼 주소 (STORAGE_DOWNLOAD_URL_TTL_SECONDS 동안 유효) */
    download_url: string;
    /** download_url 이 만료되는 시각 */
    expires_at: Date;
}

/** 파일 저장소 구분 — 파일 행(t_store_file · t_room_group_image)의 file_storage (integration.constants.ts FILE_STORAGE 값) */
export type FileStorage = 'S3' | 'LOCAL';

/** 저장소에 있는 파일 하나 — 파일 행의 저장 키 + 저장소 구분(엔티티 · 조회 행을 그대로 넘긴다, 구분이 없으면 LOCAL 로 본다) */
export interface StoredFile {
    file_key: string;
    file_storage: string | null;
}

/**
 * 파일 저장소 포트 — 공개 파일(업체 · 객실 그룹 사진 — 공개 주소)과 비공개 파일(사업자등록증 — private/, 서명된 열람 주소).
 * 새 파일은 지금 업로드 저장소(AWS_S3_BUCKET 이 있으면 S3, 비면 내부 파일 저장소 — 게이트웨이 /files)로 올리고, 그 값(getUploadStorage)을 파일 행 file_storage 에 적는다.
 * 읽기 · 삭제는 행의 file_storage 를 따른다 — S3 로 바꾼 뒤에도 그 전에 올린 LOCAL 행은 내부에서 연다(사용자 결정 2026-11-18).
 * 어느 쪽이든 클라이언트가 createUploadUrl 의 주소로 직접 올리고, 등록 명령에는 키만 보낸다(파일 본문은 서비스 · 브로커를 거치지 않는다).
 */
export interface StorageGatewayInterface {
    /**
     * 새 파일을 올리는 저장소 — 파일 행을 등록할 때 file_storage 에 넣는다.
     */
    getUploadStorage(): FileStorage;

    /**
     * 지금 업로드 저장소에 키 하나에 쓸 1회용 업로드 주소를 발급한다.
     *
     * @throws ServiceUnavailableException `{message: STORAGE_UNAVAILABLE_MESSAGE}` — 저장소에 닿지 못했을 때
     */
    createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult>;

    /**
     * 클라이언트가 그 키로 지금 업로드 저장소에 실제로 올렸는지 확인한다 — 사진 등록 명령에서 저장 전에 부른다.
     *
     * @throws ServiceUnavailableException `{message: STORAGE_UNAVAILABLE_MESSAGE}` — 저장소에 닿지 못했을 때
     */
    exists(key: string): Promise<boolean>;

    /**
     * 화면에 보일 공개 주소 — 저장소에 묻지 않고 행의 키 · 저장소로 만든다(샘플 키는 게이트웨이 /sample/).
     *
     * @throws InternalServerErrorException `{message: STORAGE_PUBLIC_URL_MISSING_MESSAGE}` — 설정된 공개 주소가 없을 때
     */
    getPublicUrl(file: StoredFile): string;

    /**
     * 비공개 파일(private/ 접두 — 공개 읽기 밖)을 잠깐 볼 수 있는 열람 주소를 발급한다(행의 저장소대로 — S3 presigned GET · 게이트웨이 서명 주소).
     *
     * @throws ServiceUnavailableException `{message: STORAGE_UNAVAILABLE_MESSAGE}` — 서명하지 못했을 때
     */
    createDownloadUrl(file: StoredFile): Promise<StorageDownloadResult>;

    /**
     * 파일을 행의 저장소에서 지운다. 없는 키여도 실패하지 않는다(샘플 키는 건너뛴다).
     *
     * @throws ServiceUnavailableException `{message: STORAGE_UNAVAILABLE_MESSAGE}` — 저장소에 닿지 못했을 때
     */
    remove(file: StoredFile): Promise<void>;
}

/**
 * 저장소 하나의 어댑터(S3StorageGateway · LocalStorageGateway) — 저장소 포트(RoutingStorageGateway)만 쓴다. 키를 받는다.
 * 실패 계약은 저장소 포트와 같다(주소 발급 · 확인 · 삭제 503, 공개 주소 기준 없음 500).
 */
export interface StorageBackendInterface {
    /** 키 하나의 1회용 업로드 주소 */
    createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult>;
    /** 그 키로 올라왔는지 */
    exists(key: string): Promise<boolean>;
    /** 공개 주소 */
    getPublicUrl(key: string): string;
    /** 비공개 파일 열람 주소 */
    createDownloadUrl(key: string): Promise<StorageDownloadResult>;
    /** 파일 삭제(없어도 성공) */
    remove(key: string): Promise<void>;
    /** 부팅 안내 — 업로드 저장소일 때만 라우터가 부른다 */
    onApplicationBootstrap(): void;
}

/** 바로 열기 명령 — gateway 가 그 업체 소켓에 door.open 을 보낸다 */
export interface DoorOpenCommand {
    /** 그 호실의 업체 ID — gateway 가 그 업체 소켓에만 보낸다 */
    store_id: string;
    /** 호실 ID */
    room_id: string;
    /** 명령 — DOOR_COMMAND.OPEN */
    command: 'open';
}

/** 연결 끊기 명령 — 업체 문 시크릿이 바뀌었다. gateway 가 그 업체 소켓을 모두 끊는다(새 시크릿으로 다시 붙는다) */
export interface DoorDisconnectCommand {
    /** 업체 ID */
    store_id: string;
    /** 명령 — DOOR_COMMAND.DISCONNECT */
    command: 'disconnect';
}

/** 문 명령 — Redis 채널 DOOR_COMMAND_CHANNEL 의 메시지(JSON). 밖(Redis · 소켓)으로 나가는 키라 snake_case */
export type DoorCommand = DoorOpenCommand | DoorDisconnectCommand;

/**
 * 문 정보 포트 — 호실마다 현재 유효 QR · 마지막으로 연 시각(Redis)과 문 명령 채널. 열림 · 닫힘 상태는 두지 않는다(사용자 결정 2026-11-19 — 닫기 없음). QR 이력은 DB(t_room_qr), QR 로 연 기록은 DB(t_door_open_log)에 있다.
 * 서버는 문을 직접 움직이지 않는다 — 문 쪽 타 업체 프로그램이 문 소켓(gateway)의 QR 확인 답 · 열기 명령을 보고 움직인다.
 */
export interface DoorStoreInterface {
    /**
     * 여러 문의 마지막으로 연 시각을 한 번에 읽는다(MGET) — 받은 순서대로, 연 적 없으면 null. 빈 배열이면 Redis 에 묻지 않는다.
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    getOpenedAt(room_ids: string[]): Promise<(string | null)[]>;

    /**
     * 그 호실의 현재 QR 을 쓴다 — expires_at 에 저절로 사라진다(PXAT). 같은 값이면 그대로(멱등).
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    setQr(room_id: string, qr: string, expires_at: Date): Promise<void>;

    /**
     * 그 호실의 현재 QR 이 qr 일 때만 지운다(다른 QR 을 지우지 않는다).
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    revokeQr(room_id: string, qr: string): Promise<void>;

    /**
     * QR 확인 — 그 호실의 현재 QR 이 qr 이면 마지막으로 연 시각을 opened_at 으로 쓰고 true, 다르거나 없으면 아무것도 바꾸지 않고 false(비교와 쓰기를 한 번에).
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    verify(room_id: string, qr: string, opened_at: string): Promise<boolean>;

    /**
     * 바로 열기 — 마지막으로 연 시각을 opened_at 으로 쓰고 같은 스크립트에서 그 업체 문 소켓에 열기 명령(DoorCommand)을 보낸다.
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    open(room_id: string, store_id: string, opened_at: string): Promise<void>;

    /**
     * 그 업체 문 소켓 연결을 모두 끊으라는 명령을 보낸다(업체 문 시크릿 변경 — 옛 시크릿으로 붙은 연결을 남기지 않는다).
     *
     * @throws ServiceUnavailableException `{message: REDIS_UNAVAILABLE_MESSAGE}` — Redis 에 닿지 못했을 때
     */
    disconnect(store_id: string): Promise<void>;

    /**
     * 문 명령을 구독한다 — 구독 전용 연결을 따로 열고 기다리지 않는다(부팅을 막지 않는다). 끊기면 다시 붙어 다시 구독한다.
     *
     * @param listener 명령마다 부를 함수(모양이 다른 메시지는 버린다)
     */
    subscribe(listener: (command: DoorCommand) => void): void;
}

/** 결제 환경 — TEST: 토스 테스트 키(test_), LIVE: 실결제 */
export type PaymentEnvironment = 'TEST' | 'LIVE';

/** 토스에서 다시 읽은 결제 1건 — 프론트가 넘긴 결과를 이것과 대조해 검증한다 */
export interface PaymentLookupResult {
    /** 토스 결제 키 */
    payment_key: string;
    /** 주문번호 — 우리 payment_id */
    order_id: string;
    /** 토스 결제 상태(READY · IN_PROGRESS · DONE · CANCELED · PARTIAL_CANCELED · ABORTED · EXPIRED …) */
    status: string;
    /** 결제 금액(원 — 취소해도 바뀌지 않는 원래 금액) */
    total_amount: number;
    /** 결제 수단(카드 · 간편결제 등) — 승인 전이면 null */
    method: string | null;
    /** 승인 시각 — 승인 전이면 null */
    approved_at: Date | null;
    /** 영수증 주소 — 없으면 null */
    receipt_url: string | null;
}

/** 환불(취소) 요청 — 금액만큼(전액 또는 일부) */
export interface PaymentCancelInput {
    /** 우리 결제 ID — 멱등키(cancel-<payment_id>)에 쓴다 */
    payment_id: string;
    /** 토스 결제 키 */
    payment_key: string;
    /** 취소 사유(토스 cancelReason, 200자) */
    reason: string;
    /** 취소 금액(원 — 토스 cancelAmount, 결제 금액 이하) */
    amount: number;
}

/** 환불 결과 */
export interface PaymentCancelResult {
    /** 취소된 금액(원) */
    canceled_amount: number;
    /** 취소 시각 */
    canceled_at: Date;
}

/**
 * 결제 포트(토스페이먼츠) — 결제창 · 승인은 프론트(Next.js)가 하고, 서버는 토스에서 다시 읽어 검증(getPayment · findByPaymentId)하고 환불(cancel)한다.
 * 업무 실패는 400 `{message: 토스 메시지, payment_error_code: 토스 code}`(재시도해도 소용없다), 일시 실패는 503 `{message: PAYMENT_UNAVAILABLE_MESSAGE}`(큐 재시도).
 */
export interface PaymentGatewayInterface {
    /**
     * 결제 환경 — 시크릿 키 접두사로 정한다(test_ → TEST, 그 밖 → LIVE). 결제 행을 만들 때 environment 에 넣는다.
     *
     * @throws ServiceUnavailableException `{message: PAYMENT_UNAVAILABLE_MESSAGE}` — 시크릿 키가 없을 때
     */
    environment(): PaymentEnvironment;

    /**
     * 결제 키로 토스에서 결제를 다시 읽는다(GET /v1/payments/{paymentKey}).
     *
     * @returns 결제 — 토스에 없으면 null
     * @throws BadRequestException 업무 실패 · ServiceUnavailableException 일시 실패
     */
    getPayment(payment_key: string): Promise<PaymentLookupResult | null>;

    /**
     * 주문번호(우리 payment_id)로 토스에서 결제를 읽는다(GET /v1/payments/orders/{orderId}) — 프론트가 결과를 못 넘긴 결제의 재확인용.
     *
     * @returns 결제 — 토스에 없으면 null
     * @throws BadRequestException 업무 실패 · ServiceUnavailableException 일시 실패
     */
    findByPaymentId(payment_id: string): Promise<PaymentLookupResult | null>;

    /**
     * 취소(환불) — 금액만큼(전액 또는 일부). Idempotency-Key cancel-<payment_id> 를 붙여 재시도가 중복 취소를 만들지 않는다(결제 1건에 환불 1번).
     *
     * @throws BadRequestException 업무 실패(이미 취소 · 취소 불가 금액 · 결제 없음 등) · ServiceUnavailableException 일시 실패
     */
    cancel(input: PaymentCancelInput): Promise<PaymentCancelResult>;
}

/** AI 대화 기록 한 줄 — user: 이용자, model: AI */
export interface AiHistoryItem {
    role: 'user' | 'model';
    text: string;
}

/** AI 글 입력 — 지시문 · 대화 기록 · 이번 말 · 웹 검색(Google 검색 그라운딩) 사용 · 끊기 신호 */
export interface AiTextInput {
    system: string;
    history: AiHistoryItem[];
    content: string;
    use_search: boolean;
    signal: AbortSignal;
}

/** AI 정해진 JSON 응답 입력 — 글 입력 + 응답 JSON Schema */
export interface AiJsonInput extends AiTextInput {
    schema: object;
}

/** 임베딩 입력 — 글 목록 · 용도(AI_EMBED_TASK) · 끊기 신호 */
export interface AiEmbedInput {
    texts: string[];
    task: 'DOCUMENT' | 'QUERY';
    signal: AbortSignal;
}

/**
 * AI 포트 — 구현 GeminiAiGateway. 지시문 · 응답 형식은 쓰는 도메인이 들고, 어댑터는 호출만 한다.
 * 키(GEMINI_API_KEY)가 비거나 Gemini 가 실패하면 503 AI_UNAVAILABLE_MESSAGE, 끊기 신호(AbortSignal)면 그 AbortError 를 그대로 던진다.
 */
export interface AiGatewayInterface {
    /**
     * 정해진 JSON 형식의 답 하나 — 웹 검색을 같이 쓸 수 있다(Gemini 3 계열).
     *
     * @returns JSON 을 읽은 값(모양 확인은 쓰는 쪽)
     * @throws ServiceUnavailableException `{message: AI_UNAVAILABLE_MESSAGE}` — 키 없음 · 실패 · JSON 아님 · 제한 시간 초과
     */
    generateJson(input: AiJsonInput): Promise<unknown>;

    /**
     * 답 글을 조각으로 흘린다.
     *
     * @throws ServiceUnavailableException `{message: AI_UNAVAILABLE_MESSAGE}` — 시작 전 · 중간 실패
     */
    streamText(input: AiTextInput): AsyncIterable<string>;

    /**
     * 글마다 벡터(AI_EMBEDDING_DIMENSIONS 차원) — 받은 순서대로.
     *
     * @throws ServiceUnavailableException `{message: AI_UNAVAILABLE_MESSAGE}`
     */
    embed(input: AiEmbedInput): Promise<number[][]>;
}

/** AI 대화 한 건 — 질문 + 답(업체 카드) · user_id · 시각(ISO). 카드 모양은 쓰는 도메인의 결과 DTO */
export interface ConversationTurn {
    turn_id: string;
    user_id: string;
    question: string;
    answer: string;
    stores: unknown[];
    asked_at: string;
    answered_at: string;
}

/** 하루 질문 수 한 줄 — 저장된 한국 날짜(yyyy-MM-dd — 줄이 없으면 null) · 그 날짜의 횟수 · 답하는 중인지 */
export interface ConversationUsage {
    date: string | null;
    count: number;
    is_answering: boolean;
}

/**
 * 대화 저장소 포트 — 구현 RedisConversationStore. 이용자마다 이력 하나(chat-turns:<user_id> — 7일) · 질문 수 한 줄(chat-usage:<user_id> = yyyy-MM-dd:횟수) · 답하는 중 잠금(chat-busy:<user_id>).
 * Redis 가 없으면 503 REDIS_UNAVAILABLE_MESSAGE.
 */
export interface ConversationStoreInterface {
    /**
     * 이력 — since 이후 물은 대화 중 마지막 limit 건(오래된 순).
     */
    getTurns(user_id: string, since: Date, limit: number): Promise<ConversationTurn[]>;

    /**
     * 한 건 저장 + 질문 수 — 이력에 더하고, 질문 수 한 줄은 date(물은 한국 날짜)로 바꾼다(줄 없음 → date:1, 다른 날짜 → date:1, 같은 날짜 → +1).
     *
     * @param keep_ms 이력 · 질문 수 키를 쓰지 않으면 지울 시간
     * @returns 바뀐 뒤 그 날짜의 질문 수
     */
    appendTurn(user_id: string, turn: ConversationTurn, date: string, keep_ms: number): Promise<number>;

    /**
     * 이력을 모두 지운다(질문 수 한 줄은 남긴다).
     */
    clearTurns(user_id: string): Promise<void>;

    /**
     * 질문 수 한 줄 · 답하는 중 — 날짜 비교는 쓰는 쪽(줄이 없거나 모양이 틀리면 date null · count 0).
     */
    getUsage(user_id: string): Promise<ConversationUsage>;

    /**
     * 답하는 중 잠금 — 비어 있을 때만 lock_id 로 잡는다(ttl_ms 뒤 만료).
     *
     * @returns 잡았으면 true
     */
    acquireBusy(user_id: string, lock_id: string, ttl_ms: number): Promise<boolean>;

    /**
     * 답하는 중 잠금 풀기 — 값이 lock_id 일 때만.
     */
    releaseBusy(user_id: string, lock_id: string): Promise<void>;

    /**
     * 지난 대화 지우기 — 이력이 있는 이용자마다 before 전에 물은 대화를 지우고, 남은 대화가 없으면 목록에서 뺀다.
     */
    purgeTurns(before: Date): Promise<void>;
}

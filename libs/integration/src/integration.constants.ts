/** AWS 가 SMS 를 접수하지 못했을 때 — 503, 큐 경로에서는 재시도된다 */
export const SMS_UNAVAILABLE_MESSAGE = 'SMS를 보내지 못했습니다. 잠시 후 다시 시도해주세요.';

/** 파일 저장소(S3)에 닿지 못했을 때 — 503 */
export const STORAGE_UNAVAILABLE_MESSAGE = '파일 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';

/** AWS_S3_PUBLIC_URL 이 비어 공개 주소를 만들 수 없을 때 — 500 */
export const STORAGE_PUBLIC_URL_MISSING_MESSAGE = '설정된 파일 공개 주소가 없습니다. 관리자에게 문의해주세요.';

/** 업로드 주소(presigned URL)의 유효 시간(초) */
export const STORAGE_UPLOAD_URL_TTL_SECONDS = 600;

/** 비공개 파일 열람 주소(presigned GET)의 유효 시간(초) */
export const STORAGE_DOWNLOAD_URL_TTL_SECONDS = 600;

/** Redis(상태 저장소)에 닿지 못했을 때 — 503 */
export const REDIS_UNAVAILABLE_MESSAGE = '상태 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';

/** 문 명령(관리자 바로 열기 · 시크릿 변경 때 연결 끊기)을 보내는 Redis 채널 — gateway 문 소켓이 구독해 그 업체 연결에 적용한다 */
export const DOOR_COMMAND_CHANNEL = 'door-commands';

/** 문 명령 종류 — open: 바로 열기(그 업체 연결에 door.open), disconnect: 그 업체 연결을 모두 끊기(시크릿 변경) */
export const DOOR_COMMAND = {OPEN: 'open', DISCONNECT: 'disconnect'} as const;

/** 토스페이먼츠에 닿지 못했거나 잠시 뒤 다시 하면 되는 실패 — 503, 큐 경로에서는 재시도된다 */
export const PAYMENT_UNAVAILABLE_MESSAGE = '결제 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';

/** 토스가 업무 실패를 돌려줬는데 메시지가 없을 때(본문이 JSON 이 아님 등) — 400 */
export const PAYMENT_FAILED_MESSAGE = '결제를 처리하지 못했습니다.';

/** 토스페이먼츠 API 주소 */
export const TOSS_API_BASE_URL = 'https://api.tosspayments.com';

/** 토스 API 요청 제한 시간(ms) — 넘기면 503(재시도) */
export const PAYMENT_REQUEST_TIMEOUT_MS = 30000;

/** 토스 결제 상태 — 승인 완료 */
export const TOSS_PAYMENT_STATUS_DONE = 'DONE';

/** 샘플 파일 저장 키 접두 — 테스트 데이터 시드(SEED_SAMPLE_DATA)의 사진. S3 가 아니라 게이트웨이 assets/sample/ 에 있고 GATEWAY_PUBLIC_URL/sample/<파일> 로 연다(libs/database sample-seed.data.ts 의 SAMPLE_IMAGE_KEY_PREFIX 와 같다) */
export const SAMPLE_FILE_KEY_PREFIX = 'sample/';

/** 비공개 파일 저장 키 접두 — 도메인 키 규칙(admin-service store.util.ts storeFilePrefix — `private/store/<업체>`)과 같다. 내부 파일 저장소는 이 키를 공개 경로로 내주지 않는다 */
export const PRIVATE_FILE_KEY_PREFIX = 'private/';

/** 내부 파일 저장소 경로(게이트웨이) — AWS_S3_BUCKET 이 비면 업로드 · 열람 · 공개 파일이 이 아래다(`/files/upload` · `/files/download` · `/files/<키>`) */
export const LOCAL_FILE_ROUTE = '/files';

/** 내부 파일 저장소 폴더 기본값 — 실행 위치 기준(로컬은 저장소 루트, Docker 는 /app — 공용 볼륨 deskless-files), FILE_STORAGE_DIR 로 바꾼다 */
export const LOCAL_FILE_STORAGE_DIR_DEFAULT = 'storage/files';

/** 내부 파일 저장소 업로드 한도(바이트) — 게이트웨이 앞 nginx(docker/nginx/gateway.conf client_max_body_size 10m)와 같다 */
export const LOCAL_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** 내부 파일 저장소 — 서명이 틀리거나 만료된(또는 Content-Type 이 다른) 업로드 · 열람 주소 */
export const LOCAL_FILE_SIGNATURE_INVALID_MESSAGE = '파일 주소가 올바르지 않거나 만료되었습니다. 주소를 다시 받아주세요.';

/** 내부 파일 저장소 — 업로드 한도 초과 */
export const LOCAL_FILE_TOO_LARGE_MESSAGE = '파일은 10MB 이하만 올릴 수 있습니다.';

/** 내부 파일 저장소 — 열람할 파일이 없음 */
export const LOCAL_FILE_NOT_FOUND_MESSAGE = '파일을 찾을 수 없습니다.';

/** 파일 저장소 구분 — 파일 행(t_store_file · t_room_group_image)의 file_storage. 업로드는 AWS_S3_BUCKET 이 있으면 S3, 비면 LOCAL — S3 로 바꾼 뒤에도 LOCAL 행은 내부 파일 저장소(게이트웨이 /files)에서 연다 */
export const FILE_STORAGE = {S3: 'S3', LOCAL: 'LOCAL'} as const;

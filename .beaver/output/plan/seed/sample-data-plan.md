# Plan — 테스트 데이터 시드 + AWS 미설정 개발 모드(sample-data)

## Feature Summary
- **Feature**: ① 테스트 데이터 시드 — `.env` `SEED_SAMPLE_DATA=1` 이면 user-service 부팅 시드가 업체 10곳 · 객실 그룹 25개 · 호실 96개 · 업체 총관리자 10명 · 이용자 1명을 고정 ID 로 멱등 입력, 사진은 저장소 PNG 70개를 게이트웨이 `/sample/` 로 내준다. ② AWS 미설정 개발 모드(사용자 결정 2026-11-15) — `AWS_S3_BUCKET` 이 비면 파일 저장소 포트가 내부 파일 저장소(LocalStorageGateway — 게이트웨이 `/files` 가 서명된 업로드를 받고 파일을 내준다, 공유 폴더 · Docker 공용 볼륨), AWS 키가 비면 SMS 를 보내지 않고 받는 번호 · 본문을 로그에 남긴다
- **Entry point**: `user-service 부팅 시드(SAMPLE_SEED_TARGETS)` · `GET /sample/<파일>.png` · `PUT /files/upload` · `GET /files/download` · `GET /files/<키>`(게이트웨이 modules/local-file) · `STORAGE_GATEWAY` · `SMS_SENDER`
- **Domain**: seed — libs/database/src/seeder · libs/integration(저장소 · SMS 어댑터) · apps/gateway(정적 경로 · 내부 파일 저장소 경로 · PNG) · scripts · Docker · 문서
- spec: [.beaver/output/spec/seed/sample-data-spec.md](../../spec/seed/sample-data-spec.md)

---

## File List

| File | Action |
|------|------|
| `libs/database/src/seeder/seeder.util.ts` | modified — `isSampleSeedEnabled` · `sampleId` · `sampleNo` · `sampleRooms` · `sampleHours` |
| `libs/database/src/seeder/sample-seed.data.ts` | new — 샘플 업체 10곳 · 그룹 · 호실 · 계정 값(선언) |
| `libs/database/src/seeder/sample-seed.targets.ts` | new — 엔티티 만드는 함수 12개 · `SAMPLE_SEED_TARGETS` |
| `libs/database/src/seeder/seeder.targets.ts` | modified — `SEED_TARGETS` 끝에 `...SAMPLE_SEED_TARGETS` |
| `libs/database/src/seeder/seeder.service.ts` | unchanged — 그대로 처리(만드는 함수 · PK 멱등) |
| `libs/integration/src/integration.constants.ts` | modified — `SAMPLE_FILE_KEY_PREFIX` · `LOCAL_FILE_*` 상수 · 메시지 |
| `libs/integration/src/integration.util.ts` | modified — `isSampleFileKey` · `isS3StorageConfigured` · `isAwsKeyConfigured` · `gatewayPublicUrl` |
| `libs/integration/src/storage/local-storage.util.ts` | new — 폴더 · 서명 · 서명 확인 · 키 → 경로 |
| `libs/integration/src/storage/local-storage.gateway.ts` | new — 내부 파일 저장소 어댑터(STORAGE_GATEWAY) |
| `libs/integration/src/storage/storage.module.ts` | modified — `AWS_S3_BUCKET` 으로 어댑터 고르기(useFactory) |
| `libs/integration/src/storage/s3-storage.gateway.ts` | modified — `getPublicUrl` · `remove` 의 `sample/` 키 분기, 부팅 경고 조건 |
| `libs/integration/src/sms/sns-sms.sender.ts` | modified — AWS 키가 비면 생략 + 로그 |
| `libs/integration/src/sms/sms.module.ts` | modified — 주석(생략 동작) |
| `libs/integration/src/interfaces/integration.interface.ts` | modified — SMS · 저장소 포트 주석(생략 · 내부 저장소) |
| `apps/gateway/src/modules/local-file/local-file.module.ts` | new |
| `apps/gateway/src/modules/local-file/local-file.server.ts` | new — `/files` 업로드 · 열람 · 공개 파일 |
| `apps/gateway/src/modules/local-file/local-file.util.ts` | new — 바이트 한도 · 실패 응답 · 쿼리 · 키 읽기 |
| `apps/gateway/src/gateway.module.ts` | modified — `LocalFileModule` |
| `apps/gateway/src/config/sample-image.config.ts` | new — 정적 폴더 · 옵션 |
| `apps/gateway/src/main.ts` | modified — `useStaticAssets` |
| `apps/gateway/src/assets/sample/*.png` | new — 70개(`store-NN-P.png` 20 · `room-NN-G-P.png` 50, 생성기 결과) |
| `nest-cli.json` | modified — gateway `assets`(PNG → dist) |
| `scripts/sample-images.mjs` | new — PNG 생성기(node:zlib) |
| `scripts/docker-network.mjs` | modified — 공용 볼륨 `roomless-files` 도 만든다 |
| `compose.gateway.yml` · `compose.user-service.yml` · `compose.admin-service.yml` | modified — 공용 볼륨 `/app/storage/files` · `FILE_STORAGE_DIR` 고정 |
| `Dockerfile` | modified — `/app/storage/files` 를 `node` 소유로 |
| `.gitignore` | modified — `/storage` |
| `package.json` | modified — `sample:images` |
| `.env.example` | modified — AWS 절(비우면 개발 모드) · `FILE_STORAGE_DIR` · `GATEWAY_PUBLIC_URL` · `SEED_SAMPLE_DATA` |
| `docs/guides/sample-data.md` | new — 켜는 법 · 넣는 것 · 계정 · 업체코드 · 사진 |
| `docs/guides/aws-setup.md` | modified — "AWS 없이 돌리기" 절 |
| `docs/architecture.md` | modified — 기본 데이터 시드 · Docker 공용 볼륨 · 게이트웨이 인프라 |
| `docs/integration.md` | modified — SMS 생략 · 내부 파일 저장소 · 샘플 키 |
| `README.md` | modified — 외부 연동 · 환경 값 · 명령 · 가이드 · 구조 · Docker 볼륨 |
| `AGENTS.md` | modified — 구조 트리 · 기본 데이터 시드 · 외부 연동(개발 모드 예외 · 파일 본문 규칙) · Docker · Checklist |
| `C:/Users/timec/.claude/projects/C--workspace-roomless-backend/memory/no-mock-adapters.md` | modified — 사용자 결정 2026-11-15 예외 |
| `.beaver/output/frontend/changes/2026-11-13-sample-data.md` | new — 프론트 안내(테스트 계정 · 업체코드 · 테스트 로그인 · 사진 · 업로드 호스트) |
| `.beaver/output/frontend/changes/README.md` | modified — 목록 한 줄 |
| `.beaver/output/report/seed/sample-data-report.md` | new (build) |

---

## Design

### Data Access (Seeder — libs/database)

기존 시드 틀(SeederService — seeder.service.ts:28 · `SEED_TARGETS` — seeder.targets.ts:197)에 대상만 더한다. 엔티티는 `new XEntity()` + 할당(첫 총관리자 시드 buildSuperAdminSeed — seeder.targets.ts:162 과 같이 — 타임스탬프 훅이 돈다). 플래그 확인은 대상 한 곳(`sampleTarget`)에서 — 꺼져 있으면 만드는 함수를 부르지 않는다(bcrypt 도 안 돈다).

```ts
// libs/database/src/seeder/seeder.util.ts — 기존 pickMissingRows 아래에 추가
/**
 * 샘플 시드(테스트 데이터)를 넣을지 — SEED_SAMPLE_DATA 가 '1' 일 때만. 운영 DB 에서는 켜지 않는다(docs/guides/sample-data.md).
 *
 * @param value SEED_SAMPLE_DATA 값
 * @returns '1' 이면 true
 */
export function isSampleSeedEnabled(value: string | undefined): boolean {
    return value === '1';
}

/**
 * 샘플 고정 ID — `5a3e` + 종류 2자리 + 번호 26자리(10진 숫자라 32자 hex 형식 — 업체코드 · 경로 파라미터 검사를 통과한다).
 * 고정이라 다시 부팅해도 같은 행이고(PK 멱등), 눈으로 샘플 행을 가를 수 있다.
 *
 * @param kind 종류(SAMPLE_ID_KIND)
 * @param no 번호
 * @returns 32자 ID
 */
export function sampleId(kind: number, no: number): string {
    return `5a3e${String(kind).padStart(2, '0')}${String(no).padStart(26, '0')}`;
}

/**
 * 샘플 업체 번호 2자리 — 사진 파일 이름 · 사업자등록번호 · 연락처에 쓴다.
 *
 * @param no 업체 번호(1 ~ 10)
 * @returns '01' ~ '10'
 */
export function sampleNo(no: number): string {
    return String(no).padStart(2, '0');
}

/**
 * 한 층의 샘플 호실 — 호실명은 `<층>01` 부터(업체 안 유일 — 그룹마다 층이 다르다).
 *
 * @param floor 층
 * @param count 호실 수
 * @returns 층 · 호실명
 */
export function sampleRooms(floor: number, count: number): {floor: number; room_name: string}[] {
    return Array.from({length: count}, (_, index) => ({floor, room_name: `${floor}${String(index + 1).padStart(2, '0')}`}));
}

/**
 * 일(0) ~ 토(6) 샘플 영업시간 — 휴무 요일은 null(행은 is_closed 1 · 두 시각 NULL — CHK_StoreHour_OpenCloseTime).
 *
 * @param open_time 영업 시작(HH:mm)
 * @param close_time 영업 마감(HH:mm — 시작보다 이르면 다음 날)
 * @param closed_days 휴무 요일
 * @returns 7개 요일
 */
export function sampleHours(open_time: string, close_time: string, closed_days: number[] = []): ({open_time: string; close_time: string} | null)[] {
    return Array.from({length: 7}, (_, day_of_week) => (closed_days.includes(day_of_week) ? null : {open_time, close_time}));
}
```

```ts
// libs/database/src/seeder/sample-seed.data.ts — 새 파일 전체
import type {RoomGroupDetail} from '../entities/room/room-group.entity.js';
import {sampleHours, sampleRooms} from './seeder.util.js';

/** 상품 종류 — t_room_plan_type 시드(HOURLY · NIGHT · LONG) */
export type SamplePlanType = 'HOURLY' | 'NIGHT' | 'LONG';

/** 샘플 영업시간 하루 — 마감이 시작보다 이르면 다음 날 */
export interface SampleStoreHour {
    open_time: string;
    close_time: string;
}

/** 샘플 객실 그룹 — 요금이 null 이면 그 종류를 판매하지 않는다(그룹 상품 is_used 0 · 요금 0) */
export interface SampleRoomGroup {
    room_group_name: string;
    description: string;
    detail: RoomGroupDetail;
    /** 그룹 상품 기본 요금(원) — 시간 이용 1회 · 1박 · 연박 1박당 */
    prices: Record<SamplePlanType, number | null>;
    /** 호실 — 층 · 호실명 */
    rooms: {floor: number; room_name: string}[];
}

/** 샘플 업체 — 배열 순서(01 ~ 10)가 고정 ID 번호 · 사진 파일 번호다(scripts/sample-images.mjs 의 GROUP_COUNTS 와 그룹 수가 같아야 한다) */
export interface SampleStore {
    store_name: string;
    address: string;
    address_detail: string | null;
    latitude: number;
    longitude: number;
    introduction: string;
    /** 24시간 연중무휴 1 — 요일 영업시간이 없다(hours 빈 배열) */
    is_always_open: number;
    /** 일(0) ~ 토(6) 영업시간, 휴무 null — 24시간 업체는 빈 배열 */
    hours: (SampleStoreHour | null)[];
    /** 매일 브레이크 */
    breaks: {start_time: string; end_time: string}[];
    maintenance_minutes: number;
    /** 시간 이용 기본 이용 시간(시간) */
    usage_hours: number;
    /** 업체가 판매하는 상품 종류 — 업체 상품 설정 is_used */
    plans: Record<SamplePlanType, boolean>;
    groups: SampleRoomGroup[];
}

/** 상품 종류 순서 — 업체 상품 설정 · 그룹 상품 행의 고정 ID 번호(1 · 2 · 3) */
export const SAMPLE_PLAN_TYPES: SamplePlanType[] = ['HOURLY', 'NIGHT', 'LONG'];

/** 업체 상품 설정 종류별 값 — admin-service store.constants.ts 의 STORE_PLAN_DEFAULTS(입점 승인)와 같다. 시간 이용 이용 시간만 업체마다(usage_hours) */
export const SAMPLE_PLAN_DEFAULTS: Record<SamplePlanType, {check_in_time: string | null; check_out_time: string | null; min_nights: number | null; max_nights: number | null}> = {
    HOURLY: {check_in_time: null, check_out_time: null, min_nights: null, max_nights: null},
    NIGHT: {check_in_time: '22:00', check_out_time: '09:00', min_nights: null, max_nights: null},
    LONG: {check_in_time: '15:00', check_out_time: '11:00', min_nights: 1, max_nights: 30},
};

/** 업체 예약 정책 · 상품 공통 — 입점 승인 기본값(admin-service store.constants.ts — 예약 가능 72시간 · 100% 환불 마감 60분 · 마감 뒤 50% · 매일 · 최대 연장 3회)과 같다 */
export const SAMPLE_STORE_POLICY = {booking_open_hours: 72, refund_deadline_minutes: 60, late_refund_percent: 50, days_of_week: 127, max_extensions: 3};

/** 업체 · 그룹 사진 번호(정렬 순서 0 · 1) */
export const SAMPLE_PHOTOS = [1, 2];

/** 샘플 사진 저장 키 접두 — libs/integration integration.constants.ts 의 SAMPLE_FILE_KEY_PREFIX 와 같다(저장소 어댑터가 이 키를 게이트웨이 주소로 바꾼다) */
export const SAMPLE_IMAGE_KEY_PREFIX = 'sample/';

/** 고정 ID 종류(sampleId 의 둘째 자리) */
export const SAMPLE_ID_KIND = {
    STORE: 1,
    STORE_CODE: 2,
    STORE_HOUR: 3,
    STORE_BREAK: 4,
    ROOM_PLAN: 5,
    STORE_FILE: 6,
    MANAGER: 7,
    MANAGER_SEARCH_CODE: 8,
    MANAGER_SETTING: 9,
    USER: 10,
    USER_SEARCH_CODE: 11,
    USER_SETTING: 12,
    ROOM_GROUP: 13,
    ROOM_GROUP_IMAGE: 14,
    ROOM_GROUP_PLAN: 15,
    ROOM: 16,
} as const;

/** 업체 총관리자 아이디 · 비밀번호 — 업체마다 같다(매니저 아이디는 업체 안에서만 유일 — UK_User_LoginIdLoginScopeStoreId). 로그인은 업체코드 + 아이디 */
export const SAMPLE_MANAGER_LOGIN_ID = 'manager';
export const SAMPLE_MANAGER_PASSWORD = '1234';

/** 이용자 1명 — SNS 로그인 값(로그인 API 에 그대로 넣는다) · 가입과 같은 꼴의 아이디(<SNS>_…) · 휴대폰 인증 완료 */
export const SAMPLE_USER = {sns_id: 'KAKAO', sns_user_id: 'sample-user-01', login_id: 'KAKAO_SAMPLE_USER_01', nickname: '테스트 이용자', gender: 'M', birth: '1995-05-05', phone: '01080000001'};

/** 그룹 상세정보 — 1룸 · 샤워 · TV */
const DETAIL_BASIC: RoomGroupDetail = {room_count: 1, has_shower: 1, has_tv: 1, has_pc: 0};
/** 그룹 상세정보 — 1룸 · 샤워 · TV · PC */
const DETAIL_PC: RoomGroupDetail = {room_count: 1, has_shower: 1, has_tv: 1, has_pc: 1};
/** 그룹 상세정보 — 2룸 · 샤워 · TV · PC */
const DETAIL_SUITE: RoomGroupDetail = {room_count: 2, has_shower: 1, has_tv: 1, has_pc: 1};

/** 판매 종류 — 전부 */
const PLANS_ALL: Record<SamplePlanType, boolean> = {HOURLY: true, NIGHT: true, LONG: true};
/** 판매 종류 — 시간 이용 · 1박(영업시간 업체 — 연박은 영업시간 밖을 지난다) */
const PLANS_NO_LONG: Record<SamplePlanType, boolean> = {HOURLY: true, NIGHT: true, LONG: false};
/** 판매 종류 — 시간 이용만(낮 영업 업체) */
const PLANS_HOURLY: Record<SamplePlanType, boolean> = {HOURLY: true, NIGHT: false, LONG: false};

/**
 * 샘플 업체 10곳(서울) — 24시간 6곳(시간 이용 · 1박 · 연박), 영업시간 4곳(잠실 · 신촌 시간 이용 · 1박 / 여의도 · 이태원 시간 이용만 — 휴무 요일 · 브레이크 포함).
 * 그룹마다 층이 다르다(2층 · 3층 · 4층). 1박 입실 22:00 ~ 퇴실 09:00 · 연박 15:00 ~ 11:00 은 SAMPLE_PLAN_DEFAULTS.
 */
export const SAMPLE_STORES: SampleStore[] = [
    {
        store_name: '룸리스 강남역점',
        address: '서울 강남구 강남대로 396',
        address_detail: '5층',
        latitude: 37.4979,
        longitude: 127.0276,
        introduction: '강남역 바로 앞, 24시간 무인으로 운영하는 객실입니다.',
        is_always_open: 1,
        hours: [],
        breaks: [],
        maintenance_minutes: 30,
        usage_hours: 3,
        plans: PLANS_ALL,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 20000, NIGHT: 55000, LONG: 60000}, rooms: sampleRooms(2, 5)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 28000, NIGHT: 75000, LONG: 80000}, rooms: sampleRooms(3, 4)},
            {room_group_name: '스위트', description: '거실이 딸린 2룸 객실(숙박 전용)', detail: DETAIL_SUITE, prices: {HOURLY: null, NIGHT: 120000, LONG: 130000}, rooms: sampleRooms(4, 3)},
        ],
    },
    {
        store_name: '룸리스 홍대입구점',
        address: '서울 마포구 양화로 160',
        address_detail: '3층',
        latitude: 37.5572,
        longitude: 126.9245,
        introduction: '홍대입구역에서 걸어서 2분, 공연 뒤 쉬어 가기 좋은 객실입니다.',
        is_always_open: 1,
        hours: [],
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 3,
        plans: PLANS_ALL,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 18000, NIGHT: 50000, LONG: 55000}, rooms: sampleRooms(2, 4)},
            {room_group_name: '트윈', description: '싱글 침대 두 개가 있는 객실', detail: DETAIL_BASIC, prices: {HOURLY: 24000, NIGHT: 65000, LONG: 70000}, rooms: sampleRooms(3, 3)},
        ],
    },
    {
        store_name: '룸리스 잠실점',
        address: '서울 송파구 올림픽로 240',
        address_detail: '7층',
        latitude: 37.5133,
        longitude: 127.1001,
        introduction: '매일 낮 12시부터 다음 날 오전 10시까지 운영합니다(연박 없음).',
        is_always_open: 0,
        hours: sampleHours('12:00', '10:00'),
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 3,
        plans: PLANS_NO_LONG,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 19000, NIGHT: 52000, LONG: null}, rooms: sampleRooms(2, 5)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 26000, NIGHT: 70000, LONG: null}, rooms: sampleRooms(3, 4)},
            {room_group_name: '패밀리', description: '최대 4명이 묵는 2룸 객실', detail: DETAIL_SUITE, prices: {HOURLY: 35000, NIGHT: 95000, LONG: null}, rooms: sampleRooms(4, 3)},
        ],
    },
    {
        store_name: '룸리스 성수점',
        address: '서울 성동구 아차산로 100',
        address_detail: '2층',
        latitude: 37.5446,
        longitude: 127.0557,
        introduction: '성수역 근처, 24시간 운영하는 조용한 객실입니다.',
        is_always_open: 1,
        hours: [],
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 4,
        plans: PLANS_ALL,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 17000, NIGHT: 48000, LONG: 52000}, rooms: sampleRooms(2, 4)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 25000, NIGHT: 68000, LONG: 72000}, rooms: sampleRooms(3, 3)},
        ],
    },
    {
        store_name: '룸리스 여의도점',
        address: '서울 영등포구 여의대로 108',
        address_detail: '4층',
        latitude: 37.5259,
        longitude: 126.9254,
        introduction: '업무 중 잠깐 쉬어 가는 시간 이용 전용 객실입니다(일요일 휴무, 15시 ~ 16시 청소).',
        is_always_open: 0,
        hours: sampleHours('10:00', '23:00', [0]),
        breaks: [{start_time: '15:00', end_time: '16:00'}],
        maintenance_minutes: 10,
        usage_hours: 2,
        plans: PLANS_HOURLY,
        groups: [
            {room_group_name: '스탠다드', description: '1인 휴식 객실', detail: DETAIL_BASIC, prices: {HOURLY: 15000, NIGHT: null, LONG: null}, rooms: sampleRooms(2, 5)},
            {room_group_name: '비즈니스', description: '책상과 PC 가 있는 업무용 객실', detail: DETAIL_PC, prices: {HOURLY: 22000, NIGHT: null, LONG: null}, rooms: sampleRooms(3, 4)},
        ],
    },
    {
        store_name: '룸리스 종로점',
        address: '서울 종로구 종로 51',
        address_detail: '6층',
        latitude: 37.5703,
        longitude: 126.9921,
        introduction: '종각역 근처, 24시간 운영합니다.',
        is_always_open: 1,
        hours: [],
        breaks: [],
        maintenance_minutes: 30,
        usage_hours: 3,
        plans: PLANS_ALL,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 16000, NIGHT: 45000, LONG: 50000}, rooms: sampleRooms(2, 4)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 24000, NIGHT: 65000, LONG: 70000}, rooms: sampleRooms(3, 4)},
            {room_group_name: '스위트', description: '거실이 딸린 2룸 객실(숙박 전용)', detail: DETAIL_SUITE, prices: {HOURLY: null, NIGHT: 110000, LONG: 120000}, rooms: sampleRooms(4, 3)},
        ],
    },
    {
        store_name: '룸리스 신촌점',
        address: '서울 서대문구 신촌로 83',
        address_detail: '4층',
        latitude: 37.5551,
        longitude: 126.9369,
        introduction: '매일 오후 2시부터 다음 날 낮 12시까지 운영합니다(연박 없음).',
        is_always_open: 0,
        hours: sampleHours('14:00', '12:00'),
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 3,
        plans: PLANS_NO_LONG,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 15000, NIGHT: 45000, LONG: null}, rooms: sampleRooms(2, 5)},
            {room_group_name: '트윈', description: '싱글 침대 두 개가 있는 객실', detail: DETAIL_BASIC, prices: {HOURLY: 21000, NIGHT: 60000, LONG: null}, rooms: sampleRooms(3, 3)},
        ],
    },
    {
        store_name: '룸리스 건대입구점',
        address: '서울 광진구 아차산로 243',
        address_detail: '5층',
        latitude: 37.5404,
        longitude: 127.0692,
        introduction: '건대입구역 앞, 24시간 운영합니다.',
        is_always_open: 1,
        hours: [],
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 3,
        plans: PLANS_ALL,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 17000, NIGHT: 47000, LONG: 52000}, rooms: sampleRooms(2, 5)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 25000, NIGHT: 66000, LONG: 70000}, rooms: sampleRooms(3, 4)},
            {room_group_name: '패밀리', description: '최대 4명이 묵는 2룸 객실', detail: DETAIL_SUITE, prices: {HOURLY: 34000, NIGHT: 90000, LONG: 95000}, rooms: sampleRooms(4, 3)},
        ],
    },
    {
        store_name: '룸리스 이태원점',
        address: '서울 용산구 이태원로 177',
        address_detail: '3층',
        latitude: 37.5345,
        longitude: 126.9946,
        introduction: '오전 10시 ~ 밤 10시 시간 이용 전용 객실입니다(월요일 휴무).',
        is_always_open: 0,
        hours: sampleHours('10:00', '22:00', [1]),
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 3,
        plans: PLANS_HOURLY,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 18000, NIGHT: null, LONG: null}, rooms: sampleRooms(2, 4)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 26000, NIGHT: null, LONG: null}, rooms: sampleRooms(3, 3)},
        ],
    },
    {
        store_name: '룸리스 합정점',
        address: '서울 마포구 양화로 45',
        address_detail: '8층',
        latitude: 37.5495,
        longitude: 126.9139,
        introduction: '합정역 앞, 24시간 운영합니다.',
        is_always_open: 1,
        hours: [],
        breaks: [],
        maintenance_minutes: 0,
        usage_hours: 3,
        plans: PLANS_ALL,
        groups: [
            {room_group_name: '스탠다드', description: '혼자 쉬기 좋은 기본 객실', detail: DETAIL_BASIC, prices: {HOURLY: 18000, NIGHT: 50000, LONG: 55000}, rooms: sampleRooms(2, 4)},
            {room_group_name: '디럭스', description: '넓은 침대와 PC 가 있는 객실', detail: DETAIL_PC, prices: {HOURLY: 26000, NIGHT: 70000, LONG: 75000}, rooms: sampleRooms(3, 4)},
            {room_group_name: '스위트', description: '거실이 딸린 2룸 객실(숙박 전용)', detail: DETAIL_SUITE, prices: {HOURLY: null, NIGHT: 115000, LONG: 125000}, rooms: sampleRooms(4, 3)},
        ],
    },
];
```

```ts
// libs/database/src/seeder/sample-seed.targets.ts — 새 파일 전체
import type {EntityTarget, ObjectLiteral} from 'typeorm';
import {getBcrypt} from '@app/common/utils/bcrypt.js';
import {RoomGroupImageEntity} from '../entities/room/room-group-image.entity.js';
import {RoomGroupPlanEntity} from '../entities/room/room-group-plan.entity.js';
import {RoomGroupEntity} from '../entities/room/room-group.entity.js';
import {RoomPlanEntity} from '../entities/room/room-plan.entity.js';
import {RoomEntity} from '../entities/room/room.entity.js';
import {StoreBreakEntity} from '../entities/store/store-break.entity.js';
import {StoreFileEntity} from '../entities/store/store-file.entity.js';
import {StoreHourEntity} from '../entities/store/store-hour.entity.js';
import {StoreEntity} from '../entities/store/store.entity.js';
import {UserSettingEntity} from '../entities/user/user-setting.entity.js';
import {UserEntity} from '../entities/user/user.entity.js';
import {
    SAMPLE_ID_KIND,
    SAMPLE_IMAGE_KEY_PREFIX,
    SAMPLE_MANAGER_LOGIN_ID,
    SAMPLE_MANAGER_PASSWORD,
    SAMPLE_PHOTOS,
    SAMPLE_PLAN_DEFAULTS,
    SAMPLE_PLAN_TYPES,
    SAMPLE_STORE_POLICY,
    SAMPLE_STORES,
    SAMPLE_USER,
} from './sample-seed.data.js';
import type {SeedTarget} from './seeder.targets.js';
import {isSampleSeedEnabled, sampleId, sampleNo} from './seeder.util.js';

/**
 * 샘플 업체 10곳 — 활성 · 영업 중, 업체코드 고정(매니저 로그인 · 매니저 화면 주소), 예약 정책은 입점 승인 기본값.
 * 사업자등록번호 `99900000NN` · 연락처 `02123400NN`(입점 신청 형식 — 숫자만).
 *
 * @returns 업체 10행
 */
export function buildSampleStores(): StoreEntity[] {
    return SAMPLE_STORES.map((sample, index) => {
        const no = index + 1;
        const store = new StoreEntity();
        store.store_id = sampleId(SAMPLE_ID_KIND.STORE, no);
        store.store_code = sampleId(SAMPLE_ID_KIND.STORE_CODE, no);
        store.store_state_id = 'ACTIVE';
        store.store_name = sample.store_name;
        store.business_number = `99900000${sampleNo(no)}`;
        store.owner_name = `샘플 대표 ${sampleNo(no)}`;
        store.phone = `02123400${sampleNo(no)}`;
        store.address = sample.address;
        store.address_detail = sample.address_detail;
        store.latitude = sample.latitude;
        store.longitude = sample.longitude;
        store.introduction = sample.introduction;
        store.is_always_open = sample.is_always_open;
        store.is_open = 1;
        store.maintenance_minutes = sample.maintenance_minutes;
        store.booking_open_hours = SAMPLE_STORE_POLICY.booking_open_hours;
        store.refund_deadline_minutes = SAMPLE_STORE_POLICY.refund_deadline_minutes;
        store.late_refund_percent = SAMPLE_STORE_POLICY.late_refund_percent;
        store.door_secret = null;
        store.suspend_comment = null;
        store.is_deleted = 0;
        store.delete_backup = null;
        return store;
    });
}

/**
 * 샘플 영업시간 — 영업시간 업체만 일 ~ 토 7행(휴무 요일은 is_closed 1 · 두 시각 NULL). 24시간 업체는 행이 없다.
 *
 * @returns 영업시간 행
 */
export function buildSampleStoreHours(): StoreHourEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        sample.hours.map((hour, day_of_week) => {
            const entity = new StoreHourEntity();
            entity.store_hour_id = sampleId(SAMPLE_ID_KIND.STORE_HOUR, (index + 1) * 10 + day_of_week);
            entity.store_id = sampleId(SAMPLE_ID_KIND.STORE, index + 1);
            entity.day_of_week = day_of_week;
            entity.is_closed = hour ? 0 : 1;
            entity.open_time = hour ? hour.open_time : null;
            entity.close_time = hour ? hour.close_time : null;
            entity.is_deleted = 0;
            return entity;
        }),
    );
}

/**
 * 샘플 브레이크 — 매일 같은 시간.
 *
 * @returns 브레이크 행
 */
export function buildSampleStoreBreaks(): StoreBreakEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        sample.breaks.map((item, order) => {
            const entity = new StoreBreakEntity();
            entity.store_break_id = sampleId(SAMPLE_ID_KIND.STORE_BREAK, (index + 1) * 10 + order + 1);
            entity.store_id = sampleId(SAMPLE_ID_KIND.STORE, index + 1);
            entity.start_time = item.start_time;
            entity.end_time = item.end_time;
            entity.is_deleted = 0;
            return entity;
        }),
    );
}

/**
 * 샘플 업체 상품 설정 — 업체 × 종류 3행(판매 안 하는 종류는 is_used 0). 값 조합은 CHK_RoomPlan_* 와 입점 승인 기본값을 따른다.
 *
 * @returns 업체 상품 설정 30행
 */
export function buildSampleRoomPlans(): RoomPlanEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        SAMPLE_PLAN_TYPES.map((room_plan_type_id, typeIndex) => {
            const defaults = SAMPLE_PLAN_DEFAULTS[room_plan_type_id];
            const plan = new RoomPlanEntity();
            plan.room_plan_id = sampleId(SAMPLE_ID_KIND.ROOM_PLAN, (index + 1) * 10 + typeIndex + 1);
            plan.store_id = sampleId(SAMPLE_ID_KIND.STORE, index + 1);
            plan.room_plan_type_id = room_plan_type_id;
            plan.is_used = sample.plans[room_plan_type_id] ? 1 : 0;
            plan.days_of_week = SAMPLE_STORE_POLICY.days_of_week;
            plan.usage_hours = room_plan_type_id === 'HOURLY' ? sample.usage_hours : null;
            plan.check_in_time = defaults.check_in_time;
            plan.check_out_time = defaults.check_out_time;
            plan.min_nights = defaults.min_nights;
            plan.max_nights = defaults.max_nights;
            plan.is_extendable = 1;
            plan.max_extensions = SAMPLE_STORE_POLICY.max_extensions;
            return plan;
        }),
    );
}

/**
 * 샘플 업체 사진 — 업체마다 2장(공개 용도 STORE_IMAGE, 신청 없이 업체에 바로), 키 `sample/store-NN-P.png`.
 *
 * @returns 업체 정보 파일 20행
 */
export function buildSampleStoreFiles(): StoreFileEntity[] {
    return SAMPLE_STORES.flatMap((_, index) =>
        SAMPLE_PHOTOS.map((photo) => {
            const no = index + 1;
            const file_name = `store-${sampleNo(no)}-${photo}.png`;
            const file = new StoreFileEntity();
            file.store_file_id = sampleId(SAMPLE_ID_KIND.STORE_FILE, no * 10 + photo);
            file.store_file_purpose_id = 'STORE_IMAGE';
            file.store_application_id = null;
            file.store_id = sampleId(SAMPLE_ID_KIND.STORE, no);
            file.file_key = `${SAMPLE_IMAGE_KEY_PREFIX}${file_name}`;
            file.file_name = file_name;
            file.content_type = 'image/png';
            file.sort_order = photo - 1;
            file.is_deleted = 0;
            return file;
        }),
    );
}

/**
 * 샘플 업체 총관리자 — 업체마다 1명(대표), 아이디 manager · 비밀번호 1234(시드 시점 bcrypt + pepper — 한 번 해시해 같이 쓴다), 비밀번호 변경 요구 없음.
 * 휴대폰 `0109000000NN`(업체 안 유일).
 *
 * @returns 업체 총관리자 10행
 */
export async function buildSampleManagers(): Promise<UserEntity[]> {
    const login_pw = await getBcrypt(SAMPLE_MANAGER_PASSWORD);
    return SAMPLE_STORES.map((_, index) => {
        const no = index + 1;
        const manager = new UserEntity();
        manager.user_id = sampleId(SAMPLE_ID_KIND.MANAGER, no);
        manager.user_search_code = sampleId(SAMPLE_ID_KIND.MANAGER_SEARCH_CODE, no);
        manager.auth_id = 'HEAD_MANAGER';
        manager.login_scope = 'MANAGER'; // 로그인 그룹 — 업체 관리자 (database 는 contracts 를 import 하지 않는다)
        manager.state_id = 'ACTIVE';
        manager.sns_id = null;
        manager.sns_user_id = null;
        manager.store_id = sampleId(SAMPLE_ID_KIND.STORE, no);
        manager.login_id = SAMPLE_MANAGER_LOGIN_ID;
        manager.login_pw = login_pw;
        manager.name = `샘플 대표 ${sampleNo(no)}`;
        manager.gender = 'M';
        manager.birth = '1985-01-01';
        manager.phone = `010900000${sampleNo(no)}`;
        manager.phone_verified_at = null;
        manager.nickname = `샘플 대표 ${sampleNo(no)}`;
        manager.device_os = null;
        manager.device_token = null;
        manager.is_password_change_required = 0;
        manager.block_comment = null;
        manager.leave_comment = null;
        manager.leave_reserved_at = null;
        manager.leave_previous_state_id = null;
        manager.leave_backup = null;
        return manager;
    });
}

/**
 * 샘플 이용자 1명 — KAKAO · sample-user-01(로그인 API 에 그대로 넣는다), 휴대폰 인증 완료(시드 시각). 비밀번호는 가입과 같이 아이디의 해시(user.service.ts sign).
 *
 * @returns 이용자 1행
 */
export async function buildSampleUser(): Promise<UserEntity[]> {
    const user = new UserEntity();
    user.user_id = sampleId(SAMPLE_ID_KIND.USER, 1);
    user.user_search_code = sampleId(SAMPLE_ID_KIND.USER_SEARCH_CODE, 1);
    user.auth_id = 'USER';
    user.login_scope = 'USER';
    user.state_id = 'ACTIVE';
    user.sns_id = SAMPLE_USER.sns_id;
    user.sns_user_id = SAMPLE_USER.sns_user_id;
    user.store_id = null;
    user.login_id = SAMPLE_USER.login_id;
    user.login_pw = await getBcrypt(SAMPLE_USER.login_id);
    user.name = SAMPLE_USER.nickname;
    user.gender = SAMPLE_USER.gender;
    user.birth = SAMPLE_USER.birth;
    user.phone = SAMPLE_USER.phone;
    user.phone_verified_at = new Date();
    user.nickname = SAMPLE_USER.nickname;
    user.device_os = null;
    user.device_token = null;
    user.is_password_change_required = 0;
    user.block_comment = null;
    user.leave_comment = null;
    user.leave_reserved_at = null;
    user.leave_previous_state_id = null;
    user.leave_backup = null;
    return [user];
}

/**
 * 샘플 계정의 회원 설정 — 로그인 회원 조회가 회원 설정을 inner join 한다(첫 총관리자 회원 설정 시드와 같은 이유).
 *
 * @returns 회원 설정 11행(업체 총관리자 10 + 이용자 1)
 */
export function buildSampleUserSettings(): UserSettingEntity[] {
    const accounts = [
        ...SAMPLE_STORES.map((_, index) => ({user_setting_id: sampleId(SAMPLE_ID_KIND.MANAGER_SETTING, index + 1), user_id: sampleId(SAMPLE_ID_KIND.MANAGER, index + 1)})),
        {user_setting_id: sampleId(SAMPLE_ID_KIND.USER_SETTING, 1), user_id: sampleId(SAMPLE_ID_KIND.USER, 1)},
    ];
    return accounts.map((account) => {
        const setting = new UserSettingEntity();
        setting.user_setting_id = account.user_setting_id;
        setting.user_id = account.user_id;
        setting.bio = null;
        return setting;
    });
}

/**
 * 샘플 객실 그룹 — 업체마다 2 ~ 3개(그룹 번호 = 업체 번호 × 10 + 순서).
 *
 * @returns 객실 그룹 25행
 */
export function buildSampleRoomGroups(): RoomGroupEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        sample.groups.map((item, order) => {
            const group = new RoomGroupEntity();
            group.room_group_id = sampleId(SAMPLE_ID_KIND.ROOM_GROUP, (index + 1) * 10 + order + 1);
            group.store_id = sampleId(SAMPLE_ID_KIND.STORE, index + 1);
            group.room_group_name = item.room_group_name;
            group.description = item.description;
            group.room_group_detail = {...item.detail};
            group.is_deleted = 0;
            return group;
        }),
    );
}

/**
 * 샘플 그룹 사진 — 그룹마다 2장, 키 `sample/room-NN-G-P.png`.
 *
 * @returns 그룹 사진 50행
 */
export function buildSampleRoomGroupImages(): RoomGroupImageEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        sample.groups.flatMap((_, order) =>
            SAMPLE_PHOTOS.map((photo) => {
                const groupNo = (index + 1) * 10 + order + 1;
                const file_name = `room-${sampleNo(index + 1)}-${order + 1}-${photo}.png`;
                const image = new RoomGroupImageEntity();
                image.room_group_image_id = sampleId(SAMPLE_ID_KIND.ROOM_GROUP_IMAGE, groupNo * 10 + photo);
                image.room_group_id = sampleId(SAMPLE_ID_KIND.ROOM_GROUP, groupNo);
                image.file_key = `${SAMPLE_IMAGE_KEY_PREFIX}${file_name}`;
                image.file_name = file_name;
                image.content_type = 'image/png';
                image.sort_order = photo - 1;
                image.is_deleted = 0;
                return image;
            }),
        ),
    );
}

/**
 * 샘플 그룹 상품 — 그룹 × 종류 3행, 요금이 있으면 판매(is_used 1), 없으면 판매 안 함 · 요금 0(객실 그룹 생성과 같은 기본 모양).
 *
 * @returns 그룹 상품 75행
 */
export function buildSampleRoomGroupPlans(): RoomGroupPlanEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        sample.groups.flatMap((item, order) =>
            SAMPLE_PLAN_TYPES.map((room_plan_type_id, typeIndex) => {
                const groupNo = (index + 1) * 10 + order + 1;
                const price = item.prices[room_plan_type_id];
                const plan = new RoomGroupPlanEntity();
                plan.room_group_plan_id = sampleId(SAMPLE_ID_KIND.ROOM_GROUP_PLAN, groupNo * 10 + typeIndex + 1);
                plan.room_group_id = sampleId(SAMPLE_ID_KIND.ROOM_GROUP, groupNo);
                plan.room_plan_type_id = room_plan_type_id;
                plan.is_used = price === null ? 0 : 1;
                plan.price = price ?? 0;
                return plan;
            }),
        ),
    );
}

/**
 * 샘플 호실 — 그룹마다 3 ~ 5개, 모두 예약가능(호실 번호 = 업체 번호 × 1000 + 호실명).
 *
 * @returns 호실 96행
 */
export function buildSampleRooms(): RoomEntity[] {
    return SAMPLE_STORES.flatMap((sample, index) =>
        sample.groups.flatMap((item, order) =>
            item.rooms.map((sampleRoom) => {
                const room = new RoomEntity();
                room.room_id = sampleId(SAMPLE_ID_KIND.ROOM, (index + 1) * 1000 + Number(sampleRoom.room_name));
                room.store_id = sampleId(SAMPLE_ID_KIND.STORE, index + 1);
                room.room_group_id = sampleId(SAMPLE_ID_KIND.ROOM_GROUP, (index + 1) * 10 + order + 1);
                room.room_state_id = 'AVAILABLE';
                room.room_name = sampleRoom.room_name;
                room.floor = sampleRoom.floor;
                room.is_deleted = 0;
                return room;
            }),
        ),
    );
}

/**
 * 샘플 시드 대상 하나 — SEED_SAMPLE_DATA 가 '1' 이 아니면 0건(만드는 함수를 부르지 않는다 — bcrypt 도 돌지 않는다).
 *
 * @param entity 엔티티 클래스
 * @param build 만드는 함수
 * @returns 시드 대상
 */
function sampleTarget(entity: EntityTarget<ObjectLiteral>, build: () => ObjectLiteral[] | Promise<ObjectLiteral[]>): SeedTarget {
    return {entity, data: async () => (isSampleSeedEnabled(process.env.SEED_SAMPLE_DATA) ? build() : [])};
}

/**
 * 샘플 시드 대상 — FK 부모 순(업체 → 업체 설정 · 사진 → 계정 → 객실 그룹 → 그룹 사진 · 상품 → 호실). SEED_TARGETS 끝(룩업 · 첫 총관리자 뒤)에 붙는다.
 * 테스트 데이터 — 개발 · 테스트 DB 에서만 켠다(docs/guides/sample-data.md).
 */
export const SAMPLE_SEED_TARGETS: SeedTarget[] = [
    sampleTarget(StoreEntity, buildSampleStores),
    sampleTarget(StoreHourEntity, buildSampleStoreHours),
    sampleTarget(StoreBreakEntity, buildSampleStoreBreaks),
    sampleTarget(RoomPlanEntity, buildSampleRoomPlans),
    sampleTarget(StoreFileEntity, buildSampleStoreFiles),
    sampleTarget(UserEntity, buildSampleManagers),
    sampleTarget(UserEntity, buildSampleUser),
    sampleTarget(UserSettingEntity, buildSampleUserSettings),
    sampleTarget(RoomGroupEntity, buildSampleRoomGroups),
    sampleTarget(RoomGroupImageEntity, buildSampleRoomGroupImages),
    sampleTarget(RoomGroupPlanEntity, buildSampleRoomGroupPlans),
    sampleTarget(RoomEntity, buildSampleRooms),
];
```

```ts
// libs/database/src/seeder/seeder.targets.ts — 변경 부분
import {UserEntity} from '../entities/user/user.entity.js';
import {SAMPLE_SEED_TARGETS} from './sample-seed.targets.js';

/**
 * 애플리케이션 시작 시 기본 데이터를 보장할 엔티티 목록 (기본 데이터 단일 관리 지점).
 * 새 기본 데이터는 위에 `<X>_SEED_DATA`(또는 만드는 함수)를 정의하고 여기에 한 줄 추가한다. FK 부모를 먼저 둔다.
 * 끝의 샘플 대상(테스트 데이터 — sample-seed.targets.ts)은 SEED_SAMPLE_DATA=1 일 때만 행을 만든다.
 */
export const SEED_TARGETS: SeedTarget[] = [
    // … 기존 15행 그대로 …
    {entity: UserSettingEntity, data: buildSuperAdminSettingSeed, key: 'user_id'},
    ...SAMPLE_SEED_TARGETS,
];
```
(`sample-seed.targets.ts` 는 `SeedTarget` 을 `import type` 으로만 가져와 실행 시 순환 import 가 없다.)

### Business Logic (저장소 어댑터 — libs/integration)

사진 주소는 지금처럼 `storageGateway.getPublicUrl` 한 곳에서 만든다(호출 8곳 — room.service.ts:219 · 242, discovery.service.ts:44 · 71 · 119, admin store.service.ts:153 · 337 · 446, user store.service.ts:137 — 바꾸지 않는다). 빈 주소 처리는 형제 분기(AWS_S3_PUBLIC_URL — s3-storage.gateway.ts:74-81)와 같다.

```ts
// libs/integration/src/integration.constants.ts — 추가
/** 샘플 파일 저장 키 접두 — 테스트 데이터 시드(SEED_SAMPLE_DATA)의 사진. S3 가 아니라 게이트웨이 assets/sample/ 에 있고 GATEWAY_PUBLIC_URL/sample/<파일> 로 연다(libs/database sample-seed.data.ts 의 SAMPLE_IMAGE_KEY_PREFIX 와 같다) */
export const SAMPLE_FILE_KEY_PREFIX = 'sample/';

/** 비공개 파일 저장 키 접두 — 도메인 키 규칙(admin-service store.util.ts storeFilePrefix — `private/store/<업체>`)과 같다. 내부 파일 저장소는 이 키를 공개 경로로 내주지 않는다 */
export const PRIVATE_FILE_KEY_PREFIX = 'private/';

/** 내부 파일 저장소 경로(게이트웨이) — AWS_S3_BUCKET 이 비면 업로드 · 열람 · 공개 파일이 이 아래다(`/files/upload` · `/files/download` · `/files/<키>`) */
export const LOCAL_FILE_ROUTE = '/files';

/** 내부 파일 저장소 폴더 기본값 — 실행 위치 기준(로컬은 저장소 루트, Docker 는 /app — 공용 볼륨 roomless-files), FILE_STORAGE_DIR 로 바꾼다 */
export const LOCAL_FILE_STORAGE_DIR_DEFAULT = 'storage/files';

/** 내부 파일 저장소 업로드 한도(바이트) — 게이트웨이 앞 nginx(docker/nginx/gateway.conf client_max_body_size 10m)와 같다 */
export const LOCAL_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** 내부 파일 저장소 — 서명이 틀리거나 만료된(또는 Content-Type 이 다른) 업로드 · 열람 주소 */
export const LOCAL_FILE_SIGNATURE_INVALID_MESSAGE = '파일 주소가 올바르지 않거나 만료되었습니다. 주소를 다시 받아주세요.';

/** 내부 파일 저장소 — 업로드 한도 초과 */
export const LOCAL_FILE_TOO_LARGE_MESSAGE = '파일은 10MB 이하만 올릴 수 있습니다.';

/** 내부 파일 저장소 — 열람할 파일이 없음 */
export const LOCAL_FILE_NOT_FOUND_MESSAGE = '파일을 찾을 수 없습니다.';
```

```ts
// libs/integration/src/integration.util.ts — 추가 (import 에 SAMPLE_FILE_KEY_PREFIX)
/**
 * 샘플 파일 저장 키인지 — 테스트 데이터 시드의 사진(게이트웨이가 내주는 저장소 안 파일). API 로는 이 키를 등록할 수 없다(업로드 키 검사가 store/<업체>/… 접두만 받는다).
 *
 * @param key 저장 키
 * @returns `sample/` 로 시작하면 true
 */
export function isSampleFileKey(key: string): boolean {
    return key.startsWith(SAMPLE_FILE_KEY_PREFIX);
}

/**
 * 파일 저장소로 S3 를 쓸지 — AWS_S3_BUCKET 이 있으면 S3, 비면 내부 파일 저장소(게이트웨이 /files — 사용자 결정 2026-11-15).
 * StorageModule(어댑터 고르기)과 게이트웨이 local-file(경로를 열지)이 같은 기준을 쓴다.
 *
 * @param env 환경변수
 * @returns S3 면 true
 */
export function isS3StorageConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.AWS_S3_BUCKET);
}

/**
 * AWS 키가 있는지 — AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY 둘 다 있어야 SMS 를 SNS 로 보낸다(없으면 보내지 않고 로그 — 사용자 결정 2026-11-15).
 *
 * @param env 환경변수
 * @returns 둘 다 있으면 true
 */
export function isAwsKeyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

/**
 * 게이트웨이 공개 주소(끝의 / 를 뗀다) — 샘플 사진 · 내부 파일 저장소 주소의 기준. 비어 있으면 빈 문자열.
 *
 * @param env 환경변수
 * @returns 예: http://localhost:3000
 */
export function gatewayPublicUrl(env: NodeJS.ProcessEnv = process.env): string {
    return (env.GATEWAY_PUBLIC_URL ?? '').replace(/\/+$/, '');
}
```

```ts
// libs/integration/src/storage/s3-storage.gateway.ts — 변경 부분
import {gatewayPublicUrl, isSampleFileKey} from '../integration.util.js';

/**
 * 파일 저장소 어댑터 — Amazon S3(AWS_S3_BUCKET 이 있을 때 — 비면 StorageModule 이 LocalStorageGateway 를 고른다). 업로드는 presigned URL(PutObject, Content-Type 서명)로 클라이언트가 직접 한다.
 * 버킷 AWS_S3_BUCKET, 공개 주소 기준 AWS_S3_PUBLIC_URL, 리전 AWS_REGION, 자격증명은 AWS SDK 기본 체인.
 * 샘플 키(`sample/` — 테스트 데이터 시드 사진)는 S3 에 없다 — 공개 주소는 GATEWAY_PUBLIC_URL 기준, 삭제는 건너뛴다(docs/guides/sample-data.md).
 * AWS 세팅: docs/guides/aws-setup.md
 */

    /**
     * AWS_REGION · AWS_S3_PUBLIC_URL 중 비어 있는 값이 있으면 부팅 때 한 번 경고한다(버킷은 있어야 이 어댑터가 골라진다). 부팅은 막지 않고 파일 요청만 실패한다.
     */
    onApplicationBootstrap(): void {
        if (!process.env.AWS_REGION || !process.env.AWS_S3_PUBLIC_URL) {
            this.logger.warn('AWS_REGION · AWS_S3_PUBLIC_URL 중 비어 있는 값이 있어 파일 요청은 실패합니다 — docs/guides/aws-setup.md');
        }
    }

    /**
     * 공개 주소 — AWS_S3_PUBLIC_URL(끝의 / 는 뗀다) 뒤에 키. 샘플 키는 GATEWAY_PUBLIC_URL(게이트웨이 /sample/ 정적 경로) 뒤에 키.
     *
     * @param key 저장 키
     * @returns 공개 주소
     * @throws InternalServerErrorException 기준 주소(AWS_S3_PUBLIC_URL · 샘플 키면 GATEWAY_PUBLIC_URL)가 비어 있을 때
     */
    getPublicUrl(key: string): string {
        const sample = isSampleFileKey(key);
        const base = sample ? gatewayPublicUrl() : (process.env.AWS_S3_PUBLIC_URL ?? '').replace(/\/+$/, '');
        if (!base) {
            this.logger.error(
                sample
                    ? 'GATEWAY_PUBLIC_URL 이 비어 있어 샘플 사진 주소를 만들 수 없습니다 — docs/guides/sample-data.md'
                    : 'AWS_S3_PUBLIC_URL 이 비어 있어 파일 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md',
            );
            throw new InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE});
        }
        return `${base}/${key}`;
    }

    /**
     * 파일을 지운다 — S3 는 없는 키도 성공으로 답한다. 샘플 키는 저장소(게이트웨이 assets)에 든 파일이라 지우지 않는다(행 소프트 삭제만).
     *
     * @param key 저장 키
     * @throws ServiceUnavailableException 저장소에 닿지 못했을 때
     */
    async remove(key: string): Promise<void> {
        if (isSampleFileKey(key)) {
            return;
        }
        try {
            await this.client.send(new DeleteObjectCommand({Bucket: process.env.AWS_S3_BUCKET, Key: key}));
        } catch (error) {
            throw toUnavailable(this.logger, '파일 삭제', error);
        }
    }
```

### Business Logic (내부 파일 저장소 · SMS 생략 — libs/integration, 사용자 결정 2026-11-15)

같은 포트(StorageGatewayInterface — integration.interface.ts) 뒤의 두 번째 어댑터 — 서비스 · 업로드 주소 API · 프론트 업로드 방식(presigned PUT + 같은 Content-Type)은 그대로다. 형제 S3 어댑터(s3-storage.gateway.ts)의 책임 분리를 따른다: 주소 발급 · 확인 · 삭제의 저장소 실패는 503 `STORAGE_UNAVAILABLE_MESSAGE`, 공개 주소 기준이 비면 500 `STORAGE_PUBLIC_URL_MISSING_MESSAGE`, 로그는 어댑터만. 서명 비밀값은 세 앱(gateway · user-service · admin-service)에 이미 있는 `INTERNAL_API_TOKEN`.

```ts
// libs/integration/src/storage/local-storage.util.ts — 새 파일 전체
import {createHmac, timingSafeEqual} from 'node:crypto';
import {isAbsolute, resolve, sep} from 'node:path';
import {LOCAL_FILE_STORAGE_DIR_DEFAULT} from '../integration.constants.js';

/** 서명할 내부 파일 저장소 요청 — 업로드(PUT, Content-Type 포함) · 열람(GET, Content-Type 빈 값) */
export interface LocalFileRequest {
    method: 'PUT' | 'GET';
    key: string;
    content_type: string;
    /** 만료 — unix 초 */
    expires: number;
}

/**
 * 내부 파일 저장소 폴더 절대 경로 — FILE_STORAGE_DIR(없으면 storage/files)를 실행 위치 기준으로. 게이트웨이 · user-service · admin-service 가 같은 폴더를 봐야 한다.
 *
 * @param env 환경변수
 * @returns 절대 경로
 */
export function localFileStorageDir(env: NodeJS.ProcessEnv = process.env): string {
    return resolve(env.FILE_STORAGE_DIR || LOCAL_FILE_STORAGE_DIR_DEFAULT);
}

/**
 * 업로드 · 열람 주소 서명 — HMAC-SHA256(비밀값, 용도 · 메서드 · 키 · Content-Type · 만료). 업로드는 Content-Type 이 들어가 다른 형식으로는 올릴 수 없다(S3 presigned 와 같다).
 *
 * @param secret 비밀값(INTERNAL_API_TOKEN)
 * @param request 서명할 요청
 * @returns hex 서명
 */
export function signLocalFileRequest(secret: string, request: LocalFileRequest): string {
    return createHmac('sha256', secret).update(['roomless-local-file', request.method, request.key, request.content_type, String(request.expires)].join('\n')).digest('hex');
}

/**
 * 받은 서명이 맞고 아직 만료 전인지 — 시간차 안전 비교. 비밀값 · 키가 비었거나 만료가 정수가 아니면 false.
 *
 * @param secret 비밀값(INTERNAL_API_TOKEN)
 * @param request 받은 요청(메서드 · 키 · Content-Type · 만료)
 * @param signature 받은 hex 서명
 * @param now 지금 — unix 초
 * @returns 맞으면 true
 */
export function isValidLocalFileSignature(secret: string, request: LocalFileRequest, signature: string, now: number): boolean {
    if (!secret || !request.key || !Number.isInteger(request.expires) || request.expires < now) {
        return false;
    }
    const expected = Buffer.from(signLocalFileRequest(secret, request), 'hex');
    const received = Buffer.from(signature, 'hex');
    return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * 저장 키 → 폴더 안 파일 경로. 폴더 밖으로 나가는 키(`..` · 절대 경로 · 역슬래시 · NUL)는 null.
 *
 * @param root 폴더 절대 경로
 * @param key 저장 키
 * @returns 파일 절대 경로 또는 null
 */
export function resolveLocalFilePath(root: string, key: string): string | null {
    if (!key || isAbsolute(key) || key.includes('\\') || key.includes('\0')) {
        return null;
    }
    const path = resolve(root, key);
    return path.startsWith(root + sep) ? path : null;
}
```

```ts
// libs/integration/src/storage/local-storage.gateway.ts — 새 파일 전체
import {rm, stat} from 'node:fs/promises';
import {Injectable, InternalServerErrorException, Logger, OnApplicationBootstrap, ServiceUnavailableException} from '@nestjs/common';
import {dayjs} from '@app/common/utils/dayjs.js';
import {LOCAL_FILE_ROUTE, STORAGE_DOWNLOAD_URL_TTL_SECONDS, STORAGE_PUBLIC_URL_MISSING_MESSAGE, STORAGE_UNAVAILABLE_MESSAGE, STORAGE_UPLOAD_URL_TTL_SECONDS} from '../integration.constants.js';
import {gatewayPublicUrl, isSampleFileKey} from '../integration.util.js';
import type {StorageDownloadResult, StorageGatewayInterface, StorageUploadInput, StorageUploadResult} from '../interfaces/integration.interface.js';
import {localFileStorageDir, resolveLocalFilePath, signLocalFileRequest} from './local-storage.util.js';
import type {LocalFileRequest} from './local-storage.util.js';

/**
 * 파일 저장소 어댑터 — 내부 파일 저장소(AWS_S3_BUCKET 이 비었을 때 — 사용자 결정 2026-11-15). 실제로 저장 · 제공한다(가짜 저장소가 아니다).
 * 파일은 FILE_STORAGE_DIR(기본 storage/files — Docker 는 공용 볼륨 roomless-files)에 있고, 받기 · 내주기는 게이트웨이 /files(modules/local-file), 확인 · 삭제는 이 어댑터가 같은 폴더에서 한다.
 * 업로드 · 열람 주소는 INTERNAL_API_TOKEN 으로 서명한다(S3 presigned 와 같은 쓰임 — 10분, 업로드는 Content-Type 까지). 키 · DB 행 모양은 S3 와 같다.
 * 세팅: docs/guides/aws-setup.md "AWS 없이 돌리기"
 */
@Injectable()
export class LocalStorageGateway implements StorageGatewayInterface, OnApplicationBootstrap {
    private readonly logger = new Logger(LocalStorageGateway.name);
    private readonly root = localFileStorageDir();

    /**
     * 내부 파일 저장소를 쓴다고 부팅 때 한 번 알리고, GATEWAY_PUBLIC_URL 이 비어 있으면 경고한다. 부팅은 막지 않고 파일 주소 요청만 실패한다.
     */
    onApplicationBootstrap(): void {
        this.logger.log(`AWS_S3_BUCKET 이 비어 있어 내부 파일 저장소를 씁니다 — ${this.root} (게이트웨이 ${LOCAL_FILE_ROUTE})`);
        if (!gatewayPublicUrl()) {
            this.logger.warn('GATEWAY_PUBLIC_URL 이 비어 있어 파일 업로드 · 열람 · 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md');
        }
    }

    /**
     * 키 하나에 쓸 업로드 주소 — 게이트웨이 `/files/upload?key&expires&signature`(PUT, 같은 Content-Type 헤더).
     *
     * @param input 저장 키 · MIME 타입
     * @returns 업로드 주소 · 만료 시각
     * @throws ServiceUnavailableException GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 이 비어 주소를 만들지 못할 때
     */
    async createUploadUrl(input: StorageUploadInput): Promise<StorageUploadResult> {
        const expiresAt = dayjs().add(STORAGE_UPLOAD_URL_TTL_SECONDS, 'second');
        const upload_url = buildSignedUrl(this.logger, 'upload', {method: 'PUT', key: input.key, content_type: input.content_type, expires: expiresAt.unix()});
        return {upload_url, expires_at: expiresAt.toDate()};
    }

    /**
     * 폴더에 그 키의 파일이 있는지 — 폴더 밖 키는 false.
     *
     * @param key 저장 키
     * @returns 있으면 true
     * @throws ServiceUnavailableException 없음이 아닌 파일 시스템 오류
     */
    async exists(key: string): Promise<boolean> {
        const path = resolveLocalFilePath(this.root, key);
        if (!path) {
            return false;
        }
        try {
            return (await stat(path)).isFile();
        } catch (error) {
            if (isMissing(error)) {
                return false;
            }
            throw toUnavailable(this.logger, '파일 확인', error);
        }
    }

    /**
     * 공개 주소 — GATEWAY_PUBLIC_URL + `/files/<키>`. 샘플 키는 `/sample/…`(게이트웨이 정적 경로).
     *
     * @param key 저장 키
     * @returns 공개 주소
     * @throws InternalServerErrorException GATEWAY_PUBLIC_URL 이 비어 있을 때
     */
    getPublicUrl(key: string): string {
        const base = gatewayPublicUrl();
        if (!base) {
            this.logger.error('GATEWAY_PUBLIC_URL 이 비어 있어 파일 공개 주소를 만들 수 없습니다 — docs/guides/aws-setup.md');
            throw new InternalServerErrorException({message: STORAGE_PUBLIC_URL_MISSING_MESSAGE});
        }
        return isSampleFileKey(key) ? `${base}/${key}` : `${base}${LOCAL_FILE_ROUTE}/${key}`;
    }

    /**
     * 비공개 파일 열람 주소 — 게이트웨이 `/files/download?key&expires&signature`(10분).
     *
     * @param key 저장 키
     * @returns 열람 주소 · 만료 시각
     * @throws ServiceUnavailableException GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 이 비어 주소를 만들지 못할 때
     */
    async createDownloadUrl(key: string): Promise<StorageDownloadResult> {
        const expiresAt = dayjs().add(STORAGE_DOWNLOAD_URL_TTL_SECONDS, 'second');
        const download_url = buildSignedUrl(this.logger, 'download', {method: 'GET', key, content_type: '', expires: expiresAt.unix()});
        return {download_url, expires_at: expiresAt.toDate()};
    }

    /**
     * 파일을 지운다 — 없어도 성공. 샘플 키는 저장소(게이트웨이 assets)에 든 파일이라 지우지 않는다(행 소프트 삭제만).
     *
     * @param key 저장 키
     * @throws ServiceUnavailableException 파일 시스템 오류
     */
    async remove(key: string): Promise<void> {
        if (isSampleFileKey(key)) {
            return;
        }
        const path = resolveLocalFilePath(this.root, key);
        if (!path) {
            return;
        }
        try {
            await rm(path, {force: true});
        } catch (error) {
            throw toUnavailable(this.logger, '파일 삭제', error);
        }
    }
}

/**
 * 게이트웨이 `/files/<action>` 서명 주소를 만든다.
 *
 * @param logger 어댑터 로거
 * @param action upload · download
 * @param request 서명할 요청
 * @returns 주소
 * @throws ServiceUnavailableException GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 이 비어 있을 때
 */
function buildSignedUrl(logger: Logger, action: 'upload' | 'download', request: LocalFileRequest): string {
    const base = gatewayPublicUrl();
    const secret = process.env.INTERNAL_API_TOKEN ?? '';
    if (!base || !secret) {
        logger.error(`GATEWAY_PUBLIC_URL · INTERNAL_API_TOKEN 중 비어 있는 값이 있어 ${action === 'upload' ? '업로드' : '열람'} 주소를 만들 수 없습니다 — docs/guides/aws-setup.md`);
        throw new ServiceUnavailableException({message: STORAGE_UNAVAILABLE_MESSAGE});
    }
    const query = new URLSearchParams({key: request.key, expires: String(request.expires), signature: signLocalFileRequest(secret, request)});
    return `${base}${LOCAL_FILE_ROUTE}/${action}?${query.toString()}`;
}

/**
 * 파일이 없다는 오류인지(ENOENT · ENOTDIR).
 *
 * @param error 파일 시스템 오류
 * @returns 없음이면 true
 */
function isMissing(error: unknown): boolean {
    const code = (error as {code?: string})?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * 파일 시스템 오류를 로그로 남기고 503 으로 바꾼다.
 *
 * @param logger 어댑터 로거
 * @param action 실패한 작업
 * @param error 오류
 * @returns 던질 예외
 */
function toUnavailable(logger: Logger, action: string, error: unknown): ServiceUnavailableException {
    logger.error(`내부 파일 저장소 ${action} 실패: ${(error as Error)?.message ?? error}`);
    return new ServiceUnavailableException({message: STORAGE_UNAVAILABLE_MESSAGE});
}
```

```ts
// libs/integration/src/storage/storage.module.ts — 새 내용 전체
import {Global, Module} from '@nestjs/common';
import {STORAGE_GATEWAY} from '../integration.symbols.js';
import {isS3StorageConfigured} from '../integration.util.js';
import type {StorageGatewayInterface} from '../interfaces/integration.interface.js';
import {LocalStorageGateway} from './local-storage.gateway.js';
import {S3StorageGateway} from './s3-storage.gateway.js';

/**
 * 파일 저장소 포트(STORAGE_GATEWAY) — AWS_S3_BUCKET 이 있으면 Amazon S3, 비면 내부 파일 저장소(게이트웨이 /files — 사용자 결정 2026-11-15).
 * 파일을 다루는 앱의 루트 모듈에서 import 한다(전역 — 도메인 모듈은 import 없이 `@Inject(STORAGE_GATEWAY)` 로 주입받는다).
 */
@Global()
@Module({
    providers: [{provide: STORAGE_GATEWAY, useFactory: (): StorageGatewayInterface => (isS3StorageConfigured() ? new S3StorageGateway() : new LocalStorageGateway())}],
    exports: [STORAGE_GATEWAY],
})
export class StorageModule {}
```
(팩토리로 만든 인스턴스도 Nest 가 `onApplicationBootstrap` 을 부른다 — hooks/on-app-bootstrap.hook.js 는 provider 종류와 무관하게 인스턴스를 본다.)

```ts
// libs/integration/src/sms/sns-sms.sender.ts — 변경 부분
import {isAwsKeyConfigured, toE164KrPhone} from '../integration.util.js';

/**
 * SMS 발송 어댑터 — Amazon SNS `Publish`.
 * 리전은 AWS_REGION, 자격증명은 AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY.
 * 두 키가 비어 있으면 보내지 않고 받는 번호 · 본문을 경고 로그로 남긴 뒤 성공으로 끝난다(AWS 미설정 개발 모드 — 사용자 결정 2026-11-15, 인증번호 · 임시 비밀번호는 로그에서 본다).
 * 한국은 AWS 에 전용 발신번호가 없어 국제 경로로 나간다(수신 화면 국제발신, 한글 70자 단위 과금).
 * AWS 세팅: docs/guides/aws-setup.md
 */

    /**
     * AWS 키가 비어 있으면 SMS 를 로그로만 남긴다고, 키는 있는데 AWS_REGION 이 비어 있으면 발송이 실패한다고 부팅 때 한 번 알린다.
     */
    onApplicationBootstrap(): void {
        if (!isAwsKeyConfigured()) {
            this.logger.warn('AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY 가 비어 있어 SMS 를 보내지 않고 받는 번호 · 본문을 로그에 남깁니다 — docs/guides/aws-setup.md');
            return;
        }
        if (!process.env.AWS_REGION) {
            this.logger.warn('AWS_REGION 이 비어 있어 SMS 를 보낼 수 없습니다 — docs/guides/aws-setup.md');
        }
    }

    /**
     * SMS 1통을 SNS 로 보낸다. AWS 키가 비어 있으면 보내지 않고 로그만 남긴다(성공).
     *
     * @param message 받는 번호 · 본문
     * @throws ServiceUnavailableException AWS 가 접수하지 못했을 때
     */
    async send(message: SmsMessage): Promise<void> {
        if (!isAwsKeyConfigured()) {
            this.logger.warn(`SMS 생략(AWS 키 미설정) — ${message.to}: ${message.text}`);
            return;
        }
        try {
            // … 기존 PublishCommand 그대로 …
```

```ts
// libs/integration/src/interfaces/integration.interface.ts — 주석만
/**
 * SMS 발송 포트 — 서비스의 모든 발송이 이 포트 하나로 나간다(이메일 · 알림톡 · 푸시 없음).
 * 휴대폰 인증 · 아이디 찾기 · 비밀번호 초기화 · 업체 계정 안내 · 예약 변경 안내 · 입장 QR 링크.
 * AWS 키가 비어 있으면 어댑터가 보내지 않고 로그만 남긴다(성공 — 개발 모드).
 */

/**
 * 파일 저장소 포트 — 공개 파일(업체 · 객실 그룹 사진 — 공개 주소)과 비공개 파일(사업자등록증 — private/, 서명된 열람 주소).
 * 어댑터는 S3(AWS_S3_BUCKET 이 있을 때) 또는 내부 파일 저장소(게이트웨이 /files). 어느 쪽이든 클라이언트가 createUploadUrl 의 주소로 직접 올리고, 등록 명령에는 키만 보낸다.
 */
```
`sms.module.ts` 주석에 "AWS 키가 비면 보내지 않고 로그" 한 줄을 더한다.

### Entry Point (게이트웨이 내부 파일 저장소 경로 — modules/local-file)

문 소켓과 같은 방식(HttpAdapterHost — door-socket.server.ts:60-70)의 인프라 모듈. 공개 API(`api/v1/…` · Swagger)가 아니라 S3 자리를 대신하는 파일 경로다. `onModuleInit` 에서 express 앱에 `app.use('/files', …)` — Nest 초기화 순서(nest-application.js init: registerRouter → callInitHook → registerRouterHooks)상 Nest 라우트 뒤 · 404 처리 앞이다. CORS(main.ts enableCors — PUT 허용)와 API 로그 미들웨어(forRoutes('*'))는 그대로 걸린다. 본문 파서는 JSON · urlencoded 만이라 이미지 본문은 스트림 그대로 온다.

```ts
// apps/gateway/src/modules/local-file/local-file.util.ts — 새 파일 전체
import {Transform} from 'node:stream';
import type {Response} from 'express';
import {PRIVATE_FILE_KEY_PREFIX} from '@app/integration/integration.constants.js';

/** 업로드 한도를 넘었을 때 스트림 오류 코드 */
export const LOCAL_FILE_TOO_LARGE_CODE = 'LOCAL_FILE_TOO_LARGE';

/**
 * 받은 바이트가 한도를 넘으면 오류를 내는 통과 스트림 — Content-Length 가 없거나 틀려도 디스크를 지킨다.
 *
 * @param max 한도(바이트)
 * @returns Transform 스트림
 */
export function createByteLimit(max: number): Transform {
    let received = 0;
    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length;
            if (received > max) {
                callback(Object.assign(new Error('파일이 한도를 넘었습니다.'), {code: LOCAL_FILE_TOO_LARGE_CODE}));
                return;
            }
            callback(null, chunk);
        },
    });
}

/**
 * 한도 초과 오류인지.
 *
 * @param error 스트림 오류
 * @returns 한도 초과면 true
 */
export function isTooLarge(error: unknown): boolean {
    return (error as {code?: string})?.code === LOCAL_FILE_TOO_LARGE_CODE;
}

/**
 * 쿼리 값 하나(문자열이 아니면 빈 문자열).
 *
 * @param value req.query 의 값
 * @returns 문자열
 */
export function readQueryValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

/**
 * 공개 경로(`/files/<키>`)의 키 — 앞의 / 를 떼고 디코드한다. 잘못된 인코딩 · 비공개 키(private/)는 빈 문자열(공개로 내주지 않는다).
 *
 * @param path req.path(`/files` 뒤)
 * @returns 저장 키 또는 빈 문자열
 */
export function readPublicKey(path: string): string {
    let key: string;
    try {
        key = decodeURIComponent(path.replace(/^\/+/, ''));
    } catch {
        return '';
    }
    return key.startsWith(PRIVATE_FILE_KEY_PREFIX) ? '' : key;
}

/**
 * 공통 실패 본문으로 답한다 — `{message, validation_errors: null}`.
 *
 * @param res 응답
 * @param status 상태 코드
 * @param message 한국어 메시지
 */
export function sendFail(res: Response, status: number, message: string): void {
    if (!res.headersSent) {
        res.status(status).json({message, validation_errors: null});
    }
}
```

```ts
// apps/gateway/src/modules/local-file/local-file.server.ts — 새 파일 전체
import {randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir, rename, rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {HttpAdapterHost} from '@nestjs/core';
import type {Express, NextFunction, Request, Response} from 'express';
import {dayjs} from '@app/common/utils/dayjs.js';
import {
    LOCAL_FILE_MAX_BYTES,
    LOCAL_FILE_NOT_FOUND_MESSAGE,
    LOCAL_FILE_ROUTE,
    LOCAL_FILE_SIGNATURE_INVALID_MESSAGE,
    LOCAL_FILE_TOO_LARGE_MESSAGE,
    STORAGE_UNAVAILABLE_MESSAGE,
} from '@app/integration/integration.constants.js';
import {isS3StorageConfigured} from '@app/integration/integration.util.js';
import {isValidLocalFileSignature, localFileStorageDir, resolveLocalFilePath} from '@app/integration/storage/local-storage.util.js';
import {createByteLimit, isTooLarge, readPublicKey, readQueryValue, sendFail} from './local-file.util.js';

/**
 * 내부 파일 저장소 경로(/files) — AWS_S3_BUCKET 이 비었을 때 게이트웨이가 S3 자리를 대신한다(사용자 결정 2026-11-15). S3 면 경로를 열지 않는다(404).
 * - `PUT /files/upload?key&expires&signature` — 서명(INTERNAL_API_TOKEN · Content-Type 포함) · 만료 확인 → 임시 파일에 받아(10MB 까지) 이름 바꾸기 → 200
 * - `GET /files/download?key&expires&signature` — 비공개 파일(private/) 열람, 캐시 안 함
 * - `GET /files/<키>` — 공개 파일(업체 · 그룹 사진), private/ 키는 내주지 않는다(다음 처리 → 404), 하루 캐시
 * 폴더는 FILE_STORAGE_DIR(user-service · admin-service 의 LocalStorageGateway 와 같은 폴더 — Docker 공용 볼륨). 공개 API 가 아니라 Swagger 에 없다.
 */
@Injectable()
export class LocalFileServer implements OnModuleInit {
    private readonly logger = new Logger(LocalFileServer.name);
    private readonly root = localFileStorageDir();

    /**
     * @param httpAdapterHost Nest HTTP 어댑터(express 앱)
     */
    constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

    /**
     * S3 를 쓰지 않으면 express 앱에 `/files` 경로를 붙인다(Nest 라우트 뒤 · 404 처리 앞).
     */
    onModuleInit(): void {
        if (isS3StorageConfigured()) {
            return;
        }
        const app = this.httpAdapterHost.httpAdapter.getInstance<Express>();
        app.use(LOCAL_FILE_ROUTE, (req: Request, res: Response, next: NextFunction) => void this.handle(req, res, next));
        this.logger.log(`내부 파일 저장소 경로 ${LOCAL_FILE_ROUTE} — ${this.root}`);
    }

    /**
     * 메서드 · 경로로 나눈다 — 나머지는 다음 처리(404).
     *
     * @param req 요청
     * @param res 응답
     * @param next 다음 처리
     */
    private async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (req.method === 'PUT' && req.path === '/upload') {
            await this.upload(req, res);
            return;
        }
        if ((req.method === 'GET' || req.method === 'HEAD') && req.path === '/download') {
            this.download(req, res);
            return;
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
            this.servePublic(req, res, next);
            return;
        }
        next();
    }

    /**
     * 업로드 받기 — 서명 · 만료 · Content-Type 확인 → 한도 확인 → 임시 파일 → 이름 바꾸기.
     *
     * @param req 요청(본문 = 파일)
     * @param res 응답
     */
    private async upload(req: Request, res: Response): Promise<void> {
        const key = readQueryValue(req.query.key);
        const path = resolveLocalFilePath(this.root, key);
        const request = {method: 'PUT' as const, key, content_type: req.headers['content-type'] ?? '', expires: Number(readQueryValue(req.query.expires))};
        if (!path || !isValidLocalFileSignature(process.env.INTERNAL_API_TOKEN ?? '', request, readQueryValue(req.query.signature), dayjs().unix())) {
            sendFail(res, 403, LOCAL_FILE_SIGNATURE_INVALID_MESSAGE);
            return;
        }
        if (Number(req.headers['content-length'] ?? 0) > LOCAL_FILE_MAX_BYTES) {
            sendFail(res, 413, LOCAL_FILE_TOO_LARGE_MESSAGE);
            return;
        }
        const temp = `${path}.${randomUUID()}.uploading`;
        try {
            await mkdir(dirname(path), {recursive: true});
            await pipeline(req, createByteLimit(LOCAL_FILE_MAX_BYTES), createWriteStream(temp));
            await rename(temp, path);
            res.status(200).end();
        } catch (error) {
            await rm(temp, {force: true});
            if (isTooLarge(error)) {
                sendFail(res, 413, LOCAL_FILE_TOO_LARGE_MESSAGE);
                return;
            }
            this.logger.error(`내부 파일 저장 실패: ${(error as Error)?.message ?? error}`);
            sendFail(res, 503, STORAGE_UNAVAILABLE_MESSAGE);
        }
    }

    /**
     * 비공개 파일 열람 — 서명 · 만료 확인 후 파일, 캐시 안 함.
     *
     * @param req 요청
     * @param res 응답
     */
    private download(req: Request, res: Response): void {
        const key = readQueryValue(req.query.key);
        const path = resolveLocalFilePath(this.root, key);
        const request = {method: 'GET' as const, key, content_type: '', expires: Number(readQueryValue(req.query.expires))};
        if (!path || !isValidLocalFileSignature(process.env.INTERNAL_API_TOKEN ?? '', request, readQueryValue(req.query.signature), dayjs().unix())) {
            sendFail(res, 403, LOCAL_FILE_SIGNATURE_INVALID_MESSAGE);
            return;
        }
        res.sendFile(path, {headers: {'Cache-Control': 'private, no-store'}, dotfiles: 'deny'}, (error) => {
            if (error) {
                sendFail(res, 404, LOCAL_FILE_NOT_FOUND_MESSAGE);
            }
        });
    }

    /**
     * 공개 파일 — private/ 가 아닌 키만, 하루 캐시. 없거나 내줄 수 없으면 다음 처리(Nest 404).
     *
     * @param req 요청
     * @param res 응답
     * @param next 다음 처리
     */
    private servePublic(req: Request, res: Response, next: NextFunction): void {
        const key = readPublicKey(req.path);
        const path = key ? resolveLocalFilePath(this.root, key) : null;
        if (!path) {
            next();
            return;
        }
        res.sendFile(path, {maxAge: '1d', dotfiles: 'deny'}, (error) => {
            if (error && !res.headersSent) {
                next();
            }
        });
    }
}
```

```ts
// apps/gateway/src/modules/local-file/local-file.module.ts — 새 파일 전체
import {Module} from '@nestjs/common';
import {LocalFileServer} from './local-file.server.js';

/**
 * 내부 파일 저장소 경로(/files) — AWS_S3_BUCKET 이 비었을 때 게이트웨이가 업로드를 받고 파일을 내준다(사용자 결정 2026-11-15). S3 면 경로를 열지 않는다.
 */
@Module({providers: [LocalFileServer]})
export class LocalFileModule {}
```

```ts
// apps/gateway/src/gateway.module.ts — 변경 부분
import {DoorSocketModule} from './modules/door-socket/door-socket.module.js';
import {LocalFileModule} from './modules/local-file/local-file.module.js';
//  * - LocalFileModule: 내부 파일 저장소 경로(/files — AWS_S3_BUCKET 이 빌 때만) — 서명된 업로드 받기 · 비공개 열람 · 공개 파일
    imports: [
        // … 기존 그대로 …
        DoorSocketModule,
        LocalFileModule,
        ApiLogModule,
```

### Entry Point (게이트웨이 정적 경로)

부트스트랩 설정 함수는 `src/config/`(형제: cors.config.ts `buildCorsOptions` · trust-proxy.config.ts `parseTrustProxy`). 폴더는 `import.meta.url` 기준 — 빌드 결과 `dist/apps/gateway/apps/gateway/src/config/` 옆 `../assets/sample/` 에 nest-cli `assets` 가 PNG 를 복사한다(Nest CLI 는 tsconfig rootDir(`../..`) 기준으로 경로를 남긴다 — assets-manager.js:45). `useStaticAssets` 는 바로 express 미들웨어로 등록돼 `init` 때 붙는 API 로그 미들웨어보다 앞선다(파일 응답은 API 로그에 쌓이지 않는다, 없는 파일은 다음으로 넘어가 Nest 404).

```ts
// apps/gateway/src/config/sample-image.config.ts — 새 파일 전체
import {fileURLToPath} from 'node:url';
import type {ServeStaticOptions} from '@nestjs/platform-express/interfaces/serve-static-options.interface.js';
import {SAMPLE_FILE_KEY_PREFIX} from '@app/integration/integration.constants.js';

/**
 * 샘플 사진 폴더 — 이 파일(config/) 옆의 ../assets/sample/. nest-cli assets 가 dist 의 같은 자리로 복사한다(nest start · dist 실행 모두 같은 경로).
 *
 * @returns 폴더 절대 경로
 */
export function sampleImageDir(): string {
    return fileURLToPath(new URL('../assets/sample/', import.meta.url));
}

/**
 * 샘플 사진 정적 경로 옵션 — 저장 키 `sample/<파일>` 이 그대로 `/sample/<파일>` 주소가 된다(GATEWAY_PUBLIC_URL 뒤). 폴더 목록 · index 없음, 하루 캐시, 없는 파일은 다음 처리로(404).
 *
 * @returns useStaticAssets 옵션
 */
export function buildSampleImageStaticOptions(): ServeStaticOptions {
    return {prefix: `/${SAMPLE_FILE_KEY_PREFIX}`, index: false, maxAge: '1d', fallthrough: true};
}
```

```ts
// apps/gateway/src/main.ts — 변경 부분
import {buildCorsOptions} from './config/cors.config.js';
import {buildSampleImageStaticOptions, sampleImageDir} from './config/sample-image.config.js';
import {parseTrustProxy} from './config/trust-proxy.config.js';

/**
 * 게이트웨이 부트스트랩 — 클라이언트(Next.js)가 붙는 유일한 서버(Docker 에서는 nginx 로드밸런서 뒤에 여러 대).
 * trust proxy(TRUST_PROXY — 실제 클라이언트 IP) → 전역 예외 필터 → 전역 ValidationPipe → CORS(CORS_ORIGINS 의 프론트 주소만) → 샘플 사진 정적 경로(/sample/) → Swagger → 종료 훅 → listen.
 */
    app.enableCors(buildCorsOptions());
    app.useStaticAssets(sampleImageDir(), buildSampleImageStaticOptions());
```

```json
// nest-cli.json — gateway 프로젝트
"gateway": {
  "type": "application",
  "root": "apps/gateway",
  "entryFile": "apps/gateway/src/main",
  "sourceRoot": "apps/gateway/src",
  "compilerOptions": {"tsConfigPath": "apps/gateway/tsconfig.app.json", "assets": [{"include": "assets/sample/*.png", "watchAssets": false}]}
}
```

### PNG 생성기 (scripts)

외부 패키지 없이 node:zlib 로 PNG 를 만든다(형제 스크립트 db-schema.mjs 와 같이 `import.meta.url` 기준 경로). 업체 외관(낮 · 밤) · 객실(침대 쪽 · TV · 책상 쪽) 단순 그림 + 왼쪽 아래 라벨. 시험 실행: 70개 · 404KB(960×640, 줄마다 None · Sub · Up 필터 선택 + deflate 9).

```js
// scripts/sample-images.mjs — 새 파일 전체
#!/usr/bin/env node
// 샘플 이미지(PNG) 생성기 — 테스트 데이터 시드(SEED_SAMPLE_DATA=1)의 업체 사진 · 객실 그룹 사진을 그린다.
// 외부 패키지 없이 node:zlib 로 PNG(RGB 8bit)를 만든다. 결과는 apps/gateway/src/assets/sample/ 에 저장하고 커밋한다 — 게이트웨이가 /sample/<파일> 로 내준다.
// 업체 수 · 업체별 객실 그룹 수(GROUP_COUNTS)는 libs/database/src/seeder/sample-seed.data.ts 의 SAMPLE_STORES 와 같아야 한다.
//   npm run sample:images            (기본 폴더에 다시 그린다 — 폴더의 기존 PNG 는 지운다)
//   node scripts/sample-images.mjs <폴더>   (다른 폴더에 그려 본다)
import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';

const OUT_DIR = process.argv[2] ?? fileURLToPath(new URL('../apps/gateway/src/assets/sample/', import.meta.url));
const WIDTH = 960;
const HEIGHT = 640;
/** 업체별 객실 그룹 수 — SAMPLE_STORES 순서(업체 01 ~ 10) */
const GROUP_COUNTS = [3, 2, 3, 2, 2, 3, 2, 3, 2, 3];
/** 사진 수 — 업체 · 그룹마다 */
const PHOTOS = 2;
const WHITE = [255, 255, 255];

/** 5×7 비트맵 글꼴 — 라벨에 쓰는 글자만 */
const FONT = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/**
 * 빈 그림판.
 *
 * @param {number} width 가로
 * @param {number} height 세로
 * @returns {{width: number, height: number, data: Uint8Array}} RGB 픽셀
 */
function createCanvas(width, height) {
    return {width, height, data: new Uint8Array(width * height * 3)};
}

/**
 * HSL → RGB.
 *
 * @param {number} h 색상(0 ~ 360)
 * @param {number} s 채도(0 ~ 100)
 * @param {number} l 명도(0 ~ 100)
 * @returns {number[]} [r, g, b]
 */
function hsl(h, s, l) {
    const hue = (((h % 360) + 360) % 360) / 360;
    const sat = s / 100;
    const light = l / 100;
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    const channel = (t) => {
        const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
        if (x < 1 / 6) return p + (q - p) * 6 * x;
        if (x < 1 / 2) return q;
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
        return p;
    };
    return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)].map((v) => Math.round(v * 255));
}

/**
 * 같은 seed 면 같은 수열을 내는 난수(mulberry32).
 *
 * @param {number} seed 시작 값
 * @returns {() => number} 0 이상 1 미만
 */
function random(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 사각형 채우기(alpha 가 1 보다 작으면 섞는다).
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} x 왼쪽
 * @param {number} y 위
 * @param {number} w 가로
 * @param {number} h 세로
 * @param {number[]} color [r, g, b]
 * @param {number} [alpha] 불투명도(0 ~ 1)
 */
function fillRect(canvas, x, y, w, h, color, alpha = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(canvas.width, Math.round(x + w));
    const y1 = Math.min(canvas.height, Math.round(y + h));
    for (let row = y0; row < y1; row += 1) {
        for (let col = x0; col < x1; col += 1) {
            const at = (row * canvas.width + col) * 3;
            for (let c = 0; c < 3; c += 1) {
                canvas.data[at + c] = alpha >= 1 ? color[c] : Math.round(canvas.data[at + c] * (1 - alpha) + color[c] * alpha);
            }
        }
    }
}

/**
 * 위에서 아래로 두 색을 잇는 사각형.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} x 왼쪽
 * @param {number} y 위
 * @param {number} w 가로
 * @param {number} h 세로
 * @param {number[]} top 위 색
 * @param {number[]} bottom 아래 색
 */
function fillGradient(canvas, x, y, w, h, top, bottom) {
    const rows = Math.max(1, Math.round(h));
    for (let i = 0; i < rows; i += 1) {
        const t = rows === 1 ? 0 : i / (rows - 1);
        fillRect(canvas, x, y + i, w, 1, [0, 1, 2].map((c) => Math.round(top[c] + (bottom[c] - top[c]) * t)));
    }
}

/**
 * 원 채우기.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} cx 중심 x
 * @param {number} cy 중심 y
 * @param {number} r 반지름
 * @param {number[]} color [r, g, b]
 * @param {number} [alpha] 불투명도
 */
function fillCircle(canvas, cx, cy, r, color, alpha = 1) {
    for (let dy = -r; dy <= r; dy += 1) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        fillRect(canvas, cx - half, cy + dy, half * 2 + 1, 1, color, alpha);
    }
}

/**
 * 위 · 아래 너비가 다른 사다리꼴(가운데 정렬) — 스탠드 갓.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} cx 가운데 x
 * @param {number} y 위
 * @param {number} topWidth 위 너비
 * @param {number} bottomWidth 아래 너비
 * @param {number} h 높이
 * @param {number[]} color [r, g, b]
 */
function fillTrapezoid(canvas, cx, y, topWidth, bottomWidth, h, color) {
    for (let i = 0; i < h; i += 1) {
        const w = topWidth + ((bottomWidth - topWidth) * i) / Math.max(1, h - 1);
        fillRect(canvas, cx - w / 2, y + i, w, 1, color);
    }
}

/**
 * 글자 그리기(5×7 글꼴 × scale).
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {string} text 글자(FONT 에 있는 것만)
 * @param {number} x 왼쪽
 * @param {number} y 위
 * @param {number} scale 배율
 * @param {number[]} color [r, g, b]
 */
function drawText(canvas, text, x, y, scale, color) {
    [...text].forEach((char, index) => {
        const glyph = FONT[char] ?? FONT[' '];
        glyph.forEach((line, row) => {
            [...line].forEach((bit, col) => {
                if (bit === '1') fillRect(canvas, x + index * 6 * scale + col * scale, y + row * scale, scale, scale, color);
            });
        });
    });
}

/**
 * 글자 폭(픽셀).
 *
 * @param {string} text 글자
 * @param {number} scale 배율
 * @returns {number} 폭
 */
function textWidth(text, scale) {
    return text.length * 6 * scale - scale;
}

/**
 * 왼쪽 아래 라벨(어두운 상자 + 흰 글자) — 어느 업체 · 그룹 사진인지 보이게.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {string} text 라벨
 */
function drawLabel(canvas, text) {
    const scale = 4;
    const boxWidth = textWidth(text, scale) + 32;
    const boxHeight = 7 * scale + 24;
    fillRect(canvas, 24, canvas.height - 24 - boxHeight, boxWidth, boxHeight, [20, 24, 32], 0.6);
    drawText(canvas, text, 40, canvas.height - 24 - boxHeight + 12, scale, WHITE);
}

/**
 * 업체 외관(낮) — 하늘 · 뒤 건물 · 건물 · 창 · 간판 · 1층 유리.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 업체 색상
 * @param {() => number} rand 난수
 */
function drawStoreDay(canvas, hue, rand) {
    const ground = 500;
    fillGradient(canvas, 0, 0, WIDTH, ground, hsl(205, 70, 70), hsl(200, 60, 92));
    for (let i = 0; i < 9; i += 1) {
        const h = 140 + Math.floor(rand() * 160);
        fillRect(canvas, i * 115 - 20, ground - h, 100, h, hsl(215, 14, 80));
    }
    fillRect(canvas, 0, ground, WIDTH, HEIGHT - ground, hsl(30, 8, 64));
    fillRect(canvas, 0, ground, WIDTH, 8, hsl(30, 8, 48));
    const bx = 150;
    const bw = 660;
    const by = 70;
    fillRect(canvas, bx - 12, by - 16, bw + 24, 20, hsl(hue, 18, 62));
    fillRect(canvas, bx, by, bw, ground - by, hsl(hue, 28, 86));
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 6; col += 1) {
            const wx = bx + 40 + col * 100;
            const wy = by + 30 + row * 70;
            fillRect(canvas, wx - 4, wy - 4, 72, 54, hsl(hue, 15, 60));
            fillGradient(canvas, wx, wy, 64, 46, hsl(205, 45, 78), hsl(205, 35, 62));
        }
    }
    const sy = by + 240;
    fillRect(canvas, bx, sy, bw, 60, hsl(hue, 55, 36));
    drawText(canvas, 'ROOMLESS', bx + (bw - textWidth('ROOMLESS', 6)) / 2, sy + 9, 6, WHITE);
    fillRect(canvas, bx + 40, sy + 76, bw - 80, ground - sy - 76, hsl(hue, 15, 55));
    fillGradient(canvas, bx + 48, sy + 84, bw - 96, ground - sy - 84, hsl(200, 35, 72), hsl(200, 30, 52));
    fillRect(canvas, bx + bw / 2 - 50, sy + 84, 100, ground - sy - 84, hsl(200, 25, 40));
    fillRect(canvas, bx + bw / 2 - 2, sy + 84, 4, ground - sy - 84, hsl(hue, 15, 70));
    for (const px of [90, 870]) {
        fillRect(canvas, px - 30, ground - 40, 60, 40, hsl(25, 45, 45));
        fillCircle(canvas, px, ground - 80, 52, hsl(120, 35, 42));
        fillCircle(canvas, px - 18, ground - 100, 30, hsl(120, 38, 50));
    }
}

/**
 * 업체 외관(밤) — 어두운 하늘 · 불 켜진 창 · 밝은 간판 · 가로등.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 업체 색상
 * @param {() => number} rand 난수
 */
function drawStoreNight(canvas, hue, rand) {
    const ground = 500;
    fillGradient(canvas, 0, 0, WIDTH, ground, hsl(235, 45, 14), hsl(260, 35, 30));
    for (let i = 0; i < 40; i += 1) fillRect(canvas, Math.floor(rand() * WIDTH), Math.floor(rand() * 200), 3, 3, hsl(50, 30, 85));
    fillRect(canvas, 0, ground, WIDTH, HEIGHT - ground, hsl(230, 10, 22));
    fillRect(canvas, 0, ground, WIDTH, 8, hsl(230, 10, 32));
    const bx = 150;
    const bw = 660;
    const by = 70;
    fillRect(canvas, bx, by, bw, ground - by, hsl(hue, 14, 24));
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 6; col += 1) {
            const lit = rand() > 0.35;
            fillRect(canvas, bx + 40 + col * 100, by + 30 + row * 70, 64, 46, lit ? hsl(42, 90, 68) : hsl(225, 20, 16));
        }
    }
    const sy = by + 240;
    fillRect(canvas, bx - 6, sy - 6, bw + 12, 72, hsl(hue, 70, 55), 0.35);
    fillRect(canvas, bx, sy, bw, 60, hsl(hue, 70, 50));
    drawText(canvas, 'ROOMLESS', bx + (bw - textWidth('ROOMLESS', 6)) / 2, sy + 9, 6, WHITE);
    fillGradient(canvas, bx + 48, sy + 84, bw - 96, ground - sy - 84, hsl(40, 80, 72), hsl(35, 70, 55));
    fillRect(canvas, bx + bw / 2 - 2, sy + 84, 4, ground - sy - 84, hsl(hue, 15, 30));
    fillRect(canvas, 70, 240, 10, ground - 240, hsl(220, 8, 40));
    fillCircle(canvas, 75, 240, 46, hsl(45, 90, 70), 0.25);
    fillCircle(canvas, 75, 240, 16, hsl(48, 95, 82));
}

/**
 * 객실(침대 쪽) — 벽 · 마루 · 창 · 액자 · 침대 · 협탁 · 스탠드 · 러그.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 그룹 색상
 */
function drawRoomBed(canvas, hue) {
    const floor = 420;
    fillRect(canvas, 0, 0, WIDTH, floor, hsl(hue, 28, 88));
    fillRect(canvas, 0, floor - 14, WIDTH, 14, hsl(hue, 12, 96));
    fillRect(canvas, 0, floor, WIDTH, HEIGHT - floor, hsl(30, 38, 56));
    for (let y = floor + 36; y < HEIGHT; y += 36) fillRect(canvas, 0, y, WIDTH, 3, hsl(30, 36, 48));
    fillRect(canvas, 70, 80, 240, 220, WHITE);
    fillGradient(canvas, 82, 92, 216, 196, hsl(205, 70, 72), hsl(195, 60, 90));
    fillRect(canvas, 187, 92, 6, 196, WHITE);
    fillRect(canvas, 82, 187, 216, 6, WHITE);
    fillRect(canvas, 700, 110, 170, 120, hsl(hue, 10, 30));
    fillRect(canvas, 712, 122, 146, 96, hsl(hue + 40, 45, 70));
    fillCircle(canvas, 785, 170, 26, hsl(hue + 160, 45, 60));
    fillRect(canvas, 330, 220, 380, 160, hsl(hue, 30, 38));
    fillRect(canvas, 310, 340, 420, 70, hsl(40, 25, 96));
    fillRect(canvas, 360, 300, 130, 50, WHITE);
    fillRect(canvas, 550, 300, 130, 50, WHITE);
    fillRect(canvas, 310, 375, 420, 110, hsl(hue, 45, 60));
    fillRect(canvas, 310, 375, 420, 16, hsl(hue, 45, 70));
    fillRect(canvas, 270, 485, 500, 110, hsl(hue, 18, 76));
    fillRect(canvas, 750, 360, 100, 90, hsl(28, 35, 38));
    fillRect(canvas, 760, 395, 80, 4, hsl(28, 35, 28));
    fillRect(canvas, 796, 320, 8, 40, hsl(28, 20, 30));
    fillTrapezoid(canvas, 800, 270, 44, 76, 52, hsl(45, 70, 82));
}

/**
 * 객실(TV · 책상 쪽) — 벽 TV · 수납장 · 책상 · 모니터 · 의자 · 화분 · 러그.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 그룹 색상
 */
function drawRoomDesk(canvas, hue) {
    const floor = 430;
    fillRect(canvas, 0, 0, WIDTH, floor, hsl(hue + 20, 24, 84));
    fillRect(canvas, 0, floor - 14, WIDTH, 14, hsl(hue, 10, 95));
    fillRect(canvas, 0, floor, WIDTH, HEIGHT - floor, hsl(28, 30, 62));
    for (let y = floor + 36; y < HEIGHT; y += 36) fillRect(canvas, 0, y, WIDTH, 3, hsl(28, 28, 54));
    fillRect(canvas, 120, 140, 320, 185, hsl(220, 10, 12));
    fillGradient(canvas, 130, 150, 300, 165, hsl(hue + 180, 50, 45), hsl(hue + 200, 55, 25));
    fillRect(canvas, 100, 360, 360, 70, hsl(28, 32, 40));
    fillRect(canvas, 110, 372, 165, 46, hsl(28, 30, 46));
    fillRect(canvas, 285, 372, 165, 46, hsl(28, 30, 46));
    fillRect(canvas, 560, 320, 330, 22, hsl(28, 35, 42));
    fillRect(canvas, 575, 342, 14, 120, hsl(28, 30, 32));
    fillRect(canvas, 861, 342, 14, 120, hsl(28, 30, 32));
    fillRect(canvas, 650, 200, 170, 110, hsl(220, 10, 14));
    fillRect(canvas, 658, 208, 154, 94, hsl(hue + 180, 35, 55));
    fillRect(canvas, 728, 310, 14, 10, hsl(220, 10, 20));
    fillRect(canvas, 680, 360, 110, 120, hsl(hue, 35, 34));
    fillRect(canvas, 665, 470, 140, 22, hsl(hue, 35, 28));
    fillRect(canvas, 728, 492, 14, 60, hsl(220, 8, 30));
    fillRect(canvas, 485, 400, 56, 64, hsl(18, 55, 50));
    fillCircle(canvas, 513, 370, 38, hsl(125, 35, 40));
    fillCircle(canvas, 495, 345, 24, hsl(125, 40, 48));
    fillCircle(canvas, 535, 350, 22, hsl(125, 40, 46));
    fillRect(canvas, 90, 480, 400, 120, hsl(hue, 20, 72));
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

/**
 * CRC32(PNG 청크).
 *
 * @param {Buffer} buf 바이트
 * @returns {number} CRC
 */
function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/**
 * PNG 청크 하나(길이 · 종류 · 본문 · CRC).
 *
 * @param {string} type 청크 종류
 * @param {Buffer} body 본문
 * @returns {Buffer} 청크
 */
function chunk(type, body) {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(typed));
    return Buffer.concat([head, typed, tail]);
}

/**
 * 그림판 → PNG(RGB 8bit). 줄마다 None · Sub · Up 필터 중 바이트 합이 작은 것을 고른다.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @returns {Buffer} PNG 파일
 */
function encodePng(canvas) {
    const stride = canvas.width * 3;
    const raw = Buffer.alloc((stride + 1) * canvas.height);
    let previous = new Uint8Array(stride);
    for (let y = 0; y < canvas.height; y += 1) {
        const row = canvas.data.subarray(y * stride, (y + 1) * stride);
        const candidates = [0, 1, 2].map((type) => {
            const out = new Uint8Array(stride);
            for (let i = 0; i < stride; i += 1) {
                const left = i >= 3 ? row[i - 3] : 0;
                out[i] = type === 0 ? row[i] : type === 1 ? row[i] - left : row[i] - previous[i];
            }
            const cost = out.reduce((sum, v) => sum + (v < 128 ? v : 256 - v), 0);
            return {type, out, cost};
        });
        const best = candidates.reduce((a, b) => (b.cost < a.cost ? b : a));
        raw[y * (stride + 1)] = best.type;
        raw.set(best.out, y * (stride + 1) + 1);
        previous = row;
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(canvas.width, 0);
    header.writeUInt32BE(canvas.height, 4);
    header[8] = 8;
    header[9] = 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * 그림 하나를 파일로 쓴다.
 *
 * @param {string} name 파일 이름
 * @param {(canvas: {width: number, height: number, data: Uint8Array}) => void} draw 그리는 함수
 * @param {string} label 왼쪽 아래 라벨
 * @returns {number} 파일 크기(바이트)
 */
function writeImage(name, draw, label) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    draw(canvas);
    drawLabel(canvas, label);
    const png = encodePng(canvas);
    writeFileSync(join(OUT_DIR, name), png);
    return png.length;
}

mkdirSync(OUT_DIR, {recursive: true});
for (const name of readdirSync(OUT_DIR)) {
    if (name.endsWith('.png')) rmSync(join(OUT_DIR, name));
}
let count = 0;
let bytes = 0;
GROUP_COUNTS.forEach((groups, index) => {
    const nn = String(index + 1).padStart(2, '0');
    const hue = (index * 36 + 10) % 360;
    for (let photo = 1; photo <= PHOTOS; photo += 1) {
        const rand = random((index + 1) * 100 + photo);
        bytes += writeImage(`store-${nn}-${photo}.png`, (canvas) => (photo === 1 ? drawStoreDay(canvas, hue, rand) : drawStoreNight(canvas, hue, rand)), `STORE ${nn}`);
        count += 1;
    }
    for (let group = 1; group <= groups; group += 1) {
        const groupHue = (hue + group * 47) % 360;
        for (let photo = 1; photo <= PHOTOS; photo += 1) {
            bytes += writeImage(`room-${nn}-${group}-${photo}.png`, (canvas) => (photo === 1 ? drawRoomBed(canvas, groupHue) : drawRoomDesk(canvas, groupHue)), `ROOM ${nn}-${group}`);
            count += 1;
        }
    }
});
console.log(`[sample-images] ${count}개 · ${Math.round(bytes / 1024)}KB → ${OUT_DIR}`);
```

```json
// package.json — scripts 에 추가 (format 의 scripts/*.mjs 가 이미 포함)
"sample:images": "node scripts/sample-images.mjs",
```

### Docker (공용 볼륨 — 내부 파일 저장소)

게이트웨이(받기 · 내주기, 인스턴스 여러 대) · user-service · admin-service(확인 · 삭제)가 같은 폴더를 봐야 한다 → 공용 네트워크와 같은 방식(external — 따로 띄운 묶음끼리 공유)의 볼륨 `roomless-files`. compose 가 고정하는 서버 구성(컨테이너 안 경로)이라 `FILE_STORAGE_DIR` 은 compose 가 `/app/storage/files` 로 고정한다(.env 의 로컬 경로가 컨테이너로 새지 않게).

```js
// scripts/docker-network.mjs — 변경 부분
/**
 * Docker 공용 네트워크 · 볼륨 만들기 — postgres · rabbitmq · redis · user-service · admin-service · scheduler · gateway 를 각자 따로 띄워도 서로 이름으로 찾고,
 * 내부 파일 저장소 폴더(AWS_S3_BUCKET 이 빌 때)를 gateway · user-service · admin-service 가 같이 보게 한다.
 *
 * 실행: `npm run docker:network` (이미 있으면 건너뛴다 — 몇 번을 돌려도 같다)
 *
 * compose 파일 7개는 이 네트워크 · 볼륨을 `external: true` 로 쓴다. 한 묶음을 내려도(`down`) 지워지지 않아 다른 묶음이 계속 동작한다.
 */

/** 공용 볼륨 — 묶음끼리 같은 파일을 본다 */
const VOLUMES = [{name: 'roomless-files', purpose: '내부 파일 저장소(AWS_S3_BUCKET 이 빌 때) — gateway · user-service · admin-service 의 /app/storage/files'}];

/**
 * 볼륨을 확인하고 없으면 만든다.
 *
 * @param volume VOLUMES 항목
 * @returns 문제가 없으면 true
 */
function ensureVolume(volume) {
    if (docker(['volume', 'inspect', '--format', '{{.Name}}', volume.name]) !== null) {
        console.log(`· ${volume.name}: 이미 있음 — ${volume.purpose}`);
        return true;
    }
    if (docker(['volume', 'create', '--label', 'roomless.volume=shared', volume.name]) === null) {
        console.log(`✗ ${volume.name}: 만들지 못함 — Docker 가 실행 중인지 확인`);
        return false;
    }
    console.log(`✓ ${volume.name}: 만듦 — ${volume.purpose}`);
    return true;
}

// 끝 부분
} else {
    const results = [...NETWORKS.map(ensure), ...VOLUMES.map(ensureVolume)];
    process.exitCode = results.every(Boolean) ? 0 : 1;
}
```

```yaml
# compose.gateway.yml · compose.user-service.yml(user-service — migrate 는 아님) · compose.admin-service.yml(admin-service) — 같은 모양
        environment:
            # … 기존 그대로 …
            # 내부 파일 저장소 폴더(AWS_S3_BUCKET 이 빌 때) — 공용 볼륨 roomless-files 를 붙인 자리(서버 구성 — .env 값과 무관)
            FILE_STORAGE_DIR: /app/storage/files
        volumes:
            - files:/app/storage/files

# 파일 끝
volumes:
    files:
        name: roomless-files
        external: true
```
(머리 주석의 "네트워크" 설명 옆에 `볼륨 roomless-files : 내부 파일 저장소 — npm run docker:network 가 만든다` 한 줄.)

```dockerfile
# Dockerfile — 4. 실행 이미지, USER node 앞
# 내부 파일 저장소 폴더 — 빈 공용 볼륨(roomless-files)이 처음 붙을 때 이 폴더의 소유자(node)를 물려받는다
RUN mkdir -p /app/storage/files && chown -R node:node /app/storage
USER node
```

```gitignore
# .gitignore — 추가
# 내부 파일 저장소(AWS_S3_BUCKET 이 빌 때 — 로컬 실행의 업로드 파일)
/storage
```

### 설정 · 문서

```ini
# .env.example — AWS 절을 바꾸고 뒤에 두 절을 더한다
# ── AWS (SMS · 파일 저장) ───────────────────
# 세팅 방법: docs/guides/aws-setup.md — 비워 두면 AWS 없이 돈다(개발 · 포트폴리오, 사용자 결정 2026-11-15):
#   - AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY 가 비면 SMS 를 보내지 않고 받는 번호 · 본문을 서버 로그에 남긴다(인증번호 · 임시 비밀번호는 로그에서 본다)
#   - AWS_S3_BUCKET 이 비면 파일은 내부 파일 저장소(게이트웨이 /files — 폴더 FILE_STORAGE_DIR)에 올리고 내준다
AWS_REGION=ap-northeast-2
# IAM 사용자 액세스 키 — 비우면 SMS 는 로그로만 남는다(IAM 역할만으로 돌려도 SMS 는 생략된다 — 보내려면 키를 넣는다. S3 는 역할로도 된다)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
# 사진 버킷 — 비우면 내부 파일 저장소
AWS_S3_BUCKET=
# 공개 파일 주소의 기준 — CloudFront 배포 주소 https://<배포>.cloudfront.net (S3 를 쓸 때. docs/guides/aws-setup.md). 비어 있으면 공개 파일 주소 요청이 실패한다
AWS_S3_PUBLIC_URL=
# 내부 파일 저장소 폴더(AWS_S3_BUCKET 이 빌 때) — 비우면 storage/files(실행 위치 기준 — 로컬은 저장소 루트). gateway · user-service · admin-service 가 같은 폴더를 봐야 한다.
# Docker 는 compose 가 공용 볼륨 roomless-files 자리(/app/storage/files)로 고정한다
FILE_STORAGE_DIR=

# ── 게이트웨이 공개 주소 ─────────────────────
# 브라우저가 게이트웨이에 닿는 주소(끝의 / 는 떼고 쓴다. 예: http://localhost:3000) — 내부 파일 저장소의 업로드 · 열람 · 사진 주소(<주소>/files/…)와
# 테스트 데이터 사진 주소(<주소>/sample/…)의 기준. user-service · admin-service 가 쓴다. 비어 있으면 그 주소를 만드는 요청이 실패한다
GATEWAY_PUBLIC_URL=

# ── 테스트 데이터 (샘플 시드) ───────────────
# 세팅 방법: docs/guides/sample-data.md — 1 이면 user-service 가 부팅할 때 업체 10곳 · 객실 · 업체 총관리자 10명 · 이용자 1명을 넣는다(고정 ID — 이미 있으면 건너뜀). 운영 DB 에서는 켜지 않는다
SEED_SAMPLE_DATA=0
```

```md
<!-- docs/guides/aws-setup.md — 맨 앞(1. 앞)에 새 절 -->
## 0. AWS 없이 돌리기 (개발 · 포트폴리오)

AWS 값을 비워 두면 AWS 없이 끝까지 동작한다(사용자 결정 2026-11-15). 값을 채우면 아래 절대로 S3 · SNS 를 쓴다.

| 비운 값 | 동작 |
|---|---|
| `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` | SMS 를 보내지 않고 `SMS 생략(AWS 키 미설정) — <번호>: <본문>` 경고 로그를 남긴 뒤 성공 처리 — 휴대폰 인증번호 · 매니저 임시 비밀번호는 로그에서 본다(`npm run docker:logs:user-service` · `docker:logs:admin-service` · `docker:logs:scheduler`) |
| `AWS_S3_BUCKET` | 파일은 **내부 파일 저장소** — 업로드 주소 API 가 게이트웨이 `GATEWAY_PUBLIC_URL/files/upload?…`(서명 · 10분)를 주고, 프론트는 S3 때와 똑같이 같은 `Content-Type` 으로 PUT 한다(10MB 까지). 공개 사진은 `GATEWAY_PUBLIC_URL/files/<키>`, 사업자등록증은 서명된 10분 주소. 키 · DB 행 모양은 S3 와 같다 |

- 필요한 값: `GATEWAY_PUBLIC_URL`(브라우저가 게이트웨이에 닿는 주소) · `INTERNAL_API_TOKEN`(서명 — 이미 필수)
- 폴더: 로컬 실행은 `storage/files`(저장소 루트 — git 제외, `FILE_STORAGE_DIR` 로 바꿈), Docker 는 공용 볼륨 `roomless-files`(`npm run docker:network` 가 만든다 — gateway · user-service · admin-service 가 같이 본다)
- 나중에 S3 를 켜면 내부 저장소에 올린 파일은 S3 에 없다(옮기지 않는다) — 그 사진은 다시 올린다
- IAM 역할만으로 돌리는 배포는 키가 비어 SMS 가 생략된다 — SMS 를 보내려면 키를 넣는다(S3 는 버킷만 있으면 역할로 된다)
```

```md
<!-- docs/integration.md — SMS 절 · 파일 저장 절에 추가 -->
- **SMS 생략(AWS 미설정 개발 모드 — 사용자 결정 2026-11-15)**: `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` 가 비면 SnsSmsSender 가 SNS 를 부르지 않고 받는 번호 · 본문을 경고 로그로 남긴 뒤 성공으로 끝난다(인증번호 · 임시 비밀번호는 로그에서 본다). 서비스는 그대로 마지막 단계에서 `send` 를 부른다.
- **내부 파일 저장소(AWS 미설정 개발 모드)**: `AWS_S3_BUCKET` 이 비면 StorageModule 이 `LocalStorageGateway` 를 고른다 — 실제로 저장 · 제공하는 두 번째 어댑터(가짜 아님). 업로드 · 열람 주소는 게이트웨이 `/files/upload` · `/files/download`(HMAC-SHA256 `INTERNAL_API_TOKEN` 서명, 업로드는 Content-Type 포함 · 10분 · 10MB), 공개 파일 `/files/<키>`(private/ 는 공개 경로로 안 나감). 받기 · 내주기는 게이트웨이 `modules/local-file`, 확인 · 삭제는 어댑터 — 같은 폴더(`FILE_STORAGE_DIR` · Docker 공용 볼륨 `roomless-files`). S3 일 때 "파일 본문은 게이트웨이를 거치지 않는다" 는 그대로이고, 내부 저장소일 때는 게이트웨이가 저장소다(브로커 · 서비스는 거치지 않음).
```
```md
<!-- docs/guides/sample-data.md — 새 파일 전체 -->
# 테스트 데이터(샘플 시드)

개발 · 테스트 DB 에 업체 10곳 · 객실 · 계정을 넣는다 — 프론트 화면 개발 · 스토리 테스트용. **운영 DB 에서는 켜지 않는다.**

## 켜기

1. `.env`
   - `SEED_SAMPLE_DATA=1`
   - `GATEWAY_PUBLIC_URL=<게이트웨이 공개 주소>` — 로컬 실행은 `http://localhost:<GATEWAY_PORT>`, Docker 는 gateway-lb 를 연 호스트 주소. 사진 주소가 `<이 주소>/sample/<파일>.png` 가 된다
2. 마이그레이션이 적용된 DB 로 user-service 를 다시 띄운다(부팅 시드). admin-service · gateway 도 다시 띄운다(사진 주소 · `/sample/` 경로)
3. user-service 로그에 `t_store: 기본 데이터 10건 입력 (…)` 같은 줄이 찍힌다. 다시 띄워도 늘지 않는다 — 고정 ID 라 이미 있는 행은 건너뛰고, 업체 관리자가 바꾼 값도 덮지 않는다

끄기: `SEED_SAMPLE_DATA=0`(또는 비움) — 이미 들어간 행은 그대로 남는다. 지우는 기능은 없다(개발 DB 를 새로 만든다).

## 넣는 것

| # | 업체 | 위치 | 운영 | 판매 | 객실 그룹(호실 수) |
|---|---|---|---|---|---|
| 01 | 룸리스 강남역점 | 강남구 강남대로 396 | 24시간 | 시간 이용(3시간) · 1박 · 연박 | 스탠다드(5) · 디럭스(4) · 스위트(3 — 숙박만) |
| 02 | 룸리스 홍대입구점 | 마포구 양화로 160 | 24시간 | 시간 이용(3시간) · 1박 · 연박 | 스탠다드(4) · 트윈(3) |
| 03 | 룸리스 잠실점 | 송파구 올림픽로 240 | 매일 12:00 ~ 다음 날 10:00 | 시간 이용(3시간) · 1박 | 스탠다드(5) · 디럭스(4) · 패밀리(3) |
| 04 | 룸리스 성수점 | 성동구 아차산로 100 | 24시간 | 시간 이용(4시간) · 1박 · 연박 | 스탠다드(4) · 디럭스(3) |
| 05 | 룸리스 여의도점 | 영등포구 여의대로 108 | 10:00 ~ 23:00 · 일요일 휴무 · 브레이크 15:00 ~ 16:00 | 시간 이용(2시간)만 | 스탠다드(5) · 비즈니스(4) |
| 06 | 룸리스 종로점 | 종로구 종로 51 | 24시간 | 시간 이용(3시간) · 1박 · 연박 | 스탠다드(4) · 디럭스(4) · 스위트(3 — 숙박만) |
| 07 | 룸리스 신촌점 | 서대문구 신촌로 83 | 매일 14:00 ~ 다음 날 12:00 | 시간 이용(3시간) · 1박 | 스탠다드(5) · 트윈(3) |
| 08 | 룸리스 건대입구점 | 광진구 아차산로 243 | 24시간 | 시간 이용(3시간) · 1박 · 연박 | 스탠다드(5) · 디럭스(4) · 패밀리(3) |
| 09 | 룸리스 이태원점 | 용산구 이태원로 177 | 10:00 ~ 22:00 · 월요일 휴무 | 시간 이용(3시간)만 | 스탠다드(4) · 디럭스(3) |
| 10 | 룸리스 합정점 | 마포구 양화로 45 | 24시간 | 시간 이용(3시간) · 1박 · 연박 | 스탠다드(4) · 디럭스(4) · 스위트(3 — 숙박만) |

- 모두 활성 · 영업 중, 업체 사진 2장 · 그룹 사진 2장, 호실은 모두 예약가능. 1박 22:00 ~ 09:00 · 연박 15:00 ~ 11:00(1 ~ 30박) · 연장 최대 3회 · 예약 가능 72시간 · 100% 환불 마감 60분 · 마감 뒤 50%(입점 승인 기본값과 같다)
- 그룹은 층이 다르다(2층 · 3층 · 4층, 호실명 `201` · `301` …). 요금은 [sample-seed.data.ts](../../libs/database/src/seeder/sample-seed.data.ts)
- 고정 ID 는 `5a3e` + 종류 2자리 + 번호 26자리(32자) — 업체 ID `5a3e01…0NN`, 업체코드 `5a3e02…0NN`

## 계정

- **총관리자** — 기본 시드 `admin` / `1234`(첫 로그인 때 변경)
- **업체 총관리자** — 업체마다 1명, 아이디 `manager` · 비밀번호 `1234`(비밀번호 변경 요구 없음). 업체코드 + 아이디로 로그인 — `POST /api/v1/admin-service/manager/login`, 프론트 주소 `/manager/<업체코드>/login`

| # | 업체 | 업체코드 |
|---|---|---|
| 01 | 룸리스 강남역점 | `5a3e0200000000000000000000000001` |
| 02 | 룸리스 홍대입구점 | `5a3e0200000000000000000000000002` |
| 03 | 룸리스 잠실점 | `5a3e0200000000000000000000000003` |
| 04 | 룸리스 성수점 | `5a3e0200000000000000000000000004` |
| 05 | 룸리스 여의도점 | `5a3e0200000000000000000000000005` |
| 06 | 룸리스 종로점 | `5a3e0200000000000000000000000006` |
| 07 | 룸리스 신촌점 | `5a3e0200000000000000000000000007` |
| 08 | 룸리스 건대입구점 | `5a3e0200000000000000000000000008` |
| 09 | 룸리스 이태원점 | `5a3e0200000000000000000000000009` |
| 10 | 룸리스 합정점 | `5a3e0200000000000000000000000010` |

- **이용자** — `sns_id` `KAKAO` · `sns_user_id` `sample-user-01`, 닉네임 `테스트 이용자`, 휴대폰 인증 완료. 이용자는 SNS 로만 로그인하므로 카카오 로그인 창으로는 이 계정에 들어갈 수 없다 — `POST /api/v1/user-service/user/login` 에 `{"sns_id": "KAKAO", "sns_user_id": "sample-user-01"}` 를 바로 보낸다(프론트의 개발용 테스트 로그인)

## 사진

- 저장 키 `sample/<파일>.png` — S3 에 없다. 게이트웨이가 [apps/gateway/src/assets/sample/](../../apps/gateway/src/assets/sample/) 을 `/sample/` 경로로 내주고(빌드 때 nest-cli `assets` 가 dist 로 복사), 저장소 어댑터가 공개 주소를 `GATEWAY_PUBLIC_URL/sample/<파일>.png` 로 만든다. API 응답의 사진 주소가 그대로 이 주소다
- 업체 관리자가 샘플 사진을 지우면 행만 소프트 삭제되고 파일은 남는다(S3 를 부르지 않는다). 새로 올리는 사진은 지금처럼 S3(presigned URL)
- 파일: 업체 `store-<NN>-<1|2>.png`(낮 · 밤 외관), 그룹 `room-<NN>-<그룹>-<1|2>.png`(침대 쪽 · TV · 책상 쪽), 왼쪽 아래 라벨(`STORE 01` · `ROOM 01-2`)
- 다시 그리기: `npm run sample:images`([scripts/sample-images.mjs](../../scripts/sample-images.mjs) — 외부 패키지 없음). 업체 · 그룹 수를 바꾸면 스크립트의 `GROUP_COUNTS` 와 `SAMPLE_STORES` 를 같이 고친다

## 바꾸는 곳

- 데이터 [libs/database/src/seeder/sample-seed.data.ts](../../libs/database/src/seeder/sample-seed.data.ts) — 업체 · 그룹 · 호실 · 요금 · 계정 값
- 행 만드는 함수 · 대상 [libs/database/src/seeder/sample-seed.targets.ts](../../libs/database/src/seeder/sample-seed.targets.ts) — `SEED_TARGETS` 끝에 붙는다
- 이미 넣은 DB 에서 값을 바꿔도 다시 넣지 않는다(고정 ID 가 있으면 건너뜀) — 새 값을 보려면 개발 DB 를 새로 만든다
```

```md
<!-- docs/architecture.md — "## 기본 데이터 시드" 절 끝에 추가 -->
테스트 데이터(샘플 시드)는 `SEED_TARGETS` 끝의 `SAMPLE_SEED_TARGETS`([sample-seed.targets.ts](../libs/database/src/seeder/sample-seed.targets.ts) · 값은 sample-seed.data.ts)다 — `SEED_SAMPLE_DATA=1` 일 때만 업체 10곳 · 객실 그룹 · 호실 · 업체 총관리자 · 이용자를 고정 ID(`sampleId` — `5a3e` + 종류 + 번호)로 넣고, 꺼져 있으면 만드는 함수를 부르지 않는다. 사진은 게이트웨이 `assets/sample/` 의 PNG(`/sample/` 정적 경로 — config/sample-image.config.ts). 켜는 법 · 계정: [guides/sample-data.md](guides/sample-data.md).

<!-- docs/architecture.md — 게이트웨이 구성 · Docker 절에 추가 -->
- 게이트웨이 인프라 `modules/local-file` — `AWS_S3_BUCKET` 이 비면 `/files`(서명된 업로드 받기 · 비공개 열람 · 공개 파일)를 HTTP 앱에 직접 붙인다(문 소켓과 같은 HttpAdapterHost 방식, Swagger 밖).
- 공용 볼륨 `roomless-files`(external — `npm run docker:network` 가 네트워크와 함께 만든다) — gateway · user-service · admin-service 의 `/app/storage/files`(compose 가 `FILE_STORAGE_DIR` 고정). 이미지가 그 폴더를 `node` 소유로 만들어 둔다.
```

```md
<!-- docs/integration.md — 파일 저장(STORAGE_GATEWAY) 절에 추가 (위 "내부 파일 저장소" 줄과 함께) -->
- **샘플 키(`sample/` — 테스트 데이터 시드 사진)** 는 어느 어댑터든 저장소 파일이 아니다 — `getPublicUrl` 은 `GATEWAY_PUBLIC_URL` 뒤에 키(게이트웨이 `/sample/` 정적 경로, 비면 500 `STORAGE_PUBLIC_URL_MISSING_MESSAGE`), `remove` 는 건너뛴다(행 소프트 삭제만). 업로드 키 검사가 `store/<업체>/…` 접두만 받아 API 로는 샘플 키를 등록할 수 없다. [guides/sample-data.md](guides/sample-data.md)
```

README.md (같은 변경):
- 외부 연동 줄(:11) — "mock 없이 실제 서비스에 붙는 코드" 뒤에: AWS 값을 비우면 AWS 없이 돈다 — SMS 는 보내지 않고 로그에 남기고(인증번호 · 임시 비밀번호는 로그에서), 파일은 게이트웨이 내부 파일 저장소(`/files` — `GATEWAY_PUBLIC_URL`)에 올린다. 테스트 데이터 사진은 게이트웨이 `/sample/` — [docs/guides/aws-setup.md](docs/guides/aws-setup.md) "AWS 없이 돌리기" · [docs/guides/sample-data.md](docs/guides/sample-data.md)
- 환경 값 안내(:53) — AWS 줄을 "비워도 서버는 뜨고 SMS 는 로그로, 파일은 내부 파일 저장소로" 로 고치고, `GATEWAY_PUBLIC_URL`(게이트웨이 공개 주소 — 내부 파일 저장소 · 샘플 사진 주소) · `SEED_SAMPLE_DATA=1`(테스트 데이터 — 개발 · 테스트 DB 만, 계정 · 업체코드는 가이드) 줄
- Docker 표 · 설명 — `npm run docker:network` 가 공용 볼륨 `roomless-files` 도 만든다
- 명령에 `npm run sample:images`(샘플 사진 다시 그리기)
- 가이드 목록(:99 · :127)에 테스트 데이터 가이드
- 구조(게이트웨이 · scripts)에 `modules/local-file` · `assets/sample/` · `sample-images.mjs`, `storage/`(로컬 업로드 — git 제외)

AGENTS.md (같은 변경):
- Architecture 트리 gateway: `│   ├── modules/local-file/   # 내부 파일 저장소 경로(/files — AWS_S3_BUCKET 이 빌 때만): 서명된 업로드 받기 · 비공개 열람 · 공개 파일 — 폴더는 user-service · admin-service 와 공유(FILE_STORAGE_DIR · Docker 공용 볼륨 roomless-files)`, `│   ├── assets/sample/        # 샘플 사진 PNG 70개(테스트 데이터 시드 — scripts/sample-images.mjs 가 그림, /sample/ 정적 경로 · nest-cli assets 로 dist 복사)`, `config/` 줄에 `sample-image.config.ts`
- libs/integration 줄: 파일 저장(STORAGE_GATEWAY · S3 + CloudFront, 버킷이 비면 내부 파일 저장소 LocalStorageGateway)
- scripts 줄: `sample-images.mjs(테스트 데이터 사진 생성)` · `docker-network.mjs(공용 네트워크 · 볼륨)`
- Key Patterns "기본 데이터 시드" 끝: `테스트 데이터(업체 10 · 객실 · 업체 총관리자 · 이용자 1)는 sample-seed.data.ts · sample-seed.targets.ts 의 SAMPLE_SEED_TARGETS 가 SEED_TARGETS 끝에서 SEED_SAMPLE_DATA=1 일 때만 고정 ID(sampleId)로 넣는다 — 운영 DB 에서는 켜지 않는다(docs/guides/sample-data.md)`
- 외부 연동 첫 줄 `mock · 가짜 어댑터를 두지 않는다 …` 를: `mock · 가짜 어댑터를 두지 않는다. 실제 서비스 어댑터 + 세팅 가이드(docs/guides/)로 만든다. **예외 — AWS 미설정 개발 모드(사용자 결정 2026-11-15)**: AWS_S3_BUCKET 이 비면 STORAGE_GATEWAY 는 내부 파일 저장소(LocalStorageGateway — 실제로 저장 · 제공, 게이트웨이 /files), AWS 키가 비면 SMS 는 보내지 않고 받는 번호 · 본문을 로그에 남긴 뒤 성공. 그 밖(토스 · Redis)은 세팅 전에는 .env 값이 비어 요청만 실패한다(부팅은 된다)` 로
- 외부 연동 사진 줄 `파일 본문은 게이트웨이 · 브로커를 거치지 않는다` 를: `S3 면 파일 본문은 게이트웨이 · 브로커를 거치지 않는다(presigned URL). 내부 파일 저장소면 게이트웨이 /files 가 저장소다(서명된 주소 · 같은 PUT 방식 — 브로커 · 서비스는 거치지 않음)` 로, 열람 주소 줄에 `내부 파일 저장소는 공개 GATEWAY_PUBLIC_URL/files/<키>, 비공개 서명된 /files/download`, 그리고 `저장 키가 sample/ 이면(테스트 데이터 사진) 어느 어댑터든 공개 주소 GATEWAY_PUBLIC_URL/sample/…, 삭제는 건너뜀`
- Docker 줄: 공용 볼륨 `roomless-files`(external — docker:network) · 세 앱 `/app/storage/files`
- Checklist 외부 연동 줄: `mock · 가짜 어댑터 없음(실제 어댑터 + docs/guides/ 가이드 — AWS 미설정 개발 모드 예외: 내부 파일 저장소 · SMS 로그)`, `파일은 STORAGE_GATEWAY 업로드 주소(S3 presigned 또는 내부 저장소 서명 주소 — 파일 본문을 브로커 · 서비스로 보내지 않음)`

메모리(사용자 auto-memory) `no-mock-adapters.md` — 본문 끝에 추가:
```md
**예외(사용자 결정 2026-11-15 — 포트폴리오용, AWS 세팅이 귀찮음)**: AWS 값이 비면 AWS 없이 돈다 — AWS_S3_BUCKET 이 비면 내부 파일 저장소(LocalStorageGateway — 게이트웨이 /files 가 실제로 받고 내준다, 키 · DB 모양은 S3 와 같음), AWS 키가 비면 SMS 를 보내지 않고 받는 번호 · 본문을 로그에 남긴 뒤 성공. 이 둘은 "가짜 대역" 이 아니라 사용자가 고른 개발 모드다. 그 밖의 새 외부 연동은 여전히 실제 서비스 + 가이드로 설계한다.
```
(description 에 "— AWS 미설정 개발 모드(내부 파일 저장소 · SMS 로그)는 예외" 를 더하고, MEMORY.md 색인 줄도 같이 고친다.)

```md
<!-- .beaver/output/frontend/changes/2026-11-13-sample-data.md — 새 파일 전체 -->
# 테스트 데이터 · AWS 없는 개발 환경 안내 — 프론트 수정 요청 (2026-11-13)

- 백엔드: spec `.beaver/output/spec/seed/sample-data-spec.md` · 커밋 <ship 때 채움>
- 반영 순서: 상관없음(공개 API 변경 없음 — 개발 · 테스트 환경 안내)

## 바뀐 이유
개발 · 테스트 DB 에 넣는 테스트 데이터(서울 업체 10곳 · 객실 그룹 25개 · 호실 96개 · 업체 총관리자 10명 · 이용자 1명)가 생겼다 — 백엔드가 `.env` `SEED_SAMPLE_DATA=1` 로 켠 서버에만 있다.
그리고 백엔드가 AWS 없이 돌 수 있게 됐다 — S3 가 없으면 파일은 게이트웨이 내부 파일 저장소에 올라가고, SMS 는 보내지 않고 서버 로그에만 남는다.

## 영향 화면
- 화면 동작 변경 없음. 개발용으로 쓰는 곳: 이용자 로그인(테스트 로그인), 업체 관리자 로그인(`/manager/<업체코드>/login`), 사진을 보여 주는 화면 · 사진을 올리는 화면(호스트), 휴대폰 인증 · 아이디 찾기 · 비밀번호 초기화(인증번호를 SMS 대신 백엔드 로그에서 받는다)

## API 변경
없음. 업로드 주소 API 의 응답(`upload_url` · `expires_at`)과 올리는 방식(같은 `Content-Type` 헤더로 `PUT`)은 그대로다 — 주소의 호스트만 바뀔 수 있다.

## 화면 구성과 쓰는 API 의 변경
- **이용자 테스트 로그인(개발 환경에서만)** — 이용자는 SNS 로만 로그인해서 카카오 창으로는 테스트 계정에 들어갈 수 없다. 개발 환경에서만 보이는 버튼이 `POST /api/v1/user-service/user/login` 에 `{"sns_id": "KAKAO", "sns_user_id": "sample-user-01"}` 를 보낸다(응답 · 토큰 처리는 SNS 로그인과 같다)
- **업체 관리자 테스트 계정** — 업체마다 아이디 `manager` · 비밀번호 `1234`, 로그인 주소 `/manager/<업체코드>/login`

| # | 업체 | 업체코드 |
|---|---|---|
| 01 | 룸리스 강남역점 | `5a3e0200000000000000000000000001` |
| 02 | 룸리스 홍대입구점 | `5a3e0200000000000000000000000002` |
| 03 | 룸리스 잠실점 | `5a3e0200000000000000000000000003` |
| 04 | 룸리스 성수점 | `5a3e0200000000000000000000000004` |
| 05 | 룸리스 여의도점 | `5a3e0200000000000000000000000005` |
| 06 | 룸리스 종로점 | `5a3e0200000000000000000000000006` |
| 07 | 룸리스 신촌점 | `5a3e0200000000000000000000000007` |
| 08 | 룸리스 건대입구점 | `5a3e0200000000000000000000000008` |
| 09 | 룸리스 이태원점 | `5a3e0200000000000000000000000009` |
| 10 | 룸리스 합정점 | `5a3e0200000000000000000000000010` |

- **총관리자** — `admin` / `1234`(첫 로그인 때 비밀번호 변경)
- **둘러보기 시험 위치** — 업체는 서울(강남역 · 홍대입구 · 잠실 · 성수 · 여의도 · 종각 · 신촌 · 건대입구 · 이태원 · 합정). 반경 검색 기준을 서울시청(37.5665, 126.9780) 근처로 두면 여러 곳이 잡힌다
- **운영 형태가 다른 업체** — 24시간 6곳(시간 이용 · 1박 · 연박), 잠실 · 신촌(낮 ~ 다음 날 오전 — 시간 이용 · 1박), 여의도(10 ~ 23시 · 일요일 휴무 · 15 ~ 16시 브레이크 · 시간 이용만), 이태원(10 ~ 22시 · 월요일 휴무 · 시간 이용만) — 예약 가능 시간 · 휴무 · 판매 종류 화면을 시험할 수 있다
- **사진 주소 호스트** — 테스트 데이터 사진은 `<게이트웨이 주소>/sample/<파일>.png`, S3 가 없는 서버에 올린 사진은 `<게이트웨이 주소>/files/<키>`, 비공개(사업자등록증) 열람 주소는 `<게이트웨이 주소>/files/download?…`(10분). `next/image` 를 쓰면 `images.remotePatterns` 에 게이트웨이 호스트를 더한다(S3 CloudFront 호스트와 함께)
- **사진 올리기** — 업로드 주소가 게이트웨이(`<게이트웨이 주소>/files/upload?…`)일 수 있다. 올리는 코드는 그대로(`fetch(upload_url, {method: 'PUT', headers: {'Content-Type': file.type}, body: file})`) — 10MB 까지, 실패는 403(주소 만료 · 형식 다름) · 413(10MB 초과) · 503, 본문은 공통 실패 모양 `{message, validation_errors: null}`. 게이트웨이 CORS(`CORS_ORIGINS`)에 프론트 주소가 있어야 한다(API 와 같다)

## 바뀐 DTO
없음.
```

```md
<!-- .beaver/output/frontend/changes/README.md — 목록에 한 줄 -->
| 2026-11-13 | [테스트 데이터 · AWS 없는 개발 환경 안내](2026-11-13-sample-data.md) | 없음(개발 · 테스트 — 테스트 로그인 · 업체코드 · 사진 · 업로드 호스트 · 인증번호는 로그) | <ship 커밋> |
```

`docs/guides/sample-data.md` 의 "사진" 절에 한 줄 — S3 가 없으면(AWS_S3_BUCKET 빔) 업체 관리자가 새로 올리는 사진도 게이트웨이 내부 파일 저장소(`/files/<키>`)에 들어간다([aws-setup.md](aws-setup.md) "AWS 없이 돌리기").

---

## Test Cases
```
테스트 생략(위임형): 샘플 시드 데이터 · 만드는 함수 · SAMPLE_SEED_TARGETS(libs/database), 내부 파일 저장소 어댑터 · 서명 · 경로 util · StorageModule 고르기 · S3 어댑터 sample/ 분기 · SMS 생략 분기(libs/integration), 게이트웨이 /sample/ · /files 경로(gateway 인프라 — modules/local-file · config), PNG 생성기 · 볼륨 스크립트(scripts) — AGENTS.md Testing 이 라이브러리 · 게이트웨이 인프라 · util 단위 spec 을 두지 않는다. 새 · 바뀐 service · repository 없음(서비스 spec 은 STORAGE_GATEWAY · SMS_SENDER 를 mock 한다) · 새 입력 DTO 없음(검증 케이스 없음)
```

build 확인(테스트 대신):
- `npm run typecheck` · `npm run lint` · prettier(`npm run format` 대상 파일)
- `npm run build:gateway` → `dist/apps/gateway/apps/gateway/src/assets/sample/` 에 PNG 70개. `npm run build` 전체(네 앱)
- 시드 데이터 점검(scratchpad 일회성 스크립트 — 빌드 결과를 node 로 불러): 업체 안 그룹명 · 호실명 유일, 고정 ID 32자 hex · 겹침 없음, 업체 상품 설정 CHECK 조합(HOURLY usage_hours 만 · NIGHT/LONG 시각 · LONG 박수), 영업시간 행 7개 · 휴무 조합, 그룹 상품 요금 null ↔ is_used 0, 사진 키 70개 = assets 파일 70개
- 서명 · 경로 util 점검(같은 방식): 맞는 서명 통과 · 키 · Content-Type · 만료 · 메서드를 바꾸면 거부 · 지난 만료 거부 · 잘못된 hex 거부, `store/a.jpg` 는 폴더 안 · `../x` · `store/../../x` · 절대 경로 · 역슬래시는 null, `readPublicKey('/private/…')` 는 빈 값
- `npm run db:check` 영향 없음(엔티티 · 마이그레이션 변경 없음), `docker compose -f compose.gateway.yml config` 형식 확인은 필수 env 가 비어 실패할 수 있어 하지 않는다(.env 를 보지 않는다)

---

## Response Codes
| Code | Cause |
|------|------|
| 부팅 시드 — 입력 | `SEED_SAMPLE_DATA=1` · 없는 행만 insert, 로그 `<테이블>: 기본 데이터 N건 입력 (…)` |
| 부팅 시드 — 0건 | 플래그 꺼짐(만드는 함수를 부르지 않음) 또는 이미 모두 있음 |
| 부팅 시드 — 경고 | 대상별 insert 실패(유일 제약 충돌 · 테이블 없음) — 경고 로그만, 부팅은 계속(SeederService 그대로) |
| 200 (`GET /sample/<파일>.png`) | 게이트웨이가 PNG 를 내준다(`Cache-Control: max-age=86400`) |
| 404 (`GET /sample/<없는 파일>`) | 정적 경로가 다음으로 넘기고 Nest 기본 404(공통 실패 본문) |
| 200 (`PUT /files/upload`) | 서명 · 만료 · Content-Type 이 맞고 10MB 이하 — 폴더에 저장(본문 없음) |
| 403 (`PUT /files/upload` · `GET /files/download`) | `LOCAL_FILE_SIGNATURE_INVALID_MESSAGE` — 서명 틀림 · 만료 · Content-Type 다름 · 폴더 밖 키 |
| 413 (`PUT /files/upload`) | `LOCAL_FILE_TOO_LARGE_MESSAGE` — Content-Length 또는 받은 바이트가 10MB 초과(임시 파일 삭제) |
| 503 (`PUT /files/upload`) | `STORAGE_UNAVAILABLE_MESSAGE` — 폴더 쓰기 실패(로그) |
| 200 / 404 (`GET /files/download`) | 서명이 맞으면 파일(`Cache-Control: private, no-store`), 없으면 `LOCAL_FILE_NOT_FOUND_MESSAGE` |
| 200 / 404 (`GET /files/<키>`) | 공개 키 파일(하루 캐시) / 없음 · private/ 키 · 잘못된 인코딩은 Nest 기본 404 |
| 404 (`/files/…`, S3 모드) | `AWS_S3_BUCKET` 이 있으면 경로를 열지 않는다 |
| 503 `STORAGE_UNAVAILABLE_MESSAGE` (업로드 · 열람 주소 API) | 내부 저장소에서 `GATEWAY_PUBLIC_URL` · `INTERNAL_API_TOKEN` 이 비어 서명 주소를 만들지 못함 · 확인 · 삭제의 파일 시스템 오류 |
| 500 `STORAGE_PUBLIC_URL_MISSING_MESSAGE` | 사진 주소를 만드는 공개 API 에서 `GATEWAY_PUBLIC_URL` 이 비어 있을 때(샘플 키 · 내부 저장소) |
| SMS — 성공(생략) | AWS 키가 비면 SNS 를 부르지 않고 `SMS 생략(AWS 키 미설정) — <번호>: <본문>` 경고 로그 |
| SMS — 503 `SMS_UNAVAILABLE_MESSAGE` | (변경 없음) 키가 있는데 SNS 가 접수하지 못함 |
| (변경 없음) 삭제 API | 샘플 사진 삭제는 행 소프트 삭제 후 `remove` 가 건너뛰고 성공, 내부 저장소 파일은 지운다 |

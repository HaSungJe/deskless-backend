import type {RoomGroupDetail} from '../entities/room/room-group.entity.js';
import type {StoreDetail} from '../entities/store/store.entity.js';
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

/** 샘플 문의 본보기 — 카테고리(기본 시드 t_inquiry_category ID) · 제목 · 내용 · 답변(답변완료로 넣을 때 쓴다, 스팸은 null) */
export interface SampleInquiryTemplate {
    inquiry_category_id: string;
    title: string;
    content: string;
    answer_content: string | null;
}

/** 샘플 문의 수 — 대상(업체 번호, null = 바로방)마다 일반 문의 · 스팸 문의(블라인드) 개수 */
export interface SampleInquiryCount {
    store_no: number | null;
    normal: number;
    spam: number;
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
    /** 업체 편의시설 — 적은 항목만 있음(1), 나머지는 기본값 없음(0) */
    store_detail: Partial<StoreDetail>;
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
    INQUIRY: 17,
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
        store_name: '바로방 강남역점',
        store_detail: {has_convenience_store: 1, has_cafe: 1, is_delivery_allowed: 1, has_parking: 1},
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
        store_name: '바로방 홍대입구점',
        store_detail: {has_convenience_store: 1, has_cafe: 1, is_delivery_allowed: 1},
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
        store_name: '바로방 잠실점',
        store_detail: {has_meal: 1, has_parking: 1, is_pet_allowed: 1},
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
        store_name: '바로방 성수점',
        store_detail: {has_cafe: 1, is_pet_allowed: 1, has_parking: 1},
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
        store_name: '바로방 여의도점',
        store_detail: {has_meal: 1, has_cafe: 1},
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
        store_name: '바로방 종로점',
        store_detail: {has_convenience_store: 1, is_delivery_allowed: 1},
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
        store_name: '바로방 신촌점',
        store_detail: {has_convenience_store: 1, has_cafe: 1, is_delivery_allowed: 1, has_meal: 1},
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
        store_name: '바로방 건대입구점',
        store_detail: {is_delivery_allowed: 1, has_parking: 1},
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
        store_name: '바로방 이태원점',
        store_detail: {has_cafe: 1, is_pet_allowed: 1},
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
        store_name: '바로방 합정점',
        store_detail: {has_cafe: 1, is_delivery_allowed: 1, has_parking: 1, is_pet_allowed: 1},
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

/** 샘플 일반 문의 본보기 13개 — 카테고리마다 1 ~ 2개, 대상마다 순서를 밀어 가며 돌려 쓴다 */
export const SAMPLE_INQUIRY_TEMPLATES: SampleInquiryTemplate[] = [
    {
        inquiry_category_id: 'RESERVATION',
        title: '예약 시간을 바꿀 수 있을까요?',
        content: '오늘 18시 예약을 20시로 바꾸고 싶은데 가능한가요?',
        answer_content: '예약 시간은 취소 뒤 다시 예약하셔야 합니다. 이용 시작 60분 전까지 취소하시면 전액 환불됩니다.',
    },
    {
        inquiry_category_id: 'RESERVATION',
        title: '하루 더 머물 수 있나요?',
        content: '1박으로 예약했는데 하루 더 묵고 싶습니다. 어떻게 하면 되나요?',
        answer_content: '이용 중에 내 예약에서 연장을 신청하시면 됩니다. 다음 예약이 없으면 최대 3회까지 늘릴 수 있습니다.',
    },
    {
        inquiry_category_id: 'PAYMENT',
        title: '결제 영수증을 받을 수 있나요?',
        content: '법인카드로 결제했는데 영수증을 따로 받을 수 있는지 궁금합니다.',
        answer_content: '내 예약 상세에서 결제 영수증을 확인하실 수 있습니다.',
    },
    {
        inquiry_category_id: 'PAYMENT',
        title: '환불이 아직 들어오지 않았어요',
        content: '어제 예약을 취소했는데 카드사에 환불이 아직 보이지 않습니다.',
        answer_content: '카드사에 따라 영업일 기준 3 ~ 5일이 걸릴 수 있습니다. 그 뒤에도 보이지 않으면 다시 문의해 주세요.',
    },
    {
        inquiry_category_id: 'ROOM',
        title: '주차할 수 있나요?',
        content: '차를 가지고 가려는데 건물에 주차할 수 있는지 알고 싶습니다.',
        answer_content: '건물 지하 주차장을 이용하실 수 있습니다. 입차 때 객실 번호를 알려 주세요.',
    },
    {
        inquiry_category_id: 'ROOM',
        title: '수건을 더 받을 수 있나요?',
        content: '두 명이 쓰기에 수건이 모자랍니다. 더 받을 수 있을까요?',
        answer_content: '객실 옷장 아래 칸에 여분 수건이 있습니다. 모자라면 업체 연락처로 알려 주세요.',
    },
    {
        inquiry_category_id: 'DOOR',
        title: 'QR 이 인식되지 않아요',
        content: '입구에서 QR 을 여러 번 대 봤는데 문이 열리지 않습니다.',
        answer_content: '화면 밝기를 최대로 올린 뒤 다시 대 주세요. 계속되면 업체 연락처로 전화 주시면 바로 열어 드립니다.',
    },
    {
        inquiry_category_id: 'DOOR',
        title: '나갈 때 문이 잠기나요?',
        content: '잠깐 밖에 나갔다 오려는데 문이 저절로 잠기는지 궁금합니다.',
        answer_content: '문을 닫으면 저절로 잠깁니다. 다시 들어오실 때 같은 QR 을 쓰시면 됩니다.',
    },
    {
        inquiry_category_id: 'ACCOUNT',
        title: '휴대폰 번호를 바꾸고 싶어요',
        content: '번호가 바뀌었는데 계정의 휴대폰 번호는 어떻게 바꾸나요?',
        answer_content: '마이페이지에서 새 번호로 휴대폰 인증을 다시 하시면 바뀝니다.',
    },
    {
        inquiry_category_id: 'ACCOUNT',
        title: '탈퇴하면 예약은 어떻게 되나요?',
        content: '탈퇴 신청을 하면 남아 있는 예약도 같이 취소되나요?',
        answer_content: '탈퇴 대기 14일 동안은 예약이 그대로 남고, 그 안에 철회하실 수 있습니다.',
    },
    {
        inquiry_category_id: 'STORE_APPLICATION',
        title: '입점 신청 절차가 궁금합니다',
        content: '운영 중인 무인 숙소도 입점 신청을 할 수 있나요? 심사 기간도 알고 싶습니다.',
        answer_content: '입점 신청을 남기시면 영업일 기준 3일 안에 심사 결과를 문자로 알려 드립니다.',
    },
    {
        inquiry_category_id: 'STORE_APPLICATION',
        title: '사업자등록증을 다시 올리고 싶어요',
        content: '입점 신청 때 올린 사업자등록증 사진이 흐리게 나왔습니다.',
        answer_content: '대기 중인 신청은 업체 정보 파일을 지우고 다시 올리실 수 있습니다.',
    },
    {
        inquiry_category_id: 'ETC',
        title: '예약 알림을 받고 싶어요',
        content: '예약 시작 전에 알림을 받을 수 있는 방법이 있을까요?',
        answer_content: '이용 시작 전에 QR 확인 링크를 문자로 보내 드립니다.',
    },
];

/** 샘플 스팸 문의 본보기 — 블라인드로 넣는다(답변 없음) */
export const SAMPLE_INQUIRY_SPAMS: SampleInquiryTemplate[] = [
    {inquiry_category_id: 'ETC', title: '[광고] 숙박 최저가 대행', content: '숙박 예약 대행 문의는 아래 연락처로 주세요. 숙박 예약 대행 문의는 아래 연락처로 주세요.', answer_content: null},
    {inquiry_category_id: 'ETC', title: '[광고] 리뷰 작업 해 드립니다', content: '리뷰 작업 저렴하게 해 드립니다. 연락 주세요. 연락 주세요. 연락 주세요.', answer_content: null},
];

/**
 * 샘플 문의 수 — 업체 01 · 바로방은 한 페이지(20건)를 넘겨 페이지 넘김을 시험한다, 업체 02 는 블라인드 1건, 업체 03 ~ 10 은 3건씩. 모두 71건.
 * 일반 문의는 번갈아 접수 · 답변완료, 스팸은 블라인드(바로방 문의의 답변 · 블라인드 계정은 총관리자 `admin` — 없으면 접수로만 넣는다).
 */
export const SAMPLE_INQUIRY_COUNTS: SampleInquiryCount[] = [
    {store_no: 1, normal: 20, spam: 2},
    {store_no: 2, normal: 2, spam: 1},
    {store_no: 3, normal: 3, spam: 0},
    {store_no: 4, normal: 3, spam: 0},
    {store_no: 5, normal: 3, spam: 0},
    {store_no: 6, normal: 3, spam: 0},
    {store_no: 7, normal: 3, spam: 0},
    {store_no: 8, normal: 3, spam: 0},
    {store_no: 9, normal: 3, spam: 0},
    {store_no: 10, normal: 3, spam: 0},
    {store_no: null, normal: 20, spam: 2},
];

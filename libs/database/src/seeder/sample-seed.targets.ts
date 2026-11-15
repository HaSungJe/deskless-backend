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

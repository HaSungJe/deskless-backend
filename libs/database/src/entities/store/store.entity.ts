import {AfterLoad, BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique} from 'typeorm';
import {StoreStateEntity} from './store-state.entity.js';

/**
 * 업체 편의시설(t_store.store_detail) — 업체 전체가 제공하는 시설(사용자 결정 2026-11-24). 객실 그룹 상세(방 수 · 샤워 · TV · PC)와 따로 둔다.
 * 항목은 언제든 바뀔 수 있다(인터페이스 · 기본값 · 필터 정의만 고치고 마이그레이션 없음). 저장된 JSON 에 없는 항목은 조회 뒤 STORE_DETAIL_DEFAULTS(없음)로 채운다.
 */
export interface StoreDetail {
    /** 편의점 유무(0: 없음, 1: 있음) */
    has_convenience_store: 0 | 1;
    /** 카페 유무(0: 없음, 1: 있음) */
    has_cafe: 0 | 1;
    /** 온천 유무(0: 없음, 1: 있음) */
    has_hot_spring: 0 | 1;
    /** 반려동물 동반 가능 여부(0: 불가, 1: 가능) */
    is_pet_allowed: 0 | 1;
    /** 식사 제공 여부(0: 없음, 1: 있음) */
    has_meal: 0 | 1;
    /** 배달 음식 가능 여부(0: 불가, 1: 가능) */
    is_delivery_allowed: 0 | 1;
    /** 주차 가능 여부(0: 불가, 1: 가능) */
    has_parking: 0 | 1;
}

/** 업체 편의시설 기본값 — 모두 없음(0, 체크하지 않은 시설을 있다고 보이지 않는다). 저장된 JSON 에 없는 항목은 조회 뒤 이 값으로 채운다(@AfterLoad) */
export const STORE_DETAIL_DEFAULTS: StoreDetail = {has_convenience_store: 0, has_cafe: 0, has_hot_spring: 0, is_pet_allowed: 0, has_meal: 0, is_delivery_allowed: 0, has_parking: 0};

/** 업체 편의시설 항목 하나의 검색 필터 — 체크박스 1개(객실 그룹 필터와 같은 모양 — room-group.entity.ts 가 이 파일을 import 해서 거기 타입을 가져오지 않는다) */
export interface StoreDetailFilter {
    /** 체크박스 이름 */
    name: string;
    /** 조건 — EQ: 값과 같다(있음 = 1) */
    operator: 'EQ';
    /** 비교 값 */
    value: number;
}

/**
 * 업체 편의시설 검색 필터 — 항목마다 체크박스 1개(이 순서로 보인다). StoreDetail 의 모든 항목을 키로 가져야 한다(Record — 항목을 더하고 빼먹으면 타입 검사가 실패한다).
 * 키는 객실 그룹 필터(ROOM_GROUP_DETAIL_FILTERS)와 겹치면 안 된다 — 업체 검색 detail_filter 에 같이 들어가고 키로 묶음을 가른다.
 */
export const STORE_DETAIL_FILTERS: Record<keyof StoreDetail, StoreDetailFilter> = {
    has_convenience_store: {name: '편의점', operator: 'EQ', value: 1},
    has_cafe: {name: '카페', operator: 'EQ', value: 1},
    has_hot_spring: {name: '온천', operator: 'EQ', value: 1},
    is_pet_allowed: {name: '반려동물 동반', operator: 'EQ', value: 1},
    has_meal: {name: '식사 제공', operator: 'EQ', value: 1},
    is_delivery_allowed: {name: '배달 음식', operator: 'EQ', value: 1},
    has_parking: {name: '주차', operator: 'EQ', value: 1},
};

/**
 * 업체 — 입점 승인으로 만들어진다. 이용자에게는 활성(ACTIVE) · 미삭제 업체만 보인다.
 * 영업중 = 영업중 여부(is_open) 1 이고, 24시간 연중무휴(is_always_open) 이거나 요일별 영업시간(t_store_hour) 안 · 브레이크타임 밖.
 * is_open 이 0 이면 연중무휴로 되어 있어도 영업중 아님이다.
 * 상품 설정은 업체 상품 설정(t_room_plan — 상품 종류마다 1행), 객실 상세(방 수 · 샤워 · TV · PC)는 객실 그룹(t_room_group.room_group_detail), 업체 편의시설은 store_detail(JSON)이다.
 */
@Entity({name: 't_store', comment: '업체 정보'})
@Unique('UK_Store_BusinessNumber', ['business_number'])
@Unique('UK_Store_StoreCode', ['store_code'])
@Index('IDX_Store_LatitudeLongitude', ['latitude', 'longitude'])
export class StoreEntity {
    @PrimaryColumn({name: 'store_id', length: 32, comment: '업체 ID', primaryKeyConstraintName: 'PK_Store'})
    store_id: string;

    @Column({name: 'store_code', length: 32, nullable: false, comment: '업체코드(UUID 32자 — PK 와 별개, 매니저 로그인 · 매니저 화면 주소에 쓴다. 승인 때 만들고 바꾸지 않는다)'})
    store_code: string;

    @ManyToOne(() => StoreStateEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'store_state_id', referencedColumnName: 'store_state_id', foreignKeyConstraintName: 'FK_Store_StoreState'})
    store_state_id: string;

    @Column({name: 'store_name', length: 100, nullable: false, comment: '상호명'})
    store_name: string;

    @Column({name: 'business_number', length: 45, nullable: false, comment: '사업자등록번호(숫자 10자리, 삭제 시 DELETE_<store_id> 로 마스킹)'})
    business_number: string;

    @Column({name: 'owner_name', length: 50, nullable: false, comment: '대표자명'})
    owner_name: string;

    @Column({name: 'phone', length: 30, nullable: false, comment: '업체 연락처'})
    phone: string;

    @Column({name: 'address', length: 255, nullable: false, comment: '주소'})
    address: string;

    @Column({name: 'address_detail', type: 'varchar', length: 255, nullable: true, comment: '상세주소'})
    address_detail: string | null;

    @Column({name: 'latitude', type: 'double precision', nullable: false, comment: '위도(WGS84)'})
    latitude: number;

    @Column({name: 'longitude', type: 'double precision', nullable: false, comment: '경도(WGS84)'})
    longitude: number;

    @Column({name: 'introduction', type: 'text', nullable: true, comment: '업체 소개'})
    introduction: string | null;

    @Column({
        name: 'store_detail',
        type: 'jsonb',
        nullable: false,
        default: () => "'{}'",
        comment:
            '편의시설(JSON — has_convenience_store · has_cafe · has_hot_spring · is_pet_allowed · has_meal · is_delivery_allowed · has_parking, 항목은 바뀔 수 있다. 없는 항목은 조회 뒤 기본값 — 모두 없음 0)',
    })
    store_detail: StoreDetail;

    @Column({name: 'is_always_open', type: 'smallint', nullable: false, default: 0, comment: '24시간 연중무휴 여부(0: 요일별 영업시간 t_store_hour, 1: 24시간 연중무휴 — 영업시간을 두지 않는다)'})
    is_always_open: number;

    @Column({name: 'is_open', type: 'smallint', nullable: false, default: 1, comment: '영업중 여부(0: 영업중 아님 — 연중무휴 · 영업시간과 무관하게 영업중 아님으로 본다, 1: 영업중)'})
    is_open: number;

    @Column({name: 'maintenance_minutes', type: 'smallint', nullable: false, default: 0, comment: '정비시간(분) — 퇴실 후 다음 이용까지 호실을 막는 시간'})
    maintenance_minutes: number;

    @Column({name: 'booking_open_hours', type: 'smallint', nullable: false, default: 72, comment: '예약 가능 시작(시간) — 이용 시작 n시간 전부터 예약을 받는다(1 ~ 4,320)'})
    booking_open_hours: number;

    @Column({
        name: 'refund_deadline_minutes',
        type: 'smallint',
        nullable: false,
        default: 60,
        comment: '100% 환불 마감(분) — 이용 시작 n분 전까지 취소하면 100% 환불(0 ~ 10,080). 예약할 때 마감 시각을 예약에 저장한다',
    })
    refund_deadline_minutes: number;

    @Column({
        name: 'late_refund_percent',
        type: 'smallint',
        nullable: false,
        default: 50,
        comment: '마감 뒤 환불 비율(%) — 환불 마감 뒤 ~ 이용 시작 전 취소의 환불 비율(0 ~ 100, 원 단위 내림 — 0 이면 환불 없이 취소). 예약할 때 값을 예약에 저장한다',
    })
    late_refund_percent: number;

    @Column({
        name: 'door_secret',
        type: 'varchar',
        length: 100,
        nullable: true,
        comment: '문 소켓 시크릿 코드(bcrypt 해시) — 업체 총관리자가 정한다. 문 쪽 프로그램이 문 소켓에 붙을 때 확인, NULL 이면 소켓에 붙을 수 없다',
    })
    door_secret: string | null;

    @Column({name: 'suspend_comment', type: 'varchar', length: 255, nullable: true, comment: '정지 사유 — 영업중지(SUSPEND)일 때만, 업체 관리자에게 보인다'})
    suspend_comment: string | null;

    @Column({name: 'is_deleted', type: 'smallint', nullable: false, default: 0, comment: '삭제여부(0: 정상, 1: 삭제)'})
    is_deleted: number;

    @Column({name: 'delete_backup', type: 'text', nullable: true, comment: '삭제 시 이전 정보 백업(JSON)'})
    delete_backup: string | null;

    @Column({name: 'created_at', type: 'timestamptz', nullable: false, comment: '등록일'})
    created_at: Date;

    @Column({name: 'updated_at', type: 'timestamptz', nullable: false, comment: '수정일'})
    updated_at: Date;

    /**
     * insert 직전 등록일 · 수정일을 채운다.
     */
    @BeforeInsert()
    insertTimestamp(): void {
        const now = new Date();
        this.created_at = now;
        this.updated_at = now;
    }

    /**
     * update 직전 수정일을 갱신한다.
     */
    @BeforeUpdate()
    updateTimestamp(): void {
        this.updated_at = new Date();
    }

    /**
     * 조회 직후 편의시설의 빈 항목을 기본값(없음)으로 채운다 — 나중에 더한 항목도 기존 행을 고치지 않고 없음으로 보인다.
     */
    @AfterLoad()
    fillDetailDefaults(): void {
        this.store_detail = {...STORE_DETAIL_DEFAULTS, ...this.store_detail};
    }
}

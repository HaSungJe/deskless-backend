import {BadRequestException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {In, MoreThanOrEqual} from 'typeorm';
import {createValidationError} from '@app/common/utils/validation.js';
import type {DiscoveryRoomGroupDetailFilterListResultDto} from '@app/contracts/discovery/dto/discovery-room-group-detail-filter.dto.js';
import type {DiscoveryRoomGroupListResultDto} from '@app/contracts/discovery/dto/discovery-room-group-list.dto.js';
import type {DiscoveryStoreDetailResultDto} from '@app/contracts/discovery/dto/discovery-store-detail.dto.js';
import type {DiscoveryStoreListDto, DiscoveryStoreListResultDto} from '@app/contracts/discovery/dto/discovery-store-list.dto.js';
import {STORAGE_GATEWAY} from '@app/integration/integration.symbols.js';
import type {StorageGatewayInterface} from '@app/integration/interfaces/integration.interface.js';
import {DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE, DISCOVERY_STORE_IMAGE_PURPOSE, DISCOVERY_STORE_LIMIT, DISCOVERY_STORE_NOT_FOUND_MESSAGE, DISCOVERY_STORE_STATE_ACTIVE} from './discovery.constants.js';
import {DISCOVERY_REPOSITORY} from './discovery.symbols.js';
import {
    isRoomGroupDetailFilterKey,
    isRoomGroupPlanOnSale,
    isStorePlanUsed,
    splitDetailFilter,
    todayKst,
    toDiscoveryImage,
    toDiscoveryRoomGroups,
    toDiscoveryStoreDetail,
    toDiscoveryStoreItem,
    toRoomGroupDetailFilterItems,
    toStoreFilter,
} from './discovery.util.js';
import type {DiscoveryRepositoryInterface} from './interfaces/discovery.repository.interface.js';

/**
 * discovery 비즈니스 로직 — 이용자 업체 둘러보기(로그인 없음, 조회만). 활성 · 지워지지 않은 업체만 보인다(영업중 아님은 is_open 0 으로 보인다).
 * 시간대별 예약 가능한 호수는 reservation 도메인의 예약 가능 시간 API 가 맡는다(재고 계산 한 곳 — 사용자 결정 2026-11-06).
 */
@Injectable()
export class DiscoveryService {
    /**
     * @param discoveryRepository discovery repository 포트
     * @param storageGateway 파일 저장소 포트 (공개 주소만 — CloudFront)
     */
    constructor(
        @Inject(DISCOVERY_REPOSITORY) private readonly discoveryRepository: DiscoveryRepositoryInterface,
        @Inject(STORAGE_GATEWAY) private readonly storageGateway: StorageGatewayInterface,
    ) {}

    /**
     * 반경 업체 조회 — 중심 위경도 + 반경(5 · 10 · 20 · 50km, ALL 은 거리 제한 없음)의 활성 업체를 가까운 순으로 최대 300개(넘으면 is_truncated 1).
     * 추가정보 필터를 주면 고른 조건을 모두 갖춘 이용자에게 보이는 객실 그룹이 있는 업체만. 지도 마커 · 목록 카드 공용.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/store)
     *
     * @param dto 위도 · 경도 · 반경 · 추가정보 필터
     * @returns 업체 목록 · 잘림 여부
     * @throws BadRequestException 추가정보 필터에 정의에 없는 항목이 있을 때
     */
    async getStores(dto: DiscoveryStoreListDto): Promise<DiscoveryStoreListResultDto> {
        // 1. 추가정보 필터 — 정의(ROOM_GROUP_DETAIL_FILTERS)에 있는 항목만
        const detail_keys = splitDetailFilter(dto.detail_filter);
        if (!detail_keys.every(isRoomGroupDetailFilterKey)) {
            throw new BadRequestException({message: DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE, validation_errors: createValidationError('detail_filter', DISCOVERY_DETAIL_FILTER_INVALID_MESSAGE)});
        }

        // 2. 중심 · 반경 → 사각형(인덱스로 먼저 거른다) + 거리 조건(제한 없음이면 둘 다 없음) + 추가정보 조건, 잘림 판단용으로 1개 더
        const filter = toStoreFilter(Number(dto.latitude), Number(dto.longitude), dto.radius_km, detail_keys);
        const rows = await this.discoveryRepository.findStoreRows(filter, DISCOVERY_STORE_LIMIT + 1);

        // 3. 대표 사진 공개 주소
        return {
            list: rows
                .slice(0, DISCOVERY_STORE_LIMIT)
                .map((row) => toDiscoveryStoreItem(row, row.cover_file_key ? this.storageGateway.getPublicUrl({file_key: row.cover_file_key, file_storage: row.cover_file_storage}) : null)),
            is_truncated: rows.length > DISCOVERY_STORE_LIMIT ? 1 : 0,
        };
    }

    /**
     * 추가정보 필터 항목 — 객실 그룹 상세 항목마다 체크박스 1개(정의 순서). 항목이 늘면 저절로 늘어난다.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/room-group-detail-filter)
     *
     * @returns 항목 목록
     */
    getRoomGroupDetailFilters(): DiscoveryRoomGroupDetailFilterListResultDto {
        return {list: toRoomGroupDetailFilterItems()};
    }

    /**
     * 업체 상세 — 소개 · 사진 · 연락처 · 영업시간 · 브레이크타임 · 판매 중인 상품 설정 · 환불 규정. 사업자 정보는 넣지 않는다.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/store/:store_id)
     *
     * @param store_id 업체 ID
     * @returns 상세
     * @throws NotFoundException 활성 · 지워지지 않은 업체가 아닐 때
     */
    async getStore(store_id: string): Promise<DiscoveryStoreDetailResultDto> {
        // 1. 활성 업체
        const store = await this.discoveryRepository.findDiscoveryStore({store_id, store_state_id: DISCOVERY_STORE_STATE_ACTIVE});
        if (!store) {
            throw new NotFoundException({message: DISCOVERY_STORE_NOT_FOUND_MESSAGE});
        }

        // 2. 사진(공개 주소) · 영업시간 · 브레이크 · 사용 중인 상품 설정
        const images = await this.discoveryRepository.findStoreImages({store_id: store.store_id, store_file_purpose_id: DISCOVERY_STORE_IMAGE_PURPOSE});
        const hours = await this.discoveryRepository.findStoreHours(store.store_id);
        const breaks = await this.discoveryRepository.findStoreBreaks(store.store_id);
        const plans = (await this.discoveryRepository.findStorePlanRows(store.store_id)).filter(isStorePlanUsed);
        return toDiscoveryStoreDetail(
            store,
            images.map((image) => toDiscoveryImage(this.storageGateway.getPublicUrl(image), image.sort_order)),
            hours,
            breaks,
            plans,
        );
    }

    /**
     * 업체의 객실 그룹 목록 — 그룹명 순, 예약 받을 호실이 있고 판매 중인 상품이 있는 그룹만. 그룹마다 사진 · 상세정보 · 호실 수 · 상품(기본 요금 · 남은 기간 가격).
     * (내부 HTTP: GET /internal/v1/user-service/discovery/store/:store_id/room-group)
     *
     * @param store_id 업체 ID
     * @returns 그룹 목록
     * @throws NotFoundException 활성 · 지워지지 않은 업체가 아닐 때
     */
    async getRoomGroups(store_id: string): Promise<DiscoveryRoomGroupListResultDto> {
        // 1. 활성 업체 · 업체가 파는 상품 종류
        const store = await this.discoveryRepository.findDiscoveryStore({store_id, store_state_id: DISCOVERY_STORE_STATE_ACTIVE});
        if (!store) {
            throw new NotFoundException({message: DISCOVERY_STORE_NOT_FOUND_MESSAGE});
        }
        const store_plans = (await this.discoveryRepository.findStorePlanRows(store.store_id)).filter(isStorePlanUsed);
        if (store_plans.length === 0) {
            return {list: []};
        }

        // 2. 그룹
        const groups = await this.discoveryRepository.findRoomGroups({store_id: store.store_id});
        if (groups.length === 0) {
            return {list: []};
        }
        const group_ids = groups.map((group) => group.room_group_id);

        // 3. 예약 받을 호실 수 · 판매 중인 그룹 상품 · 남은 기간 가격(끝 날짜 ≥ 오늘) · 사진
        const counts = await this.discoveryRepository.countBookableRooms(group_ids);
        const group_plans = (await this.discoveryRepository.findRoomGroupPlans({room_group_id: In(group_ids)})).filter((plan) => isRoomGroupPlanOnSale(plan, store_plans));
        if (group_plans.length === 0) {
            return {list: []};
        }
        const periods = await this.discoveryRepository.findRoomGroupPlanPrices({room_group_plan_id: In(group_plans.map((plan) => plan.room_group_plan_id)), end_date: MoreThanOrEqual(todayKst())});
        const images = await this.discoveryRepository.findRoomGroupImages({room_group_id: In(group_ids)});
        return {
            list: toDiscoveryRoomGroups(
                groups,
                counts,
                store_plans,
                group_plans,
                periods,
                images.map((image) => ({room_group_id: image.room_group_id, ...toDiscoveryImage(this.storageGateway.getPublicUrl(image), image.sort_order)})),
            ),
        };
    }
}

import {BadRequestException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {Transactional} from '@nestjs-cls/transactional';
import {In} from 'typeorm';
import type {FindOptionsWhere} from 'typeorm';
import {Pagination} from '@app/common/utils/pagination.js';
import type {InquiryAnswerDto} from '@app/contracts/inquiry/dto/inquiry-answer.dto.js';
import type {InquiryManageDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-detail.dto.js';
import type {InquiryManageListDto, InquiryManageListResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-list.dto.js';
import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';
import type {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import {
    INQUIRY_ALREADY_BLIND_MESSAGE,
    INQUIRY_BLIND_ANSWER_MESSAGE,
    INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE,
    INQUIRY_NOT_BLIND_MESSAGE,
    INQUIRY_NOT_FOUND_MESSAGE,
    INQUIRY_UNBLINDED_STATES,
} from './inquiry.constants.js';
import {INQUIRY_REPOSITORY} from './inquiry.symbols.js';
import {
    buildInquiryAnswer,
    buildInquiryBlind,
    buildInquiryUnblind,
    toInquiryDetailFilter,
    toInquiryListFilter,
    toInquiryManageDetail,
    toInquiryManageItem,
    toInquiryScopeWhere,
    toInquiryUnblindWhere,
} from './inquiry.util.js';
import type {InquiryRepositoryInterface} from './interfaces/inquiry.repository.interface.js';

/**
 * inquiry 비즈니스 로직 (문의 관리) — 업체 관리자(업체 총관리자 · 업체 관리자)는 소속 업체 문의, 관리자(총관리자 · 관리자)는 업체 대상이 아닌(바로방) 문의만 다룬다.
 * 목록 · 상세 · 답변(1개 — 고칠 수 있다) · 블라인드 · 해제(상세에서 한 건씩 — 사용자 결정 2026-11-24). 블라인드 중에는 답변 · 수정할 수 없다.
 * 범위 조건은 inquiry.util.ts 의 toInquiryScopeWhere · toInquiry*Filter 한 곳이 만든다. 업체 관리자 쪽의 "소속 업체 찾기" 는 private 헬퍼 금지라 메서드마다 둔다.
 */
@Injectable()
export class InquiryService {
    /**
     * @param inquiryRepository inquiry repository 포트
     */
    constructor(
        @Inject(INQUIRY_REPOSITORY)
        private readonly inquiryRepository: InquiryRepositoryInterface,
    ) {}

    /**
     * 내 업체 문의 목록 (업체 관리자) — 카테고리 · 상태 · 검색어(제목 · 내용) — 고르지 않은 것은 전체, 최신순. (내부 HTTP: GET /internal/v1/admin-service/inquiry/mine)
     *
     * @param user_id 로그인 매니저 ID
     * @param dto 카테고리 · 상태 · 검색어 · 페이지
     * @returns 목록 · 페이지 정보
     */
    async getMyStoreInquiryList(user_id: string, dto: InquiryManageListDto): Promise<InquiryManageListResultDto> {
        // 1. 범위 정하기 — 매니저의 소속 업체(탈퇴 · 지운 업체 제외)
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        // 2. 개수 → 3. 같은 조건의 페이지
        const filter = toInquiryListFilter(managerStore.store_id, dto);
        const total_count = await this.inquiryRepository.countInquiryRows(filter);
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.inquiryRepository.findInquiryRows(filter, pagination.limit, pagination.offset);
        return {list: rows.map(toInquiryManageItem), pagination: pagination.getPagination()};
    }

    /**
     * 바로방 문의 목록 (관리자) — 업체 대상이 아닌 문의만, 카테고리 · 상태 · 검색어, 최신순. (내부 HTTP: GET /internal/v1/admin-service/inquiry)
     *
     * @param dto 카테고리 · 상태 · 검색어 · 페이지
     * @returns 목록 · 페이지 정보
     */
    async getInquiryList(dto: InquiryManageListDto): Promise<InquiryManageListResultDto> {
        // 1. 범위 정하기 — 업체 없음(바로방)
        const filter = toInquiryListFilter(null, dto);
        // 2. 개수 → 3. 같은 조건의 페이지
        const total_count = await this.inquiryRepository.countInquiryRows(filter);
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.inquiryRepository.findInquiryRows(filter, pagination.limit, pagination.offset);
        return {list: rows.map(toInquiryManageItem), pagination: pagination.getPagination()};
    }

    /**
     * 내 업체 문의 상세 (업체 관리자) — 작성자 · 카테고리 · 내용 · 답변 · 블라인드. 다른 업체 · 바로방 문의는 404. (내부 HTTP: GET /internal/v1/admin-service/inquiry/mine/:inquiry_id)
     *
     * @param user_id 로그인 매니저 ID
     * @param inquiry_id 문의 ID
     * @returns 상세
     */
    async getMyStoreInquiry(user_id: string, inquiry_id: string): Promise<InquiryManageDetailResultDto> {
        // 1. 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const row = await this.inquiryRepository.findInquiryDetailRow(toInquiryDetailFilter(managerStore.store_id, inquiry_id));
        if (!row) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }
        // 2. 상세 반환
        return toInquiryManageDetail(row);
    }

    /**
     * 바로방 문의 상세 (관리자) — 업체 문의는 404. (내부 HTTP: GET /internal/v1/admin-service/inquiry/:inquiry_id)
     *
     * @param inquiry_id 문의 ID
     * @returns 상세
     */
    async getInquiry(inquiry_id: string): Promise<InquiryManageDetailResultDto> {
        // 1. 범위 확인 — 업체 없음(바로방)
        const row = await this.inquiryRepository.findInquiryDetailRow(toInquiryDetailFilter(null, inquiry_id));
        if (!row) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }
        // 2. 상세 반환
        return toInquiryManageDetail(row);
    }

    /**
     * 내 업체 문의 답변 (업체 관리자) — 답변을 달거나 고치고 답변완료로. 블라인드면 400. (RabbitMQ: admin.inquiry.mine-answer)
     *
     * @param user_id 로그인 매니저 ID (답변 계정)
     * @param inquiry_id 문의 ID
     * @param dto 답변
     */
    @Transactional()
    async answerMyStoreInquiry(user_id: string, inquiry_id: string, dto: InquiryAnswerDto): Promise<void> {
        // 1. 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(managerStore.store_id), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // 2. 블라인드 확인
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }

        // 3. 답변 저장 — 블라인드가 아닐 때만(그사이 블라인드됐으면 0행 → 400 으로 롤백)
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryAnswer(user_id, dto.answer_content, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }
        // 4. 완료 (돌려줄 값 없음)
    }

    /**
     * 바로방 문의 답변 (관리자) — 업체 문의는 404, 블라인드면 400. (RabbitMQ: admin.inquiry.answer)
     *
     * @param user_id 로그인 관리자 ID (답변 계정)
     * @param inquiry_id 문의 ID
     * @param dto 답변
     */
    @Transactional()
    async answerInquiry(user_id: string, inquiry_id: string, dto: InquiryAnswerDto): Promise<void> {
        // 1. 범위 확인 — 업체 없음(바로방)
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(null), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // 2. 블라인드 확인
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }

        // 3. 답변 저장 — 블라인드가 아닐 때만
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryAnswer(user_id, dto.answer_content, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }
        // 4. 완료
    }

    /**
     * 내 업체 문의 블라인드 (업체 관리자) — 상세에서 본 부적절한 문의 한 건. 이미 블라인드면 400, 답변 칸은 그대로 둔다. (RabbitMQ: admin.inquiry.mine-blind)
     *
     * @param user_id 로그인 매니저 ID (블라인드한 계정)
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async blindMyStoreInquiry(user_id: string, inquiry_id: string): Promise<void> {
        // 1. 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(managerStore.store_id), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // 2. 상태 확인 — 이미 블라인드면 400
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }

        // 3. 블라인드 — 접수 · 답변완료일 때만(그사이 블라인드됐으면 0행 → 400 으로 롤백)
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryBlind(user_id, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }
        // 4. 완료 (돌려줄 값 없음)
    }

    /**
     * 바로방 문의 블라인드 (관리자) — 업체 문의는 404, 이미 블라인드면 400. (RabbitMQ: admin.inquiry.blind)
     *
     * @param user_id 로그인 관리자 ID (블라인드한 계정)
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async blindInquiry(user_id: string, inquiry_id: string): Promise<void> {
        // 1. 범위 확인 — 업체 없음(바로방)
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(null), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // 2. 상태 확인
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }

        // 3. 블라인드 — 접수 · 답변완료일 때만
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryBlind(user_id, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }
        // 4. 완료
    }

    /**
     * 내 업체 문의 블라인드 해제 (업체 관리자) — 답변이 있으면 답변완료, 없으면 접수로 되돌리고 블라인드 기록을 지운다. 블라인드가 아니면 400. (RabbitMQ: admin.inquiry.mine-unblind)
     *
     * @param user_id 로그인 매니저 ID
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async unblindMyStoreInquiry(user_id: string, inquiry_id: string): Promise<void> {
        // 1. 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(managerStore.store_id), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // 2. 상태 확인 — 블라인드가 아니면 400
        if (inquiry.inquiry_state_id !== INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }

        // 3. 해제 — 답변 있음 → 답변완료, 없음 → 접수. 블라인드 · 같은 답변 여부일 때만(그사이 바뀌었으면 0행 → 400 으로 롤백)
        const updated = await this.inquiryRepository.updateInquiry(toInquiryUnblindWhere(where, inquiry.answered_at), buildInquiryUnblind(inquiry.answered_at));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }
        // 4. 완료 (돌려줄 값 없음)
    }

    /**
     * 바로방 문의 블라인드 해제 (관리자) — 업체 문의는 404, 블라인드가 아니면 400. 누가 풀었는지는 남기지 않아 actor 를 받지 않는다. (RabbitMQ: admin.inquiry.unblind)
     *
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async unblindInquiry(inquiry_id: string): Promise<void> {
        // 1. 범위 확인 — 업체 없음(바로방)
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(null), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // 2. 상태 확인
        if (inquiry.inquiry_state_id !== INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }

        // 3. 해제 — 블라인드 · 같은 답변 여부일 때만
        const updated = await this.inquiryRepository.updateInquiry(toInquiryUnblindWhere(where, inquiry.answered_at), buildInquiryUnblind(inquiry.answered_at));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }
        // 4. 완료
    }
}

import {Inject, Injectable, NotFoundException} from '@nestjs/common';
import {Transactional} from '@nestjs-cls/transactional';
import {generateId} from '@app/common/utils/id.js';
import {Pagination} from '@app/common/utils/pagination.js';
import type {InquiryCategoryListResultDto} from '@app/contracts/inquiry/dto/inquiry-category-list.dto.js';
import type {InquiryDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-detail.dto.js';
import type {InquiryListDto, InquiryListResultDto} from '@app/contracts/inquiry/dto/inquiry-list.dto.js';
import type {InquiryDto, InquiryResultDto} from '@app/contracts/inquiry/dto/inquiry.dto.js';
import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import {INQUIRY_REPOSITORY} from './inquiry.symbols.js';
import {toInquiryCategoryItem, toMyInquiryDetail, toMyInquiryDetailFilter, toMyInquiryItem, toMyInquiryListFilter} from './inquiry.util.js';
import type {InquiryRepositoryInterface} from './interfaces/inquiry.repository.interface.js';

/**
 * inquiry 비즈니스 로직 (이용자 문의) — 카테고리 목록 · 등록 · 내 문의 목록 · 상세. 답변 · 블라인드는 admin-service inquiry 다(기능은 행위자로 서버를 고른다).
 * 이용 제한 · 탈퇴 대기 이용자도 문의할 수 있다(제한 사유를 물어볼 통로 — 상태를 보지 않는다). 동의 항목은 프론트가 등록 전에 체크한다(서버는 받지 않는다).
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
     * 문의 카테고리 목록 (로그인 없음) — 정렬 순서대로. 이용자 문의 등록 · 목록 거르기와 관리 목록 거르기가 같이 쓴다. (내부 HTTP: GET /internal/v1/user-service/inquiry/category)
     *
     * @returns 카테고리 목록
     */
    async getInquiryCategoryList(): Promise<InquiryCategoryListResultDto> {
        // 1. 카테고리 읽기 (sort_order 순 — repository)
        const categories = await this.inquiryRepository.findInquiryCategories();
        // 2. 목록 반환
        return {list: categories.map(toInquiryCategoryItem)};
    }

    /**
     * 문의 등록 — 업체(영업 중 · 영업중지)를 고르면 그 업체, 안 고르면 바로방(업체 없음)에 고른 카테고리 · 접수 상태로.
     * 카테고리 값은 게이트웨이 DTO 가 허용값(시드와 같다)으로 걸러 다시 찾지 않는다(FK 가 마지막 방어). (RabbitMQ: user.inquiry.create)
     *
     * @param user_id 로그인 이용자 ID
     * @param dto 업체(선택) · 카테고리 · 제목 · 내용
     * @returns 문의 ID
     */
    @Transactional()
    async createInquiry(user_id: string, dto: InquiryDto): Promise<InquiryResultDto> {
        // 1. 대상 확인 — 탈퇴 · 지운 · 없는 업체는 404, 업체를 안 고르면 바로방(조회 없음)
        const store_id = dto.store_id ?? null;
        if (store_id !== null) {
            const store = await this.inquiryRepository.findInquiryStore(store_id);
            if (!store) {
                throw new NotFoundException({message: '업체를 찾을 수 없습니다.'});
            }
        }

        // 2. 문의 저장 (접수 — 답변 · 블라인드 칸은 비운다)
        const inquiry = new InquiryEntity();
        inquiry.inquiry_id = generateId();
        inquiry.user_id = user_id;
        inquiry.store_id = store_id;
        inquiry.inquiry_category_id = dto.inquiry_category_id;
        inquiry.inquiry_state_id = INQUIRY_STATE.RECEIVED;
        inquiry.title = dto.title;
        inquiry.content = dto.content;
        inquiry.answer_content = null;
        inquiry.answer_user_id = null;
        inquiry.answered_at = null;
        inquiry.blind_user_id = null;
        inquiry.blinded_at = null;
        await this.inquiryRepository.insertInquiry(inquiry);

        // 3. ID 반환
        return {inquiry_id: inquiry.inquiry_id};
    }

    /**
     * 내 문의 목록 — 카테고리 · 상태 거르기(선택 — 없으면 전체), 블라인드 포함, 최신순. 개수 · 목록은 같은 필터. (내부 HTTP: GET /internal/v1/user-service/inquiry)
     *
     * @param user_id 로그인 이용자 ID
     * @param dto 카테고리(선택) · 상태(선택) · 페이지
     * @returns 목록 · 페이지 정보
     */
    async getMyInquiryList(user_id: string, dto: InquiryListDto): Promise<InquiryListResultDto> {
        // 1. 개수 — 내 문의 + 고른 카테고리 · 상태
        const filter = toMyInquiryListFilter(user_id, dto);
        const total_count = await this.inquiryRepository.countMyInquiryRows(filter);
        // 2. 같은 조건의 페이지 (최신순 — 업체명 · 카테고리명 · 상태명 조인)
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.inquiryRepository.findMyInquiryRows(filter, pagination.limit, pagination.offset);
        return {list: rows.map(toMyInquiryItem), pagination: pagination.getPagination()};
    }

    /**
     * 내 문의 상세 — 답변 포함, 블라인드도 그대로 보인다(안내 문구는 프론트). 남의 문의는 404. (내부 HTTP: GET /internal/v1/user-service/inquiry/:inquiry_id)
     *
     * @param user_id 로그인 이용자 ID
     * @param inquiry_id 문의 ID
     * @returns 상세
     */
    async getMyInquiry(user_id: string, inquiry_id: string): Promise<InquiryDetailResultDto> {
        // 1. 내 문의 찾기 — 작성자 조건이 쿼리에 들어가 남의 문의는 없는 것과 같다
        const row = await this.inquiryRepository.findMyInquiryDetailRow(toMyInquiryDetailFilter(user_id, inquiry_id));
        if (!row) {
            throw new NotFoundException({message: '문의를 찾을 수 없습니다.'});
        }
        // 2. 상세 반환
        return toMyInquiryDetail(row);
    }
}

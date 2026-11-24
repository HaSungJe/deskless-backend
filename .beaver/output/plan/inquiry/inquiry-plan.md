# Plan — 문의사항 (카테고리 · 답변 · 블라인드)

> 무엇을·왜는 [spec](../../spec/inquiry/inquiry-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 진입점마다 비즈니스 로직 전체 ② 계산 함수 ③ 규약만으로 예측할 수 없는 데이터 규칙·쿼리
> **싣지 않는 것** 진입점 껍데기, 입력 검증 객체, 등록·배선, 형제 코드와 같은 조회 — 따르는 패턴을 표 한 줄로 가리킨다

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `libs/database/src/entities/inquiry/inquiry-state.entity.ts` | 신규 | 문의 상태 룩업 `t_inquiry_state` | 생략 (store-state.entity.ts 그대로) |
| `libs/database/src/entities/inquiry/inquiry-category.entity.ts` | 신규 | 문의 카테고리 룩업 `t_inquiry_category` — ID · 이름 · 정렬 순서 | 아래 3-1 |
| `libs/database/src/entities/inquiry/inquiry.entity.ts` | 신규 | 문의 `t_inquiry` — 카테고리 FK · 답변 · 블라인드 칸, CHECK 2개 | 아래 3-1 |
| `libs/database/src/entities.ts` | 수정 | `ENTITIES` 에 세 엔티티 | 생략 |
| `libs/database/src/seeder/seeder.targets.ts` | 수정 | `INQUIRY_STATE_SEED_DATA` · `INQUIRY_CATEGORY_SEED_DATA` + `SEED_TARGETS` | 아래 3-1 |
| `libs/database/src/migrations/<ts>-Inquiry.ts` · `migrations.ts` | 신규 · 수정 | `npm run db:generate -- Inquiry` 결과 | 생략 (생성기) |
| `libs/contracts/src/inquiry/inquiry.constants.ts` | 신규 | `INQUIRY_STATE` · `INQUIRY_STATE_IDS` · `INQUIRY_CATEGORY` · `INQUIRY_CATEGORY_IDS`(DTO `@IsIn` · 두 서비스 공용) | 아래 3-2 |
| `libs/contracts/src/inquiry/inquiry.commands.ts` | 신규 | 명령 type · 내부 경로(user-service `INQUIRY_USER_*` — 카테고리 목록 포함, admin-service `INQUIRY_*`) | 아래 3-2 |
| `libs/contracts/src/inquiry/dto/inquiry-category-list.dto.ts` | 신규 | 카테고리 목록 항목 · 결과 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry.dto.ts` | 신규 | 문의 등록 입력(카테고리 필수) · 결과 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-list.dto.ts` | 신규 | 내 문의 목록 query(생성자 — 카테고리 · 상태) · 항목 · 결과 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-detail.dto.ts` | 신규 | 내 문의 상세 path param · 결과 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-manage-list.dto.ts` | 신규 | 관리 목록 query(생성자 — 카테고리 · 상태 · 검색어) · 항목 · 결과 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-manage-detail.dto.ts` | 신규 | 관리 상세 path param · 결과 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-answer.dto.ts` | 신규 | 답변 path param · 본문 | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-blind.dto.ts` | 신규 | 블라인드 path param(`inquiry_id`) — 결과 없음(void) | 생략 |
| `libs/contracts/src/inquiry/dto/inquiry-unblind.dto.ts` | 신규 | 해제 path param(`inquiry_id`) — 결과 없음(void) | 생략 |
| `libs/contracts/src/discovery/dto/discovery-store-search.dto.ts` | 신규 | 업체 이름 검색 query(생성자) · 결과 | 생략 |
| `libs/contracts/src/discovery/discovery.commands.ts` | 수정 | `DISCOVERY_INTERNAL_PATH.STORE_SEARCH` | 생략 |
| `apps/user-service/src/discovery/discovery.service.ts` | 수정 | `searchStores` | 아래 1-1 |
| `apps/user-service/src/discovery/discovery.constants.ts` | 수정 | 검색 대상 업체 상태 · 최대 20건 | 아래 3-4 |
| `apps/user-service/src/discovery/discovery.util.ts` | 수정 | `toStoreSearchItem` | 생략 |
| `apps/user-service/src/discovery/interfaces/discovery.repository.interface.ts` · `repositories/discovery.repository.ts` | 수정 | `findStoreSearchRows` · `buildStoreSearchQuery` | 아래 3-4 |
| `apps/user-service/src/discovery/controllers/discovery.controller.ts` | 수정 | `GET /store-search` | 생략 |
| `apps/user-service/src/inquiry/**` | 신규 | 이용자 문의 도메인 — controllers(동기 · 큐) · service · repository · interface · symbols · constants · util · module | service 아래 1-2 ~ 1-5, 쿼리 아래 3-5 |
| `apps/user-service/src/user-service.module.ts` | 수정 | `InquiryModule` 등록 | 생략 |
| `apps/admin-service/src/inquiry/**` | 신규 | 문의 관리 도메인 — controllers(동기 · 큐) · service · repository · interface · symbols · constants · util · module | service 아래 1-6 ~ 1-10, 범위 · 쿼리 아래 3-3 |
| `apps/admin-service/src/admin-service.module.ts` | 수정 | `InquiryModule` 등록 | 생략 |
| `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts` | 수정 | `GET /store-search`(가드 없음) | 생략 |
| `apps/gateway/src/api/v1/user-service/inquiry/**` | 신규 | 이용자 문의 라우트 — 카테고리 목록(가드 없음 · `/:inquiry_id` 보다 먼저) · 그 밖 이용자 가드, 동기 3 · 큐 1 · module | 생략 |
| `apps/gateway/src/api/v1/admin-service/inquiry/**` | 신규 | 문의 관리 라우트 — `/mine…` 매니저 가드 · 그 밖 관리자 가드, 동기 4 · 큐 6 · module | 생략 |
| `apps/gateway/src/gateway.module.ts` | 수정 | `InquiryModule as UserInquiryModule` · `InquiryModule` | 생략 |
| `apps/user-service/src/inquiry/test/*` · `apps/user-service/src/discovery/test/*` · `apps/admin-service/src/inquiry/test/*` | 신규 · 수정 | service 기능 spec · repository spec · test-helper | 아래 "테스트" |
| `README.md` | 수정 | 구조의 도메인 목록에 `inquiry` | 생략 |
| `AGENTS.md` | 수정 | 도메인 트리 · `@Query()` DTO 목록 · Pagination 적용 목록 · Data-Access Smoke 목록 | 생략 |
| `docs/architecture.md` | 수정 | 앱 표의 도메인 · 라우트 표 · 게이트웨이 모듈 · 폴더 트리 | 생략 |
| `.beaver/output/frontend/changes/2026-11-24-inquiry.md` · `changes/README.md` | 신규 · 수정 | 프론트 수정 요청(API 추가 · 등록 전 동의 항목 체크 · 카테고리 고르기 · 목록 거르기 · 블라인드 안내 문구 · DTO 사본) + 목록 한 줄 | 생략 |

---

## 1. 비즈니스 로직 — 진입점별 코드

### 1-1. 업체 이름 검색 — `DiscoveryService.searchStores`

```ts
// apps/user-service/src/discovery/discovery.service.ts
    /**
     * 업체 이름 검색 (문의할 업체 고르기) — 상호명 부분 일치, 영업 중 · 영업중지(탈퇴 · 지운 업체 제외), 상호명 순 최대 20건.
     * 주소 · 위경도(지도에서 위치 확인) · 대표 사진 1장(공개 주소, 없으면 null)을 같이 준다(사용자 결정 2026-11-24). 로그인 없음.
     * (내부 HTTP: GET /internal/v1/user-service/discovery/store-search)
     *
     * @param dto 검색어
     * @returns 업체 목록
     */
    async searchStores(dto: DiscoveryStoreSearchDto): Promise<DiscoveryStoreSearchResultDto> {
        // ① 이름 검색 — 상태 · 삭제 · 개수 조건과 대표 사진 키는 쿼리(3-4)
        const rows = await this.discoveryRepository.findStoreSearchRows(dto.keyword, DISCOVERY_STORE_SEARCH_LIMIT);
        // ② 대표 사진 공개 주소를 붙여 목록 반환(반경 업체 조회 getStores 와 같은 방식)
        return {
            list: rows.map((row) => toStoreSearchItem(row, row.cover_file_key ? this.storageGateway.getPublicUrl({file_key: row.cover_file_key, file_storage: row.cover_file_storage}) : null)),
        };
    }
```

### 1-2. 문의 카테고리 목록 — `InquiryService.getInquiryCategoryList` (user-service)

로그인 없는 조회 하나를 이용자 화면 · 관리 화면이 같이 쓴다(업체 검색 추가정보 필터 항목 `getRoomGroupDetailFilters` 와 같은 자리 — discovery.controller.ts:41). 고정 룩업이라 업체 · 이용자 조건이 없다.

```ts
// apps/user-service/src/inquiry/inquiry.service.ts
import {Inject, Injectable, NotFoundException} from '@nestjs/common';
import {Transactional} from '@nestjs-cls/transactional';
import {generateId} from '@app/common/utils/id.js';
import {Pagination} from '@app/common/utils/pagination.js';
import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';
import type {InquiryCategoryListResultDto} from '@app/contracts/inquiry/dto/inquiry-category-list.dto.js';
import type {InquiryDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-detail.dto.js';
import type {InquiryListDto, InquiryListResultDto} from '@app/contracts/inquiry/dto/inquiry-list.dto.js';
import type {InquiryDto, InquiryResultDto} from '@app/contracts/inquiry/dto/inquiry.dto.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {InquiryRepositoryInterface} from './interfaces/inquiry.repository.interface.js';
import {INQUIRY_NOT_FOUND_MESSAGE, INQUIRY_STORE_NOT_FOUND_MESSAGE} from './inquiry.constants.js';
import {INQUIRY_REPOSITORY} from './inquiry.symbols.js';
import {toInquiryCategoryItem, toMyInquiryDetail, toMyInquiryDetailFilter, toMyInquiryItem, toMyInquiryListFilter} from './inquiry.util.js';

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
        // ① 카테고리 읽기 (sort_order 순 — repository)
        const categories = await this.inquiryRepository.findInquiryCategories();
        // ② 목록 반환
        return {list: categories.map(toInquiryCategoryItem)};
    }
```

### 1-3. 문의 등록 — `InquiryService.createInquiry`

카테고리 값은 게이트웨이 DTO 가 `@IsIn(INQUIRY_CATEGORY_IDS)` 로 거른다 — 허용값은 시드와 같으므로 service 는 카테고리를 다시 찾지 않는다(FK 가 마지막 방어).

```ts
    /**
     * 문의 등록 — 업체(영업 중 · 영업중지)를 고르면 그 업체, 안 고르면 바로방(업체 없음)에 고른 카테고리 · 접수 상태로. (RabbitMQ: user.inquiry.create)
     *
     * @param user_id 로그인 이용자 ID
     * @param dto 업체(선택) · 카테고리 · 제목 · 내용
     * @returns 문의 ID
     */
    @Transactional()
    async createInquiry(user_id: string, dto: InquiryDto): Promise<InquiryResultDto> {
        // ① 대상 확인 — 탈퇴 · 지운 · 없는 업체는 404, 업체를 안 고르면 바로방(조회 없음)
        const store_id = dto.store_id ?? null;
        if (store_id !== null) {
            const store = await this.inquiryRepository.findInquiryStore(store_id);
            if (!store) {
                throw new NotFoundException({message: INQUIRY_STORE_NOT_FOUND_MESSAGE});
            }
        }

        // ② 문의 저장 (접수 — 답변 · 블라인드 칸은 비운다)
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

        // ③ ID 반환
        return {inquiry_id: inquiry.inquiry_id};
    }
```

### 1-4. 내 문의 목록 — `InquiryService.getMyInquiryList`

개수와 행을 같은 필터 객체 하나로 같은 QueryBuilder(3-5)가 만든다 — 카테고리 · 상태 조건이 개수와 목록에서 어긋나지 않는다(관리 목록 1-6 과 같은 모양). "전체" 는 값을 보내지 않는 것이라 필터의 그 칸이 null(조건 없음)이다.

```ts
    /**
     * 내 문의 목록 — 카테고리 · 상태 거르기(선택 — 없으면 전체), 블라인드 포함, 최신순. (내부 HTTP: GET /internal/v1/user-service/inquiry)
     *
     * @param user_id 로그인 이용자 ID
     * @param dto 카테고리(선택) · 상태(선택) · 페이지
     * @returns 목록 · 페이지 정보
     */
    async getMyInquiryList(user_id: string, dto: InquiryListDto): Promise<InquiryListResultDto> {
        // ① 개수 — 내 문의 + 고른 카테고리 · 상태
        const filter = toMyInquiryListFilter(user_id, dto);
        const total_count = await this.inquiryRepository.countMyInquiryRows(filter);
        // ② 같은 조건의 페이지 (최신순 — 업체명 · 카테고리명 · 상태명 조인, 3-5)
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.inquiryRepository.findMyInquiryRows(filter, pagination.limit, pagination.offset);
        return {list: rows.map(toMyInquiryItem), pagination: pagination.getPagination()};
    }
```

### 1-5. 내 문의 상세 — `InquiryService.getMyInquiry`

```ts
    /**
     * 내 문의 상세 — 답변 포함, 블라인드도 그대로 보인다(안내 문구는 프론트). 남의 문의는 404. (내부 HTTP: GET /internal/v1/user-service/inquiry/:inquiry_id)
     *
     * @param user_id 로그인 이용자 ID
     * @param inquiry_id 문의 ID
     * @returns 상세
     */
    async getMyInquiry(user_id: string, inquiry_id: string): Promise<InquiryDetailResultDto> {
        // ① 내 문의 찾기 — 작성자 조건이 쿼리에 들어가 남의 문의는 없는 것과 같다
        const row = await this.inquiryRepository.findMyInquiryDetailRow(toMyInquiryDetailFilter(user_id, inquiry_id));
        if (!row) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }
        // ② 상세 반환
        return toMyInquiryDetail(row);
    }
}
```

### 1-6. 문의 목록 (업체 관리자 · 관리자) — `InquiryService.getMyStoreInquiryList` · `getInquiryList` (admin-service)

두 경로는 범위만 다르다 — 범위 조건은 3-3 의 util 하나가 만든다(목록 · 상세 · 답변 · 블라인드 · 해제가 같이 쓴다). service private 헬퍼 금지라 업체 관리자 쪽의 "소속 업체 찾기" 몇 줄은 메서드마다 둔다(통계 `getStats` · `getMyStats` 와 같은 모양, stats.controller.ts:37 · 55).

```ts
// apps/admin-service/src/inquiry/inquiry.service.ts
import {BadRequestException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {Transactional} from '@nestjs-cls/transactional';
import {In} from 'typeorm';
import type {FindOptionsWhere} from 'typeorm';
import {Pagination} from '@app/common/utils/pagination.js';
import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';
import type {InquiryAnswerDto} from '@app/contracts/inquiry/dto/inquiry-answer.dto.js';
import type {InquiryManageDetailResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-detail.dto.js';
import type {InquiryManageListDto, InquiryManageListResultDto} from '@app/contracts/inquiry/dto/inquiry-manage-list.dto.js';
import type {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {InquiryRepositoryInterface} from './interfaces/inquiry.repository.interface.js';
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

/**
 * inquiry 비즈니스 로직 (문의 관리) — 업체 관리자(업체 총관리자 · 업체 관리자)는 소속 업체 문의, 관리자(총관리자 · 관리자)는 업체 대상이 아닌(바로방) 문의만 다룬다.
 * 목록 · 상세 · 답변(1개 — 고칠 수 있다) · 블라인드 · 해제(상세에서 한 건씩). 블라인드 중에는 답변 · 수정할 수 없다.
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
        // ① 범위 정하기 — 매니저의 소속 업체(탈퇴 · 지운 업체 제외)
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        // ② 개수 → ③ 같은 조건의 페이지
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
        // ① 범위 정하기 — 업체 없음(바로방)
        const filter = toInquiryListFilter(null, dto);
        // ② 개수 → ③ 같은 조건의 페이지
        const total_count = await this.inquiryRepository.countInquiryRows(filter);
        const pagination = new Pagination({...dto, total_count});
        const rows = await this.inquiryRepository.findInquiryRows(filter, pagination.limit, pagination.offset);
        return {list: rows.map(toInquiryManageItem), pagination: pagination.getPagination()};
    }
```

### 1-7. 문의 상세 (업체 관리자 · 관리자) — `getMyStoreInquiry` · `getInquiry`

```ts
    /**
     * 내 업체 문의 상세 (업체 관리자) — 작성자 · 내용 · 답변 · 블라인드. 다른 업체 · 바로방 문의는 404. (내부 HTTP: GET /internal/v1/admin-service/inquiry/mine/:inquiry_id)
     *
     * @param user_id 로그인 매니저 ID
     * @param inquiry_id 문의 ID
     * @returns 상세
     */
    async getMyStoreInquiry(user_id: string, inquiry_id: string): Promise<InquiryManageDetailResultDto> {
        // ① 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const row = await this.inquiryRepository.findInquiryDetailRow(toInquiryDetailFilter(managerStore.store_id, inquiry_id));
        if (!row) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }
        // ② 상세 반환
        return toInquiryManageDetail(row);
    }

    /**
     * 바로방 문의 상세 (관리자) — 업체 문의는 404. (내부 HTTP: GET /internal/v1/admin-service/inquiry/:inquiry_id)
     *
     * @param inquiry_id 문의 ID
     * @returns 상세
     */
    async getInquiry(inquiry_id: string): Promise<InquiryManageDetailResultDto> {
        // ① 범위 확인 — 업체 없음(바로방)
        const row = await this.inquiryRepository.findInquiryDetailRow(toInquiryDetailFilter(null, inquiry_id));
        if (!row) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }
        // ② 상세 반환
        return toInquiryManageDetail(row);
    }
```

### 1-8. 문의 답변 — `answerMyStoreInquiry` · `answerInquiry`

확인(②)과 저장(③) 사이에 다른 사람이 블라인드할 수 있다 — 저장 조건에 "블라인드가 아님"(접수 · 답변완료)을 걸고 0행이면 400 으로 되돌린다(상태 조건을 건 쓰기, store `updateApplication` 과 같은 방식).

```ts
    /**
     * 내 업체 문의 답변 (업체 관리자) — 답변을 달거나 고치고 답변완료로. 블라인드면 400. (RabbitMQ: admin.inquiry.mine-answer)
     *
     * @param user_id 로그인 매니저 ID (답변 계정)
     * @param inquiry_id 문의 ID
     * @param dto 답변
     */
    @Transactional()
    async answerMyStoreInquiry(user_id: string, inquiry_id: string, dto: InquiryAnswerDto): Promise<void> {
        // ① 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(managerStore.store_id), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // ② 블라인드 확인
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }

        // ③ 답변 저장 — 블라인드가 아닐 때만(그사이 블라인드됐으면 0행 → 400 으로 롤백)
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryAnswer(user_id, dto.answer_content, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }
        // ④ 완료 (돌려줄 값 없음)
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
        // ① 범위 확인 — 업체 없음(바로방)
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(null), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // ② 블라인드 확인
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }

        // ③ 답변 저장 — 블라인드가 아닐 때만
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryAnswer(user_id, dto.answer_content, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_BLIND_ANSWER_MESSAGE});
        }
        // ④ 완료
    }
```

### 1-9. 문의 블라인드 — `blindMyStoreInquiry` · `blindInquiry`

상세에서 한 건씩 한다(사용자 결정 2026-11-24 — 처음의 선택 일괄 처리를 바꿨다). 답변(1-8)과 같은 모양이다 — 범위 확인 → 상태 확인 → 상태 조건을 건 저장(그사이 다른 사람이 블라인드했으면 0행 → 400 으로 롤백).

```ts
    /**
     * 내 업체 문의 블라인드 (업체 관리자) — 상세에서 본 부적절한 문의 한 건. 이미 블라인드면 400, 답변 칸은 그대로 둔다(해제 때 답변완료로 돌아갈 근거). (RabbitMQ: admin.inquiry.mine-blind)
     *
     * @param user_id 로그인 매니저 ID (블라인드한 계정)
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async blindMyStoreInquiry(user_id: string, inquiry_id: string): Promise<void> {
        // ① 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(managerStore.store_id), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // ② 상태 확인 — 이미 블라인드면 400
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }

        // ③ 블라인드 — 접수 · 답변완료일 때만(그사이 블라인드됐으면 0행 → 400 으로 롤백)
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryBlind(user_id, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }
        // ④ 완료 (돌려줄 값 없음)
    }

    /**
     * 바로방 문의 블라인드 (관리자) — 업체 문의는 404, 이미 블라인드면 400. (RabbitMQ: admin.inquiry.blind)
     *
     * @param user_id 로그인 관리자 ID (블라인드한 계정)
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async blindInquiry(user_id: string, inquiry_id: string): Promise<void> {
        // ① 범위 확인 — 업체 없음(바로방)
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(null), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // ② 상태 확인
        if (inquiry.inquiry_state_id === INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }

        // ③ 블라인드 — 접수 · 답변완료일 때만
        const updated = await this.inquiryRepository.updateInquiry({...where, inquiry_state_id: In(INQUIRY_UNBLINDED_STATES)}, buildInquiryBlind(user_id, new Date()));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_ALREADY_BLIND_MESSAGE});
        }
        // ④ 완료
    }
```

### 1-10. 문의 블라인드 해제 — `unblindMyStoreInquiry` · `unblindInquiry`

되돌릴 상태는 찾은 행의 `answered_at` 으로 고른다(직전 상태 컬럼이 없다 — 답변 있음 → 답변완료, 없음 → 접수). 저장 조건에는 "블라인드" 와 "찾을 때와 같은 답변 여부" 를 같이 건다(3-3 `toInquiryUnblindWhere`) — 그사이 다른 사람이 풀었거나(블라인드 아님), 풀고 답변한 뒤 다시 블라인드했으면(답변 여부가 바뀜) 0행 → 400 으로 롤백한다. 답변 여부 조건이 없으면 마지막 경우에 답변 칸이 찬 채로 접수가 되어 `CHK_Inquiry_Answer` 위반(500)이 난다.

```ts
    /**
     * 내 업체 문의 블라인드 해제 (업체 관리자) — 답변이 있으면 답변완료, 없으면 접수로 되돌리고 블라인드 기록을 지운다. 블라인드가 아니면 400. (RabbitMQ: admin.inquiry.mine-unblind)
     *
     * @param user_id 로그인 매니저 ID
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async unblindMyStoreInquiry(user_id: string, inquiry_id: string): Promise<void> {
        // ① 범위 확인 — 소속 업체의 문의만
        const managerStore = await this.inquiryRepository.findManagerStore(user_id);
        if (!managerStore) {
            throw new NotFoundException({message: INQUIRY_MANAGER_STORE_NOT_FOUND_MESSAGE});
        }
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(managerStore.store_id), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // ② 상태 확인 — 블라인드가 아니면 400
        if (inquiry.inquiry_state_id !== INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }

        // ③ 해제 — 답변 있음 → 답변완료, 없음 → 접수. 블라인드 · 같은 답변 여부일 때만(그사이 바뀌었으면 0행 → 400 으로 롤백)
        const updated = await this.inquiryRepository.updateInquiry(toInquiryUnblindWhere(where, inquiry.answered_at), buildInquiryUnblind(inquiry.answered_at));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }
        // ④ 완료 (돌려줄 값 없음)
    }

    /**
     * 바로방 문의 블라인드 해제 (관리자) — 업체 문의는 404, 블라인드가 아니면 400. (RabbitMQ: admin.inquiry.unblind)
     *
     * @param inquiry_id 문의 ID
     */
    @Transactional()
    async unblindInquiry(inquiry_id: string): Promise<void> {
        // ① 범위 확인 — 업체 없음(바로방)
        const where: FindOptionsWhere<InquiryEntity> = {...toInquiryScopeWhere(null), inquiry_id};
        const inquiry = await this.inquiryRepository.findInquiry(where);
        if (!inquiry) {
            throw new NotFoundException({message: INQUIRY_NOT_FOUND_MESSAGE});
        }

        // ② 상태 확인
        if (inquiry.inquiry_state_id !== INQUIRY_STATE.BLIND) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }

        // ③ 해제 — 블라인드 · 같은 답변 여부일 때만
        const updated = await this.inquiryRepository.updateInquiry(toInquiryUnblindWhere(where, inquiry.answered_at), buildInquiryUnblind(inquiry.answered_at));
        if (!updated) {
            throw new BadRequestException({message: INQUIRY_NOT_BLIND_MESSAGE});
        }
        // ④ 완료
    }
}
```

해제는 누가 풀었는지를 남기지 않는다(블라인드 기록을 지운다 — 이용 제한 해제 때 사유를 지우는 것과 같은 방식, manager.service.ts:621). 그래서 관리자 해제는 actor 가 필요 없다 — 큐 핸들러는 `requireActor(command)` 로 로그인만 확인하고 service 에는 넘기지 않는다.

---

## 3. 데이터 규칙 — 규약만으로 예측할 수 없는 부분

### 3-1. 문의 테이블 · 카테고리 · 상태 룩업 — `libs/database/src/entities/inquiry/*.entity.ts`

카테고리는 룩업이지만 화면에 목록으로 내려가는 첫 룩업이라 정렬 순서 `sort_order` 를 둔다 — ID · 이름뿐이면 이름순에서 "기타" 가 가운데로 온다. 값은 기본 데이터 시드가 넣고 순서를 바꿀 API 는 없다.

```ts
// libs/database/src/entities/inquiry/inquiry-category.entity.ts
import {Column, Entity, PrimaryColumn} from 'typeorm';

/**
 * 문의 카테고리 (룩업) — 기본 데이터는 seeder.targets.ts(예약 · 결제/환불 · 객실/시설 · 출입/QR · 회원/계정 · 입점 · 기타).
 * 업체 문의 · 바로방 문의가 같은 목록을 쓴다. 화면 순서는 sort_order(작은 값이 먼저 — 사용자 결정 2026-11-24).
 */
@Entity({name: 't_inquiry_category', comment: '문의 카테고리'})
export class InquiryCategoryEntity {
    @PrimaryColumn({name: 'inquiry_category_id', length: 20, comment: '문의 카테고리 ID', primaryKeyConstraintName: 'PK_InquiryCategory'})
    inquiry_category_id: string;

    @Column({name: 'inquiry_category_name', length: 50, nullable: false, comment: '문의 카테고리명'})
    inquiry_category_name: string;

    @Column({name: 'sort_order', type: 'smallint', nullable: false, comment: '화면 정렬 순서(작은 값이 먼저)'})
    sort_order: number;
}
```

`t_user` 를 가리키는 FK 가 셋(작성자 · 답변 계정 · 블라인드 계정)이라 "FK 는 가리키는 PK 와 같은 이름" 을 셋 다 지킬 수 없다 — 작성자만 `user_id`, 나머지는 역할을 붙인 `answer_user_id` · `blind_user_id`(제약명 `FK_Inquiry_AnswerUser` · `FK_Inquiry_BlindUser`). 상태와 칸이 어긋나지 않게 CHECK 2개를 둔다 — 답변 세 칸은 같이 차거나 같이 비고, 블라인드 두 칸은 블라인드 상태일 때만 찬다. 답변완료 = 답변 있음(블라인드가 아니면)도 같은 CHECK 에 넣는다.

```ts
import {BeforeInsert, BeforeUpdate, Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn} from 'typeorm';
import {StoreEntity} from '../store/store.entity.js';
import {UserEntity} from '../user/user.entity.js';
import {InquiryCategoryEntity} from './inquiry-category.entity.js';
import {InquiryStateEntity} from './inquiry-state.entity.js';

/**
 * 문의 — 이용자가 카테고리를 골라 업체(store_id) 또는 바로방(store_id NULL — 운영)에 남긴 문의와 답변 · 블라인드(사용자 결정 2026-11-24).
 * 답변은 문의당 1개(고치면 덮어쓴다), 블라인드는 업체 관리자 · 관리자가 골라서 한 번에 하고 해제하면 블라인드 칸을 지운다. 지우지 않는다(is_deleted 없음).
 */
@Entity({name: 't_inquiry', comment: '문의 — 이용자가 카테고리를 골라 업체 또는 바로방에 남긴 문의 · 답변 · 블라인드'})
@Index('IDX_Inquiry_UserIdCreatedAt', ['user_id', 'created_at'])
@Index('IDX_Inquiry_StoreIdCreatedAt', ['store_id', 'created_at'])
@Check('CHK_Inquiry_Answer', `("answer_content" IS NULL) = ("answered_at" IS NULL) AND ("answer_content" IS NULL) = ("answer_user_id" IS NULL) AND ("inquiry_state_id" = 'BLIND' OR ("inquiry_state_id" = 'ANSWERED') = ("answered_at" IS NOT NULL))`)
@Check('CHK_Inquiry_Blind', `("inquiry_state_id" = 'BLIND') = ("blinded_at" IS NOT NULL) AND ("blinded_at" IS NULL) = ("blind_user_id" IS NULL)`)
export class InquiryEntity {
    @PrimaryColumn({name: 'inquiry_id', length: 32, comment: '문의 ID', primaryKeyConstraintName: 'PK_Inquiry'})
    inquiry_id: string;

    @ManyToOne(() => UserEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_Inquiry_User'})
    user_id: string;

    @ManyToOne(() => StoreEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'store_id', referencedColumnName: 'store_id', foreignKeyConstraintName: 'FK_Inquiry_Store'})
    store_id: string | null;

    @ManyToOne(() => InquiryCategoryEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'inquiry_category_id', referencedColumnName: 'inquiry_category_id', foreignKeyConstraintName: 'FK_Inquiry_InquiryCategory'})
    inquiry_category_id: string;

    @ManyToOne(() => InquiryStateEntity, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
    @JoinColumn({name: 'inquiry_state_id', referencedColumnName: 'inquiry_state_id', foreignKeyConstraintName: 'FK_Inquiry_InquiryState'})
    inquiry_state_id: string;

    @Column({name: 'title', type: 'varchar', length: 100, nullable: false, comment: '제목(100자)'})
    title: string;

    @Column({name: 'content', type: 'varchar', length: 2000, nullable: false, comment: '내용(2000자)'})
    content: string;

    @Column({name: 'answer_content', type: 'varchar', length: 2000, nullable: true, comment: '답변(2000자 — 답변 전 NULL, 고치면 덮어쓴다)'})
    answer_content: string | null;

    @ManyToOne(() => UserEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'answer_user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_Inquiry_AnswerUser'})
    answer_user_id: string | null;

    @Column({name: 'answered_at', type: 'timestamptz', nullable: true, comment: '마지막으로 답변(수정)한 시각 — 답변 전 NULL'})
    answered_at: Date | null;

    @ManyToOne(() => UserEntity, {nullable: true, onUpdate: 'CASCADE', onDelete: 'RESTRICT'})
    @JoinColumn({name: 'blind_user_id', referencedColumnName: 'user_id', foreignKeyConstraintName: 'FK_Inquiry_BlindUser'})
    blind_user_id: string | null;

    @Column({name: 'blinded_at', type: 'timestamptz', nullable: true, comment: '블라인드한 시각 — 블라인드가 아니면 NULL(해제하면 지운다)'})
    blinded_at: Date | null;

    @Column({name: 'created_at', type: 'timestamptz', nullable: false, comment: '등록일(문의한 시각)'})
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
}
```

`IDX_Inquiry_StoreIdCreatedAt` 하나로 업체 문의(`store_id = …`)와 바로방 문의(`store_id IS NULL` — btree 는 NULL 도 담는다) 목록을 다 받는다. 카테고리 · 상태 거르기는 그 범위 안에서 거르는 조건이라 인덱스를 더 두지 않는다. 룩업 시드는 `seeder.targets.ts` 에 더한다(업체 상태 다음, `t_inquiry` 보다 먼저). 카테고리 ID 는 3-2 의 `INQUIRY_CATEGORY` 와 같아야 한다(DTO 허용값은 모두 시드에 있어야 한다).

```ts
/** 문의 상태(t_inquiry_state) 기본 데이터 */
export const INQUIRY_STATE_SEED_DATA: InquiryStateEntity[] = [
    {inquiry_state_id: 'RECEIVED', inquiry_state_name: '접수'},
    {inquiry_state_id: 'ANSWERED', inquiry_state_name: '답변완료'},
    {inquiry_state_id: 'BLIND', inquiry_state_name: '블라인드'},
];

/** 문의 카테고리(t_inquiry_category) 기본 데이터 — contracts INQUIRY_CATEGORY 와 같다, 화면 순서 sort_order */
export const INQUIRY_CATEGORY_SEED_DATA: InquiryCategoryEntity[] = [
    {inquiry_category_id: 'RESERVATION', inquiry_category_name: '예약', sort_order: 1},
    {inquiry_category_id: 'PAYMENT', inquiry_category_name: '결제/환불', sort_order: 2},
    {inquiry_category_id: 'ROOM', inquiry_category_name: '객실/시설', sort_order: 3},
    {inquiry_category_id: 'DOOR', inquiry_category_name: '출입/QR', sort_order: 4},
    {inquiry_category_id: 'ACCOUNT', inquiry_category_name: '회원/계정', sort_order: 5},
    {inquiry_category_id: 'STORE_APPLICATION', inquiry_category_name: '입점', sort_order: 6},
    {inquiry_category_id: 'ETC', inquiry_category_name: '기타', sort_order: 7},
];
// SEED_TARGETS: {entity: InquiryStateEntity, data: INQUIRY_STATE_SEED_DATA}, {entity: InquiryCategoryEntity, data: INQUIRY_CATEGORY_SEED_DATA}
```

### 3-2. 규격 상수 — `libs/contracts/src/inquiry/inquiry.constants.ts` · `inquiry.commands.ts`

상태 ID 는 DTO `@IsIn`(목록 거르기) · 두 서비스 service · CHECK 문자열이 같이 쓴다 — 예약 상태처럼 contracts 에 둔다(`libs/contracts/src/reservation/reservation.constants.ts`). 같은 이름 도메인이 두 서비스에 있어 상수 이름으로 가른다(store `STORE_COMMAND` · `STORE_USER_COMMAND` 와 같다).

```ts
// libs/contracts/src/inquiry/inquiry.constants.ts
/** 문의 상태 — 접수 · 답변완료 · 블라인드(t_inquiry_state 시드와 같다) */
export const INQUIRY_STATE = {RECEIVED: 'RECEIVED', ANSWERED: 'ANSWERED', BLIND: 'BLIND'} as const;

/** 문의 상태 허용값 — 목록 거르기 DTO `@IsIn` */
export const INQUIRY_STATE_IDS: string[] = [INQUIRY_STATE.RECEIVED, INQUIRY_STATE.ANSWERED, INQUIRY_STATE.BLIND];

/** 문의 카테고리 — 예약 · 결제/환불 · 객실/시설 · 출입/QR · 회원/계정 · 입점 · 기타(t_inquiry_category 시드와 같다) */
export const INQUIRY_CATEGORY = {
    RESERVATION: 'RESERVATION',
    PAYMENT: 'PAYMENT',
    ROOM: 'ROOM',
    DOOR: 'DOOR',
    ACCOUNT: 'ACCOUNT',
    STORE_APPLICATION: 'STORE_APPLICATION',
    ETC: 'ETC',
} as const;

/** 문의 카테고리 허용값 — 등록(필수) · 목록 거르기(선택) DTO `@IsIn` */
export const INQUIRY_CATEGORY_IDS: string[] = Object.values(INQUIRY_CATEGORY);
```

```ts
// libs/contracts/src/inquiry/inquiry.commands.ts
/** inquiry 내부 HTTP 경로 접두 — admin-service (문의 관리) */
const INQUIRY_INTERNAL_BASE = '/internal/v1/admin-service/inquiry';

/** inquiry 내부 HTTP 경로 접두 — user-service (이용자 문의) */
const INQUIRY_USER_INTERNAL_BASE = '/internal/v1/user-service/inquiry';

/**
 * inquiry 도메인 이용자 명령 (= 라우팅 키, user-service q.user.cmd 가 `user.#` 로 받는다)
 */
export const INQUIRY_USER_COMMAND = {
    /** 문의 등록 (이용자) */
    CREATE: 'user.inquiry.create',
} as const;

/**
 * inquiry 도메인 이용자 내부 HTTP 경로 (게이트웨이 → user-service)
 */
export const INQUIRY_USER_INTERNAL_PATH = {
    /** 문의 카테고리 목록 (GET, 로그인 없음 — 이용자 · 관리 화면 공용) */
    CATEGORY_LIST: `${INQUIRY_USER_INTERNAL_BASE}/category`,
    /** 내 문의 목록 (GET, 이용자) */
    LIST: INQUIRY_USER_INTERNAL_BASE,
    /** 내 문의 상세 (GET, 이용자) */
    inquiry: (inquiry_id: string) => `${INQUIRY_USER_INTERNAL_BASE}/${encodeURIComponent(inquiry_id)}`,
} as const;

/**
 * inquiry 도메인 문의 관리 명령 (= 라우팅 키, admin-service q.admin.cmd 가 `admin.#` 로 받는다) — `MINE_*` 는 업체 관리자(소속 업체 문의), 나머지는 관리자(바로방 문의)
 */
export const INQUIRY_COMMAND = {
    /** 내 업체 문의 답변 (업체 관리자) */
    MINE_ANSWER: 'admin.inquiry.mine-answer',
    /** 내 업체 문의 블라인드 (업체 관리자 — 한 건) */
    MINE_BLIND: 'admin.inquiry.mine-blind',
    /** 내 업체 문의 블라인드 해제 (업체 관리자 — 한 건) */
    MINE_UNBLIND: 'admin.inquiry.mine-unblind',
    /** 바로방 문의 답변 (관리자) */
    ANSWER: 'admin.inquiry.answer',
    /** 바로방 문의 블라인드 (관리자 — 한 건) */
    BLIND: 'admin.inquiry.blind',
    /** 바로방 문의 블라인드 해제 (관리자 — 한 건) */
    UNBLIND: 'admin.inquiry.unblind',
} as const;

/**
 * inquiry 도메인 문의 관리 내부 HTTP 경로 (게이트웨이 → admin-service)
 */
export const INQUIRY_INTERNAL_PATH = {
    /** 바로방 문의 목록 (GET, 관리자) */
    LIST: INQUIRY_INTERNAL_BASE,
    /** 바로방 문의 상세 (GET, 관리자) */
    inquiry: (inquiry_id: string) => `${INQUIRY_INTERNAL_BASE}/${encodeURIComponent(inquiry_id)}`,
    /** 내 업체 문의 목록 (GET, 업체 관리자) */
    MINE_LIST: `${INQUIRY_INTERNAL_BASE}/mine`,
    /** 내 업체 문의 상세 (GET, 업체 관리자) */
    mineInquiry: (inquiry_id: string) => `${INQUIRY_INTERNAL_BASE}/mine/${encodeURIComponent(inquiry_id)}`,
} as const;
```

게이트웨이 · 서비스 컨트롤러 모두 `/mine` · `/mine/:inquiry_id` 를 `/:inquiry_id` 보다 **먼저** 선언한다 — 뒤에 두면 `GET /inquiry/mine` 이 `inquiry_id = 'mine'` 으로 잡혀 400 이 된다(업체 라우트와 같은 순서, store.controller.ts:46 · 170). 이용자 쪽 `/category` 도 같은 이유로 `/:inquiry_id` 보다 먼저 둔다(게이트웨이 핸들러는 가드 없음, 나머지 이용자 라우트는 이용자 가드 — 가드가 핸들러 단위라 한 컨트롤러에 섞어도 된다).

### 3-3. 범위 조건 · 관리 목록 쿼리 — `apps/admin-service/src/inquiry/inquiry.util.ts` · `repositories/inquiry.repository.ts`

범위 규칙(업체 관리자 = 소속 업체, 관리자 = 업체 없음)은 이 util 하나에만 둔다 — 관리자 쪽을 "범위 조건 없음" 으로 잘못 두면 모든 업체 문의가 열리므로, 관리자도 반드시 `store_id IS NULL` 을 건다. `store_id` 는 관계 속성이라 `IsNull()` 이 `"store_id" IS NULL` 로 바뀌는지 Smoke 로 고정한다.

```ts
// apps/admin-service/src/inquiry/inquiry.util.ts
import {IsNull, Not} from 'typeorm';
import type {FindOptionsWhere} from 'typeorm';
import {INQUIRY_STATE} from '@app/contracts/inquiry/inquiry.constants.js';
import type {InquiryManageListDto} from '@app/contracts/inquiry/dto/inquiry-manage-list.dto.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {InquiryFilter} from './interfaces/inquiry.repository.interface.js';

/**
 * 문의 범위 조건 — 업체 관리자는 소속 업체(store_id), 관리자는 바로방(store_id IS NULL). 범위 규칙은 여기 한 곳뿐이다.
 *
 * @param store_id 소속 업체 ID(업체 관리자) 또는 null(관리자 — 바로방)
 * @returns 조회 · 수정 조건
 */
export function toInquiryScopeWhere(store_id: string | null): FindOptionsWhere<InquiryEntity> {
    return {store_id: store_id ?? IsNull()};
}

/**
 * 관리 목록 필터 — 범위 + 카테고리(선택) + 상태(선택) + 검색어(선택, 빈 문자열은 없음). 고르지 않은 칸은 null(전체).
 *
 * @param store_id 소속 업체 ID 또는 null(바로방)
 * @param dto 목록 query
 * @returns 필터
 */
export function toInquiryListFilter(store_id: string | null, dto: InquiryManageListDto): InquiryFilter {
    return {
        store_id,
        inquiry_id: null,
        inquiry_category_id: dto.inquiry_category_id ?? null,
        inquiry_state_id: dto.inquiry_state_id ?? null,
        keyword: dto.keyword ? dto.keyword : null,
    };
}

/**
 * 관리 상세 필터 — 범위 + 문의 ID.
 *
 * @param store_id 소속 업체 ID 또는 null(바로방)
 * @param inquiry_id 문의 ID
 * @returns 필터
 */
export function toInquiryDetailFilter(store_id: string | null, inquiry_id: string): InquiryFilter {
    return {store_id, inquiry_id, inquiry_category_id: null, inquiry_state_id: null, keyword: null};
}

/**
 * 답변 쓰기 — 답변완료 + 답변 내용 · 답변 계정 · 시각(고치면 셋 다 새 값).
 *
 * @param user_id 답변 계정
 * @param answer_content 답변
 * @param now 지금
 * @returns update 엔티티
 */
export function buildInquiryAnswer(user_id: string, answer_content: string, now: Date): InquiryEntity {
    const entity = new InquiryEntity();
    entity.inquiry_state_id = INQUIRY_STATE.ANSWERED;
    entity.answer_content = answer_content;
    entity.answer_user_id = user_id;
    entity.answered_at = now;
    return entity;
}

/**
 * 블라인드 쓰기 — 블라인드 + 처리한 계정 · 시각(답변은 그대로 둔다 — 해제 때 답변완료로 돌아갈 근거).
 *
 * @param user_id 블라인드한 계정
 * @param now 지금
 * @returns update 엔티티
 */
export function buildInquiryBlind(user_id: string, now: Date): InquiryEntity {
    const entity = new InquiryEntity();
    entity.inquiry_state_id = INQUIRY_STATE.BLIND;
    entity.blind_user_id = user_id;
    entity.blinded_at = now;
    return entity;
}

/**
 * 해제 쓰기 — 답변이 있으면 답변완료, 없으면 접수 + 블라인드 칸 지우기(null 은 update 에 그대로 실린다).
 *
 * @param answered_at 찾은 문의의 답변 시각(없으면 null)
 * @returns update 엔티티
 */
export function buildInquiryUnblind(answered_at: Date | null): InquiryEntity {
    const entity = new InquiryEntity();
    entity.inquiry_state_id = answered_at === null ? INQUIRY_STATE.RECEIVED : INQUIRY_STATE.ANSWERED;
    entity.blind_user_id = null;
    entity.blinded_at = null;
    return entity;
}

/**
 * 해제 조건 — 범위 · 문의 ID + 블라인드 + 찾을 때와 같은 답변 여부. 그사이 풀렸거나 답변 여부가 바뀌었으면 0행이다(되돌릴 상태와 답변 칸이 어긋나 CHECK 위반이 나지 않게).
 *
 * @param where 범위 · 문의 ID 조건
 * @param answered_at 찾은 문의의 답변 시각(없으면 null)
 * @returns update 조건
 */
export function toInquiryUnblindWhere(where: FindOptionsWhere<InquiryEntity>, answered_at: Date | null): FindOptionsWhere<InquiryEntity> {
    return {...where, inquiry_state_id: INQUIRY_STATE.BLIND, answered_at: answered_at === null ? IsNull() : Not(IsNull())};
}
```

관리 목록 · 상세 쿼리 — 업체 관리자 목록 `buildAccountQuery`(manager.repository.ts:268)와 같은 "필터 객체 + 값이 있을 때만 조건 + 괄호 OR" 모양이다. 다른 점: 범위는 값이 null 이어도 `IS NULL` 로 항상 건다, 작성자 닉네임 · 카테고리명 · 상태명 · (상세) 답변 계정 이름을 조인한다.

```ts
// apps/admin-service/src/inquiry/interfaces/inquiry.repository.interface.ts (발췌)
/** 관리 목록 · 상세 필터 — store_id 는 범위(null = 바로방 · 항상 건다), 나머지는 null 이면 조건 없음(전체) */
export interface InquiryFilter {
    store_id: string | null;
    inquiry_id: string | null;
    inquiry_category_id: string | null;
    inquiry_state_id: string | null;
    keyword: string | null;
}

/** 관리 목록 행 (QueryBuilder raw — 별칭이 키와 같다) */
export interface InquiryRow {
    inquiry_id: string;
    user_id: string;
    user_nickname: string;
    store_id: string | null;
    inquiry_category_id: string;
    inquiry_category_name: string;
    title: string;
    inquiry_state_id: string;
    inquiry_state_name: string;
    answered_at: Date | null;
    created_at: Date;
}

/** 관리 상세 행 — 목록 행 + 내용 · 답변 · 답변 계정 이름 · 블라인드 시각 */
export interface InquiryDetailRow extends InquiryRow {
    content: string;
    answer_content: string | null;
    answer_user_name: string | null;
    blinded_at: Date | null;
}
```

```ts
// apps/admin-service/src/inquiry/repositories/inquiry.repository.ts (발췌)
    /**
     * 문의 관리 쿼리 — 범위(store_id = 또는 IS NULL)는 항상, 문의 ID · 카테고리 · 상태 · 검색어(제목 · 내용 괄호 OR)는 값이 있을 때만. 작성자 닉네임 · 카테고리명 · 상태명 조인, 상세면 내용 · 답변 · 답변 계정 이름 · 블라인드 시각을 더 읽는다.
     * 매핑 민감(조인 · raw select · 동적 조립 · IS NULL 분기 · OR 괄호)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param filter 필터
     * @param detail true 면 상세 칸까지
     * @returns 쿼리 빌더
     */
    buildInquiryQuery(filter: InquiryFilter, detail: boolean): SelectQueryBuilder<InquiryEntity> {
        const query = this.inquiries
            .createQueryBuilder('i')
            .select('i.inquiry_id', 'inquiry_id')
            .addSelect('i.user_id', 'user_id')
            .addSelect('u.nickname', 'user_nickname')
            .addSelect('i.store_id', 'store_id')
            .addSelect('i.inquiry_category_id', 'inquiry_category_id')
            .addSelect('c.inquiry_category_name', 'inquiry_category_name')
            .addSelect('i.title', 'title')
            .addSelect('i.inquiry_state_id', 'inquiry_state_id')
            .addSelect('st.inquiry_state_name', 'inquiry_state_name')
            .addSelect('i.answered_at', 'answered_at')
            .addSelect('i.created_at', 'created_at')
            .innerJoin(UserEntity, 'u', 'u.user_id = i.user_id')
            .innerJoin(InquiryCategoryEntity, 'c', 'c.inquiry_category_id = i.inquiry_category_id')
            .innerJoin(InquiryStateEntity, 'st', 'st.inquiry_state_id = i.inquiry_state_id');
        if (filter.store_id === null) {
            query.where('i.store_id IS NULL');
        } else {
            query.where('i.store_id = :store_id', {store_id: filter.store_id});
        }
        if (filter.inquiry_id !== null) {
            query.andWhere('i.inquiry_id = :inquiry_id', {inquiry_id: filter.inquiry_id});
        }
        if (filter.inquiry_category_id !== null) {
            query.andWhere('i.inquiry_category_id = :inquiry_category_id', {inquiry_category_id: filter.inquiry_category_id});
        }
        if (filter.inquiry_state_id !== null) {
            query.andWhere('i.inquiry_state_id = :inquiry_state_id', {inquiry_state_id: filter.inquiry_state_id});
        }
        if (filter.keyword !== null) {
            const pattern = toContainsPattern(filter.keyword);
            query.andWhere(
                new Brackets((qb) => {
                    qb.where('i.title ILIKE :pattern', {pattern}).orWhere('i.content ILIKE :pattern');
                }),
            );
        }
        if (detail) {
            query
                .addSelect('i.content', 'content')
                .addSelect('i.answer_content', 'answer_content')
                .addSelect('a.name', 'answer_user_name')
                .addSelect('i.blinded_at', 'blinded_at')
                .leftJoin(UserEntity, 'a', 'a.user_id = i.answer_user_id');
        }
        return query;
    }
```

`countInquiryRows(filter)` = `buildInquiryQuery(filter, false).getCount()`, `findInquiryRows` = `.orderBy('i.created_at', 'DESC').addOrderBy('i.inquiry_id', 'DESC').limit().offset().getRawMany()`, `findInquiryDetailRow` = `buildInquiryQuery(filter, true).getRawOne() ?? null`. 작성자 · 답변 계정 조인에 `is_deleted` 는 없다(`t_user` 에 소프트 삭제 칸이 없다 — 탈퇴는 상태 · 마스킹).

### 3-4. 업체 이름 검색 쿼리 — `apps/user-service/src/discovery/repositories/discovery.repository.ts`

둘러보기의 다른 조회는 활성(ACTIVE)만 보이지만(discovery.constants.ts:2), 문의 대상은 영업중지도 받는다(사용자 결정 2026-11-24) — 그래서 새 상수를 둔다.

```ts
// apps/user-service/src/discovery/discovery.constants.ts (추가)
/** 업체 이름 검색(문의할 업체 고르기) 대상 상태 — 영업 중 · 영업중지(탈퇴 제외, 사용자 결정 2026-11-24) */
export const DISCOVERY_SEARCH_STORE_STATES: string[] = ['ACTIVE', 'SUSPEND'];

/** 업체 이름 검색 최대 개수 */
export const DISCOVERY_STORE_SEARCH_LIMIT = 20;
```

```ts
// apps/user-service/src/discovery/repositories/discovery.repository.ts (추가)
    /**
     * 업체 이름 검색 쿼리 — 상호명 부분 일치(이스케이프) · 영업 중 · 영업중지 · 지워지지 않은 업체, 상호명 순(같으면 ID 순) 최대 limit 건.
     * 매핑 민감(raw select · IN · ILIKE)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param keyword 검색어
     * @param limit 최대 개수
     * @returns 쿼리 빌더
     */
    buildStoreSearchQuery(keyword: string, limit: number): SelectQueryBuilder<StoreEntity> {
        return this.stores
            .createQueryBuilder('s')
            .select('s.store_id', 'store_id')
            .addSelect('s.store_name', 'store_name')
            .addSelect('s.address', 'address')
            .addSelect('s.latitude', 'latitude')
            .addSelect('s.longitude', 'longitude')
            // 대표 사진 — 반경 업체 쿼리(buildStoreRowsQuery)와 같은 서브쿼리 2개: 지워지지 않은 업체 사진 중 정렬 순서 · 등록일이 가장 앞인 1장의 file_key · file_storage
            .addSelect((sub) => sub.select('"f"."file_key"').from(StoreFileEntity, 'f').where('"f"."store_id" = "s"."store_id"').andWhere('"f"."store_file_purpose_id" = :image_purpose').andWhere('"f"."is_deleted" = 0').orderBy('"f"."sort_order"', 'ASC').addOrderBy('"f"."created_at"', 'ASC').limit(1), 'cover_file_key')
            .addSelect((sub) => sub.select('"f"."file_storage"')/* 같은 조건 */, 'cover_file_storage')
            .where('s.store_name ILIKE :pattern', {pattern: toContainsPattern(keyword)})
            .andWhere('s.store_state_id IN (:...states)', {states: DISCOVERY_SEARCH_STORE_STATES})
            .andWhere('s.is_deleted = 0')
            .orderBy('s.store_name', 'ASC')
            .addOrderBy('s.store_id', 'ASC')
            .limit(limit)
            .setParameters({image_purpose: DISCOVERY_STORE_IMAGE_PURPOSE});
    }
```

### 3-5. 이용자 문의 · 문의할 업체 — `apps/user-service/src/inquiry/repositories/inquiry.repository.ts`

업체 조인은 `leftJoin` 이고 `is_deleted` 를 걸지 않는다 — 바로방 문의는 업체가 없고, 나중에 지운 업체에 남긴 문의도 이용자에게는 그 업체 이름으로 보여야 한다(이용 이력 조인과 같다 — admin-service user.repository.ts:194 · user-service reservation.repository.ts:584 는 업체 조인에 `is_deleted` 를 걸지 않는다).

```ts
// apps/user-service/src/inquiry/repositories/inquiry.repository.ts (발췌)
    /**
     * 문의할 업체 — 영업 중 · 영업중지이고 지워지지 않은 업체만(탈퇴 · 삭제 · 없음은 null)
     *
     * @param store_id 업체 ID
     * @returns 업체 또는 null
     */
    async findInquiryStore(store_id: string): Promise<StoreEntity | null> {
        try {
            return await this.stores.findOne({where: notDeleted({store_id, store_state_id: In(INQUIRY_STORE_STATES)}), loadRelationIds: true});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 문의 카테고리 전부 — 화면 정렬 순서(sort_order), 같으면 ID 순
     *
     * @returns 카테고리 목록
     */
    async findInquiryCategories(): Promise<InquiryCategoryEntity[]> {
        try {
            return await this.inquiryCategories.find({order: {sort_order: 'ASC', inquiry_category_id: 'ASC'}});
        } catch {
            throw new InternalServerErrorException({message: SERVER_ERROR_MESSAGE});
        }
    }

    /**
     * 내 문의 쿼리 — 작성자는 항상, 문의 ID · 카테고리 · 상태는 값이 있을 때만(null 이면 전체). 업체명(바로방 · 지운 업체도 — leftJoin, is_deleted 없음) · 카테고리명 · 상태명 조인, 상세면 내용 · 답변까지.
     * 매핑 민감(leftJoin · raw select · 동적 조립)이라 Data-Access Smoke spec 으로 SQL 을 고정한다.
     *
     * @param filter 작성자 · 문의 ID · 카테고리 · 상태
     * @param detail true 면 상세 칸까지
     * @returns 쿼리 빌더
     */
    buildMyInquiryQuery(filter: MyInquiryFilter, detail: boolean): SelectQueryBuilder<InquiryEntity> {
        const query = this.inquiries
            .createQueryBuilder('i')
            .select('i.inquiry_id', 'inquiry_id')
            .addSelect('i.store_id', 'store_id')
            .addSelect('s.store_name', 'store_name')
            .addSelect('i.inquiry_category_id', 'inquiry_category_id')
            .addSelect('c.inquiry_category_name', 'inquiry_category_name')
            .addSelect('i.title', 'title')
            .addSelect('i.inquiry_state_id', 'inquiry_state_id')
            .addSelect('st.inquiry_state_name', 'inquiry_state_name')
            .addSelect('i.answered_at', 'answered_at')
            .addSelect('i.created_at', 'created_at')
            .leftJoin(StoreEntity, 's', 's.store_id = i.store_id')
            .innerJoin(InquiryCategoryEntity, 'c', 'c.inquiry_category_id = i.inquiry_category_id')
            .innerJoin(InquiryStateEntity, 'st', 'st.inquiry_state_id = i.inquiry_state_id')
            .where('i.user_id = :user_id', {user_id: filter.user_id});
        if (filter.inquiry_id !== null) {
            query.andWhere('i.inquiry_id = :inquiry_id', {inquiry_id: filter.inquiry_id});
        }
        if (filter.inquiry_category_id !== null) {
            query.andWhere('i.inquiry_category_id = :inquiry_category_id', {inquiry_category_id: filter.inquiry_category_id});
        }
        if (filter.inquiry_state_id !== null) {
            query.andWhere('i.inquiry_state_id = :inquiry_state_id', {inquiry_state_id: filter.inquiry_state_id});
        }
        if (detail) {
            query.addSelect('i.content', 'content').addSelect('i.answer_content', 'answer_content');
        }
        return query;
    }
```

```ts
// apps/user-service/src/inquiry/interfaces/inquiry.repository.interface.ts (발췌)
/** 내 문의 목록 · 상세 필터 — user_id 는 항상 건다(남의 문의는 없는 것과 같다), 나머지는 null 이면 조건 없음(전체) */
export interface MyInquiryFilter {
    user_id: string;
    inquiry_id: string | null;
    inquiry_category_id: string | null;
    inquiry_state_id: string | null;
}
```

```ts
// apps/user-service/src/inquiry/inquiry.util.ts (발췌)
/**
 * 내 문의 목록 필터 — 작성자 + 카테고리(선택) + 상태(선택). 고르지 않은 칸은 null(전체).
 *
 * @param user_id 로그인 이용자 ID
 * @param dto 목록 query
 * @returns 필터
 */
export function toMyInquiryListFilter(user_id: string, dto: InquiryListDto): MyInquiryFilter {
    return {user_id, inquiry_id: null, inquiry_category_id: dto.inquiry_category_id ?? null, inquiry_state_id: dto.inquiry_state_id ?? null};
}

/**
 * 내 문의 상세 필터 — 작성자 + 문의 ID.
 *
 * @param user_id 로그인 이용자 ID
 * @param inquiry_id 문의 ID
 * @returns 필터
 */
export function toMyInquiryDetailFilter(user_id: string, inquiry_id: string): MyInquiryFilter {
    return {user_id, inquiry_id, inquiry_category_id: null, inquiry_state_id: null};
}
```

`INQUIRY_STORE_STATES`(user-service `inquiry.constants.ts`)는 `['ACTIVE', 'SUSPEND']` — 업체 이름 검색과 같은 값이지만 앱 안 도메인끼리 상수를 import 하지 않으므로(도메인 경계) 따로 둔다. `countMyInquiryRows(filter)` = `buildMyInquiryQuery(filter, false).getCount()`, `findMyInquiryRows` 는 `.orderBy('i.created_at', 'DESC').addOrderBy('i.inquiry_id', 'DESC').limit().offset().getRawMany()`, `findMyInquiryDetailRow` = `buildMyInquiryQuery(filter, true).getRawOne() ?? null`. 카테고리 조회는 관계 · 조건이 없는 `find` 라 Smoke 대상이 아니다(500 변환만).

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| `InquiryStateEntity` | 룩업 엔티티 — PK `<x>_state_id` length 20 · 이름 length 50 | `libs/database/src/entities/store/store-state.entity.ts:7` |
| 엔티티 등록 · 시드 대상 | `ENTITIES` 배열 · `SEED_TARGETS` 행 | `libs/database/src/entities.ts:43` · `libs/database/src/seeder/seeder.targets.ts:205` |
| 마이그레이션 | `npm run db:generate -- Inquiry` → `npm run db:check` (CHECK · 인덱스 · FK 제약명이 생성 결과에 그대로인지 확인) | `docs/data-layer.md` 마이그레이션 절 |
| 입력 DTO(문의 등록 · 답변) | `@ApiProperty` → 제약(`@MaxLength` · `@Matches`) → `@IsNotEmpty`, 선택 `store_id` 는 `@IsOptional()` → `@Matches(/^[a-f0-9]{32}$/)`, 필수 `inquiry_category_id` 는 `@IsIn(INQUIRY_CATEGORY_IDS)` → `@IsNotEmpty`. 동의 항목 필드는 두지 않는다(프론트가 등록 전에 체크 — `forbidNonWhitelisted` 라 프론트가 실수로 보내면 400) | `libs/contracts/src/store/dto/store-application.dto.ts` |
| Query DTO 3종(`InquiryListDto` · `InquiryManageListDto` · `DiscoveryStoreSearchDto`) | 생성자 `data?: Partial<T>` · 컨트롤러 `const dto = new X(query)`, 목록은 `extends PaginationDto` + `super(data)`, 카테고리 `@IsOptional()` → `@IsIn(INQUIRY_CATEGORY_IDS)` · 상태 `@IsOptional()` → `@IsIn(INQUIRY_STATE_IDS)`(안 보내면 전체), 검색어 `@MaxLength` | `libs/contracts/src/store/dto/store-my-application-list.dto.ts:7` · `libs/contracts/src/user/dto/user-list.dto.ts` |
| path param DTO(상세 · 답변 · 블라인드 · 해제 — 기능마다 따로 선언) | `inquiry_id` `@Matches(hex32)` → `@IsNotEmpty`. 블라인드 · 해제는 본문 · 결과 DTO 없음(void) | `libs/contracts/src/room/dto/room-group-image-order.dto.ts:7` |
| 결과 DTO | 응답 필드 생략 없음(`x: T \| null`), 목록 `{list, pagination: PaginationResultDto}`, 시각 ISO 문자열 | `libs/contracts/src/store/dto/store-my-application-list.dto.ts:20` |
| 행 → 결과 변환(`toInquiryCategoryItem` · `toMyInquiryItem` · `toMyInquiryDetail` · `toInquiryManageItem` · `toInquiryManageDetail` · `toStoreSearchItem`) | raw 행 시각은 `new Date(row.x).toISOString()`, null 은 null | `apps/admin-service/src/manager/manager.util.ts:136` |
| 매니저의 소속 업체(admin-service inquiry) | `buildManagerStoreQuery` 그대로(t_user 조인 · 매니저 그룹 · 탈퇴 제외 · 지운 업체 제외) — 잠금 인자 없이 | `apps/admin-service/src/reservation/repositories/reservation.repository.ts:85` |
| repository 단건 · 수정 · 등록 | admin `findInquiry` = `findOne({where, loadRelationIds: true})`, `updateInquiry` = 상태 조건을 건 쓰기라 `(await update(where, entity)).affected === 1` 을 boolean 으로(답변 · 블라인드 · 해제 모두 false 면 service 가 400), user `insertInquiry`, 모두 try/catch → `SERVER_ERROR_MESSAGE` 500 (`t_inquiry` 는 is_deleted 가 없어 `notDeleted` 를 감싸지 않는다) | `apps/admin-service/src/manager/repositories/manager.repository.ts:222` |
| 목록 개수 · 행(이용자 · 관리) | 필터 객체 하나 → `count…Rows(filter)` = 빌더 `.getCount()` → Pagination → `find…Rows(filter, limit, offset)` | `apps/admin-service/src/manager/repositories/manager.repository.ts:268` |
| 서비스 큐 컨트롤러(user `InquiryQueueController` 1개 · admin 6개) | `@OnCommand(TYPE)` + `requireActor(command).user_id` 위임 한 줄, 답변 payload = `InquiryAnswerParamDto & InquiryAnswerDto`, 블라인드 · 해제 payload = `InquiryBlindParamDto` · `InquiryUnblindParamDto`(관리자 해제는 actor 를 넘기지 않는다) | `apps/user-service/src/store/controllers/store.controller.queue.ts:29` |
| 서비스 동기 컨트롤러 | `@Controller('/internal/v1/<service>/inquiry')`, 업체 관리자 라우트는 `@InternalActor('user_id')`, `@HttpCode(200)` | `apps/admin-service/src/stats/controllers/stats.controller.ts:11` |
| 게이트웨이 동기 라우트 | 관리자 `PassportJwtAdminAuthGuard` · `/mine` 은 `PassportJwtManagerAuthGuard`(`@Roles` 없음) · `InternalHttpClient.request('admin' \| 'user', 'GET', 경로, {actor, query: dto})` | `apps/gateway/src/api/v1/admin-service/stats/controllers/stats.controller.ts:37` |
| 게이트웨이 큐 라우트 | `commandStream.dispatch(res, {type, actor, payload: {...param, ...dto}, client_ip: ip})`, 답변은 `@Put('…/:inquiry_id/answer')`, 블라인드 · 해제는 `@Patch('…/:inquiry_id/blind' · '…/:inquiry_id/unblind')`(payload `{...param}`) | `apps/gateway/src/api/v1/admin-service/manager/controllers/manager.controller.queue.ts:176` |
| 게이트웨이 업체 이름 검색 · 카테고리 목록 | 가드 없는 동기 GET — 업체 이름 검색은 둘러보기 컨트롤러, 카테고리 목록은 이용자 문의 컨트롤러(`/category` 를 `/:inquiry_id` 보다 먼저)에 한 핸들러씩 | `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts:41` |
| 모듈 · 등록 | 도메인 모듈 `controllers: [동기]` · `providers: [Service, QueueController, {provide: INQUIRY_REPOSITORY, useClass}]`, 게이트웨이 `InquiryModule as UserInquiryModule` | `apps/user-service/src/store/store.module.ts` · `apps/gateway/src/gateway.module.ts:21` |
| 메시지 상수 | 여러 메서드가 쓰는 문구는 `inquiry.constants.ts` 의 `*_MESSAGE`(`문의를 찾을 수 없습니다.` · 매니저 소속 업체 없음 `소속 업체를 찾을 수 없습니다.`(형제 도메인과 같은 문구) · `블라인드된 문의에는 답변할 수 없습니다.` · `이미 블라인드된 문의입니다.` · `블라인드된 문의가 아닙니다.`), `INQUIRY_UNBLINDED_STATES = [RECEIVED, ANSWERED]`(블라인드가 아닌 상태 — 답변 · 블라인드 저장 조건) | `apps/user-service/src/store/store.constants.ts` |
| 프론트 수정 요청 | 이유 · 영향 화면 · API 추가 10개(경로 19개) · 화면 구성과 쓰는 API · 바뀐 DTO 사본 · 반영 순서. 화면에 실을 것: 문의 등록 전 동의 항목 체크(모두 체크해야 등록 — 서버로 보내지 않는다, 문구는 프론트) · 카테고리 고르기(카테고리 목록 API) · 이용자 · 관리 목록의 카테고리 · 상태 거르기(전체 · 접수 · 답변완료 · 블라인드 — 전체는 값을 보내지 않는다) · 관리 상세 화면의 블라인드 · 해제 버튼(상태에 따라 하나만 — 한 건씩, 목록 선택 일괄 처리는 없다) · 블라인드 상세 안내 문구 "스팸/반복성 문의로 블라인드 된 문의입니다." | `.beaver/output/frontend/changes/2026-11-22-reservation-list-state.md` |

## 테스트

spec의 "결과" 표에서 ✓ 표시된 24건과 "계산 규칙" 표 0건을 그대로 테스트로 옮긴다. 여기에는 추가분만 적는다.

파일 — service 기능 spec 은 API 1개당 1개, 업체 관리자 · 관리자 경로 짝은 한 파일에서 두 경로를 다 부른다(같은 기능을 범위만 달리 쓴다): user-service `discovery-store-search.spec.ts` · `inquiry-category-list.spec.ts` · `inquiry-create.spec.ts` · `inquiry-my-list.spec.ts` · `inquiry-my-detail.spec.ts`, admin-service `inquiry-list.spec.ts` · `inquiry-detail.spec.ts` · `inquiry-answer.spec.ts` · `inquiry-blind.spec.ts` · `inquiry-unblind.spec.ts`. 부팅은 `inquiry.test-helper.ts`(store.test-helper.ts 와 같은 모양 — 큐 경로 `bootCommandPath` · 동기 경로 `bootHttpPath` · `createInquiryRepositoryMock`).

단언 포인트(spec 행이 무엇을 보장하는지 — 상태 코드만 보지 않는다):
- 범위 — 업체 관리자 경로는 `findManagerStore(user_id)` 뒤의 조건에 `store_id: '<소속 업체>'`, 관리자 경로는 `store_id: IsNull()` 이 실리는지(목록은 `countInquiryRows` · `findInquiryRows` 에 넘긴 필터, 쓰기는 `findInquiry` · `updateInquiry` 에 넘긴 where).
- 답변 — `updateInquiry` 조건에 `inquiry_state_id: In(['RECEIVED', 'ANSWERED'])`, 엔티티 `toBeInstanceOf(InquiryEntity)` · `{inquiry_state_id: 'ANSWERED', answer_content, answer_user_id: actor, answered_at: FIXED_TIME}`. 0행이면 failed 400 + 롤백(예외 throw).
- 블라인드 — `updateInquiry` 조건에 `inquiry_id` · 범위 · `inquiry_state_id: In(['RECEIVED', 'ANSWERED'])`, 엔티티 `{inquiry_state_id: 'BLIND', blind_user_id: actor, blinded_at: FIXED_TIME}` 이고 답변 칸은 엔티티에 싣지 않는다(undefined — 그대로 둔다). 이미 블라인드면 `updateInquiry` 미호출. 범위 밖 404 · 0행 400 은 답변과 같은 코드 모양이라 답변 spec 이 대표한다.
- 해제 — `updateInquiry` 1회: 답변 있는 문의는 조건 `answered_at: Not(IsNull())` + 엔티티 `ANSWERED`, 답변 없는 문의는 조건 `answered_at: IsNull()` + 엔티티 `RECEIVED`, 둘 다 `inquiry_state_id: 'BLIND'` 조건 · 엔티티 `blind_user_id: null, blinded_at: null`. 블라인드가 아니면 미호출.
- 등록 — 엔티티 `inquiry_category_id` 가 고른 값, 업체를 안 고르면 `findInquiryStore` 미호출 · 엔티티 `store_id: null`. 카테고리를 빼거나 허용값 밖이면 `insertInquiry` 미호출.
- 업체 이름 검색 — `findStoreSearchRows(검색어, 20)`, 사진 키가 있는 행만 `getPublicUrl({file_key, file_storage})`, 없으면 `image_url` null, 위경도는 숫자.
- 카테고리 목록 — `findInquiryCategories` 1회, 결과는 받은 순서 그대로 `{inquiry_category_id, inquiry_category_name}`(정렬 순서 칸은 내려가지 않는다).
- 목록 거르기 — 이용자 목록은 `countMyInquiryRows` · `findMyInquiryRows` 에 같은 필터 `{user_id, inquiry_id: null, inquiry_category_id, inquiry_state_id}` 가 실리는지, 관리 목록은 `countInquiryRows` · `findInquiryRows` 필터에 `inquiry_category_id` · `inquiry_state_id` · `keyword` 가 같이 실리는지. 고르지 않은 칸은 null.

| 종류 | 대상 | 이유 |
|---|---|---|
| 쿼리 스모크 | user-service discovery `buildStoreSearchQuery` | raw select · 위경도 · 대표 사진 서브쿼리 2개(키 · 저장소) · `IN (:...states)` 펼침 · ILIKE 이스케이프 · 정렬 · LIMIT |
| 쿼리 스모크 | user-service inquiry `findInquiryStore` (find 조건 — `vi.spyOn(dataSource.manager, 'findOne')` → `setFindOptions`) | `In` 상태 + `notDeleted` 가 `store_state_id IN (...) AND is_deleted = 0` 으로 |
| 쿼리 스모크 | user-service inquiry `buildMyInquiryQuery` (목록 전체 · 카테고리 + 상태 · 상세) | leftJoin 업체(is_deleted 없음) · 카테고리 · 상태 조인 · 동적 조건 · 상세 칸 |
| 쿼리 스모크 | admin-service inquiry `buildManagerStoreQuery` | t_user 조인 · 관계 컬럼 · 탈퇴 · 삭제 제외(형제 그대로인지) |
| 쿼리 스모크 | admin-service inquiry `buildInquiryQuery` (업체 범위 + 카테고리 · 상태 · 검색어 · 바로방 범위 · 상세) | `store_id IS NULL` 분기 · 괄호 OR · 조인 4개(상세 5개) · raw 별칭 |
| 쿼리 스모크 | admin-service inquiry `findInquiry` · `updateInquiry` 조건 (`vi.spyOn(dataSource.manager, 'findOne' \| 'update')`) | 관계 속성 `store_id: IsNull()` · 상태 `In(...)` · `answered_at: Not(IsNull())` 가 SQL 로 바뀌는지 — 범위가 빠지면 다른 업체 문의를 바꾸는 쓰기라 고정한다 |
| 저장 분기 실패 | 두 inquiry repository 의 DB 실행 메서드 전부 | 통일 500 (`it.each` 표 — manager.repository.spec.ts 와 같은 모양) |

## 만드는 순서

1. 엔티티 3개 · `ENTITIES` · 시드 2개 → `npm run db:generate -- Inquiry` → `npm run db:check`
2. contracts — `inquiry.constants.ts` · `inquiry.commands.ts` · DTO 10개 · 둘러보기 경로 상수
3. user-service — discovery(상수 · repository · util · service · 컨트롤러) → inquiry 도메인(repository → util → service → 컨트롤러 2개 → module) → 루트 모듈
4. admin-service — inquiry 도메인(repository → util → service → 컨트롤러 2개 → module) → 루트 모듈
5. gateway — 둘러보기 핸들러 · 이용자 문의 라우트(`/category` 먼저) · 문의 관리 라우트(`/mine` 먼저) · 루트 모듈
6. 테스트 — test-helper → service 기능 spec 10개 → repository spec(Smoke · 500)
7. 문서 — README.md · AGENTS.md · docs/architecture.md · 프론트 수정 요청 + 목록 한 줄

import {Module} from '@nestjs/common';
import {InquiryController} from './controllers/inquiry.controller.js';
import {InquiryQueueController} from './controllers/inquiry.controller.queue.js';
import {INQUIRY_REPOSITORY} from './inquiry.symbols.js';
import {InquiryService} from './inquiry.service.js';
import {InquiryRepository} from './repositories/inquiry.repository.js';

/**
 * inquiry 도메인 (이용자 문의) — 인바운드 어댑터 2종이 같은 service 를 부른다.
 * - InquiryController(controllers/inquiry.controller.ts): 내부 HTTP — 카테고리 목록 · 내 문의 목록 · 상세
 * - InquiryQueueController(controllers/inquiry.controller.queue.ts): RabbitMQ — 문의 등록 (`@OnCommand` provider 라 providers 에 등록)
 * 업체 관리자 · 관리자의 답변 · 블라인드는 admin-service inquiry 다(기능은 행위자로 서버를 고른다).
 */
@Module({controllers: [InquiryController], providers: [InquiryService, InquiryQueueController, {provide: INQUIRY_REPOSITORY, useClass: InquiryRepository}]})
export class InquiryModule {}

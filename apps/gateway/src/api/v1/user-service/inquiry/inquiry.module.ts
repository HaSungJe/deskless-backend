import {Module} from '@nestjs/common';
import {InquiryController} from './controllers/inquiry.controller.js';
import {InquiryQueueController} from './controllers/inquiry.controller.queue.js';

/**
 * 이용자 문의 라우트 모듈(/api/v1/user-service/inquiry — 카테고리 목록은 가드 없음, 그 밖 이용자 가드) — 동기(InquiryController) · 큐(InquiryQueueController) 컨트롤러를 [동기, 큐] 순으로 등록한다.
 * 업체 관리자 · 관리자의 문의 관리는 /api/v1/admin-service/inquiry 다(기능은 행위자로 서버를 고른다).
 */
@Module({controllers: [InquiryController, InquiryQueueController]})
export class InquiryModule {}

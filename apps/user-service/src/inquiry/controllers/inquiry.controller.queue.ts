import {Injectable} from '@nestjs/common';
import type {InquiryDto, InquiryResultDto} from '@app/contracts/inquiry/dto/inquiry.dto.js';
import {INQUIRY_USER_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import type {MessageEnvelope} from '@app/contracts/message-envelope.js';
import {requireActor} from '@app/messaging/messaging.util.js';
import {OnCommand} from '@app/messaging/on-command.decorator.js';
import {InquiryService} from '../inquiry.service.js';

/**
 * inquiry 큐 경로 컨트롤러 (이용자 문의, RabbitMQ 인바운드 어댑터) — 게이트웨이가 발행한 `user.inquiry.*` 명령을 `@OnCommand` 로 받아 service 로 넘긴다(위임만).
 * 입력 검증은 게이트웨이 ValidationPipe 에서 끝났다(다시 검증하지 않는다). 로그인 이용자 명령이라 actor 가 필요하다.
 */
@Injectable()
export class InquiryQueueController {
    /**
     * @param inquiryService inquiry 비즈니스 로직
     */
    constructor(private readonly inquiryService: InquiryService) {}

    /**
     * 문의 등록 — 로그인 이용자
     *
     * @param command 명령 봉투 (actor 필수)
     * @returns 문의 ID
     */
    @OnCommand(INQUIRY_USER_COMMAND.CREATE)
    async createInquiry(command: MessageEnvelope<InquiryDto>): Promise<InquiryResultDto> {
        return this.inquiryService.createInquiry(requireActor(command).user_id, command.payload);
    }
}

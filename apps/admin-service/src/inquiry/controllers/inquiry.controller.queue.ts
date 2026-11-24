import {Injectable} from '@nestjs/common';
import type {InquiryAnswerDto, InquiryAnswerParamDto} from '@app/contracts/inquiry/dto/inquiry-answer.dto.js';
import type {InquiryBlindParamDto} from '@app/contracts/inquiry/dto/inquiry-blind.dto.js';
import type {InquiryUnblindParamDto} from '@app/contracts/inquiry/dto/inquiry-unblind.dto.js';
import {INQUIRY_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import type {MessageEnvelope} from '@app/contracts/message-envelope.js';
import {requireActor} from '@app/messaging/messaging.util.js';
import {OnCommand} from '@app/messaging/on-command.decorator.js';
import {InquiryService} from '../inquiry.service.js';

/**
 * inquiry 큐 경로 컨트롤러 (문의 관리, RabbitMQ 인바운드 어댑터) — 게이트웨이가 발행한 `admin.inquiry.*` 명령을 `@OnCommand` 로 받아 service 로 넘긴다(위임만).
 * 입력 검증은 게이트웨이 ValidationPipe 에서 끝났다(다시 검증하지 않는다). 모두 로그인 명령이라 actor 가 필요하다 — 관리자 해제는 누가 풀었는지 남기지 않아 로그인만 확인하고 넘기지 않는다.
 */
@Injectable()
export class InquiryQueueController {
    /**
     * @param inquiryService inquiry 비즈니스 로직
     */
    constructor(private readonly inquiryService: InquiryService) {}

    /**
     * 내 업체 문의 답변 — 업체 관리자
     *
     * @param command 명령 봉투 (actor 필수, payload = path param + 본문)
     */
    @OnCommand(INQUIRY_COMMAND.MINE_ANSWER)
    async answerMyStoreInquiry(command: MessageEnvelope<InquiryAnswerParamDto & InquiryAnswerDto>): Promise<void> {
        return this.inquiryService.answerMyStoreInquiry(requireActor(command).user_id, command.payload.inquiry_id, command.payload);
    }

    /**
     * 내 업체 문의 블라인드 — 업체 관리자, 한 건
     *
     * @param command 명령 봉투 (actor 필수, payload = path param)
     */
    @OnCommand(INQUIRY_COMMAND.MINE_BLIND)
    async blindMyStoreInquiry(command: MessageEnvelope<InquiryBlindParamDto>): Promise<void> {
        return this.inquiryService.blindMyStoreInquiry(requireActor(command).user_id, command.payload.inquiry_id);
    }

    /**
     * 내 업체 문의 블라인드 해제 — 업체 관리자, 한 건
     *
     * @param command 명령 봉투 (actor 필수, payload = path param)
     */
    @OnCommand(INQUIRY_COMMAND.MINE_UNBLIND)
    async unblindMyStoreInquiry(command: MessageEnvelope<InquiryUnblindParamDto>): Promise<void> {
        return this.inquiryService.unblindMyStoreInquiry(requireActor(command).user_id, command.payload.inquiry_id);
    }

    /**
     * 바로방 문의 답변 — 관리자
     *
     * @param command 명령 봉투 (actor 필수, payload = path param + 본문)
     */
    @OnCommand(INQUIRY_COMMAND.ANSWER)
    async answerInquiry(command: MessageEnvelope<InquiryAnswerParamDto & InquiryAnswerDto>): Promise<void> {
        return this.inquiryService.answerInquiry(requireActor(command).user_id, command.payload.inquiry_id, command.payload);
    }

    /**
     * 바로방 문의 블라인드 — 관리자, 한 건
     *
     * @param command 명령 봉투 (actor 필수, payload = path param)
     */
    @OnCommand(INQUIRY_COMMAND.BLIND)
    async blindInquiry(command: MessageEnvelope<InquiryBlindParamDto>): Promise<void> {
        return this.inquiryService.blindInquiry(requireActor(command).user_id, command.payload.inquiry_id);
    }

    /**
     * 바로방 문의 블라인드 해제 — 관리자, 한 건 (로그인만 확인)
     *
     * @param command 명령 봉투 (actor 필수, payload = path param)
     */
    @OnCommand(INQUIRY_COMMAND.UNBLIND)
    async unblindInquiry(command: MessageEnvelope<InquiryUnblindParamDto>): Promise<void> {
        requireActor(command);
        return this.inquiryService.unblindInquiry(command.payload.inquiry_id);
    }
}

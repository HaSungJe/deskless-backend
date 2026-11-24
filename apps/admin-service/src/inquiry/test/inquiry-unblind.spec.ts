import type {TestingModule} from '@nestjs/testing';
import {IsNull, Not} from 'typeorm';
import {INQUIRY_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {CommandDispatcher} from '@app/messaging/command.dispatcher.js';
import {
    ADMIN_ACTOR,
    ANSWERED_AT,
    bootCommandPath,
    createInquiryRepositoryMock,
    FIXED_TIME,
    INQUIRY_ID,
    inquiryEntity,
    InquiryRepositoryMock,
    MANAGER_ACTOR,
    runCommand,
    STORE_ID,
} from './inquiry.test-helper.js';

/** 블라인드된 문의 — 답변 있음 */
const BLINDED_ANSWERED = {
    inquiry_state_id: 'BLIND',
    answer_content: '답변',
    answer_user_id: MANAGER_ACTOR.user_id,
    answered_at: ANSWERED_AT,
    blind_user_id: MANAGER_ACTOR.user_id,
    blinded_at: FIXED_TIME,
};

describe('admin.inquiry.mine-unblind · admin.inquiry.unblind — 문의 블라인드 해제 (큐 경로, 한 건)', () => {
    let repo: InquiryRepositoryMock;
    let dispatcher: CommandDispatcher;
    let module: TestingModule;

    beforeEach(async () => {
        repo = createInquiryRepositoryMock();
        ({dispatcher, module} = await bootCommandPath(repo));
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await module.close();
    });

    it('[SUCCESS] 답변이 있는 블라인드 문의를 풀면 답변완료 — 조건에 블라인드 · 답변 있음, 블라인드 칸은 비운다', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity(BLINDED_ANSWERED));

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.MINE_UNBLIND, actor: MANAGER_ACTOR, payload: {inquiry_id: INQUIRY_ID}});

        expect(result).toEqual({result: null, error: null});
        expect(repo.findInquiry).toHaveBeenCalledWith({store_id: STORE_ID, inquiry_id: INQUIRY_ID});
        expect(repo.updateInquiry).toHaveBeenCalledTimes(1);
        const [where, entity] = repo.updateInquiry.mock.calls[0];
        expect(where).toEqual({store_id: STORE_ID, inquiry_id: INQUIRY_ID, inquiry_state_id: 'BLIND', answered_at: Not(IsNull())});
        expect(entity).toBeInstanceOf(InquiryEntity);
        expect(entity).toMatchObject({inquiry_state_id: 'ANSWERED', blind_user_id: null, blinded_at: null});
    });

    it('[SUCCESS] 답변이 없는 블라인드 문의를 풀면 접수 — 관리자 경로는 바로방 범위, 조건에 블라인드 · 답변 없음', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity({store_id: null, inquiry_state_id: 'BLIND', blind_user_id: ADMIN_ACTOR.user_id, blinded_at: FIXED_TIME}));

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.UNBLIND, actor: ADMIN_ACTOR, payload: {inquiry_id: INQUIRY_ID}});

        expect(result).toEqual({result: null, error: null});
        expect(repo.findManagerStore).not.toHaveBeenCalled();
        const [where, entity] = repo.updateInquiry.mock.calls[0];
        expect(where).toEqual({store_id: IsNull(), inquiry_id: INQUIRY_ID, inquiry_state_id: 'BLIND', answered_at: IsNull()});
        expect(entity).toMatchObject({inquiry_state_id: 'RECEIVED', blind_user_id: null, blinded_at: null});
    });

    it('[FAIL:business] 블라인드가 아닌 문의를 풀면 400 블라인드된 문의가 아닙니다. — 쓰기 없음', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity({inquiry_state_id: 'ANSWERED', answer_content: '답변', answer_user_id: MANAGER_ACTOR.user_id, answered_at: ANSWERED_AT}));

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.MINE_UNBLIND, actor: MANAGER_ACTOR, payload: {inquiry_id: INQUIRY_ID}});

        expect(result?.error).toEqual({status_code: 400, body: {message: '블라인드된 문의가 아닙니다.', validation_errors: null}});
        expect(repo.updateInquiry).not.toHaveBeenCalled();
    });
});

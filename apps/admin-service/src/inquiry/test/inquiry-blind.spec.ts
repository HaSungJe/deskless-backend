import type {TestingModule} from '@nestjs/testing';
import {In, IsNull} from 'typeorm';
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

describe('admin.inquiry.mine-blind · admin.inquiry.blind — 문의 블라인드 (큐 경로, 한 건)', () => {
    let repo: InquiryRepositoryMock;
    let dispatcher: CommandDispatcher;
    let module: TestingModule;

    beforeEach(async () => {
        vi.useFakeTimers({toFake: ['Date']});
        vi.setSystemTime(FIXED_TIME);
        repo = createInquiryRepositoryMock();
        ({dispatcher, module} = await bootCommandPath(repo));
    });

    afterEach(async () => {
        vi.useRealTimers();
        vi.clearAllMocks();
        await module.close();
    });

    it('[SUCCESS] 접수 · 답변완료 문의를 블라인드 — 범위(업체 관리자 소속 업체 · 관리자 바로방) · 블라인드가 아닐 때만, 처리 계정 · 시각을 적고 답변 칸은 싣지 않는다', async () => {
        repo.findInquiry
            .mockResolvedValueOnce(inquiryEntity())
            .mockResolvedValueOnce(inquiryEntity({store_id: null, inquiry_state_id: 'ANSWERED', answer_content: '답변', answer_user_id: ADMIN_ACTOR.user_id, answered_at: ANSWERED_AT}));

        const mine = await runCommand(dispatcher, {type: INQUIRY_COMMAND.MINE_BLIND, actor: MANAGER_ACTOR, payload: {inquiry_id: INQUIRY_ID}});
        const all = await runCommand(dispatcher, {type: INQUIRY_COMMAND.BLIND, actor: ADMIN_ACTOR, payload: {inquiry_id: INQUIRY_ID}});

        expect(mine.result).toEqual({result: null, error: null});
        expect(all.result).toEqual({result: null, error: null});
        expect(repo.updateInquiry).toHaveBeenCalledTimes(2);
        const [mineWhere, mineEntity] = repo.updateInquiry.mock.calls[0];
        expect(mineWhere).toEqual({store_id: STORE_ID, inquiry_id: INQUIRY_ID, inquiry_state_id: In(['RECEIVED', 'ANSWERED'])});
        expect(mineEntity).toBeInstanceOf(InquiryEntity);
        expect(mineEntity).toMatchObject({inquiry_state_id: 'BLIND', blind_user_id: MANAGER_ACTOR.user_id, blinded_at: FIXED_TIME});
        expect(mineEntity.answer_content).toBeUndefined();
        expect(mineEntity.answered_at).toBeUndefined();
        const [allWhere, allEntity] = repo.updateInquiry.mock.calls[1];
        expect(allWhere).toEqual({store_id: IsNull(), inquiry_id: INQUIRY_ID, inquiry_state_id: In(['RECEIVED', 'ANSWERED'])});
        expect(allEntity).toMatchObject({inquiry_state_id: 'BLIND', blind_user_id: ADMIN_ACTOR.user_id, blinded_at: FIXED_TIME});
        expect(repo.findManagerStore).toHaveBeenCalledTimes(1);
    });

    it('[FAIL:business] 이미 블라인드된 문의를 블라인드하면 400 이미 블라인드된 문의입니다. — 쓰기 없음', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity({inquiry_state_id: 'BLIND', blind_user_id: MANAGER_ACTOR.user_id, blinded_at: FIXED_TIME}));

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.MINE_BLIND, actor: MANAGER_ACTOR, payload: {inquiry_id: INQUIRY_ID}});

        expect(result?.error).toEqual({status_code: 400, body: {message: '이미 블라인드된 문의입니다.', validation_errors: null}});
        expect(repo.updateInquiry).not.toHaveBeenCalled();
    });
});

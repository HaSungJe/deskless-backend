import type {TestingModule} from '@nestjs/testing';
import {In, IsNull} from 'typeorm';
import {InquiryAnswerDto} from '@app/contracts/inquiry/dto/inquiry-answer.dto.js';
import {INQUIRY_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {CommandDispatcher} from '@app/messaging/command.dispatcher.js';
import {
    ADMIN_ACTOR,
    bootCommandPath,
    createInquiryRepositoryMock,
    FIXED_TIME,
    INQUIRY_ID,
    inquiryEntity,
    InquiryRepositoryMock,
    MANAGER_ACTOR,
    runCommand,
    STORE_ID,
    validateBody,
} from './inquiry.test-helper.js';

const ANSWER = '20시로 바꿔 드렸습니다.';
const PAYLOAD = {inquiry_id: INQUIRY_ID, answer_content: ANSWER};

describe('admin.inquiry.mine-answer · admin.inquiry.answer — 문의 답변 (큐 경로)', () => {
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

    it('[SUCCESS] 업체 관리자가 접수 문의에 답한다 — 소속 업체 범위로 찾고, 블라인드가 아닐 때만 답변완료 · 답변 · 답변 계정 · 시각 저장', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity());

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.MINE_ANSWER, actor: MANAGER_ACTOR, payload: PAYLOAD});

        expect(result).toEqual({result: null, error: null});
        expect(repo.findManagerStore).toHaveBeenCalledWith(MANAGER_ACTOR.user_id);
        expect(repo.findInquiry).toHaveBeenCalledWith({store_id: STORE_ID, inquiry_id: INQUIRY_ID});
        expect(repo.updateInquiry).toHaveBeenCalledTimes(1);
        const [where, entity] = repo.updateInquiry.mock.calls[0];
        expect(where).toEqual({store_id: STORE_ID, inquiry_id: INQUIRY_ID, inquiry_state_id: In(['RECEIVED', 'ANSWERED'])});
        expect(entity).toBeInstanceOf(InquiryEntity);
        expect(entity).toMatchObject({inquiry_state_id: 'ANSWERED', answer_content: ANSWER, answer_user_id: MANAGER_ACTOR.user_id, answered_at: FIXED_TIME});
    });

    it('[FAIL:business] 블라인드된 문의에 답하면 400 블라인드된 문의에는 답변할 수 없습니다. — 쓰기 없음(관리자 경로 · 바로방 범위)', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity({store_id: null, inquiry_state_id: 'BLIND', blind_user_id: ADMIN_ACTOR.user_id, blinded_at: FIXED_TIME}));

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.ANSWER, actor: ADMIN_ACTOR, payload: PAYLOAD});

        expect(result?.error).toEqual({status_code: 400, body: {message: '블라인드된 문의에는 답변할 수 없습니다.', validation_errors: null}});
        expect(repo.findManagerStore).not.toHaveBeenCalled();
        expect(repo.findInquiry).toHaveBeenCalledWith({store_id: IsNull(), inquiry_id: INQUIRY_ID});
        expect(repo.updateInquiry).not.toHaveBeenCalled();
    });

    it('[FAIL:business] 확인과 저장 사이에 다른 사람이 블라인드했으면(저장 0행) 같은 400 — 예외로 롤백', async () => {
        repo.findInquiry.mockResolvedValueOnce(inquiryEntity({store_id: null}));
        repo.updateInquiry.mockResolvedValueOnce(false);

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.ANSWER, actor: ADMIN_ACTOR, payload: PAYLOAD});

        expect(result?.error).toEqual({status_code: 400, body: {message: '블라인드된 문의에는 답변할 수 없습니다.', validation_errors: null}});
        expect(repo.updateInquiry).toHaveBeenCalledTimes(1);
        expect(repo.updateInquiry.mock.calls[0][0]).toEqual({store_id: IsNull(), inquiry_id: INQUIRY_ID, inquiry_state_id: In(['RECEIVED', 'ANSWERED'])});
        expect(repo.updateInquiry.mock.calls[0][1]).toMatchObject({answer_user_id: ADMIN_ACTOR.user_id});
    });

    it('[FAIL:service] 다른 업체 문의에 답하면(소속 업체 범위로 찾지 못함) 404 문의를 찾을 수 없습니다. — 쓰기 없음', async () => {
        repo.findInquiry.mockResolvedValueOnce(null);

        const {result} = await runCommand(dispatcher, {type: INQUIRY_COMMAND.MINE_ANSWER, actor: MANAGER_ACTOR, payload: PAYLOAD});

        expect(result?.error).toEqual({status_code: 404, body: {message: '문의를 찾을 수 없습니다.', validation_errors: null}});
        expect(repo.updateInquiry).not.toHaveBeenCalled();
    });

    it('[FAIL:validation] 답변이 비었거나 2000자를 넘으면 → answer_content', async () => {
        await expect(validateBody(InquiryAnswerDto, {answer_content: ''})).resolves.toEqual({
            message: '답변을 입력해주세요.',
            validation_errors: [{property: 'answer_content', message: '답변을 입력해주세요.'}],
        });
        await expect(validateBody(InquiryAnswerDto, {answer_content: '가'.repeat(2001)})).resolves.toMatchObject({
            validation_errors: [{property: 'answer_content', message: '답변은 2000자 이내로 입력해주세요.'}],
        });
        await expect(validateBody(InquiryAnswerDto, {answer_content: '가'.repeat(2000)})).resolves.toBeNull();
    });
});

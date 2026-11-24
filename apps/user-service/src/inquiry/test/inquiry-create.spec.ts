import type {TestingModule} from '@nestjs/testing';
import {InquiryDto} from '@app/contracts/inquiry/dto/inquiry.dto.js';
import {INQUIRY_USER_COMMAND} from '@app/contracts/inquiry/inquiry.commands.js';
import {InquiryEntity} from '@app/database/entities/inquiry/inquiry.entity.js';
import type {CommandDispatcher} from '@app/messaging/command.dispatcher.js';
import {bootCommandPath, createInquiryRepositoryMock, InquiryRepositoryMock, runCommand, STORE_ID, USER_ACTOR, validateBody} from './inquiry.test-helper.js';

/** 업체 문의 — 예약 카테고리 */
const DTO = {store_id: STORE_ID, inquiry_category_id: 'RESERVATION', title: '예약 시간 변경 문의', content: '오늘 18시 예약을 20시로 바꿀 수 있나요?'};

describe('user.inquiry.create — 문의 등록 (큐 경로)', () => {
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

    it('[SUCCESS] 업체 · 카테고리를 골라 문의 — 영업 중 · 영업중지 업체만 찾고, 그 업체 · 카테고리 · 접수로 저장(답변 · 블라인드 칸은 비움), 문의 ID', async () => {
        repo.findInquiryStore.mockResolvedValueOnce({store_id: STORE_ID});

        const {result} = await runCommand(dispatcher, {type: INQUIRY_USER_COMMAND.CREATE, actor: USER_ACTOR, payload: DTO});

        expect(repo.findInquiryStore).toHaveBeenCalledTimes(1);
        expect(repo.findInquiryStore).toHaveBeenCalledWith(STORE_ID);
        expect(repo.insertInquiry).toHaveBeenCalledTimes(1);
        const inserted = repo.insertInquiry.mock.calls[0][0];
        expect(inserted).toBeInstanceOf(InquiryEntity);
        expect(inserted).toMatchObject({
            user_id: USER_ACTOR.user_id,
            store_id: STORE_ID,
            inquiry_category_id: 'RESERVATION',
            inquiry_state_id: 'RECEIVED',
            title: DTO.title,
            content: DTO.content,
            answer_content: null,
            answer_user_id: null,
            answered_at: null,
            blind_user_id: null,
            blinded_at: null,
        });
        expect(inserted.inquiry_id).toMatch(/^[a-f0-9]{32}$/);
        expect(result).toEqual({result: {inquiry_id: inserted.inquiry_id}, error: null});
    });

    it('[SUCCESS] 업체를 고르지 않으면 바로방 문의 — 업체를 찾지 않고 store_id null 로 고른 카테고리와 저장', async () => {
        const {result} = await runCommand(dispatcher, {
            type: INQUIRY_USER_COMMAND.CREATE,
            actor: USER_ACTOR,
            payload: {inquiry_category_id: 'STORE_APPLICATION', title: '입점 문의', content: '입점 절차가 궁금합니다.'},
        });

        expect(repo.findInquiryStore).not.toHaveBeenCalled();
        expect(repo.insertInquiry).toHaveBeenCalledTimes(1);
        expect(repo.insertInquiry.mock.calls[0][0]).toMatchObject({user_id: USER_ACTOR.user_id, store_id: null, inquiry_category_id: 'STORE_APPLICATION', inquiry_state_id: 'RECEIVED'});
        expect(result?.error).toBeNull();
    });

    it('[FAIL:service] 탈퇴 · 지운 · 없는 업체를 고르면 404 업체를 찾을 수 없습니다., 저장 없음', async () => {
        repo.findInquiryStore.mockResolvedValueOnce(null);

        const {result} = await runCommand(dispatcher, {type: INQUIRY_USER_COMMAND.CREATE, actor: USER_ACTOR, payload: DTO});

        expect(result?.error).toEqual({status_code: 404, body: {message: '업체를 찾을 수 없습니다.', validation_errors: null}});
        expect(repo.insertInquiry).not.toHaveBeenCalled();
    });

    describe('[FAIL:validation] 게이트웨이 ValidationPipe', () => {
        it('카테고리를 고르지 않으면 → inquiry_category_id', async () => {
            await expect(validateBody(InquiryDto, {store_id: STORE_ID, title: DTO.title, content: DTO.content})).resolves.toEqual({
                message: '카테고리를 선택해주세요.',
                validation_errors: [{property: 'inquiry_category_id', message: '카테고리를 선택해주세요.'}],
            });
        });

        it('카테고리가 허용값 밖이면 → inquiry_category_id', async () => {
            await expect(validateBody(InquiryDto, {...DTO, inquiry_category_id: 'SPAM'})).resolves.toEqual({
                message: '카테고리가 올바르지 않습니다.',
                validation_errors: [{property: 'inquiry_category_id', message: '카테고리가 올바르지 않습니다.'}],
            });
        });

        it('제목이 비었거나 100자를 넘으면 → title', async () => {
            await expect(validateBody(InquiryDto, {...DTO, title: ''})).resolves.toMatchObject({validation_errors: [{property: 'title', message: '제목을 입력해주세요.'}]});
            await expect(validateBody(InquiryDto, {...DTO, title: '가'.repeat(101)})).resolves.toMatchObject({validation_errors: [{property: 'title', message: '제목은 100자 이내로 입력해주세요.'}]});
        });

        it('업체 ID 형식이 틀리면 → store_id, 동의 값 같은 선언 안 된 필드는 게이트웨이가 막지 않는다(whitelist 꺼짐 — service 가 필드별로 저장해 버린다)', async () => {
            await expect(validateBody(InquiryDto, {...DTO, store_id: 'store-1'})).resolves.toMatchObject({validation_errors: [{property: 'store_id', message: '업체 ID가 올바르지 않습니다.'}]});
            await expect(validateBody(InquiryDto, {...DTO, is_agreed: 1})).resolves.toBeNull();
        });

        it('업체 없이(바로방) 카테고리 · 제목 · 내용만 있으면 통과', async () => {
            await expect(validateBody(InquiryDto, {inquiry_category_id: 'ETC', title: '기타 문의', content: '내용'})).resolves.toBeNull();
        });
    });
});

import type {TestingModule} from '@nestjs/testing';
import {CHAT_COMMAND} from '@app/contracts/chat/chat.commands.js';
import type {CommandDispatcher} from '@app/messaging/command.dispatcher.js';
import {bootCommandPath, ChatMocks, createChatMocks, runCommand, USER_ACTOR} from './chat.test-helper.js';

describe('user.chat.clear — 대화 초기화 (큐 경로)', () => {
    let mocks: ChatMocks;
    let dispatcher: CommandDispatcher;
    let module: TestingModule;

    beforeEach(async () => {
        mocks = createChatMocks();
        ({dispatcher, module} = await bootCommandPath(mocks));
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await module.close();
    });

    it('[SUCCESS] 내 이력을 바로 모두 지운다 — done data 없음, 질문 수 한 줄은 건드리지 않는다', async () => {
        const {decision, result} = await runCommand(dispatcher, {type: CHAT_COMMAND.CLEAR, payload: {}, actor: USER_ACTOR});

        expect(decision.action).toBe('ack');
        expect(result).toEqual({result: null, error: null});
        expect(mocks.store.clearTurns).toHaveBeenCalledTimes(1);
        expect(mocks.store.clearTurns).toHaveBeenCalledWith(USER_ACTOR.user_id);
        expect(mocks.store.appendTurn).not.toHaveBeenCalled();
        expect(mocks.store.getUsage).not.toHaveBeenCalled();
    });
});

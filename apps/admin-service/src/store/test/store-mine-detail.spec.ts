import type {TestingModule} from '@nestjs/testing';
import {StoreMineDetailDto} from '@app/contracts/store/dto/store-mine-detail.dto.js';
import {STORE_COMMAND} from '@app/contracts/store/store.commands.js';
import {StoreEntity} from '@app/database/entities/store/store.entity.js';
import type {CommandDispatcher} from '@app/messaging/command.dispatcher.js';
import {bootCommandPath, createStoreRepositoryMock, MANAGER_ACTOR, runCommand, STORE_ID, StoreRepositoryMock, storeRow, validateBody} from './store.test-helper.js';

describe('admin.store.mine-detail — 내 업체 편의시설 설정 (큐 경로)', () => {
    let repo: StoreRepositoryMock;
    let dispatcher: CommandDispatcher;
    let module: TestingModule;

    beforeEach(async () => {
        repo = createStoreRepositoryMock();
        repo.findStoreByManager.mockResolvedValue(storeRow());
        ({dispatcher, module} = await bootCommandPath(repo));
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await module.close();
    });

    it('[SUCCESS] 업체 행을 잠가 찾고, 보낸 항목은 그 값 · 빠진 항목은 없음(0)으로 7개를 통째로 저장 — 선언 안 된 키는 버리고 다른 칸은 건드리지 않는다', async () => {
        const payload = {has_hot_spring: 1, is_pet_allowed: 1, has_parking: 0, has_wifi: 1};

        const {result} = await runCommand(dispatcher, {type: STORE_COMMAND.MINE_DETAIL, payload, actor: MANAGER_ACTOR});

        expect(result).toEqual({result: null, error: null});
        expect(repo.findStoreByManager).toHaveBeenCalledTimes(1);
        expect(repo.findStoreByManager).toHaveBeenCalledWith(MANAGER_ACTOR.user_id, true);
        expect(repo.updateStore).toHaveBeenCalledTimes(1);
        const [where, entity] = repo.updateStore.mock.calls[0] as [unknown, StoreEntity];
        expect(where).toEqual({store_id: STORE_ID});
        expect(entity).toBeInstanceOf(StoreEntity);
        expect(entity.store_detail).toEqual({has_convenience_store: 0, has_cafe: 0, has_hot_spring: 1, is_pet_allowed: 1, has_meal: 0, is_delivery_allowed: 0, has_parking: 0});
        expect(
            Object.entries(entity)
                .filter(([, value]) => value !== undefined)
                .map(([key]) => key),
        ).toEqual(['store_detail']);
    });

    it('[FAIL:service] 소속 업체가 탈퇴 · 삭제됐으면 failed 404 소속 업체를 찾을 수 없습니다. — 쓰기 없음', async () => {
        repo.findStoreByManager.mockResolvedValueOnce(null);

        const {result} = await runCommand(dispatcher, {type: STORE_COMMAND.MINE_DETAIL, payload: {has_cafe: 1}, actor: MANAGER_ACTOR});

        expect(result?.error).toEqual({status_code: 404, body: {message: '소속 업체를 찾을 수 없습니다.', validation_errors: null}});
        expect(repo.updateStore).not.toHaveBeenCalled();
    });

    describe('[FAIL:validation] 게이트웨이 ValidationPipe', () => {
        it('값이 0 · 1 이 아니면 → 그 항목', async () => {
            await expect(validateBody(StoreMineDetailDto, {has_hot_spring: 2})).resolves.toEqual({
                message: '온천 여부가 올바르지 않습니다.',
                validation_errors: [{property: 'has_hot_spring', message: '온천 여부가 올바르지 않습니다.'}],
            });
        });

        it('선언 안 된 항목은 게이트웨이가 막지 않는다(whitelist 꺼짐) — service 가 버린다, 빈 본문(전부 없음)과 0 · 1 만 있는 본문도 통과', async () => {
            await expect(validateBody(StoreMineDetailDto, {has_wifi: 1})).resolves.toBeNull();
            await expect(validateBody(StoreMineDetailDto, {})).resolves.toBeNull();
            await expect(validateBody(StoreMineDetailDto, {has_convenience_store: 1, has_cafe: 0, has_meal: 1})).resolves.toBeNull();
        });
    });
});

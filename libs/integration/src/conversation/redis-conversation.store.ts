import {Injectable, Logger, ServiceUnavailableException} from '@nestjs/common';
import {dayjs} from '@app/common/utils/dayjs.js';
import {REDIS_UNAVAILABLE_MESSAGE} from '../integration.constants.js';
import type {ConversationStoreInterface, ConversationTurn, ConversationUsage} from '../interfaces/integration.interface.js';
import {RedisConnection} from '../redis/redis.connection.js';
import type {RedisClient} from '../redis/redis.connection.js';

/** 이용자의 대화 이력 키 접두 — ZSET(점수 = 물은 시각 ms, 값 = 한 건 JSON) */
const CHAT_TURNS_KEY_PREFIX = 'chat-turns:';

/** 이력이 있는 이용자 목록 — ZSET(점수 = 마지막 질문 시각, 값 = user_id) — 지난 대화 지우기가 훑는다 */
const CHAT_USERS_KEY = 'chat-users';

/** 이용자의 하루 질문 수 한 줄 키 접두 — STRING `yyyy-MM-dd:횟수` */
const CHAT_USAGE_KEY_PREFIX = 'chat-usage:';

/** 이용자의 답하는 중 잠금 키 접두 — STRING(값 = 요청 ID) */
const CHAT_BUSY_KEY_PREFIX = 'chat-busy:';

/** 지난 대화 지우기가 한 번에 읽는 이용자 수 */
const PURGE_BATCH = 500;

/** 이력 — since(ms) 이후 물은 대화(오래된 순) */
const TURNS_SCRIPT = `
return redis.call('ZRANGE', KEYS[1], ARGV[1], '+inf', 'BYSCORE')
`;

/** 한 건 저장 + 질문 수 — 이력 · 이력 만료 · 이용자 목록 · 질문 수 한 줄(없음 → 날짜:1, 다른 날짜 → 날짜:1, 같은 날짜 → +1). 새 횟수를 돌려준다 */
const APPEND_SCRIPT = `
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[1], ARGV[4])
local date, count = string.match(redis.call('GET', KEYS[3]) or '', '^(%d%d%d%d%-%d%d%-%d%d):(%d+)$')
local used = 1
if date == ARGV[5] then used = tonumber(count) + 1 end
redis.call('SET', KEYS[3], ARGV[5] .. ':' .. used, 'PX', ARGV[3])
return used
`;

/** 이력 지우기 — 이력 키를 지우고 이용자 목록에서 뺀다(질문 수 한 줄은 그대로) */
const CLEAR_SCRIPT = `
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[1])
return 1
`;

/** 질문 수 한 줄 · 답하는 중 — 한 번에 읽는다 */
const USAGE_SCRIPT = `
return {redis.call('GET', KEYS[1]) or '', redis.call('EXISTS', KEYS[2])}
`;

/** 답하는 중 잠금 — 비어 있을 때만 잡는다(만료 ms) */
const ACQUIRE_BUSY_SCRIPT = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 end
return 0
`;

/** 잠금 풀기 — 값이 내 요청 ID 일 때만 */
const RELEASE_BUSY_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/** 이용자 목록 한 묶음 — 순위 범위 */
const USERS_PAGE_SCRIPT = `
return redis.call('ZRANGE', KEYS[1], ARGV[1], ARGV[2])
`;

/** 이용자 한 명의 지난 대화 지우기 — 남은 대화가 없으면 이력 키를 지우고 목록에서 빼고 1 */
const PURGE_USER_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', '(' .. ARGV[1])
if redis.call('ZCARD', KEYS[1]) == 0 then
  redis.call('DEL', KEYS[1])
  redis.call('ZREM', KEYS[2], ARGV[2])
  return 1
end
return 0
`;

/**
 * 이용자의 대화 이력 키.
 *
 * @param user_id 이용자 ID
 * @returns 키
 */
function turnsKey(user_id: string): string {
    return `${CHAT_TURNS_KEY_PREFIX}${user_id}`;
}

/**
 * 이용자의 질문 수 한 줄 키.
 *
 * @param user_id 이용자 ID
 * @returns 키
 */
function usageKey(user_id: string): string {
    return `${CHAT_USAGE_KEY_PREFIX}${user_id}`;
}

/**
 * 이용자의 답하는 중 잠금 키.
 *
 * @param user_id 이용자 ID
 * @returns 키
 */
function busyKey(user_id: string): string {
    return `${CHAT_BUSY_KEY_PREFIX}${user_id}`;
}

/**
 * 이력 값(JSON)을 한 건으로 — 모양이 다르면 null(버린다).
 *
 * @param value 저장된 값
 * @returns 한 건 또는 null
 */
function parseTurn(value: unknown): ConversationTurn | null {
    if (typeof value !== 'string') {
        return null;
    }
    try {
        const turn = JSON.parse(value) as Partial<ConversationTurn>;
        if (typeof turn.turn_id !== 'string' || typeof turn.question !== 'string' || typeof turn.answer !== 'string' || typeof turn.asked_at !== 'string') {
            return null;
        }
        return {
            turn_id: turn.turn_id,
            user_id: typeof turn.user_id === 'string' ? turn.user_id : '',
            question: turn.question,
            answer: turn.answer,
            stores: Array.isArray(turn.stores) ? turn.stores : [],
            asked_at: turn.asked_at,
            answered_at: typeof turn.answered_at === 'string' ? turn.answered_at : turn.asked_at,
        };
    } catch {
        return null;
    }
}

/**
 * 질문 수 한 줄(`yyyy-MM-dd:횟수`)을 날짜 · 횟수로 — 없거나 모양이 틀리면 날짜 null · 0회.
 *
 * @param value 저장된 값
 * @returns 날짜 · 횟수
 */
function parseUsage(value: unknown): {date: string | null; count: number} {
    const match = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(value) : null;
    return match ? {date: match[1], count: Number(match[2])} : {date: null, count: 0};
}

/**
 * 대화 저장소 어댑터 — Redis. 이용자마다 이력(chat-turns:<user_id> — 질문 + 답 한 건씩, 7일) · 질문 수 한 줄(chat-usage:<user_id> = yyyy-MM-dd:횟수) · 답하는 중 잠금(chat-busy:<user_id>).
 * 이력 저장과 질문 수 올리기처럼 함께 바꾸는 일은 Lua 하나로(원자적). Redis 는 단일 노드(클러스터 모드 끔)라 Lua 안에서 키를 만들어도 된다.
 * 대화는 DB 가 아니라 실제로 지운다(소프트 삭제 규칙은 DB 에만). 세팅: docs/guides/redis-setup.md
 */
@Injectable()
export class RedisConversationStore implements ConversationStoreInterface {
    private readonly logger = new Logger(RedisConversationStore.name);

    /**
     * @param redis Redis 연결
     */
    constructor(private readonly redis: RedisConnection) {}

    /**
     * 이력 — since 이후 물은 대화 중 마지막 limit 건(오래된 순).
     *
     * @param user_id 이용자 ID
     * @param since 이 시각 이후 물은 대화만
     * @param limit 최대 건수(끝에서)
     * @returns 대화
     */
    async getTurns(user_id: string, since: Date, limit: number): Promise<ConversationTurn[]> {
        const values = await this.run('대화 이력 읽기', (client) => client.eval(TURNS_SCRIPT, {keys: [turnsKey(user_id)], arguments: [String(dayjs(since).valueOf())]}));
        const turns = (Array.isArray(values) ? values : []).map(parseTurn).filter((turn): turn is ConversationTurn => turn !== null);
        return turns.slice(Math.max(0, turns.length - limit));
    }

    /**
     * 한 건 저장 + 질문 수 — 이력에 더하고(점수 = 물은 시각), 질문 수 한 줄을 date 로 바꾼다.
     *
     * @param user_id 이용자 ID
     * @param turn 한 건
     * @param date 물은 한국 날짜(yyyy-MM-dd)
     * @param keep_ms 이력 · 질문 수 키를 쓰지 않으면 지울 시간
     * @returns 바뀐 뒤 그 날짜의 질문 수
     */
    async appendTurn(user_id: string, turn: ConversationTurn, date: string, keep_ms: number): Promise<number> {
        const used = await this.run('대화 저장', (client) =>
            client.eval(APPEND_SCRIPT, {
                keys: [turnsKey(user_id), CHAT_USERS_KEY, usageKey(user_id)],
                arguments: [String(dayjs(turn.asked_at).valueOf()), JSON.stringify(turn), String(keep_ms), user_id, date],
            }),
        );
        return Number(used);
    }

    /**
     * 이력을 모두 지운다(질문 수 한 줄은 남긴다).
     *
     * @param user_id 이용자 ID
     */
    async clearTurns(user_id: string): Promise<void> {
        await this.run('대화 초기화', (client) => client.eval(CLEAR_SCRIPT, {keys: [turnsKey(user_id), CHAT_USERS_KEY], arguments: [user_id]}));
    }

    /**
     * 질문 수 한 줄 · 답하는 중.
     *
     * @param user_id 이용자 ID
     * @returns 날짜 · 횟수 · 답하는 중
     */
    async getUsage(user_id: string): Promise<ConversationUsage> {
        const values = await this.run('질문 수 읽기', (client) => client.eval(USAGE_SCRIPT, {keys: [usageKey(user_id), busyKey(user_id)], arguments: []}));
        const [usage, busy] = Array.isArray(values) ? values : [];
        return {...parseUsage(usage), is_answering: Number(busy) === 1};
    }

    /**
     * 답하는 중 잠금 — 비어 있을 때만 잡는다.
     *
     * @param user_id 이용자 ID
     * @param lock_id 이번 요청 ID
     * @param ttl_ms 만료(풀지 못하고 죽어도 이 시간 뒤 풀린다)
     * @returns 잡았으면 true
     */
    async acquireBusy(user_id: string, lock_id: string, ttl_ms: number): Promise<boolean> {
        const acquired = await this.run('답하는 중 잠금', (client) => client.eval(ACQUIRE_BUSY_SCRIPT, {keys: [busyKey(user_id)], arguments: [lock_id, String(ttl_ms)]}));
        return Number(acquired) === 1;
    }

    /**
     * 답하는 중 잠금 풀기 — 값이 lock_id 일 때만.
     *
     * @param user_id 이용자 ID
     * @param lock_id 이번 요청 ID
     */
    async releaseBusy(user_id: string, lock_id: string): Promise<void> {
        await this.run('답하는 중 잠금 풀기', (client) => client.eval(RELEASE_BUSY_SCRIPT, {keys: [busyKey(user_id)], arguments: [lock_id]}));
    }

    /**
     * 지난 대화 지우기 — 이용자 목록을 PURGE_BATCH 명씩 훑어 이용자마다 before 전에 물은 대화를 지운다(이용자 하나씩 — Redis 를 오래 막지 않게).
     * 남은 대화가 없는 이용자는 목록에서 빠지므로 다음 묶음의 시작 순위를 그만큼 당긴다.
     *
     * @param before 이 시각 전에 물은 대화를 지운다
     */
    async purgeTurns(before: Date): Promise<void> {
        const before_ms = String(dayjs(before).valueOf());
        let offset = 0;
        for (;;) {
            const page = await this.run('지난 대화 지우기', (client) => client.eval(USERS_PAGE_SCRIPT, {keys: [CHAT_USERS_KEY], arguments: [String(offset), String(offset + PURGE_BATCH - 1)]}));
            const user_ids = (Array.isArray(page) ? page : []).filter((value): value is string => typeof value === 'string');
            let emptied = 0;
            for (const user_id of user_ids) {
                const removed = await this.run('지난 대화 지우기', (client) => client.eval(PURGE_USER_SCRIPT, {keys: [turnsKey(user_id), CHAT_USERS_KEY], arguments: [before_ms, user_id]}));
                emptied += Number(removed) === 1 ? 1 : 0;
            }
            if (user_ids.length < PURGE_BATCH) {
                return;
            }
            offset += user_ids.length - emptied;
        }
    }

    /**
     * Redis 명령 1번 — 준비 전이면 RedisConnection 이 503, 명령이 실패하면 로그를 남기고 503.
     *
     * @param action 로그에 남길 동작 이름
     * @param command 클라이언트로 실행할 명령
     * @returns 명령 결과
     */
    private async run<T>(action: string, command: (client: RedisClient) => Promise<T>): Promise<T> {
        const client = this.redis.ready();
        try {
            return await command(client);
        } catch (error) {
            this.logger.error(`${action} 실패: ${(error as Error)?.message ?? error}`);
            throw new ServiceUnavailableException({message: REDIS_UNAVAILABLE_MESSAGE});
        }
    }
}

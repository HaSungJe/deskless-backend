import {randomInt} from 'node:crypto';
import {IsNull, MoreThan} from 'typeorm';
import type {FindOptionsWhere} from 'typeorm';
import {dayjs} from '@app/common/utils/dayjs.js';
import {sha256Hex} from '@app/common/utils/hash.js';
import {generateId} from '@app/common/utils/id.js';
import {SmsVerificationEntity} from '@app/database/entities/user/sms-verification.entity.js';
import {DEFAULT_SMS_DAILY_LIMIT, SMS_CODE_TTL_MINUTES} from '../account.constants.js';

/** SMS 인증 기록 상태 — 사용 가능 · 이미 사용 · 만료 */
export type SmsVerificationState = 'USABLE' | 'USED' | 'EXPIRED';

/** buildSmsVerification 입력 */
export interface SmsVerificationInput {
    sms_purpose_id: string;
    user_id: string;
    phone: string;
    /** 인증번호 원문 — 해시(확인용)와 원문(테스트 때 보려고)을 함께 저장한다 */
    code: string;
    ip: string;
    now: Date;
}

/**
 * 숫자 6자리 인증번호 (암호학적 난수, 앞자리 0 유지).
 *
 * @returns 000000 ~ 999999
 */
export function generateVerificationCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * 같은 번호 하루 발송 한도 — env SMS_VERIFICATION_DAILY_LIMIT. 없거나 숫자가 아니거나 0 이하면 기본 10.
 *
 * @returns 한도
 */
export function getSmsDailyLimit(): number {
    const parsed = parseInt(process.env.SMS_VERIFICATION_DAILY_LIMIT ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SMS_DAILY_LIMIT;
}

/**
 * SMS 인증 기록 상태 — 이미 인증했으면 USED, 만료 시각이 지났으면(같으면 포함) EXPIRED.
 *
 * @param verification 인증 기록
 * @param now 기준 시각
 * @returns 상태
 */
export function checkSmsVerification(verification: SmsVerificationEntity, now: Date): SmsVerificationState {
    if (verification.verified_at) {
        return 'USED';
    }
    if (!dayjs(verification.expires_at).isAfter(now)) {
        return 'EXPIRED';
    }
    return 'USABLE';
}

/**
 * SMS 인증 발송 기록 — 인증번호는 SHA-256 해시(확인에 쓴다) + 원문(SMS 없이 테스트할 때 DB 에서 보려고 — 사용자 결정 2026-11-24), 만료는 발송 + 5분.
 *
 * @param input 용도 · 회원 · 번호 · 인증번호 · IP · 기준 시각
 * @returns 저장할 엔티티
 */
export function buildSmsVerification(input: SmsVerificationInput): SmsVerificationEntity {
    const entity = new SmsVerificationEntity();
    entity.sms_verification_id = generateId();
    entity.sms_purpose_id = input.sms_purpose_id;
    entity.user_id = input.user_id;
    entity.phone = input.phone;
    entity.code_hash = sha256Hex(input.code);
    entity.code = input.code;
    entity.attempt_count = 0;
    entity.expires_at = dayjs(input.now).add(SMS_CODE_TTL_MINUTES, 'minute').toDate();
    entity.verified_at = null;
    entity.ip = input.ip || null;
    return entity;
}

/** 인증 기록 수정 조건 · 값 — repository update 에 그대로 넘긴다 */
export interface SmsVerificationUpdate {
    where: FindOptionsWhere<SmsVerificationEntity>;
    entity: SmsVerificationEntity;
}

/**
 * 이전 인증번호 닫기 — 새 번호를 보내기 전에 같은 회원 · 같은 용도로 아직 쓰지 않았고 만료 전인 기록의 만료를 지금으로 당긴다.
 * 마지막에 받은 번호만 쓸 수 있다(사용자 결정 2026-11-24). 닫힌 번호로 확인하면 "만료" 400 이다.
 *
 * @param user_id 회원 ID
 * @param sms_purpose_id 용도
 * @param now 기준 시각
 * @returns 수정 조건 · 값(expires_at = now)
 */
export function buildSmsVerificationExpiry(user_id: string, sms_purpose_id: string, now: Date): SmsVerificationUpdate {
    const entity = new SmsVerificationEntity();
    entity.expires_at = now;
    return {where: {user_id, sms_purpose_id, verified_at: IsNull(), expires_at: MoreThan(now)}, entity};
}

/**
 * 인증 완료 표시 — 아직 사용 전인 행만 바꾼다(verified_at IS NULL). 같은 번호로 동시에 확인하면 먼저 커밋한 쪽만 1행을 바꾸고,
 * 뒤의 요청은 0행이라 service 가 "이미 사용" 400 으로 롤백한다 — 한 번호는 한 번만 쓴다.
 *
 * @param sms_verification_id 인증 기록 ID
 * @param now 인증 완료 시각
 * @returns 수정 조건 · 값(verified_at = now)
 */
export function buildSmsVerificationCompletion(sms_verification_id: string, now: Date): SmsVerificationUpdate {
    const entity = new SmsVerificationEntity();
    entity.verified_at = now;
    return {where: {sms_verification_id, verified_at: IsNull()}, entity};
}

/**
 * 인증번호 SMS 본문 — 한글 70자 안(1건 과금).
 *
 * @param code 인증번호
 * @returns 본문
 */
export function smsVerificationText(code: string): string {
    return `[바로방] 인증번호 [${code}] — ${SMS_CODE_TTL_MINUTES}분 안에 입력해주세요.`;
}

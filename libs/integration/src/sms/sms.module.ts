import {Global, Module} from '@nestjs/common';
import {SMS_SENDER} from '../integration.symbols.js';
import {SnsSmsSender} from './sns-sms.sender.js';

/**
 * SMS 발송 포트(SMS_SENDER) — Amazon SNS. AWS 키가 비면 보내지 않고 받는 번호 · 본문을 로그에 남긴다(AWS 미설정 개발 모드).
 * SMS 를 보내는 앱의 루트 모듈에서 import 한다(전역 — 도메인 모듈은 import 없이 `@Inject(SMS_SENDER)` 로 주입받는다).
 */
@Global()
@Module({providers: [{provide: SMS_SENDER, useClass: SnsSmsSender}], exports: [SMS_SENDER]})
export class SmsModule {}

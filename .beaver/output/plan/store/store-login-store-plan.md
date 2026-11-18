# Plan — 매니저 로그인용 업체 조회

> 무엇을·왜는 [spec](../../spec/store/store-login-store-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 진입점마다 비즈니스 로직 전체 ② 계산 함수 ③ 규약만으로 예측할 수 없는 데이터 규칙·쿼리
> **싣지 않는 것** 진입점 껍데기, 입력 검증 객체, 등록·배선, 형제 코드와 같은 조회 — 따르는 패턴을 표 한 줄로 가리킨다

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `apps/admin-service/src/store/store.service.ts` | 수정 | `getLoginStore` — 업체 ID 로 찾고 상태로 가른다 | 아래 1 |
| `libs/contracts/src/store/dto/store-login-store.dto.ts` | 신규 | 경로 입력 · 응답 DTO | 아래 3 |
| `libs/contracts/src/store/store.commands.ts` | 수정 | `STORE_INTERNAL_PATH.loginStore(store_id)` | 생략 |
| `apps/admin-service/src/store/controllers/store.controller.ts` | 수정 | 내부 HTTP `GET /login-store/:store_id` → `getLoginStore` | 생략 |
| `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.ts` | 수정 | 공개 `GET /login-store/:store_id`(가드 없음 · Swagger) · 클래스 주석 | 생략 |
| `apps/admin-service/src/store/test/store-login-store.spec.ts` | 신규 | service 기능 spec(동기 경로) — spec 의 ✓ 5건 | 생략 |
| `.beaver/output/frontend/changes/2026-11-18-store-login-store.md` · `changes/README.md` | 신규 · 수정 | 프론트 수정 요청 — API 추가(메모리 frontend) | 아래 4 |
| `AGENTS.md` · `README.md` | 수정 | 인증 없는 공개 라우트 목록 · 업체 관리 경로 한 줄 | 생략 |

---

## 1. 비즈니스 로직 — 진입점별 코드

### 1-1. 매니저 로그인용 업체 조회 — `StoreService.getLoginStore`

모양 검사를 두지 않는 것이 이 기능의 결정이다 — 모양이 틀린 ID 도 아래 ① 조회가 null 을 돌려줘 ② 의 404 로 끝난다(spec 결정한 것).

```ts
// apps/admin-service/src/store/store.service.ts — getStore(329) 바로 앞에 둔다
    /**
     * 매니저 로그인용 업체 조회 (로그인 없음) — 업체 ID 로 업체 ID · 업체코드 · 업체명. 없는 · 탈퇴 업체(모양이 틀린 ID 포함)는 404, 영업중지는 400 + 정지 사유. (내부 HTTP: GET /internal/v1/admin-service/store/login-store/:store_id)
     *
     * @param store_id 업체 ID (모양을 따지지 않는다)
     * @returns 업체 ID · 업체코드 · 업체명
     */
    async getLoginStore(store_id: string): Promise<StoreLoginStoreResultDto> {
        // ① 지워지지 않은 업체를 업체 ID 로 — 모양 검사 없음(틀린 모양은 결과 없음 → 404)
        const store = await this.storeRepository.findStore({store_id});

        // ② 없거나 탈퇴 업체는 같은 404
        if (!store || store.store_state_id === STORE_STATE.LEAVE) {
            throw new NotFoundException({message: STORE_NOT_FOUND_MESSAGE});
        }

        // ③ 영업중지 — 400 + 정지 사유(없으면 null)
        if (store.store_state_id === STORE_STATE.SUSPEND) {
            throw new BadRequestException({message: '영업이 중지된 업체입니다.', suspend_comment: store.suspend_comment ?? null});
        }

        // ④ 활성 업체
        return {store_id: store.store_id, store_code: store.store_code, store_name: store.store_name};
    }
```

- import 더하기: `import type {StoreLoginStoreResultDto} from '@app/contracts/store/dto/store-login-store.dto.js';` — `BadRequestException` · `NotFoundException` · `STORE_STATE` · `STORE_NOT_FOUND_MESSAGE` 는 이미 있다(`store.service.ts:1` · `store.constants.ts:4` · `:28`).
- 메시지 `'영업이 중지된 업체입니다.'` 는 이 한 곳에서만 쓰여 인라인 리터럴(AGENTS.md 메시지 상수 규칙).
- 결과는 객체 리터럴 — 형제 `return {store_id, store_code};`(`store.service.ts:280`).

---

## 3. 데이터 규칙 — 규약만으로 예측할 수 없는 부분

### 3-1. 경로 입력은 비었는지만 본다 — `libs/contracts/src/store/dto/store-login-store.dto.ts`

형제 업체 상세 DTO 는 `@Matches(/^[a-f0-9]{32}$/)` 로 모양을 검사한다(`store-detail.dto.ts:10`). 그대로 따르면 모양이 틀린 ID 가 ValidationPipe 에서 400 이 되어 spec 결정(404)과 어긋나므로 `@IsNotEmpty` 하나만 둔다(입력 필드마다 검증 데코레이터 1개 이상 규칙은 지킨다). 조회 조건은 TypeORM 파라미터라 어떤 문자열도 SQL 에 섞이지 않는다.

```ts
import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty} from 'class-validator';

/**
 * 매니저 로그인용 업체 조회 path param — 모양은 검사하지 않는다(틀린 모양은 없는 업체와 같은 404)
 */
export class StoreLoginStoreParamDto {
    @ApiProperty({description: '업체 ID (32자 영문 소문자 · 숫자 — 모양이 달라도 400 이 아니라 404)'})
    @IsNotEmpty({message: '업체 ID를 입력해주세요.'})
    store_id: string;
}

/**
 * 매니저 로그인용 업체 조회 결과 — 활성 업체만
 */
export class StoreLoginStoreResultDto {
    @ApiProperty({description: '업체 ID'})
    store_id: string;

    @ApiProperty({description: '업체코드 (매니저 로그인 · 아이디 찾기 · 비밀번호 초기화의 store_code)'})
    store_code: string;

    @ApiProperty({description: '상호명'})
    store_name: string;
}
```

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| 내부 경로 상수 `loginStore: (store_id) => \`${STORE_INTERNAL_BASE}/login-store/${encodeURIComponent(store_id)}\`` | 업체 상세 경로 함수 | `libs/contracts/src/store/store.commands.ts:60` |
| admin-service 내부 controller `@Get('/login-store/:store_id')` · `@HttpCode(200)` · `@Param() param: StoreLoginStoreParamDto` → `getLoginStore(param.store_id)`, `/:store_id` 보다 앞에 선언 | 업체 상세 핸들러 | `apps/admin-service/src/store/controllers/store.controller.ts:83` |
| 게이트웨이 공개 핸들러 — 가드 · `@ApiBearerAuth` 없음, `@Get('/login-store/:store_id')` → `@HttpCode(200)` → `@ApiOperation({summary: '매니저 로그인용 업체 조회'})` → `@ApiOkResponse({type: StoreLoginStoreResultDto})` → `@ApiBadRequestResponse` · `@ApiNotFoundResponse` · `@ApiServiceUnavailableResponse` · `@ApiInternalServerErrorResponse`(`type: ApiFailResultDto`), `internalHttp.request('admin', 'GET', STORE_INTERNAL_PATH.loginStore(param.store_id))`(actor 없음), `/:store_id` 보다 앞에 선언 · 클래스 주석에 "로그인용 업체 조회는 가드 없음" | 가드 없는 공개 조회 · 같은 컨트롤러의 업체 상세 | `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts:40` · `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.ts:154` |
| 실패 본문의 추가 필드(`suspend_comment`) Swagger 는 `ApiFailResultDto` 그대로 | 매니저 로그인 정지 403 + `block_comment` | `apps/admin-service/src/manager/manager.service.ts:120` |
| 업체 조회 `findStore({store_id})`(지워지지 않은 업체 — `notDeleted`) | 그대로 재사용 · repository 변경 없음 | `apps/admin-service/src/store/repositories/store.repository.ts:334` |
| service spec — `bootHttpPath(repo, storage)` 동기 경로 부팅, `storeRow()` 를 상태만 바꿔 씀, 내부 헤더 `internalHeaders()` | 업체 상세 spec | `apps/admin-service/src/store/test/store-detail.spec.ts:1` |
| 프론트 수정 요청 문서 · 목록 한 줄 | 토큰 재발급 문서 형식 | `.beaver/output/frontend/changes/2026-11-16-token-refresh-ip.md` · `changes/README.md:11` |
| AGENTS.md "인증 없는 공개 라우트(적용 — …)" 목록에 이 경로 · README 업체 관리 경로 줄 | 업체 둘러보기 항목 | `AGENTS.md:188` · `README.md:5` |

### 4-1. 프론트 수정 요청 문서에 싣는 것

- 반영 순서: 백엔드 배포 먼저(API 추가만 — 기존 화면은 그대로 동작)
- 영향 화면: M1(업체 관리자 로그인 · 아이디 찾기 · 비밀번호 초기화) — 이 API 를 쓸지 · 어디서 부를지는 프론트가 정한다
- API 변경: 추가 `GET /api/v1/admin-service/store/login-store/:store_id`(동기 · 로그인 없음) — 200 `{store_id, store_code, store_name}` / 404 없음 · 탈퇴 · 모양이 틀린 ID / 400 영업중지 + `suspend_comment`
- 화면 쪽 주의: 받은 `store_code` 를 로그인 · 아이디 찾기 · 비밀번호 초기화의 `store_code` 로 넘긴다. 영업중지 업체도 매니저 로그인 API 자체는 막히지 않는다(업체 관리자는 내 업체에서 정지 사유를 본다) — 400 을 받았을 때 로그인 화면을 막을지는 프론트가 정한다.
- 바뀐 DTO: `store-login-store.dto.ts` 사본(Swagger 데코레이터 · import 를 뺀 것)

## 테스트

spec의 "결과" 표에서 ✓ 표시된 5건을 그대로 테스트로 옮긴다(`apps/admin-service/src/store/test/store-login-store.spec.ts` — `[SUCCESS]` 1 · `[FAIL:*]` 4). 계산 규칙은 없다. 추가분:

| 종류 | 대상 | 이유 |
|---|---|---|
| 단언 보강 | 모양이 틀린 ID(예: `'5a3e-not-hex'`) | 404 와 함께 `repo.findStore` 가 그 문자열 그대로 1번 불렸는지 — 파이프가 막지 않고 조회까지 간다는 결정을 고정 |
| 단언 보강 | 영업중지 · 탈퇴 · 없음 | 응답 본문 전체(`toEqual`) — 영업중지는 `suspend_comment` 포함, 404 는 `validation_errors: null` |

쿼리 스모크 없음 — 새 데이터 접근 메서드가 없다(`findStore` 재사용).

## 만드는 순서

1. DTO · 내부 경로 상수 → 2. `getLoginStore` → 3. admin-service 내부 controller → 4. 게이트웨이 핸들러 → 5. spec → 6. 프론트 수정 요청 문서 · AGENTS.md · README.md

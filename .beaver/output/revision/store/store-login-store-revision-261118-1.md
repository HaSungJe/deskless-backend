# Revision — 매니저 로그인용 업체 조회 — 261118-1

> Change plan for an existing feature. The original spec.md / plan.md are not modified, only referenced.
> 원래 spec · plan: `.beaver/output/spec/store/store-login-store-spec.md` · `.beaver/output/plan/store/store-login-store-plan.md` (아직 커밋 전 — 같은 ship 으로 나간다)

## Reason for Change Request
업체 ID 가 아니라 **업체코드로 찾아야 했다**(사용자 정정 2026-11-18 — "방금 만든 api는 업체 ID가 아니라, 업체 코드로 검색해야 하는 거였음"). 프론트 매니저 로그인 화면은 주소에 업체코드(`/manager/[store_code]/login`)를 갖고 있고, 이 API 로 그 업체가 있는지 · 이름이 무엇인지 확인한다.

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| 주소 | `GET /api/v1/admin-service/store/login-store/:store_id` | `GET /api/v1/admin-service/store/login-store/:store_code` (내부 `/internal/v1/admin-service/store/login-store/:store_code`) |
| 찾는 키 | 업체 ID(`store_id`) | 업체코드(`store_code` — 유일 제약 `UK_Store_StoreCode`, `libs/database/src/entities/store/store.entity.ts:12`) |
| 경로 입력 | `store_id` — 비었는지만 | `store_code` — 비었는지만(모양이 틀려도 400 이 아니라 404 — 그대로) |
| 응답 · 실패 | 200 `{store_id, store_code, store_name}` / 404 없음 · 탈퇴 · 모양 틀림 / 400 영업중지 + `suspend_comment` | 그대로 |
| 업체코드 공개 여부 | 업체 ID(공개)로 업체코드를 얻을 수 있어 사실상 공개 값 | **공개되지 않는다** — 업체코드를 이미 아는 사람만 업체 이름 · ID 를 받는다(지금까지처럼 그 업체 사람만 앎). AGENTS.md 의 "업체코드가 사실상 공개" 문장을 지운다 |

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `libs/contracts/src/store/dto/store-login-store.dto.ts` | modify | param `store_id` → `store_code` |
| `libs/contracts/src/store/store.commands.ts` | modify | `loginStore(store_code)` |
| `apps/admin-service/src/store/store.service.ts` | modify | `getLoginStore(store_code)` — `findStore({store_code})` |
| `apps/admin-service/src/store/controllers/store.controller.ts` | modify | `@Get('/login-store/:store_code')` |
| `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.ts` | modify | `@Get('/login-store/:store_code')` · 주석 |
| `apps/admin-service/src/store/test/store-login-store.spec.ts` | modify | 경로 · 조회 조건을 업체코드로 |
| `.beaver/output/frontend/changes/2026-11-18-store-login-store.md` · `changes/README.md` | modify | 업체코드로 찾는 API 로 다시 씀(아직 커밋 전 — 같은 문서를 고친다) |
| `AGENTS.md` · `README.md` | modify | 공개 라우트 경로 `:store_code` · "업체코드 사실상 공개" 문장 삭제 |
| `.beaver/output/report/store/store-login-store-report.md` | modify | `## Modification - 261118-1` |

## Code Changes

```ts
// libs/contracts/src/store/dto/store-login-store.dto.ts — before
export class StoreLoginStoreParamDto {
    @ApiProperty({description: '업체 ID (32자 영문 소문자 · 숫자 — 모양이 달라도 400 이 아니라 404)'})
    @IsNotEmpty({message: '업체 ID를 입력해주세요.'})
    store_id: string;
}
```

```ts
// libs/contracts/src/store/dto/store-login-store.dto.ts — after (결과 DTO 는 그대로)
/**
 * 매니저 로그인용 업체 조회 path param — 모양은 검사하지 않는다(틀린 모양은 없는 업체와 같은 404)
 */
export class StoreLoginStoreParamDto {
    @ApiProperty({description: '업체코드 (32자 영문 소문자 · 숫자 — 모양이 달라도 400 이 아니라 404)'})
    @IsNotEmpty({message: '업체코드를 입력해주세요.'})
    store_code: string;
}
```

```ts
// libs/contracts/src/store/store.commands.ts — before
    /** 매니저 로그인용 업체 조회 (GET, 로그인 없음) — 업체 ID → 업체 ID · 업체코드 · 업체명 */
    loginStore: (store_id: string) => `${STORE_INTERNAL_BASE}/login-store/${encodeURIComponent(store_id)}`,
```

```ts
// libs/contracts/src/store/store.commands.ts — after
    /** 매니저 로그인용 업체 조회 (GET, 로그인 없음) — 업체코드 → 업체 ID · 업체코드 · 업체명 */
    loginStore: (store_code: string) => `${STORE_INTERNAL_BASE}/login-store/${encodeURIComponent(store_code)}`,
```

```ts
// apps/admin-service/src/store/store.service.ts — before
     * 매니저 로그인용 업체 조회 (로그인 없음) — 업체 ID 로 업체 ID · 업체코드 · 업체명. 없는 · 탈퇴 업체(모양이 틀린 ID 포함)는 404, 영업중지는 400 + 정지 사유. (내부 HTTP: GET /internal/v1/admin-service/store/login-store/:store_id)
     *
     * @param store_id 업체 ID (모양을 따지지 않는다)
     * @returns 업체 ID · 업체코드 · 업체명
     */
    async getLoginStore(store_id: string): Promise<StoreLoginStoreResultDto> {
        // ① 지워지지 않은 업체를 업체 ID 로 — 모양 검사 없음(틀린 모양은 결과 없음 → 404)
        const store = await this.storeRepository.findStore({store_id});
```

```ts
// apps/admin-service/src/store/store.service.ts — after (② ③ ④ 그대로)
     * 매니저 로그인용 업체 조회 (로그인 없음) — 업체코드로 업체 ID · 업체코드 · 업체명. 없는 · 탈퇴 업체(모양이 틀린 코드 포함)는 404, 영업중지는 400 + 정지 사유. (내부 HTTP: GET /internal/v1/admin-service/store/login-store/:store_code)
     *
     * @param store_code 업체코드 (모양을 따지지 않는다)
     * @returns 업체 ID · 업체코드 · 업체명
     */
    async getLoginStore(store_code: string): Promise<StoreLoginStoreResultDto> {
        // ① 지워지지 않은 업체를 업체코드로(유일 — UK_Store_StoreCode) — 모양 검사 없음(틀린 모양은 결과 없음 → 404)
        const store = await this.storeRepository.findStore({store_code});
```

```ts
// apps/admin-service/src/store/controllers/store.controller.ts — after
    @Get('/login-store/:store_code')
    @HttpCode(200)
    async getLoginStore(@Param() param: StoreLoginStoreParamDto): Promise<StoreLoginStoreResultDto> {
        return this.storeService.getLoginStore(param.store_code);
    }
```

```ts
// apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.ts — after
    /**
     * 매니저 로그인용 업체 조회 (로그인 없음) — 업체코드 → 업체 ID · 업체코드 · 업체명. 없는 · 탈퇴 업체(모양이 틀린 코드 포함) 404, 영업중지 400 + 정지 사유(suspend_comment)
     */
    @Get('/login-store/:store_code')
    // … 데코레이터 그대로
    async getLoginStore(@Param() param: StoreLoginStoreParamDto): Promise<StoreLoginStoreResultDto> {
        return this.internalHttp.request<StoreLoginStoreResultDto>('admin', 'GET', STORE_INTERNAL_PATH.loginStore(param.store_code));
    }
```
클래스 주석의 `/login-store/:store_id` → `/login-store/:store_code`.

## Test Cases
spec 의 ✓ 5건 그대로, 키만 업체코드로:
- `[SUCCESS]` 활성 → 3필드 · `findStore({store_code: STORE_CODE})` 1번
- `[FAIL:service]` 모양이 틀린 코드 → 404 + `findStore({store_code: '5a3e-not-hex'})` 1번 / 없음 404 / 탈퇴 404 / 영업중지 400 + `suspend_comment`
- 새 데이터 접근 메서드 없음(`findStore` 재사용 — `notDeleted` 로 감싸는 `findOne` where, 관계 필드 아님) → 쿼리 스모크 없음.

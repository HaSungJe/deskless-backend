# Report — 매니저 로그인용 업체 조회

## Feature Summary
- **Feature**: 매니저 로그인용 업체 조회 — 업체 ID로 업체코드 받기
- **Entry point**: `GET /api/v1/admin-service/store/login-store/:store_id` (로그인 없음 · 동기 → `/internal/v1/admin-service/store/login-store/:store_id`)
- **Domain**: store (admin-service)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `libs/contracts/src/store/dto/store-login-store.dto.ts` | created | `StoreLoginStoreParamDto`(`@IsNotEmpty` 만 — 모양 검사 없음) · `StoreLoginStoreResultDto`(store_id · store_code · store_name) |
| `libs/contracts/src/store/store.commands.ts` | modified | `STORE_INTERNAL_PATH.loginStore(store_id)` |
| `apps/admin-service/src/store/store.service.ts` | modified | `getLoginStore` — `findStore` 재사용, 없음 · 탈퇴 404 · 영업중지 400 + `suspend_comment` · 활성 3필드 |
| `apps/admin-service/src/store/controllers/store.controller.ts` | modified | 내부 HTTP `GET /login-store/:store_id`(`/:store_id` 앞) · 클래스 주석 |
| `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.ts` | modified | 공개 핸들러(가드 없음 · Swagger) · 클래스 주석 |
| `apps/admin-service/src/store/test/store-login-store.spec.ts` | created | service 기능 spec(동기 경로) 5건 |
| `.beaver/output/frontend/changes/2026-11-18-store-login-store.md` · `changes/README.md` | created · modified | 프론트 수정 요청 — 새 API · 응답 표 · 화면 쪽 주의 · DTO 사본 |
| `AGENTS.md` · `README.md` | modified | 인증 없는 공개 라우트 목록(+ 업체코드 공개 결정) · 업체 관리 경로 줄 |

## Tests Written
- `store-login-store.spec.ts` — `[SUCCESS]` 활성 업체 → 3필드만(`toEqual`) · `findStore({store_id})` 1번 · 파일 조회 없음 / `[FAIL:service]` 모양이 틀린 ID → 404 + 그 문자열 그대로 조회 1번(파이프가 막지 않음) · 없음 404 · 탈퇴 404(업체코드 없음) · 영업중지 400 + `suspend_comment`(업체코드 없음).
- 쿼리 스모크 없음 — 새 데이터 접근 메서드 없음(`findStore` 재사용).

## Verification
- `npm run typecheck` 0건 · `npm run lint` 통과 · prettier(바꾼 파일) 통과 · `npm run build`(네 앱) 통과.
- `npm test` — 124 파일 · 1,360건 통과(새 spec 5건 포함 — AGENTS.md 가 Claude 실행을 허용).
- 계획과 대조: plan 1-1 코드 그대로(① 조회 ② 없음 · 탈퇴 404 ③ 영업중지 400 ④ 3필드), DTO 는 plan 3-1 그대로, 나머지는 형제(업체 상세 · 둘러보기 업체 상세)와 같은 모양. 게이트웨이 Swagger 에서 "업체" 태그 아래 자물쇠 없이 보이는 것을 확인용 화면(swagger-tag-select 점검)으로 봤다.

## Remaining Issues
- 업체 ID 는 둘러보기 API 로 공개라 이 API 로 업체코드도 사실상 공개 값이 된다 — 사용자 결정(2026-11-18), 매니저 로그인 보호는 비밀번호.
- 영업중지 업체의 매니저 로그인 자체는 막지 않는다(지금 그대로) — 이 API 의 400 을 받았을 때 로그인 칸을 막을지는 프론트가 정한다(수정 요청 문서에 적음).
- 배포는 사용자 몫 — admin-service · gateway 새 이미지(`npm run docker:admin-service` · `npm run docker:gateway`), 마이그레이션 없음.

## Modification - 261118-1

### Change summary
업체 ID 가 아니라 **업체코드로 찾는다**(사용자 정정 2026-11-18 — revision `.beaver/output/revision/store/store-login-store-revision-261118-1.md`). 주소 `GET /api/v1/admin-service/store/login-store/:store_code`, `findStore({store_code})`(유일 — `UK_Store_StoreCode`). 응답 · 404(없음 · 탈퇴 · 모양 틀림) · 400(영업중지 + `suspend_comment`)은 그대로. 업체코드는 다시 공개 값이 아니다 — 아는 사람만 그 업체 이름 · ID 를 받는다.

### Changed files
| File | Change Type | Description |
|------|-----------|------|
| `libs/contracts/src/store/dto/store-login-store.dto.ts` | modified | param `store_id` → `store_code` |
| `libs/contracts/src/store/store.commands.ts` | modified | `loginStore(store_code)` |
| `apps/admin-service/src/store/store.service.ts` | modified | `getLoginStore(store_code)` — `findStore({store_code})` |
| `apps/admin-service/src/store/controllers/store.controller.ts` · `apps/gateway/src/api/v1/admin-service/store/controllers/store.controller.ts` | modified | `/login-store/:store_code` · 주석 |
| `apps/admin-service/src/store/test/store-login-store.spec.ts` | modified | 경로 · 조회 조건을 업체코드로, 탈퇴 · 영업중지는 "업체 정보를 내주지 않는다"(`store_id` 없음) |
| `.beaver/output/frontend/changes/2026-11-18-store-login-store.md` · `changes/README.md` | modified | 업체코드로 찾는 API · 화면에서 주소의 업체코드로 부르는 방법으로 다시 씀 |
| `AGENTS.md` · `README.md` | modified | 공개 라우트 경로 `:store_code` · "업체코드 사실상 공개" 문장 삭제 |

### Tests written
- 같은 5건, 키만 업체코드: `[SUCCESS]` `findStore({store_code: STORE_CODE})` 1번 · 3필드 / `[FAIL:service]` 모양 틀린 코드 그대로 조회 404 · 없음 404 · 탈퇴 404 · 영업중지 400 + `suspend_comment`.

### Verification
- `npm run typecheck` 0건 · `npm run lint` · prettier · `npm run build`(네 앱) 통과, `npm test` 124 파일 · 1,360건 통과.
- 업체 ID 로 찾던 흔적 없음(`login-store/:store_id` · `loginStore(param.store_id)` grep 0건).

### Remaining issues
- 영업중지 업체의 매니저 로그인 자체는 막지 않는다(그대로) — 400 을 받았을 때 로그인 칸을 막을지는 프론트가 정한다.
- 배포는 사용자 몫 — admin-service · gateway 새 이미지, 마이그레이션 없음.

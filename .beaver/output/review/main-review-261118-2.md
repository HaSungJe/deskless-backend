# Review — main — 261118-2

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`
- Included features: ① 매니저 로그인용 업체 조회(store-login-store + revision 261118-1 — 업체코드로 조회) ② Swagger 도메인 선택(swagger-tag-select)
- Change scope: 소스 7(수정 5 · 새 파일 3 — DTO · swagger.config.ts · spec) · 문서(AGENTS.md · README · docs/api.md · docs/architecture.md) · 프론트 수정 요청 문서 · beaver 산출물(spec · plan · revision · report · spec-board)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | DTO `store-login-store.dto.ts` · `StoreLoginStoreParamDto` / `ResultDto`, service `getLoginStore`, 경로 kebab `/login-store/:store_code`(snake param), 인프라 `swagger.config.ts` · `buildSwaggerCustomOptions` |
| Structure & layering | pass | 서버 admin-service(로그인 전 업체 관리자) · 도메인 store(대상 업체). 게이트웨이 동기 controller 는 `InternalHttpClient` 위임 한 줄 · 가드 없음 · Swagger 데코레이터 순서 지킴. 내부 경로는 contracts 경로 함수(`encodeURIComponent`). 정적 경로를 `/:store_id` 앞에 선언(게이트웨이 · 서비스). Swagger 설정은 `config/` 부트스트랩 함수 |
| Shared logic extraction | pass | 새 repository 메서드 없음 — `findStore` 재사용(`notDeleted`). service private 헬퍼 없음 |
| Errors & responses | pass | 404 `STORE_NOT_FOUND_MESSAGE`(상수 재사용) · 400 인라인 리터럴(한 곳) + 추가 필드 `suspend_comment`(정지 계정 `block_comment` 와 같은 방식), 응답 3필드 모두 값 있음 |
| Test strength | pass | 5건 — 호출 횟수 · 인자(`{store_code}`, 모양 틀린 값 그대로) · 본문 `toEqual` · 실패 때 업체 정보 없음 · 파일 조회 미호출. 한국어 리터럴 · 분류 태그. Swagger 는 게이트웨이 설정이라 spec 없음(AGENTS.md · 사용자 확인) — 브라우저 확인 |

## Intended Behavior Check (against plan/spec)
- 업체 조회: revision 261118-1 대로 업체코드로 찾는다 — 200 3필드 / 404 없음 · 탈퇴 · 모양 틀림(DTO `@IsNotEmpty` 만 — 파이프 400 없음) / 400 영업중지 + 사유. 업체 ID 로 찾던 흔적 0건. AGENTS.md 의 "업체코드 사실상 공개" 문장은 지웠다(업체코드는 다시 그 업체 사람만 앎).
- Swagger: Authorize 반대편(왼쪽 끝) 선택 상자 · 기본 전체 · 정확히 같은 태그만 · 기본 글자 필터 칸 숨김 · 새로 열면 전체 — 빌드 결과로 임시 화면을 띄워 브라우저에서 확인(업체 → 업체만, 전체 → 모두, Authorize 창 정상, 콘솔 오류 없음). 처음 화면에서 상자가 Authorize 옆에 붙어 `margin-right:auto` 를 더했고 plan 코드도 맞췄다.
- 프론트 수정 요청 문서(메모리 frontend): `changes/2026-11-18-store-login-store.md` + 목록 한 줄 — 업체코드 기준 API · 응답 표 · 화면 쪽 주의(영업중지여도 매니저 로그인 자체는 막히지 않음) · DTO 사본. Swagger 는 프론트 공개 API 변경이 아니라 대상 아님.
- README.md · AGENTS.md · docs 같은 변경에서 갱신. 검사: typecheck 0 · lint · prettier · build(네 앱) · `npm test` 124 파일 1,360건 통과.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `apps/gateway/src/config/swagger.config.ts` | swagger-ui 내부 이름(`AuthorizeBtnContainer` · `operationsWithTags` · `layoutActions.updateFilter` · `fn.opsFilter`)에 기댄다 — swagger-ui-dist 를 올리면 바뀔 수 있다(지금 5.33.0 으로 확인). 깨져도 선택 상자만 안 나오고 Swagger 자체는 뜬다 | 코드 변경 없음 — `@nestjs/swagger` · swagger-ui 를 올릴 때 Swagger 화면에서 선택 상자를 한 번 본다 |

## Verdict
Pass — Low 1건은 버전을 올릴 때의 확인 안내. 커밋 진행.

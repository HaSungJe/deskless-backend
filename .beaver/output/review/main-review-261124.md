# Review — main — 261124

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — direct 모드(main 에 바로 커밋 · 푸쉬).

## Target
- stick: `main`(direct 모드) → origin: `main`
- Included features: 문의사항(inquiry — 카테고리 · 답변 · 블라인드) + 업체 이름 검색(discovery `store-search` — 주소 · 위경도 · 대표 사진) + 테스트 데이터 문의 71건
- Change scope: 83 files, +6504 / −29 — 엔티티 3 · 마이그레이션 1, contracts(상수 · 명령 · DTO 11), user-service(discovery 수정 · inquiry 신규), admin-service(inquiry 신규), gateway(라우트 2 모듈 · 둘러보기 핸들러), spec 15파일, 문서(README · AGENTS · architecture · sample-data 가이드 · 프론트 요청서 · spec/plan/report)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | `<domain>.<role>.ts` · DTO kebab · 엔티티 `t_inquiry*` · 제약 PascalCase(`PK_Inquiry` · `FK_Inquiry_AnswerUser` · `CHK_Inquiry_Answer` · `IDX_Inquiry_StoreIdCreatedAt`) · 명령 `user.inquiry.create` · `admin.inquiry.mine-*` · 같은 이름 도메인은 상수 이름(`INQUIRY_USER_*` · `INQUIRY_*`) · 게이트웨이 별칭 `UserInquiryModule` |
| Structure & layering | pass | 행위자로 서버를 갈랐다(이용자 user-service · 업체 관리자 · 관리자 admin-service). controller → service → repository, controller 는 위임 한 줄, 동기 · 큐 2파일. `/mine` · `/category` 를 `/:inquiry_id` 보다 먼저 선언 |
| Shared logic extraction | pass | service private 헬퍼 0건 — 범위 · 필터 · 쓰기 엔티티 · 해제 조건은 `inquiry.util.ts`. 범위 규칙(소속 업체 / `store_id IS NULL`)은 admin util 한 곳 |
| Errors & responses | pass | 상태 조건 쓰기 `updateInquiry` → boolean, false 면 400 롤백(답변 · 블라인드 · 해제). repository 통일 500. 응답 필드 생략 없음(null). 여러 메서드가 쓰는 문구는 `inquiry.constants.ts` `*_MESSAGE`, 한 번 쓰는 user-service 문구는 인라인 |
| Test strength | pass | service 기능 spec API 1개당 1개(관리 경로 짝은 한 파일), 호출 인자 · 엔티티 `toBeInstanceOf` · 미호출 단언. 매핑 민감 메서드 전부 Data-Access Smoke(`buildMyInquiryQuery` · `findInquiryStore` find 조건 · `buildInquiryQuery` · `buildManagerStoreQuery` · find/update 조건 IsNull · In · Not(IsNull) · `buildStoreSearchQuery`) |

## Intended Behavior Check (against plan/spec)
- spec 진입점 10개 · ✓ 24건 모두 구현 · 테스트 작성. build 중 바뀐 것(사용자 요청): 업체 이름 검색 결과에 위경도 · 대표 사진, 블라인드 · 해제를 상세에서 한 건씩, 테스트 데이터 문의 71건 — spec · plan · report · 프론트 요청서에 반영됨.
- 매니저 소속 업체 없음 문구를 형제 도메인과 같은 "소속 업체를 찾을 수 없습니다." 로 맞추고 spec 도 고침.
- 동의 항목은 서버가 받지 않는다(DTO 에 필드 없음 — `forbidNonWhitelisted` 로 보내면 400). 프론트 요청서에 체크 · 블라인드 안내 문구 · 카테고리 목록 API 사용 · "전체" 는 값을 빼고 부른다는 것을 실었다.
- `npm run typecheck` · `npm run lint` · `npm run db:check` 통과, 바뀐 TS 파일 Prettier 통과. 테스트 실행은 `/beaver:test`.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `apps/*/src/inquiry/test/inquiry.repository.spec.ts` · `apps/user-service/src/discovery/test/discovery.repository.spec.ts` | Smoke 가 SQL 전체 문자열이 아니라 조건 · 조인 · 별칭 조각으로 고정한다(build 에서 실행하지 않아 전체 SQL 을 확정하지 못했다). 매핑(관계 속성 IsNull · 범위 · 괄호 OR · 별칭)은 조각으로 잡힌다 | `/beaver:test` 에서 조각 단언이 실제 SQL 과 다르면 맞춘다. 필요하면 그때 전체 문자열로 굳힌다 |
| 2 | Low | `libs/database/src/seeder/sample-seed.targets.ts` (`buildSampleInquiries`) | 샘플 문의 행만 엔티티 인스턴스가 아닌 객체 리터럴 — insert 훅이 등록일을 지금으로 덮지 않게 해 날짜를 흩는다. 시드 행 객체 리터럴 예외 범위 안이고 이유를 주석에 적었다 | 그대로 |

## Verdict
Pass — 차단할 문제 없음(Low 2건은 기록만).

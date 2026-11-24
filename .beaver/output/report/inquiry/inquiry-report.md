# Report — 문의사항

## Feature Summary
- **Feature**: 문의사항 — 이용자 문의(카테고리) · 답변 · 블라인드
- **Entry point**: `POST /api/v1/user-service/inquiry` (외 9개 — 업체 이름 검색 · 카테고리 목록 · 내 문의 목록 · 상세 · 관리 목록 · 상세 · 답변 · 블라인드 · 해제)
- **Domain**: inquiry (user-service · admin-service 같은 이름 도메인) + discovery(업체 이름 검색)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `libs/database/src/entities/inquiry/inquiry.entity.ts` · `inquiry-category.entity.ts` · `inquiry-state.entity.ts` | created | 문의 `t_inquiry`(카테고리 FK · 답변 · 블라인드 칸, CHECK 2개) · 카테고리 룩업(sort_order) · 상태 룩업 |
| `libs/database/src/entities.ts` · `seeder/seeder.targets.ts` | modified | 엔티티 3개 등록 · 상태 3개 · 카테고리 7개 시드 |
| `libs/database/src/migrations/1795503980335-Inquiry.ts` · `migrations.ts` | created · modified | `db:generate -- Inquiry` 결과(설명 주석만 손으로) |
| `libs/contracts/src/inquiry/inquiry.constants.ts` · `inquiry.commands.ts` · `dto/*.ts`(10개) | created | 상태 · 카테고리 허용값, 명령 type · 내부 경로(이용자 `INQUIRY_USER_*` · 관리 `INQUIRY_*`), DTO |
| `libs/contracts/src/discovery/dto/discovery-store-search.dto.ts` · `discovery.commands.ts` | created · modified | 업체 이름 검색 query · 결과(주소 · 위경도 · 대표 사진) · `STORE_SEARCH` 경로 |
| `apps/user-service/src/discovery/**` | modified | `searchStores` · `findStoreSearchRows` · `buildStoreSearchQuery`(대표 사진 서브쿼리) · `toStoreSearchItem` · 상수 · `GET /store-search` |
| `apps/user-service/src/inquiry/**` | created | 이용자 문의 도메인 — 카테고리 목록 · 등록(큐) · 내 문의 목록 · 상세 |
| `apps/user-service/src/user-service.module.ts` | modified | `InquiryModule` 등록 |
| `apps/admin-service/src/inquiry/**` | created | 문의 관리 도메인 — 목록 · 상세(동기) · 답변 · 블라인드 · 해제(큐, 업체 관리자 `MINE_*` · 관리자) |
| `apps/admin-service/src/admin-service.module.ts` | modified | `InquiryModule` 등록 |
| `apps/gateway/src/api/v1/user-service/inquiry/**` · `api/v1/admin-service/inquiry/**` | created | 공개 라우트 — 이용자(카테고리 목록 가드 없음) · 관리(`/mine` 매니저 가드 · 그 밖 관리자 가드) |
| `apps/gateway/src/api/v1/user-service/discovery/controllers/discovery.controller.ts` · `gateway.module.ts` | modified | `GET /store-search` · `UserInquiryModule` · `InquiryModule` 등록 |
| `README.md` · `AGENTS.md` · `docs/architecture.md` | modified | 도메인 목록 · 트리 · Query DTO · Pagination · 공개 라우트 · Smoke 목록 · 라우트 표 · 모듈 |
| `.beaver/output/frontend/changes/2026-11-24-inquiry.md` · `changes/README.md` | created · modified | 프론트 수정 요청(API 10개 · 동의 체크 · 카테고리 · 거르기 · 블라인드 안내 · DTO 사본) + 목록 한 줄 |
| `libs/database/src/seeder/sample-seed.data.ts` · `sample-seed.targets.ts` | modified | 테스트 데이터(SEED_SAMPLE_DATA=1)에 샘플 문의 71건 — 본보기 13개 · 광고 2개를 대상별 개수(업체 01 · 바로방 22건 · 업체 02 ~ 10 3건씩)로 돌려 쓴다. 바로방 처리 계정은 총관리자 `admin` 을 찾아 쓰고, 등록일을 과거로 흩으려고 객체 리터럴로 넣는다(insert 훅 회피). `SAMPLE_ID_KIND.INQUIRY` 17 (build 뒤 사용자 요청) |
| `docs/guides/sample-data.md` | modified | 테스트 데이터 "문의" 절 — 대상별 건수 · 상태, 카테고리 · 상태는 기본 시드 |
| `.beaver/output/spec/inquiry/inquiry-spec.md` · `plan/inquiry/inquiry-plan.md` | modified | build 중 사용자 요청 반영(업체 이름 검색에 위경도 · 대표 사진) · 소속 업체 없음 문구를 형제와 맞춤 |

## Tests Written
spec ✓ 24건 + plan 추가분. 실행은 `/beaver:test`(build 는 돌리지 않았다).
- user-service
  - `discovery/test/discovery-store-search.spec.ts` — 정상(검색어 · 20건 · 위경도 숫자 · 사진 있으면 공개 주소 · 없으면 null) · 검증 실패(빈 값 · 51자)
  - `inquiry/test/inquiry-category-list.spec.ts` — 정상(받은 순서 · ID · 이름만)
  - `inquiry/test/inquiry-create.spec.ts` — 업체 문의 · 바로방 문의 · 없는 업체 404 · 검증(카테고리 없음 · 허용값 밖 · 제목 · 업체 ID · 선언 안 된 필드 거절)
  - `inquiry/test/inquiry-my-list.spec.ts` — 카테고리 · 상태 필터가 개수 · 목록에 같이 · 전체는 null · 허용값 밖 400
  - `inquiry/test/inquiry-my-detail.spec.ts` — 남의 문의 404 · 작성자 필터
  - `inquiry/test/inquiry.repository.spec.ts` — 통일 500 · 문의할 업체 find 조건(상태 IN · 지워지지 않음) · 내 문의 쿼리 Smoke(전체 · 카테고리 + 상태 · 상세 — 별칭)
  - `discovery/test/discovery.repository.spec.ts` — 업체 이름 검색 Smoke(ILIKE 이스케이프 · 상태 IN · 대표 사진 서브쿼리 2개 · 별칭) · 500 표에 한 줄
- admin-service
  - `inquiry/test/inquiry-list.spec.ts` — 업체 관리자 범위 + 필터 · 관리자 바로방 범위 · 소속 업체 없음 404
  - `inquiry/test/inquiry-detail.spec.ts` — 범위 밖 404(두 경로의 필터)
  - `inquiry/test/inquiry-answer.spec.ts` — 정상 · 블라인드 400 · 저장 0행 400 · 다른 업체 404 · 검증
  - `inquiry/test/inquiry-blind.spec.ts` — 정상(두 경로 · 답변 칸 미포함) · 이미 블라인드 400
  - `inquiry/test/inquiry-unblind.spec.ts` — 답변 있음 → 답변완료 · 없음 → 접수 · 블라인드 아님 400
  - `inquiry/test/inquiry.repository.spec.ts` — 상태 조건 쓰기 boolean · 통일 500 · Smoke(매니저 소속 업체 · 관리 쿼리 업체 / 바로방 IS NULL / 상세 · find IsNull · update In · Not(IsNull))

## Verification
- `npm run typecheck` 통과 · `npm run lint` 통과 · 바뀐 TS 파일 Prettier 통과 · `npm run db:check` "엔티티와 마이그레이션이 일치합니다."
- 읽어서 확인한 것: 범위 규칙은 admin `inquiry.util.ts` 한 곳(`toInquiryScopeWhere` · `toInquiry*Filter`), 관리자 범위는 목록 · 상세 · 쓰기 모두 `store_id IS NULL` 이 걸린다. 쓰기 3종은 상태 조건 + `affected === 1` boolean → false 면 400(롤백). 해제는 찾은 행의 답변 여부를 조건에도 걸어 CHECK 위반 경합을 막는다. `/mine` · `/category` 는 `/:inquiry_id` 보다 먼저 선언했다.
- Smoke 는 SQL 전체 문자열 대신 조건 · 조인 · 별칭 조각으로 고정했다(빌드 단계에서 실행하지 않아 전체 SQL 을 확정할 수 없었다) — `/beaver:test` 에서 문자열이 다르면 그 단계가 고친다.

## Remaining Issues
- 마이그레이션 적용(`db:migrate` 또는 deskless 마이그레이션 Job)은 사용자 몫. 룩업 행(상태 3 · 카테고리 7)은 user-service 부팅 때 SeederService 가 넣는다.
- 테스트 실행은 `/beaver:test`.

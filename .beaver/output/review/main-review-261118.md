# Review — main — 261118

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`
- Included features: 테스트 데이터 시드 + AWS 미설정 개발 모드 수정 회차 261118-1 — S3 로 바꾼 뒤에도 내부 파일 저장소 사진 계속 열기(파일 행 `file_storage` · `RoutingStorageGateway`)
- Change scope: 58개 파일(수정 55 · 새 파일 3 — 마이그레이션 `1794961426515-FileStorage.ts` · `routing-storage.gateway.ts` · revision 문서), 소스 · spec · 문서 · beaver 산출물(revision · report · spec-board)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 컬럼 `file_storage`(snake) · 상수 `FILE_STORAGE` · 클래스 `RoutingStorageGateway`(인프라 `<kebab>.<role>.ts`) · 조회 별칭 `cover_file_storage` |
| Structure & layering | pass | 엔티티는 `libs/database/src/entities/<domain>/` · 마이그레이션 `db:generate` 결과 + `MIGRATIONS` 등록 · `db:check` 일치. 포트는 Symbol 토큰 그대로(`STORAGE_GATEWAY`), service 는 포트만 안다 — 어댑터 고르기는 라우터 안. 컬럼 주석 있음 |
| Shared logic extraction | pass | 샘플 키 분기를 두 어댑터에서 빼 라우터 한 곳으로(중복 제거). service 에 private 헬퍼 없음 |
| Errors & responses | pass | 실패 모양 그대로 — 기준 주소 없음 500(`STORAGE_PUBLIC_URL_MISSING_MESSAGE`) · 저장소 실패 503. 공개 API 응답 모양 변화 없음 |
| Test strength | pass | 저장소 호출 단언이 파일 행(키 + 저장소)을 확인, 등록 3곳 `file_storage` 단언, S3 업로드 저장소 사례 1건 추가. Data-Access Smoke — 대표 사진 하위 쿼리 2곳 · 파일 행 raw select 2곳 · 그룹 사진 엔티티 select SQL 과 행 키 목록 갱신. 라우터 · 어댑터 · 게이트웨이 `/files` 는 AGENTS.md Testing 대로 spec 없음(scratchpad 점검) |

## Intended Behavior Check (against plan/spec)
- revision 261118-1 의 Spec Before → After 행이 모두 반영됐다: 두 파일 테이블 `file_storage`(기본 `LOCAL`) · 시드 `LOCAL` · 등록 3곳 `getUploadStorage()` · 주소 · 열람 · 삭제 14곳이 행을 넘김(키 문자열 호출 0 — 포트 시그니처가 `StoredFile` 이라 typecheck 가 막는다) · 대표 사진 `cover_file_storage` · 파일 행 select · `useClass: RoutingStorageGateway` · 게이트웨이 `/files` 늘 붙임 + S3 모드 업로드 404.
- 빌드 결과 점검(check-routing.mjs): S3 모드에서 `LOCAL` 행은 게이트웨이 주소 · 서명 열람 · 폴더 삭제, `S3` 행은 CDN · S3 presigned · `DeleteObject`, 샘플 키 `/sample/` · 삭제 건너뜀, 게이트웨이 S3 모드 업로드 404 · 옛 파일 읽기 200.
- `npm test` 123 파일 · 1,355건, typecheck · lint · build · `db:check` 통과(build 회차).
- 마이그레이션은 사용자가 적용 · 확인했다(2026-11-18).
- 프론트 수정 요청 문서(메모리 frontend): 공개 API 주소 · 요청 · 응답 · 실패 모양이 그대로라 대상 아님 — 사진 주소 호스트가 행마다 게이트웨이 또는 CloudFront 인데 두 호스트는 이미 `changes/2026-11-13-sample-data.md` 에서 안내했다.
- README.md · AGENTS.md · docs(aws-setup · integration · architecture · data-layer) 같은 변경에서 갱신.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `libs/integration/src/storage/routing-storage.gateway.ts` | 업로드 저장소는 부팅 때 정해진다. 버킷 없이 업로드 주소를 받은 뒤(10분 안) 서버가 S3 모드로 다시 뜨면 등록 때 `exists` 가 S3 를 봐서 "업로드 확인 실패" 400 — 사용자는 다시 올리면 된다 | 그대로 둔다(전환 순간에만 생기고 데이터가 깨지지 않는다) |
| 2 | Low | 배포 순서(운영) | S3 를 켠 상태에서 admin-service · user-service 중 예전 이미지가 남아 있으면 그 앱이 S3 에 올린 파일 행이 기본값 `LOCAL` 로 남아 주소가 게이트웨이로 만들어진다 | 사용자에게 안내함 — S3 를 켜기 전에 세 앱(user-service · admin-service · gateway)을 새 이미지로. 코드 변경 없음 |

## Verdict
Pass — Low 2건은 코드 변경이 필요 없는 운영 안내. 커밋 진행.

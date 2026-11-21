# Review — main — 261122

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`(원격 `HaSungJe/deskless-backend` — 저장소 이름 바꾼 뒤)
- Included features:
  - 프로젝트 이름 바꾸기 — 영어 Deskless · 한글 바로방 — spec `platform/project-rename-spec.md` · plan `platform/project-rename-plan.md` · report `platform/project-rename-report.md`
- Change scope: 추적 파일 121개 글자 바꾸기(코드 · 테스트 · 설정 · compose · Docker · nginx · 브로커 권한 · 스크립트 · 문서 · `.beaver` 기록) + 로드맵 파일 이름 3개(git mv) + 샘플 업체 사진 20장 다시 그림 + 새 문서 5(spec · plan · report · 프론트 수정 요청 · 이 리뷰) — 146 경로, 삭제 없음

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 영어 자리는 글자 모양 그대로(`deskless` · `Deskless` · `DESKLESS`), 한글 `바로방`, SMS 머리말만 한글 브랜드 `[바로방]`(spec 결정). exchange · 네트워크 · 볼륨 · 컨테이너 · 이미지 · 라벨 · CSS 클래스 · 메타데이터 키가 한 이름으로 맞다 |
| Structure & layering | pass | 로직 변화 없음 — 상수 · 문구 · 설정 값만. 브로커 exchange 상수(`messaging.constants.ts`)와 계정 권한 정규식(`init.sh`) · ACL 검사(`check-broker-acl.mjs`)가 같이 바뀌어 어긋남 없음 |
| Shared logic extraction | pass | 해당 없음 — 새 util 없음 |
| Errors & responses | pass | 응답 · 실패 모양 그대로, API 변화 없음 |
| Data layer | pass | 스키마 · 마이그레이션 변화 없음(`db:check` 일치). 시드 테스트 데이터 업체 이름만 — 새 볼륨이라 처음 넣을 때 새 이름 |
| Test strength | pass | 새 테스트 없음(spec 결과 표에 ✓ 없음). 기존 테스트의 기대 문구가 함께 바뀌어 SMS 머리말 · 업체 이름을 그대로 단언한다. Data-Access Smoke 대상 쿼리 변화 없음 |

## Intended Behavior Check (against plan/spec)
- 진입점 1(Docker): compose 7개 `config -q` 통과, gateway 묶음 이름 `deskless-gateway` · 네트워크 `deskless-*` · 볼륨 `deskless-files` · 이미지 `deskless/gateway` 확인. `docker-network.mjs` 가 `deskless-*` 네트워크 · 볼륨 · 라벨을 만든다. RabbitMQ 호스트 이름 · 볼륨이 새것이라 빈 브로커 — 계정은 rabbitmq-init, exchange · 큐는 앱이 다시 만든다(큐 이름 그대로).
- 진입점 2(보이는 이름): SMS 8종 `[바로방]`, Swagger 기본 제목 `Deskless API`, 테스트 데이터 `바로방 …점`, 샘플 사진 간판 `DESKLESS`(글꼴 D · K 추가 — `store-01-1.png` 눈으로 확인).
- 진입점 3(저장소 · 문서): `git grep -i -e roomless -e 룸리스` → 이번 변경을 설명하는 줄만. 로드맵 `deskless-roadmap.*`, GitHub 저장소 · 원격 주소 · 로컬 폴더 · Claude 메모리는 사용자 단계 완료(plan 표시).
- README · AGENTS.md · docs 같은 변경에서 바뀜. 검사: typecheck 0 · lint 0 · `db:check` 일치 · `npm test` 123 파일 1,361건 · build(네 앱) · prettier(바뀐 `.ts` · `.mjs`).
- 메모리(frontend): 사용자에게 보이는 동작(SMS 머리말 · Swagger 제목 · 테스트 데이터)이 바뀌어 수정 요청 문서 `changes/2026-11-22-project-rename.md` + 목록 줄 있음 — 빠진 것 없음. `screens.md` · `api.md` · `dto/` 는 이름이 없어 바뀌지 않았다.
- 메모리 reconcile: `.beaver/memory` 에 `AGENTS.md 반영: 미반영` 항목 없음.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | 운영(Docker) | 옛 `roomless-*` 볼륨 4개(postgres · rabbitmq · redis · files) · 네트워크 4개 · `roomless/*` 이미지 4개가 그대로 남는다 — 새 이름과 겹치지 않아 동작에는 영향 없음 | 사용자 몫 정리(선택) — ship 보고에 명령 |
| 2 | Info | `.beaver/output/frontend/design/*.html` | 아티팩트 원본 HTML 의 글자(브랜드 이름)도 바뀌었다 — 메모리 frontend "아티팩트도 고치지 않는다" 와 닿지만 배치 · 디자인은 그대로이고 게시된 아티팩트 3개는 다시 게시하지 않았다. 사용자 결정 "싹다" | 그대로 둔다 — 수정 요청 문서가 "원본 HTML 기준, 게시본은 옛 이름" 을 알린다 |
| 3 | Info | `.beaver/output/**` 지난 기록 | 지난 spec · plan · report · review · 이미 보낸 프론트 수정 요청(2026-11-13 등)의 이름도 바뀌었다 — 그때 기록의 글자가 지금 이름으로 보인다 | 그대로 둔다(사용자 결정 "싹다") — 옛 글자는 git 기록에 남는다 |
| 4 | Info | 배포 | 새로 띄우면 DB · 브로커 · Redis(문 연 시각) · 내부 파일 저장소가 모두 빈 상태 — 테스트 데이터뿐이라 결정대로. `.env` 값에 roomless 가 있으면 그 값으로도 동작하지만 사용자가 새 값으로 바꾼다 | ship 보고의 배포 순서 |

## Verdict
Pass — 코드 변경이 필요한 문제 없음(Low 1 · Info 3 은 운영 · 기록 안내). 커밋 진행.

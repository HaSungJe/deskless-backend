# Review — main — 261124-3

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — direct 모드(main 에 바로 커밋 · 푸쉬), 같은 날 세 번째 리뷰.

## Target
- stick: `main`(direct 모드) → origin: `main`
- Included features: 전국 테스트 업체(sample-nationwide — AI 업체 검색 3단계 중 ②) — 테스트 데이터에 전국 업체 61곳 · 객실 · 사진
- Change scope: 수정 9 파일(+144 / −31) + 신규 5 파일(전국 업체 데이터 1,285줄 · spec · plan · report · 프론트 요청서) + 샘플 PNG 380장(새 파일 — 서울 70장은 변경 없음)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 파일 `sample-seed.region.data.ts`(형제 `sample-seed.data.ts` 꼴), 상수 `SAMPLE_REGION_STORES` · 서울 `SAMPLE_SEOUL_STORES`, 그룹 이름 우리말(스탠다드 · 온돌 · 오션뷰 · 패밀리 …) · 코드 키 영어 대문자(`STANDARD` · `ONDOL` · `OCEAN`) |
| Structure & layering | pass | 시드 데이터만 — 만드는 함수 · 시드 틀 · 스키마 변경 없음. 새 파일은 `sample-seed.data.ts` 에서 타입만 가져와 값 순환 import 가 없다 |
| Shared logic extraction | pass | 영업시간 · 호실은 기존 util(`sampleHours` · `sampleRooms`), 요금은 등급 × 종류 표 하나(`PRICE` — `satisfies` 로 없는 조합은 typecheck 실패) |
| Errors & responses | 해당 없음 | 런타임 코드 변경 없음 |
| Test strength | pass(spec 없음 — 의도) | 라이브러리 시드 · 스크립트라 spec 을 두지 않는다(AGENTS.md Testing). build 점검 스크립트로 행 수 · PK 중복 · 업체 안 그룹명 · 호실명 · 좌표 범위 · 영업시간 짝 규칙 · 판매 안 하는 상품 · 사진 키 ↔ 파일을 빌드 결과로 확인(통과) |

## Intended Behavior Check (against plan/spec)
- spec 진입점 2개(부팅 시드 · 사진 그리기) 그대로. plan 3-2 표의 61곳(주소 · 좌표 · 등급 · 편의시설 · 운영 · 그룹 · 소개)이 생성 스크립트로 한 곳에서 옮겨졌다 — 번호 11 ~ 71 연속, 그룹 129 · 호실 441.
- 결정대로: 온천 10곳(그중 반려동물 3곳), 2룸 + PC 그룹 업체 30곳(제주 8곳 중 7곳), 영업시간 업체 5곳(남포 · 강화 · 공주 · 담양 연박 없음, 세종 시간 이용만 · 일요일 휴무 · 브레이크), 판매하지 않는 종류의 그룹 요금 null, 상세주소 없음, 소개에 지역 · 주변 관광지.
- 끝에만 더한다 — `SAMPLE_STORES = [...서울, ...전국]`, 서울 값 · 서울 사진 70장은 바뀌지 않았다(`git diff` 확인). 사진 색 공식은 서울 01 ~ 10 에서 예전 값과 같다.
- plan 과 다르게 쓴 곳 2가지(동작 같음, report 에 이유): `GROUP` 을 `satisfies` 대신 키 타입을 단 `Record` 로, `GROUP_COUNTS` 를 지역별 배열 펼치기로.
- 문서: sample-data.md(전국 표 · 업체코드 규칙 · 기존 DB 는 61건 · 끝에만 더하기) · architecture.md · AGENTS.md 의 업체 수 · 사진 수. README 는 해당 줄 없음. 프론트 요청서(API 변화 없음 — 안내) + 목록 한 줄.
- `npm run typecheck` · `lint` · `db:check` · Prettier 통과(build). 테스트 실행은 `/beaver:test`.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | `libs/database/src/seeder/sample-seed.targets.ts`(`buildSampleStores` — 연락처) | 업체 연락처가 번호와 상관없이 `02123400NN`(서울 지역번호)이라 부산 · 제주 업체도 02 로 보인다 | 그대로 — 테스트 데이터 형식만 맞으면 된다(검색 · AI 재료에 쓰지 않음) |
| 2 | Low | `libs/database/src/seeder/sample-seed.region.data.ts` 좌표 · 주소 | 좌표는 그 동네의 대략 위치, 도로명 번지는 지어낸 값이라 지도에서 건물과 어긋날 수 있다 | spec 결정대로(실제 건물과 맞추지 않음) — ③ 은 지역 단위 거리만 쓴다 |

## Verdict
Pass — 차단할 문제 없음(Low 2건은 기록만).

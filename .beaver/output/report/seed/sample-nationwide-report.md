# Report — 전국 테스트 업체

## Feature Summary
- **Feature**: 테스트 데이터(`SEED_SAMPLE_DATA=1`)에 전국 17개 시 · 도의 업체 61곳(번호 11 ~ 71)을 더한다 — 서울 10곳과 합쳐 71곳. 지역 특징대로 편의시설 · 주변 관광지를 적은 소개 · 객실(휴양지는 2룸 + PC)을 넣고 업체마다 사진을 그린다. ③ AI 대화형 업체 검색을 시험할 재료.
- **Entry point**: `JOB user-service 부팅 시드 SAMPLE_SEED_TARGETS` · `CMD npm run sample:images`
- **Domain**: seed (libs/database 샘플 시드 · scripts 사진 생성기 · 게이트웨이 샘플 사진)
- spec `.beaver/output/spec/seed/sample-nationwide-spec.md` · plan `.beaver/output/plan/seed/sample-nationwide-plan.md` — direct 모드(main)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `libs/database/src/seeder/sample-seed.region.data.ts` | created | 전국 업체 61곳 `SAMPLE_REGION_STORES` — 판매 종류 3개 · 객실 그룹 본보기 `GROUP`(8종) · 등급 × 종류 요금표 `PRICE`(satisfies — 표에 없는 조합은 typecheck 실패). plan 3-2 표를 그대로 옮겼다(scratchpad 생성 스크립트 — 표 한 곳에서 만들어 손으로 옮긴 오타가 없게) |
| `libs/database/src/seeder/sample-seed.data.ts` | modified | 서울 10곳 배열을 `SAMPLE_SEOUL_STORES`(export 안 함)로, `SAMPLE_STORES = [...서울, ...전국]`, JSDoc 번호 범위 — 서울 값은 한 줄도 바뀌지 않음 |
| `libs/database/src/seeder/sample-seed.targets.ts` | modified | JSDoc 의 고정 행 수만 "업체마다 n행" 으로(코드 그대로) |
| `scripts/sample-images.mjs` | modified | `GROUP_COUNTS` 71곳(지역별 묶음), 색 `(index × 36 + 10 + ⌊index / 10⌋ × 17) % 360` — 서울 01 ~ 10 은 예전 값 그대로 |
| `apps/gateway/src/assets/sample/*.png` | created | 380장 새로 그림(모두 450장 · 2.6MB) — 서울 70장은 바이트까지 그대로(git 변경 없음) |
| `docs/guides/sample-data.md` | modified | 업체 수 · 로그(71건, 기존 DB 는 61건), "서울 10곳" · "전국 61곳" 표(주소 · 편의시설 · 운영 · 객실), 업체코드 규칙, 사진 수, 바꾸는 곳(끝에만 더한다) |
| `docs/architecture.md` | modified | 트리 PNG 수(450), 테스트 데이터 문단 · `SEED_SAMPLE_DATA` 설정 줄의 업체 수(71 — 서울 10 · 전국 61) |
| `AGENTS.md` | modified | 트리 `assets/sample/` PNG 수(450), 기본 데이터 시드 줄의 테스트 데이터 업체 수 · 전국 파일 |
| `README.md` | 확인 | 업체 수 · 사진 수를 적은 곳이 없다(sample-data.md 링크만) — 고치지 않음 |
| `.beaver/output/frontend/changes/2026-11-24-sample-nationwide.md` · `changes/README.md` | created · modified | 프론트 요청서(API 변화 없음 · 지도 · 업체 상세에 전국 업체 · 업체코드 규칙 · 지역별 번호) + 목록 한 줄 |

## Tests Written
- 없음 — spec 의 결과 표에 ✓ 행이 없고 계산 규칙도 없다(라이브러리 시드 · 스크립트는 spec 을 두지 않는다 — AGENTS.md Testing).
- 대신 일회성 점검 스크립트(scratchpad `check-nationwide.mjs`)를 `nest build user-service` 결과로 돌려 통과했다 — plan "테스트" 표의 항목.
  - 행 수: 업체 71 · 영업시간 63 · 브레이크 2 · 상품 설정 213 · 업체 사진 142 · 업체 총관리자 71 · 회원 설정 72 · 그룹 154 · 그룹 사진 308 · 그룹 상품 462 · 호실 537
  - 표마다 PK 중복 없음(업체코드 · 사업자등록번호 · 매니저 검색 코드 포함), 업체 안 그룹명 · 호실명 중복 없음, 업체마다 그룹 2 ~ 3개
  - 좌표가 한국 안, 영업시간 짝 규칙(휴무 아니면 두 시각 · 휴무면 둘 다 없음), 24시간 업체는 영업시간 행 없음, 편의시설 7개 모두 채워짐, 전국 업체 상세주소 없음
  - 업체가 팔지 않는 종류는 그룹 요금도 null → 그룹 상품 `is_used` 0 · 요금 0, 파는 종류는 요금 > 0
  - 업체 · 그룹 사진 키마다 `assets/sample/` 에 파일이 있고 남는 파일이 없다(450장)
  - 요약: 온천 10곳 · 그중 반려동물 3곳(수안보 · 경주보문 · 백암) · 2룸 + PC 그룹이 있는 업체 30곳

## Verification
- `npm run typecheck` · `npm run lint`(oxlint) · `npm run db:check`(엔티티와 마이그레이션이 일치 — 스키마 변경 없음) 통과, 바뀐 `.ts` · `.mjs` Prettier 통과.
- `git diff` 로 서울 10곳 값이 그대로인지(이름 바꾼 줄 · JSDoc 만) · 서울 사진 70장이 바뀌지 않았는지 확인했다.
- 새 사진 하나(`store-44-1.png`)를 열어 라벨 `STORE 44` · 다른 색을 확인했다.
- plan 과 다르게 쓴 곳 2가지(동작 같음):
  - `GROUP` 은 `satisfies` 대신 키 타입(`RegionGroupKind`)을 단 `Record` 로 적었다 — 편의 항목이 `0 | 1` 이라 `satisfies` 만으로는 펼친 그룹이 `SampleRoomGroup` 에 맞는지 장담할 수 없어서. `PRICE` 는 plan 대로 `satisfies`.
  - `GROUP_COUNTS` 는 지역별 작은 배열을 펼쳐(`...[…], // 지역`) 적었다 — Prettier 가 숫자 배열을 한 줄로 다시 묶어도 지역 주석이 남게.
- 부팅 시드 실행(실제 DB 입력)은 하지 않았다 — 서버 기동은 사용자 몫. `/beaver:test` 는 이번 변경에 spec 이 없어 기존 회귀만 돈다.

## Remaining Issues
- 이미 테스트 데이터가 있는 개발 DB 는 user-service 를 다시 띄우면 61곳이 더 들어간다(`SEED_SAMPLE_DATA=1`) — 서버 기동은 사용자 몫.
- 게이트웨이 이미지가 샘플 사진만큼(약 2MB) 커진다 — 운영에서도 `/sample/` 정적 경로는 열려 있다(지금과 같음).

# Report — project-rename

## Feature Summary
- **Feature**: 프로젝트 이름 바꾸기 — 영어 Deskless · 한글 바로방
- **Entry point**: `CMD npm run docker:up` (Docker · 브로커 이름) · SMS 문구 · 저장소 · 문서
- **Domain**: platform (로드맵 해당 없음)
- **Plan**: [project-rename-plan.md](../../plan/platform/project-rename-plan.md)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `.beaver/output/roadmap/deskless-roadmap.{md,html,publish.html}` → `deskless-roadmap.*` | moved (git mv) + modified | 로드맵 파일 이름 · 본문, 뷰 다시 만듦(`roadmap-html.js` — 117/119 · 25/26 그대로) |
| `libs/messaging/src/messaging.constants.ts` · `docker/rabbitmq/init.sh` · `scripts/check-broker-acl.mjs` | modified | exchange `deskless.cmd` · `deskless.event` · `deskless.dlx`, 앱 계정 권한 정규식 · ACL 검사 상수(관리자 기본 계정 `deskless`) |
| `libs/account/src/utils/{sms-verification,password}.ts` · `apps/admin-service/src/{manager/manager.util,reservation/reservation.util,store/store.util}.ts` · `apps/scheduler/src/reservation/reservation.util.ts` | modified | SMS 머리말 `[바로방]` 8종 |
| `libs/messaging/src/on-command.decorator.ts` · `libs/integration/src/storage/local-storage.util.ts` | modified | 메타데이터 키 `deskless:on-command` · 내부 파일 서명 구분값 `deskless-local-file` |
| `apps/gateway/src/main.ts` · `config/swagger.config.ts` · `config/cors.config.ts` | modified | Swagger 기본 제목 `Deskless API` · 선택 상자 CSS 클래스 `deskless-tag-select` · 주석 예시 주소 |
| `libs/database/src/seeder/sample-seed.data.ts` · `libs/contracts/src/store/dto/store-application.dto.ts` | modified | 테스트 데이터 업체 10곳 `바로방 …점` · Swagger 예시값 `바로방 강남점` |
| `compose.*.yml`(7) · `Dockerfile` · `docker/nginx/*.conf` · `scripts/docker-network.mjs` | modified | 묶음 · 컨테이너 · 이미지(`deskless/<앱>`) · 네트워크(`deskless-edge` · `-service` · `-broker` · `-data`) · 볼륨(`deskless-files` · `-postgres-data` · `-rabbitmq-data` · `-redis-data`) · 라벨 · RabbitMQ 호스트 이름 |
| `scripts/sample-images.mjs` | modified | 간판 글자 `DESKLESS` + 글꼴에 `D` · `K` |
| `apps/gateway/src/assets/sample/store-*.png`(20) | modified | 업체 사진 간판 다시 그림(`npm run sample:images` — 객실 그룹 사진 50장은 간판이 없어 그대로) |
| `apps/**/test/*.ts`(25) | modified | 기대 문구 — SMS 머리말 · 업체 이름 · 예시 주소(`deskless.test`) · 아이디(`deskless_01`) |
| `package.json` · `package-lock.json` · `.env.example` | modified | 패키지 이름 `deskless-backend` · 예시 값(계정 · DB 이름 · 비밀번호 · Swagger 제목) |
| `.beaver/config.json` | modified (로컬 — gitignore) | beaver 프로젝트 이름 `deskless-backend` — 스크립트 대상(추적 파일) 밖이라 따로 고침 |
| `AGENTS.md` · `README.md` · `docs/{architecture,messaging,integration}.md` · `docs/guides/{aws-setup,redis-setup,sample-data}.md` | modified | 이름 · 명령 예시 · 네트워크 · 볼륨 · exchange |
| `.beaver/**`(기획 · 리포트 · 리뷰 · 리비전 · 프론트 인계 원본 · 메모리 · spec 보드) | modified | 지난 기록까지 새 이름, spec 보드 다시 만듦 |
| `.beaver/output/frontend/changes/2026-11-22-project-rename.md` · `changes/README.md` | created · modified | 프론트 수정 요청 — SMS 머리말 · Swagger 제목 · 테스트 데이터 · 저장소 이름(API 변화 없음) |

글자 바꾸기는 plan §1 스크립트(scratchpad, 커밋하지 않음)로 git 추적 파일 전부에 한 번에 적용했다 — 121개. 줄 끝(CRLF/LF)은 그대로다.

## Tests Written
없음 — spec 결과 표에 ✓ 행이 없다. 기존 테스트의 기대 문구가 스크립트로 함께 바뀌었다.

## Verification
- 남은 이름: `git grep -n -i -e deskless -e 룸리스` → 이번 변경을 설명하는 문서(프론트 수정 요청 목록 줄 · spec 보드의 이번 카드)만 남는다.
- `docker compose -f compose.<묶음>.yml config -q` 7개 OK — gateway 묶음 이름 `deskless-gateway`, 네트워크 `deskless-*`, 볼륨 `deskless-files`, 이미지 `deskless/gateway` 확인(컨테이너는 띄우지 않음).
- `npm run typecheck` 0 · `npm run lint` 0 · `npm run db:check` 일치 · `npm test` 123 파일 1,361건 통과 · `npm run build`(네 앱) 성공 · 바뀐 `.ts` · `.mjs` prettier 통과.
- 샘플 사진: `store-01-1.png` 를 열어 간판 `DESKLESS` 확인.
- Claude 메모리(저장소 밖)의 로드맵 파일 이름도 `deskless-roadmap` 으로 맞췄다.

## Remaining Issues
- **사용자 단계(ship 뒤)** — plan "ship 뒤 사용자 단계" 2~4: `.env` 값 · `npm run docker:up` · 옛 볼륨 · 네트워크 · 이미지 정리. 옛 묶음 내리기 · GitHub 저장소 이름 · 원격 주소 · 로컬 폴더 이름(`C:\workspace\deskless-backend`) · Claude 메모리 폴더 복사(`C--workspace-deskless-backend`, 옛 폴더는 그대로 둠)는 완료(2026-11-22).
- 게시된 아티팩트(로드맵 · spec 보드 · 화면 설계 3개 · MSA 구상)는 다시 게시하지 않았다 — 로드맵 · spec 보드는 ship 때 같은 주소로 다시 게시하면 제목이 맞춰진다.

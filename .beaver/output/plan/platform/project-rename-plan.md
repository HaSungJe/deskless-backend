# Plan — project-rename

> 무엇을·왜는 [spec](../../spec/platform/project-rename-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 글자 바꾸기 스크립트(이번 변경의 본체) ② 샘플 사진 글꼴에 더할 글자 ③ 바뀐 뒤 모양을 미리 봐야 하는 곳(브로커 권한 · 메시징 상수 · SMS 머리말)
> **싣지 않는 것** 스크립트가 글자만 바꾸는 나머지 파일 — 아래 파일 표에 묶어 적는다

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `.beaver/output/roadmap/roomless-roadmap.md` · `.html` · `.publish.html` → `deskless-roadmap.*` | 이동(git mv) + 수정 | 로드맵 파일 이름 · 본문 | 아래 1 (스크립트) |
| `libs/messaging/src/messaging.constants.ts` | 수정 | exchange 세 개 이름 | 아래 3-1 |
| `docker/rabbitmq/init.sh` · `scripts/check-broker-acl.mjs` | 수정 | 브로커 계정 권한 정규식 · ACL 검사 상수 | 아래 3-1 |
| `libs/account/src/utils/password.ts` · `sms-verification.ts` · `apps/admin-service/src/{manager/manager.util.ts, reservation/reservation.util.ts, store/store.util.ts}` · `apps/scheduler/src/reservation/reservation.util.ts` | 수정 | SMS 머리말 `[바로방]` (8종) | 아래 3-2 |
| `libs/messaging/src/on-command.decorator.ts` · `libs/integration/src/storage/local-storage.util.ts` | 수정 | 메타데이터 키 · 내부 파일 서명 구분값 | 아래 1 (스크립트) |
| `apps/gateway/src/main.ts` · `config/swagger.config.ts` · `config/cors.config.ts` | 수정 | Swagger 기본 제목 · 선택 상자 CSS 클래스 · 주석 예시 주소 | 아래 1 (스크립트) |
| `libs/database/src/seeder/sample-seed.data.ts` | 수정 | 테스트 데이터 업체 이름 `바로방 …점` | 아래 1 (스크립트) |
| `compose.*.yml` 7개 · `Dockerfile` · `docker/nginx/*.conf` · `scripts/docker-network.mjs` | 수정 | 묶음 이름 · 컨테이너 · 이미지 · 네트워크 · 볼륨 · 라벨 · 주석 | 아래 1 (스크립트) |
| `scripts/sample-images.mjs` | 수정 | 간판 글자 `DESKLESS` + 글꼴에 D · K | 아래 2 |
| `apps/gateway/src/assets/sample/*.png` (70) | 다시 그림 | `npm run sample:images` | 생략 (스크립트 실행 결과) |
| `apps/**/test/*.ts` · `libs/**` 의 테스트 · 도우미 (약 25) | 수정 | 기대 문구(SMS 머리말 · 업체 이름 · 예시 주소 · 아이디) | 아래 1 (스크립트) |
| `package.json` · `package-lock.json` · `.env.example` · `.beaver/config.json` | 수정 | 패키지 이름 · 예시 값(계정 · DB 이름 · 비밀번호 · Swagger 제목) · beaver 프로젝트 이름 | 아래 1 (스크립트) |
| `AGENTS.md` · `README.md` · `docs/**/*.md` | 수정 | 이름 · 명령 예시 · 네트워크 · 볼륨 · exchange | 아래 1 (스크립트) |
| `.beaver/**` (기획 · 리포트 · 리뷰 · 리비전 · 프론트 인계 · 로드맵 · 메모리, 약 54) | 수정 | 지난 기록까지 새 이름 | 아래 1 (스크립트) |
| `.beaver/output/frontend/changes/2026-11-22-project-rename.md` · `changes/README.md` | 신규 · 수정 | 프론트 수정 요청 — SMS 머리말 · Swagger 제목 · 테스트 데이터 업체 이름 · 백엔드 저장소 이름 | 생략 (문서 틀 그대로) |
| `.beaver/output/report/platform/project-rename-report.md` | 신규 | build 리포트 | 생략 |

---

## 1. 비즈니스 로직 — 글자 바꾸기 스크립트

이번 변경의 본체다. 추적 파일 전부에 같은 규칙을 한 번에 적용해 빠뜨리는 곳이 없게 한다. 스크립트는 scratchpad 에 두고 커밋하지 않는다.
**순서가 중요하다** — SMS 머리말 `[roomless]` 를 먼저 한글 브랜드로 바꾼 뒤 나머지 영어를 바꾼다(거꾸로면 `[deskless]` 가 된다). 줄 끝(CRLF/LF)은 건드리지 않는다.

```js
// <scratchpad>/rename-project.cjs — 사용: node rename-project.cjs <저장소 경로>
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const repo = process.argv[2];
// ① 바꾸는 규칙 — 위에서부터 차례로(SMS 머리말이 먼저)
const RULES = [
    ['[roomless]', '[바로방]'],
    ['Roomless', 'Deskless'],
    ['ROOMLESS', 'DESKLESS'],
    ['roomless', 'deskless'],
    ['룸리스', '바로방'],
];
// ② 대상 — git 이 추적하는 파일만(.env · .back/ · node_modules · dist 는 추적되지 않아 빠진다), 그림 파일 제외
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?)$/i;
const files = execFileSync('git', ['ls-files', '-z'], {cwd: repo}).toString('utf8').split('\0').filter(Boolean);

// ③ 파일마다 규칙을 적용하고 바뀐 파일만 쓴다
let changed = 0;
for (const rel of files) {
    if (BINARY.test(rel)) continue;
    const file = path.join(repo, rel);
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    for (const [from, to] of RULES) after = after.split(from).join(to);
    if (after !== before) {
        fs.writeFileSync(file, after);
        changed++;
    }
}
console.log(`바꾼 파일 ${changed}개`);
```

로드맵 파일 이름은 스크립트 전에 옮긴다(스크립트가 새 이름의 파일 본문을 바꾸게).

```bash
git mv .beaver/output/roadmap/roomless-roadmap.md .beaver/output/roadmap/deskless-roadmap.md
git mv .beaver/output/roadmap/roomless-roadmap.html .beaver/output/roadmap/deskless-roadmap.html
git mv .beaver/output/roadmap/roomless-roadmap.publish.html .beaver/output/roadmap/deskless-roadmap.publish.html
```

---

## 2. 샘플 사진 간판 글자 — `scripts/sample-images.mjs`

5×7 글꼴에는 라벨에 쓰는 글자만 있다(`0-9 E L M O R S T -`). `DESKLESS` 에 필요한 **D · K** 를 더한다 — 없는 글자는 빈칸으로 그려지므로 더하지 않으면 간판이 `ES LESS` 가 된다. 글자 수(8)가 같아 간판 크기 · 위치는 그대로다. 스크립트가 `ROOMLESS` 를 `DESKLESS` 로 바꾼 뒤 `npm run sample:images` 로 70장을 다시 그린다.

```js
// scripts/sample-images.mjs — FONT 에 더한다
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
```

---

## 3. 데이터 규칙 — 바뀐 뒤 모양

### 3-1. 브로커 exchange · 계정 권한 — `libs/messaging/src/messaging.constants.ts` · `docker/rabbitmq/init.sh`

exchange 이름은 코드 상수와 브로커 권한 정규식 두 곳에 있다. 한쪽만 바뀌면 앱이 exchange 를 선언하다 403(ACCESS_REFUSED)으로 막힌다 — 스크립트가 두 곳을 같이 바꾼다. 큐 이름(`q.user.cmd` · `q.admin.cmd` · `q.gw.result.*` · `q.dead`)에는 이름이 없어 그대로다.

```ts
// libs/messaging/src/messaging.constants.ts
export const COMMAND_EXCHANGE = 'deskless.cmd';
export const EVENT_EXCHANGE = 'deskless.event';
export const DEAD_LETTER_EXCHANGE = 'deskless.dlx';
```

```sh
# docker/rabbitmq/init.sh — 32행 (user-service · admin-service 도 같은 모양)
put "permissions/%2F/gateway" '{"configure":"^(deskless\\.(cmd|event|dlx)|q\\.dead|q\\.gw\\.result\\..+)$","write":"^(deskless\\.cmd|q\\.dead|q\\.gw\\.result\\..+)$","read":"^(deskless\\.(event|dlx)|q\\.dead|q\\.gw\\.result\\..+)$"}'
```

RabbitMQ 는 호스트 이름(`deskless-rabbitmq`)과 볼륨(`deskless-rabbitmq-data`)이 모두 새것이라 빈 브로커로 뜬다 — 계정 · 권한은 rabbitmq-init 이, exchange · 큐는 앱이 접속할 때 다시 만든다.

### 3-2. SMS 머리말 — 8종

```ts
// libs/account/src/utils/sms-verification.ts
return `[바로방] 인증번호 [${code}] — ${SMS_CODE_TTL_MINUTES}분 안에 입력해주세요.`;
// libs/account/src/utils/password.ts
return `[바로방] 임시 비밀번호 ${password} — 로그인 후 비밀번호를 바꿔주세요.`;
// apps/admin-service/src/store/store.util.ts
return `[바로방] ${store_name} 입점이 승인되었습니다.`;
// manager.util.ts · admin-service reservation.util.ts(3) · scheduler reservation.util.ts — 머리말만 같은 방식
```

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| 프론트 수정 요청 문서 | 문서 틀(반영 순서 · 바뀐 이유 · 영향 화면 · API 변경 · 화면 구성 · DTO) — DTO 변화 없음 | `.beaver/output/frontend/changes/README.md:16` · `2026-11-16-token-refresh-ip.md`(프론트 변경 없는 안내) |
| build 리포트 | 리포트 틀 | `.beaver/output/report/door/door-state-report.md` |

## 테스트

spec 의 "결과" 표에 ✓ 행이 없고 계산 규칙도 없다 — 새 테스트는 쓰지 않는다. 스크립트가 기존 테스트의 기대 문구(`[바로방]` · `바로방 강남점` · `https://deskless.test` · `deskless_01`)를 같이 바꾸고, 그대로 통과해야 한다.

| 종류 | 대상 | 이유 |
|---|---|---|
| 남은 이름 검사 | `git grep -n -i -e roomless -e 룸리스` | 0건이어야 한다 — 빠뜨린 곳 찾기 |
| 형식 검사 | `docker compose -f compose.<묶음>.yml config -q` 7개 | 컨테이너를 띄우지 않고 compose 형식만 확인(허용) |
| 회귀 | `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run db:check` | 문구 · 상수만 바뀌어 모두 그대로 통과해야 한다 |

## 만드는 순서

1. 로드맵 파일 git mv → 2. 글자 바꾸기 스크립트 실행 → 3. 샘플 글꼴 D · K + `npm run sample:images` → 4. 프론트 수정 요청 문서 · 목록 줄 → 5. 검사(남은 이름 0건 · compose config · typecheck · lint · test · build · db:check) → 6. 리포트

## ship 뒤 사용자 단계 (리포트 · ship 보고에 싣는다)

1. 옛 묶음 내리기 — 바꾸기 전 코드로 `npm run docker:down`. 이미 바꾼 뒤면 묶음마다 `docker compose -p roomless-<gateway|scheduler|admin-service|user-service|redis|rabbitmq|postgres> down`.
2. `.env` — 값에 roomless 가 있으면 새 값으로(`POSTGRES_USER` · `POSTGRES_PASSWORD` · `POSTGRES_DB` · `DATABASE_URL` · `RABBITMQ_USER` · `RABBITMQ_PASSWORD` · `REDIS_PASSWORD` · `REDIS_URL` · `SWAGGER_TITLE` · `CORS_ORIGINS` · `USER_WEB_URL` 등). 빈 새 볼륨이라 새 값이 그대로 적용된다.
3. `npm run docker:up` — 새 네트워크 · 볼륨 · 빈 DB(마이그레이션 + 시드).
4. 정리(선택) — 옛 `roomless-*` 볼륨 · 네트워크 · `roomless/*` 이미지 지우기.
5. ~~GitHub 저장소 이름 `deskless-backend` 로 바꾸기 → 원격 주소 바꾸기~~ — 완료(2026-11-22 사용자가 GitHub 이름 변경, 원격 주소 `https://github.com/HaSungJe/deskless-backend.git` 로 바꾸고 `main` = `fd81cd1` 확인).
6. ~~세션을 닫고 로컬 폴더 이름 바꾸기 — Claude 메모리 폴더도 새 경로 이름으로 옮긴다~~ — 완료(2026-11-22 사용자가 `C:\workspace\deskless-backend` 로 바꿈, 메모리 10개를 `~/.claude/projects/C--workspace-deskless-backend/memory` 로 복사 — 옛 폴더는 그대로 둠).

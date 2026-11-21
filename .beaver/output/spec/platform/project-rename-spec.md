---
feature_goal: "프로젝트 이름 바꾸기 — 영어 Deskless · 한글 바로방"
domain: "platform"
roadmap_phase: ""
api_method: "CMD"
api_path: "npm run docker:up"
affected_data: ["Docker 네트워크 · 볼륨 · 컨테이너 · 이미지 이름", "RabbitMQ exchange 이름 · 브로커 계정 권한", "SMS 문구 머리말", "테스트 데이터 업체 이름 · 샘플 사진 글자"]
---

# 프로젝트 이름 바꾸기

## 한눈에

- **무엇을** 코드 · 설정 · 문서 · Docker · 브로커 · 저장소에 있는 `deskless` 를 모두 `Deskless` 로 바꾼다.
- **왜** deskless 는 "방이 없다" 로 읽혀 서비스와 뜻이 맞지 않는다. Deskless 는 "프런트 데스크가 없는(무인) 숙소" 라는 원래 뜻을 그대로 담는다.
- **범위 밖** 옛 Docker 볼륨의 데이터 옮기기(테스트 데이터뿐이라 새로 시작한다), 프론트 저장소 안의 이름(프론트 세션 몫 — 수정 요청 문서로 알린다), git 기록 고쳐 쓰기.

| 진입점 | 한 줄 요약 | 테스트 |
|---|---|---|
| 1. Docker 실행 | 네트워크 · 볼륨 · 컨테이너 · 이미지 · 브로커 exchange 가 새 이름으로 빈 상태에서 다시 만들어진다 | 0건 |
| 2. 사용자에게 보이는 이름 | SMS 머리말 · Swagger 제목 · 테스트 데이터 업체 이름 · 샘플 사진 글자가 새 이름 | 0건 |
| 3. 저장소 · 문서 | 코드 · 문서 · beaver 기록 · 로드맵 파일 이름, GitHub 저장소 · 로컬 폴더 이름 | 0건 |

---

## 1. Docker 실행 — `CMD npm run docker:up`

**동작 흐름**

1. **옛 묶음 내리기** — 사용자가 이름을 바꾸기 전 코드로 `npm run docker:down` 을 실행해 deskless 컨테이너를 내린다.
   - 이미 바꾼 뒤면 → `docker compose -p deskless-<묶음> down` 으로 옛 묶음 이름을 지정해 내린다.
2. **공용 망 · 볼륨 만들기** — `npm run docker:network` 가 `deskless-edge` · `deskless-service` · `deskless-broker` · `deskless-data` 네트워크와 `deskless-files` 볼륨을 만든다.
3. **인프라 새로 띄우기** — postgres · rabbitmq · redis 가 `deskless-*` 이름과 빈 새 볼륨으로 뜬다.
4. **브로커 계정 권한** — rabbitmq-init 이 앱 계정마다 `deskless.cmd` · `deskless.event` · `deskless.dlx` 권한을 준다.
5. **앱 띄우기** — `deskless/<앱>` 이미지로 user-service(마이그레이션 · 시드) → admin-service → scheduler → gateway 가 뜬다.

**입력**

| 필드 | 필수 | 설명 |
|---|---|---|
| `.env` | ✓ | 사용자 값 그대로 쓴다. 접속 계정 · DB 이름에 deskless 가 있으면 사용자가 새 값으로 바꾼다(빈 새 볼륨이라 새 값이 그대로 적용된다) |

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| 처음부터 띄운다 | `deskless-*` 컨테이너 · 네트워크 · 볼륨, 빈 DB 에 마이그레이션 전부와 기본 데이터(+ `SEED_SAMPLE_DATA=1` 이면 테스트 데이터) | — (Docker 실행은 사용자 몫, `docker compose config` 로 형식만 확인) |
| 옛 deskless 컨테이너가 떠 있는 채로 띄운다 | 호스트 포트(gateway · postgres · redis · rabbitmq)가 겹쳐 새 컨테이너가 뜨지 않는다 | — (안내 — 1단계를 먼저) |
| 게이트웨이가 명령을 보낸다 | `deskless.cmd` 로 발행하고 서비스는 `q.user.cmd` · `q.admin.cmd`(이름 그대로)로 받는다 | — (기존 메시징 테스트가 상수를 그대로 쓴다) |

---

## 2. 사용자에게 보이는 이름 — `FUNC SMS 문구 · Swagger 제목`

**동작 흐름**

1. **SMS 머리말** — 모든 SMS 문구의 `[deskless]` 가 한글 브랜드 `[바로방]` 이 된다(인증번호 · 임시 비밀번호 · 입점 승인 · 업체 관리자 등록 · 업체 취소 · 호실 이동 · 이용 중 취소 요청 · QR 확인 링크).
2. **Swagger 제목** — 기본 제목이 `Deskless API` 가 된다(`.env` 의 `SWAGGER_TITLE` 이 있으면 그 값).
3. **테스트 데이터** — 업체 10곳 이름이 `바로방 강남역점` … 이 된다.
4. **샘플 사진** — 사진 70장의 간판 글자가 `DESKLESS` 가 된다(`scripts/sample-images.mjs` 로 다시 그림).

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| 인증번호 SMS 를 보낸다 | `[바로방] 인증번호 [123456] — 5분 안에 입력해주세요.` | — (기존 SMS 테스트의 기대 문구만 바뀜) |
| Swagger 를 연다 | 제목 `Deskless API` | — (문자열 하나) |
| 테스트 데이터를 넣는다 | 업체 이름 `바로방 …점` | — (시드 테스트 없음 — 규약) |

---

## 3. 저장소 · 문서 — `CMD git remote set-url`

**동작 흐름**

1. **글자 바꾸기** — 추적되는 모든 파일(코드 · 설정 · 문서 · `.beaver` 기록)에서 `deskless` → `deskless`, `deskless` → `Deskless`, `deskless` → `DESKLESS`, `룸리스` → `바로방`.
2. **파일 이름** — 로드맵 `deskless-roadmap.*` 를 `deskless-roadmap.*` 로 옮긴다(git mv).
3. **GitHub 저장소** — ship 뒤 사용자가 `deskless-backend` 를 `deskless-backend` 로 바꾸고, 원격 주소를 새 이름으로 바꾼다.
4. **로컬 폴더** — 세션을 닫고 사용자가 `C:\workspace\deskless-backend` 를 `deskless-backend` 로 바꾼다. Claude 메모리 폴더도 새 경로 이름으로 옮긴다.

**결과**

| 상황 | 응답 | 테스트 |
|---|---|---|
| 바꾼 뒤 추적 파일을 찾는다 | `deskless` · `룸리스` 0건 | — (검사 명령으로 확인 — `git grep -i deskless`) |
| GitHub 이름을 바꾼 뒤 옛 주소로 push 한다 | GitHub 가 새 주소로 넘겨 준다(그래도 원격 주소는 바꾼다) | — (GitHub 동작) |

---

## 데이터 변화

| 대상 | 무엇이 바뀌나 |
|---|---|
| Docker 볼륨 | `deskless-postgres-data` · `deskless-rabbitmq-data` · `deskless-redis-data` · `deskless-files` 가 빈 상태로 새로 생긴다. 옛 `deskless-*` 볼륨은 그대로 남고, 지우는 것은 사용자 몫 |
| RabbitMQ | 새 이름 exchange 세 개 · 새 호스트 이름(`deskless-rabbitmq`)의 빈 브로커. 큐 이름은 그대로 |
| PostgreSQL | 빈 DB 에 마이그레이션 전부 + 시드 — 테스트 데이터 업체 이름만 바뀐다(스키마 변화 없음, 새 마이그레이션 없음) |

## 결정한 것

- [x] 이름은 영어 **Deskless** · 한글 **바로방**(사용자 2026-11-22 — 둘 다 "직원 없이 바로 들어가는 방" 이라 한 브랜드의 영어 · 한글 이름). 영어는 글자 모양을 그대로 맞춘다 — `deskless` → `deskless`, `deskless` → `Deskless`, `deskless` → `DESKLESS`. 한글은 `룸리스` → `바로방`.
- [x] SMS 머리말은 한글 브랜드 `[바로방]`(사용자 2026-11-22 — 받는 사람이 국내 이용자 · 업체). 문자 수도 `[deskless]` 10자 → 5자로 준다. 그 밖의 영어 자리(코드 · 설정 · Docker · 브로커 · Swagger · 샘플 사진 글자)는 Deskless.
- [x] **옛 데이터는 옮기지 않는다**(사용자 — 테스트 데이터뿐). 새 볼륨으로 다시 시작하고 시드가 다시 넣는다.
- [x] **전부 바꾼다**(사용자 "싹다") — `.beaver` 의 지난 기획 · 리포트 · 리뷰 · 프론트 수정 요청 기록까지. git 기록과 로컬 전용 `.back/`(수정 금지 규칙)은 빼고, `.env` 는 사용자 파일이라 손대지 않는다(`.env.example` 만 바꾼다).
- [x] **GitHub 저장소 · 로컬 폴더 이름은 ship 뒤 사용자 몫** — 저장소 이름 바꾸기는 밖으로 나가는 동작이고, 로컬 폴더는 이 세션이 쓰는 작업 폴더라 세션을 닫고 바꿔야 한다.
- [x] **프론트 수정 요청 문서를 남긴다** — SMS 머리말 · Swagger 제목 · 테스트 데이터 업체 이름이 사용자에게 보이고, 백엔드 저장소 이름이 바뀐다.
- [x] 내부 파일 서명 주소의 HMAC 구분값(`deskless-local-file`)도 바꾼다 — 바꾸는 순간 이미 내준 10분짜리 업로드 · 열람 주소가 무효가 되지만 새로 시작하므로 상관없다.

## 제안 (코드베이스 기반)

- [x] 게시한 로드맵 · spec 보드 아티팩트는 같은 주소로 다시 게시해 제목을 새 이름으로 맞춘다. 근거: 두 뷰는 `deskless-roadmap.md` · spec 에서 다시 만들어진다.
- [ ] 화면 설계 아티팩트 3개 · MSA 구상 아티팩트의 제목 — 프론트 세션 · 별도 요청 때(문서가 링크로만 가리킨다).

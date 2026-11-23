# deskless-backend

무인 객실 대여 서비스 백엔드 — NestJS 12 모노레포(MSA).

- **gateway** — 유일한 외부 진입점(:3000). 로그인 그룹별 JWT 인증 · 입력 검증 후 서비스로 전달한다. 상태를 바꾸는 요청은 RabbitMQ 를 거쳐 처리하고 결과를 요청 단위 SSE 로 돌려준다. 공개 경로는 `/api/v1/<서비스>/<도메인>/...` 이다 — 이용자 `/api/v1/user-service/user` · 매니저(총매니저 · 매니저) `/api/v1/admin-service/manager` · 관리자(총관리자 · 관리자) `/api/v1/admin-service/admin` · 입점 신청(이용자) `/api/v1/user-service/store` · 업체 관리 `/api/v1/admin-service/store`(매니저 로그인용 업체 조회 `/login-store/:store_code` 는 로그인 없음) · 객실 `/api/v1/admin-service/room` · 예약(이용자) `/api/v1/user-service/reservation` · 업체 예약(업체 관리자) `/api/v1/admin-service/reservation` · 업체 둘러보기 `/api/v1/user-service/discovery`(로그인 없음) · 이용자 관리(총관리자 · 관리자) `/api/v1/admin-service/user` · 통계(총관리자 · 관리자 전체, 업체 관리자 `/mine`) `/api/v1/admin-service/stats`. 이용자가 쓰는 기능은 user-service, 업체 관리자 · 업체 총관리자 · 관리자 · 총관리자 전용 기능은 admin-service 에 둔다. 서비스 내부 경로도 `/internal/v1/<서비스>/<도메인>/...` 다. 문 쪽 타 업체 프로그램과는 문 소켓 `/ws/v1/door`(표준 WebSocket — 아래 "문 소켓")로 주고받는다. 모든 HTTP 요청(성공 · 실패와 그 사유 — 경로 · 입력 · 상태 · 응답 · 회원 · IP · 처리 시간, Swagger 문서 제외)은 응답이 끝난 뒤 API 로그(`t_api_log`)로 남긴다 — 게이트웨이의 유일한 DB 사용이라 로그 전용 연결(풀 5)로 바로 넣고, DB 가 없거나 실패하면 그 로그만 빠진다(그래서 게이트웨이도 `DATABASE_URL` 이 필요하다).
- **scheduler** — crontab 전용 서버(탈퇴 자동처리 · 결제 대기 만료(연장 구간 포함 — 결제됨이면 연장 확정, 아니면 만료 · 잡아 둔 구간을 풀고 그 예약은 다시 연장할 수 없다) · 늦게 승인된 결제 환불 · 환불 처리 · 이용 전환(매분 — 시작 시각이 된 확정 예약은 이용 중 + 호실 사용중 + QR 발급, 끝난 예약은 이용 완료 + 호실 사용중 → 정비중 — 결제 대기 중인 연장이 있으면 결제 결과를 기다린다. 체크인 · 체크아웃은 없다) · QR 확인 링크 SMS(매분 — 이용 시작 5분 전 예약 화면 링크 `USER_WEB_URL/reservation/<예약 ID>`, 예약당 1번) · 문 QR 동기화(매분 — 이용 중 예약의 Redis 현재 QR 다시 쓰기) · API 로그 월 파티션 미리 만들기(매일 03:00 — 한국 달 기준 이번 달 + 3개월, 로그는 지우지 않는다)). 들어오는 연결이 없고(포트 없음) DB · Redis · 토스 · SNS 에만 붙는다. 여러 대여도 DB 잠금으로 회차마다 1대만 실행한다.
- **user-service** — 이용자 서버(:3010, 내부망) — 이용자가 쓰는 기능을 모은다. SNS 가입 · 로그인(만 19세가 되는 해부터 — 청소년보호법. 이용 제한(BLOCK) · 탈퇴 대기(LEAVE_WAIT) 이용자도 로그인 · 토큰 재발급 · 모든 기능을 쓰고 새 예약 · 연장만 막힌다 — 로그인 결과의 `state_id` · `block_comment` · `leave_reserved_at`(탈퇴 예정 시각 — 그 전에 철회할 수 있다)) · 휴대폰 SMS 인증 · 아이디 찾기 · 탈퇴 · 내 정보(`GET /api/v1/user-service/user/me` — 닉네임 · SNS · 휴대폰 · 인증 여부 · 성별 · 생년월일 · 가입일 · 회원 상태 · 이용 제한 사유 · 탈퇴 예정 시각). PostgreSQL 을 소유하고(마이그레이션), 부팅 때 기본 데이터와 첫 총관리자(`admin` / `1234`)를 넣는다. 업체 둘러보기(로그인 없음 — `/api/v1/user-service/discovery`): 반경 업체 조회(지도 중심 + 5 · 10 · 20 · 50km · 거리 제한 없음(ALL), 객실 그룹 상세 추가정보 필터(체크박스 — 항목 목록 API), 가까운 순 최대 300개 — 지도 · 목록 공용, 거리 · 대표 사진 · 최저가) · 업체 상세(사업자 정보 없음 · 상품 설정 — 연장 가능 여부 · 최대 연장 횟수 포함) · 객실 그룹 목록(사진 · 편의시설 · 호실 수 · 판매 중인 상품). 예약: 객실 그룹별 예약 가능 시간(로그인 없음 — 그룹 → 시간대 → 예약 가능한 호수, room_group_id 필터, 시간 이용 · 오늘이면 '지금 바로' 시간대) · 시간 이용 지금 바로 예약(is_now — 지금(분)부터 이용 시간만큼) · 예약(결제 대기 5분) · 토스 결제 확인 · 취소(업체 환불 규정 — 마감 전 100%, 마감 뒤 비율, 시작 뒤 불가. 예약한 호실이 사용중지면 이용 중이어도 끝 전까지 100% — 목록 · 상세의 `is_room_disabled`) · 내 예약(목록 — 상태 거르기) · 내 예약 QR(이용 중 예약에만, 정확히 시작 시각부터 — 시작했는데 아직 확정이면 그 자리에서 이용 중으로 바꾸고 발급, `GET /api/v1/user-service/reservation/:reservation_id/qr`) · 이용 중 취소 요청(업체가 보낸 SMS 링크 화면 — `GET …/:reservation_id/cancel-request`, 로그인해 10분 안에 `PATCH …/cancel-request/approve`(전액 환불 취소) · `…/reject`) · 연장(이용 중에만 — 시간 이용 · 1박은 업체 시간 이용 시간만큼 시간 이용 요금, 연박은 1일씩 1박 요금으로 최대 박수까지, 업체 상품별 연장 가능 여부 · 최대 연장 횟수까지. `GET …/:reservation_id/extension` 조회 · `POST …/:reservation_id/extension` 신청 — 다음 예약과 겹치면 불가, 신청하면 구간을 잡아 두고 5분 안에 결제(결제 확인은 같은 `/payment-confirm`), 결제하지 않으면 만료되고 그 예약은 다시 연장할 수 없다) — `/api/v1/user-service/reservation`. QR 이력은 DB(`t_room_qr` — 유효 시작 · 끝), 호실의 현재 QR 은 Redis(이용 끝에 자동 만료). 결제 확인 때 이미 시작한 예약이면(지금 바로 · 시작 뒤 결제) 바로 이용 중 · QR 발급이다. 업체 · 객실 · 상품 · 영업시간은 공유 DB 에서 읽는다. 입점 신청(`/api/v1/user-service/store/application…` — 업체 총관리자 아이디 · 비밀번호 포함) · 신청 취소 · 업체 정보 파일(사업자등록증 · 업체 사진 — S3 업로드 주소) · 내 신청(승인되면 업체코드). 문 소켓의 접속 확인 · QR 확인도 여기서 판단한다(게이트웨이가 내부 HTTP `/internal/v1/user-service/door/…` 로 넘긴다). QR 로 문을 열면 그 기록(호실 · 예약 · QR · 시각, 연 방법 `QR`)을 `t_door_open_log` 에 쌓는다 — 업체 관리자 바로 열기는 admin-service 가 같은 표에 `MANAGER` + 연 사람으로 쌓는다.
- **admin-service** — 관리자 서버(:3020, 내부망) — 업체 관리자 · 업체 총관리자 · 관리자 · 총관리자 전용 기능만 둔다. 매니저(총매니저 · 매니저): 업체코드 + 아이디 로그인 · 비밀번호 변경 · 아이디 찾기 · 비밀번호 초기화(업체코드 + 등록된 휴대폰, 임시 비밀번호 SMS), 업체 총관리자의 업체 관리자 계정 등록 · 목록 · 상세 · 수정 · 비밀번호 초기화 · 정지 · 해제 · 삭제. 관리자(총관리자 · 관리자): 이용자 관리(`/api/v1/admin-service/user` — 목록(이름 · 닉네임 · 휴대폰 · 회원 식별 코드 검색, 상태 · SNS 필터) · 상세(예약 건수 요약) · 예약 이력 · 이용 제한 · 해제(정상 ↔ 이용 제한, 사유)) · 업체 관리자 관리(`/api/v1/admin-service/manager/account` — 전체 업체의 업체 총관리자 · 업체 관리자 목록 · 상세 · 비밀번호 초기화(임시 비밀번호 SMS). 계정 정지는 없고 정지는 업체 단위 — 업체 상태 변경) · 아이디 로그인 · 비밀번호 변경(첫 총관리자는 `POST /api/v1/admin-service/admin/login` 후 `PATCH /api/v1/admin-service/admin/password` 로 변경). 업체: 총관리자의 입점 신청 목록 · 상세 · 승인(업체 + 업체코드 + 업체 총관리자 계정 + 승인 알림 SMS) · 반려 · 업체 목록 · 상세 · 수정 · 상태 변경(영업중지 사유) · 영업중 여부 변경, 업체 관리자의 내 업체 설정(상세 · 소개 · 사진과 순서 · 요일별 영업시간 · 매일 브레이크타임 · 정비시간 · 영업중 여부 · 예약 · 환불 규정(예약 n시간 전부터 · 환불 마감 n분 · 마감 뒤 환불 비율) · 일시 예약불가), 업체 총관리자의 문 소켓 시크릿 코드 설정(`PATCH /api/v1/admin-service/store/mine/door-secret` — bcrypt 해시로만 저장). 객실: 업체 관리자의 업체 상품 설정(시간 이용 · 1박 · 연박 — 사용 여부 · 예약 가능 요일 · 이용 시간 · 입퇴실 시각(1박은 항상 다음 날 퇴실) · 연박 최소 · 최대 박수 · 연장 가능 여부 · 최대 연장 횟수(1 ~ 10회, 입점 승인 때 연장 가능 · 3회)) · 객실 그룹(상세정보 · 사진과 순서 — 상세는 상품마다 기간 가격 수 · 그룹의 호실 수 · 호실 목록 포함) · 그룹 상품(사용 여부 · 요금) · 상품별 기간 가격 · 호실(그룹은 등록 때만 — 수정으로 바꾸지 않는다) · 호실 상태(정비 완료 · 사용중지) · 호실 목록의 문을 마지막으로 연 시각 · 층 거르기 선택지(내 업체 호실이 있는 층 전부) · 호실 문 바로 열기(`POST /api/v1/admin-service/room/:room_id/door-open` — 예약 상태와 상관없이 언제든, 문 열림 기록(`t_door_open_log` · 연 사람)을 남기고 연 시각을 쓰고 문 소켓으로 열기 명령, 열림 · 닫힘 상태는 없다). 예약이 걸려 있는 호실 · 그룹은 지울 수 없다. 업체 예약: 업체 관리자의 예약 현황(마지막 이용 중 취소 요청 상태 포함) · 업체 취소(시작 전 예약만 — 100% 환불 + SMS) · 호실 이동(같은 그룹 + SMS) · 이용 중 취소 요청(`POST /api/v1/admin-service/reservation/:reservation_id/use-cancel-request` — 예약자에게 승인 링크 SMS, 10분 안에 승인하면 전액 환불 취소 · 호실 정비중) — `/api/v1/admin-service/reservation`. 통계(조회만 — 월 단위 기간(기본 이번 달 포함 최근 3개월, 최대 12개월) · 결제 환경 LIVE · TEST): 총관리자 · 관리자는 `GET /api/v1/admin-service/stats` 로 합계 · 월별 · 업체별(이용자 수 · 이용 건수 · 결제액 · 환불액 · 수익 — 기본 기간 안 활동이 있는 업체, `has_activity=0` 이면 모든 업체, 수익 순 · 페이지), 업체 관리자는 `GET /api/v1/admin-service/stats/mine` 으로 자기 업체만. 이용자 수 · 이용 건수는 이용 끝이 기간 안인 이용 완료 예약, 결제액은 승인 시각, 환불액은 환불 신청 시각 기준(한국 달). user-service 와 같은 DB 를 직접 쓴다.
- 아이디 · 휴대폰 번호는 로그인 그룹(이용자 · 매니저 · 관리자) 안에서만 겹치지 않는다. 매니저 그룹은 업체 안에서만 — 다른 업체면 같은 아이디를 쓸 수 있고, 로그인 때 업체코드(매니저 화면 주소에 들어 있다)를 함께 받는다.

- **외부 연동** — 발송은 SMS 하나(Amazon SNS), 업체 정보 파일 · 객실 사진은 Amazon S3(presigned URL 로 클라이언트가 직접 업로드) — 공개 파일(업체 · 객실 사진)은 CloudFront(CDN) 주소(admin-service · user-service 업체 둘러보기 · 입점 신청 — `AWS_S3_PUBLIC_URL`), 비공개 파일(사업자등록증)은 10분짜리 서명 주소로 본다. 결제는 토스페이먼츠(결제창 · 승인은 프론트, 서버는 토스 조회로 검증 · 환불 — 환불은 scheduler 가 백그라운드로, 전액 또는 일부 — [docs/guides/toss-setup.md](docs/guides/toss-setup.md)). mock 없이 실제 서비스에 붙는 코드이고, AWS 세팅은 [docs/guides/aws-setup.md](docs/guides/aws-setup.md) 를 따른다. AWS 값을 비워 두면 AWS 없이 돈다 — SMS 는 보내지 않고 받는 번호 · 본문을 로그에 남기고(인증번호 · 임시 비밀번호는 로그에서), 파일은 게이트웨이 내부 파일 저장소(`/files` — 서명된 업로드 주소 · 같은 PUT 방식)에 올린다(가이드의 "AWS 없이 돌리기"). 테스트 데이터 사진은 게이트웨이 `/sample/` — [docs/guides/sample-data.md](docs/guides/sample-data.md).
- **프론트** — 별도 저장소(Next.js 앱 하나 — 이용자 `/` · 업체 관리자 `/manager` · 관리자 `/admin`). 인계 자료는 [.beaver/output/frontend/](.beaver/output/frontend/README.md) — 화면 설계 아티팩트 3개(링크) · 화면 목록과 구성 · API 목록과 호출 방식 · DTO 사본. 공개 API · 사용자에게 보이는 동작이 바뀌면 같은 변경에 `changes/` 수정 요청 문서를 만든다(AGENTS.md "프론트 연계").

## 문 소켓

문 쪽 타 업체 프로그램(문 하드웨어를 다루는 프로그램)이 업체 단위로 게이트웨이에 붙는 표준 WebSocket 이다. HTTP 문 열기 · 닫기 API 는 없다 — 문이 QR 을 읽으면 이 소켓으로 묻고, 서버가 Redis 의 현재 QR 과 비교한다. 상세: [docs/realtime.md](docs/realtime.md).

- 접속: `ws://<gateway>/ws/v1/door`, 헤더 `x-store-id`(업체 ID) · `x-store-secret`(업체 총관리자가 정한 시크릿 코드). 틀리면 업그레이드 전에 HTTP 401.
- 메시지는 JSON 한 개 `{"event": …, "data": …}`.

| event | 방향 | data | 설명 |
|---|---|---|---|
| `door.snapshot` | 서버 → 문 | `{store_id, list: [{room_id, room_name, floor}]}` | 접속 직후 업체 호실 전체 |
| `door.verify` | 문 → 서버 | `{room_id, qr}` | 문이 읽은 QR 확인 요청 |
| `door.verified` | 서버 → 문 | `{room_id, ok}` | 확인 결과(그 연결에만). ok 면 문을 연다(서버는 QR 로 연 기록을 DB 에 남긴다) |
| `door.open` | 서버 → 문 | `{room_id}` | 업체 관리자의 바로 열기 명령(그 업체 연결 모두) |
| `error` | 서버 → 문 | `{status_code, message}` | 받은 메시지를 처리하지 못했다(연결은 유지) |

- 연결 유지: 서버가 30초마다 ping, pong 이 없으면 끊는다. 재연결은 문 프로그램이 한다.
- 업체 총관리자가 시크릿을 바꾸면 그 업체 연결을 모두 끊는다(종료 코드 1008) — 새 시크릿으로 다시 붙는다.
- 서버는 열림 · 닫힘 상태를 두지 않고 문마다 마지막으로 연 시각만 둔다(Redis `door-opened:<room_id>` = 한국 시각 `yyyyMMddHHmmss` — QR 확인이 맞았거나 업체 관리자가 바로 열기를 한 때). 닫기 · 잠금 알림은 받지 않는다(보내면 `error` 400).

스택: Node.js 24 LTS(24.22.1 이상 — Docker 이미지 `node:24.22.3-slim`) · NestJS 12 (ESM) · TypeORM 1.x + PostgreSQL 17 · RabbitMQ 4 · Redis 8(node-redis) · AWS SDK v3(SNS · S3) · 토스페이먼츠(fetch) · Vitest 5 · oxlint.
규약과 구조는 [AGENTS.md](AGENTS.md) 와 [docs/](docs/) 를 본다.

## 실행

### 1. 준비 — `.env`

```bash
cp .env.example .env
```

`.env.example` 에는 **로컬 실행용 기본값**이 들어 있어 그대로 복사하면 바로 뜬다(AWS 없이 — SMS 는 로그, 파일은 게이트웨이 내부 저장소 · 테스트 데이터 포함, 프론트 `http://localhost:5000` · 게이트웨이 `http://localhost:3000`). 서버에 올릴 때는 아래를 바꾼다.

| 서버에서 바꿀 값 | 내용 |
|---|---|
| `JWT_SECRET` · `BCRYPT_CODE` · `TOKEN_CIPHER_KEY` · `INTERNAL_API_TOKEN` | 인증 · 암호화 비밀값 — 새로 만든다(만드는 법은 `.env.example` 주석) |
| `RABBITMQ_GATEWAY_PASSWORD` · `RABBITMQ_USER_SERVICE_PASSWORD` · `RABBITMQ_ADMIN_SERVICE_PASSWORD` · `POSTGRES_PASSWORD` · `RABBITMQ_PASSWORD` | 브로커 · DB 계정 비밀번호 |
| `REDIS_PASSWORD` · `REDIS_URL` | Redis 비밀번호 — `REDIS_URL` 안의 비밀번호와 같게 |
| `SEED_SAMPLE_DATA` | `0` — 운영 DB 에 테스트 데이터를 넣지 않는다 |
| `CORS_ORIGINS` · `GATEWAY_PUBLIC_URL` · `USER_WEB_URL` | 프론트 · 게이트웨이 · 이용자 화면의 실제 주소 |

- `.env` 하나가 곧 서버 설정이다. Docker 는 값을 바꾸지 않고 그대로 쓰며, 필수값이 비어 있으면 띄우지 않는다.
- AWS 값(`AWS_REGION` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `AWS_S3_BUCKET` · `AWS_S3_PUBLIC_URL`)은 비워도 된다 — 키가 비면 SMS 는 보내지 않고 로그에 남기고, 버킷이 비면 파일은 게이트웨이 내부 파일 저장소(폴더 `FILE_STORAGE_DIR`, 기본 `storage/files` · Docker 는 공용 볼륨 `deskless-files`)에 올린다. S3 를 쓰려면 버킷 · `AWS_S3_PUBLIC_URL`(CloudFront 배포 주소)을 채운다 — S3 로 바꿔도 이미 올린 사진은 그대로 열린다(파일마다 저장소 `file_storage` 를 적어 두어, 내부 저장소 파일은 계속 게이트웨이 `/files` 로 나간다 — 볼륨을 지우지 않는다) — [docs/guides/aws-setup.md](docs/guides/aws-setup.md).
- 게이트웨이 공개 주소(`GATEWAY_PUBLIC_URL` — 브라우저가 게이트웨이에 닿는 주소, 예: `http://localhost:3000`)는 내부 파일 저장소의 업로드 · 사진 주소와 테스트 데이터 사진 주소의 기준이다. 버킷을 비우거나 테스트 데이터를 쓰면 채운다.
- 테스트 데이터(`SEED_SAMPLE_DATA=1`)를 켜면 user-service 가 부팅할 때 서울 업체 10곳 · 객실 · 업체 총관리자 10명 · 이용자 1명을 넣는다(개발 · 테스트 DB 만) — 계정 · 업체코드는 [docs/guides/sample-data.md](docs/guides/sample-data.md).
- 토스 시크릿 키(`TOSS_SECRET_KEY`)도 비워도 서버는 뜬다 — 예약 생성 · 결제 확인 · 환불만 실패한다(user-service · scheduler 가 쓴다). 테스트 키 받는 법 · 시험 순서는 [docs/guides/toss-setup.md](docs/guides/toss-setup.md).
- 이용자 화면 주소(`USER_WEB_URL` — 프론트 주소)는 SMS 링크의 기준이다. 비우면 서버는 뜨고 scheduler 의 QR 확인 링크 SMS 만 보내지 않으며, 이용 중 취소 요청(admin-service)은 503 이다. SMS 는 user-service · admin-service · scheduler 가 쓴다(scheduler 에도 AWS 키를 넘긴다).

### 2. 전체 실행 (Docker)

```bash
npm run docker:up     # 아래 묶음을 순서대로 빌드 + 실행
npm run docker:down   # 모두 내림 (공용 네트워크 · 데이터 볼륨 · 파일 볼륨은 남는다)
```

| 순서 | 묶음 | 명령 | 하는 일 |
|---|---|---|---|
| 1 | 공용 네트워크 · 볼륨 | `npm run docker:network` | 묶음끼리 이름으로 찾는 네트워크 5개(모니터링 내부망 `deskless-monitoring` 포함) + 내부 파일 저장소 볼륨 `deskless-files` — 선언은 `compose.shared.yml` 한곳(각 묶음이 include, 이 명령도 그 파일을 읽어 만든다), 이미 있으면 건너뜀 |
| 2 | postgres | `npm run docker:postgres` | DB (127.0.0.1:5432) |
| 3 | rabbitmq | `npm run docker:rabbitmq` | 브로커 + 앱별 계정 초기화 (관리 화면 http://localhost:15672) |
| 4 | redis | `npm run docker:redis` | 문 정보 저장소 (127.0.0.1:6379, AOF 영속 — gateway · user-service · admin-service · scheduler 가 쓴다) — [docs/guides/redis-setup.md](docs/guides/redis-setup.md) |
| 5 | user-service | `npm run docker:user-service` | 마이그레이션 1회 → 인스턴스 N대 → 로드밸런서 |
| 6 | admin-service | `npm run docker:admin-service` | 매니저 · 관리자 인스턴스 → 로드밸런서 |
| 7 | scheduler | `npm run docker:scheduler` | crontab 전용 (포트 없음) |
| 8 | gateway | `npm run docker:gateway` | 외부 진입점 http://localhost:3000 · Swagger http://localhost:3000/swagger (Authorize 왼쪽 도메인 선택 상자로 한 도메인만 보기) |
| 9 | monitoring | `npm run docker:monitoring` | Prometheus · Grafana(http://localhost:3001 — 한국어 화면 · 홈이 서비스 부하 대시보드, 인프라 대시보드) · PostgreSQL · Redis 수집기 — `.env` 의 `GRAFANA_ADMIN_PASSWORD` · `MONITORING_DATABASE_URL` 필요(비면 `docker:up` 이 이 단계에서 멈춘다 — 앞의 묶음은 이미 떠 있다) — [docs/monitoring.md](docs/monitoring.md) |

- 묶음마다 compose 파일이 따로 있어 하나씩 띄우고 내릴 수 있다(`npm run docker:<묶음>`). 로그는 `npm run docker:logs:<앱>`.
- gateway · user-service 는 여러 대(`GATEWAY_REPLICAS` · `USER_SERVICE_REPLICAS`, 기본 2), admin-service 는 `ADMIN_SERVICE_REPLICAS`(기본 1)로 뜨고 앞에 nginx 로드밸런서가 붙는다. scheduler 는 `SCHEDULER_REPLICAS`(기본 1)이고 포트 · 로드밸런서가 없다.
- user-service · admin-service 는 게이트웨이만 닿는다(전역 내부 토큰 가드 + internal 네트워크). 큐 명령도 gateway 브로커 계정이 발행한 것만 처리한다.
- 마이그레이션은 `migrate` 컨테이너(user-service 묶음)가 인스턴스보다 먼저 1회 적용한다. 적용 계정에는 PostgreSQL 확장 `btree_gist`(기간 가격 · 예약 점유 겹침 배타 제약) 생성 권한이 필요하다(RDS PostgreSQL 13+ 는 DB 의 CREATE 권한). admin-service 는 같은 DB 를 쓰므로 user-service 묶음 뒤에 띄운다.
- **모니터링** — 앱 인스턴스마다 지표 전용 포트(Docker 안 9464 · `/metrics`, 모니터링 내부망에서만)를 열고, Prometheus 가 Docker DNS 로 인스턴스를 모두 찾아 모은다(`--scale` 을 저절로 따라감). Grafana "서비스 부하" 에서 서비스별 부하율(이벤트 루프 사용률)을 시간대별로 보고 인스턴스 수를 정한다(증설 기준 — [docs/monitoring.md](docs/monitoring.md)). 다른 프로젝트(프론트 등)를 붙일 때는 [docs/guides/monitoring-integration.md](docs/guides/monitoring-integration.md) 를 넘긴다. 내리기 `docker compose -f compose.monitoring.yml down`.
- 같은 휴대폰 번호의 하루 인증 SMS 수는 `SMS_VERIFICATION_DAILY_LIMIT`(기본 10), DB 연결 풀 대기 최대 시간은 `DATABASE_CONNECTION_TIMEOUT_MS`(기본 30000ms — 넘기면 500).

### 3. 로컬 개발 — 인프라만 Docker, 앱은 watch

```bash
node -v                     # v24.22.1 이상(24 LTS)
npm install
npm run docker:infra        # 공용 네트워크 + postgres + rabbitmq(+계정 초기화) + redis
npm run db:migrate
npm run start:user-service  # :3010
npm run start:admin-service # :3020
npm run start:gateway       # :3000
npm run start:scheduler     # crontab (포트 없음)
```

- 같은 `.env` 를 쓰려면 hosts 파일에 `127.0.0.1 postgres rabbitmq redis` 를 넣는다(인프라 묶음의 포트가 127.0.0.1 에 열려 있다).

### 4. 운영으로 옮길 때

- compose 는 그대로 두고 `.env` 의 접속정보만 바꾼다 — DB `DATABASE_URL`(RDS 등) · 브로커 `RABBITMQ_HOST`(Amazon MQ 등) · Redis `REDIS_URL`(ElastiCache 등, TLS 면 `rediss://`). 바꾼 인프라의 묶음(postgres · rabbitmq · redis)은 띄우지 않는다.
- 올리기 전 확인: `NODE_ENV=production`(development 는 JWT 만료를 검사하지 않는다) · 비밀값 새로 생성 · `POSTGRES_PASSWORD` · `RABBITMQ_PASSWORD` · `REDIS_PASSWORD` 변경 · `CORS_ORIGINS` 를 실제 프론트 주소로.
- 자세한 구성: [docs/architecture.md](docs/architecture.md) 의 "실행 (Docker)" · Redis: [docs/guides/redis-setup.md](docs/guides/redis-setup.md) · AWS: [docs/guides/aws-setup.md](docs/guides/aws-setup.md) · 토스: [docs/guides/toss-setup.md](docs/guides/toss-setup.md) · 테스트 데이터: [docs/guides/sample-data.md](docs/guides/sample-data.md).

## 명령

| 명령 | 내용 |
|---|---|
| `npm test` | 전체 테스트 (Vitest) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` · `npm run format` | oxlint · Prettier |
| `npm run build` | 세 앱 빌드 → `dist/apps/<app>/apps/<app>/src/main.js` |
| `npm run start:prod:gateway` · `start:prod:user-service` · `start:prod:scheduler` | 빌드 산출물 실행 |
| `npm run db:migrate` · `db:revert` | 마이그레이션 적용 · 마지막 1건 되돌리기 (실제 DB) |
| `npm run db:generate -- <Name>` · `db:check` | 엔티티 변경분 마이그레이션 생성 · 일치 검사 (DB 없이 PGlite) |
| `npm run docker:up` · `docker:down` | 모든 묶음(모니터링 포함) 실행 · 종료 — 내릴 때는 모니터링 · gateway 부터 |
| `npm run docker:network` | 공용 Docker 네트워크 5개 · 파일 볼륨 만들기 (이미 있으면 건너뜀) |
| `npm run sample:images` | 테스트 데이터 사진(PNG 70개) 다시 그리기 → `apps/gateway/src/assets/sample/` |
| `npm run docker:postgres` · `docker:rabbitmq` · `docker:redis` · `docker:user-service` · `docker:admin-service` · `docker:scheduler` · `docker:gateway` | 묶음 하나만 실행 |
| `npm run docker:infra` | 공용 네트워크 · postgres · rabbitmq(+계정 초기화) · redis 만 실행 (앱 로컬 개발용) |
| `npm run docker:logs:gateway` · `docker:logs:user-service` · `docker:logs:admin-service` · `docker:logs:scheduler` | 앱 · 로드밸런서 로그 |
| `npm run docker:monitoring` · `docker:logs:monitoring` | 모니터링 묶음(Prometheus · Grafana · 수집기) 실행 · 로그 |
| `npm run broker:check` | 브로커 계정 권한 점검 (gateway 만 명령 발행 · user_id 위조 거부) |

## 구조

```
apps/gateway   apps/user-service   apps/admin-service   apps/scheduler   # 진입점 · 이용자 기능 · 업체 관리자/관리자 전용 기능 · crontab 전용
apps/gateway/src/modules/door-socket/   # 문 소켓(표준 WebSocket /ws/v1/door)
apps/gateway/src/modules/local-file/    # 내부 파일 저장소 경로(/files — 받기는 AWS_S3_BUCKET 이 빌 때, 읽기는 늘)
apps/gateway/src/assets/sample/         # 테스트 데이터 사진(/sample/ — scripts/sample-images.mjs 가 그림)
libs/account  libs/common  libs/contracts  libs/database  libs/integration  libs/messaging  libs/monitoring
compose.<묶음>.yml  compose.shared.yml   # 묶음 8개(따로 띄움) · 공용 네트워크 · 볼륨 선언 한곳(include — 새 공용 리소스는 여기에만)
libs/database/src/entities/<domain>/   libs/database/src/migrations/
libs/integration/src/sms/  libs/integration/src/storage/  libs/integration/src/redis/  libs/integration/src/door/  libs/integration/src/payment/   # SMS(SNS — 키가 비면 로그) · 파일 저장(S3 — 버킷이 비면 내부 파일 저장소, 읽기 · 삭제는 파일 행의 저장소) · Redis 연결 · 문 정보(Redis) · 결제(토스) 포트 · 어댑터
libs/database/src/seeder/                # 기본 데이터 시드 · 테스트 데이터(sample-seed.* — SEED_SAMPLE_DATA=1)
libs/monitoring/src/       # 지표 모듈(MonitoringModule — 앱마다 지표 전용 포트 /metrics, prom-client)
docker/prometheus/  docker/grafana/   # 모니터링 설정 — 수집 대상 · 기록 규칙, 데이터 원본 · 대시보드 JSON(파일이 원본)
docs/  docs/guides/        # 규약 · AWS · Redis · 토스 세팅 · 테스트 데이터 · 모니터링 연결 규격 가이드
storage/                   # 내부 파일 저장소(로컬 실행의 업로드 파일 — git 제외)
.beaver/output/frontend/   # 프론트 인계(아티팩트 링크 · screens · api · dto · design 원본 · changes 수정 요청)
.back/              # NestJS 11 시절 코드 (이식 참고용, git 제외 · 로컬 전용)
```

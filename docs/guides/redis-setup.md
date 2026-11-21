# Redis 세팅 · 실행 가이드

> 문 정보(호실의 현재 QR · 문을 마지막으로 연 시각)와 문 명령 채널을 둔다 — 열림 · 닫힘 상태는 두지 않는다(사용자 결정 2026-11-19). 쓰는 앱은 넷이다 — gateway(문 소켓의 바로 열기 · 연결 끊기 명령 구독) · user-service(문 소켓 QR 확인 + 연 시각 · 내 예약 QR · 사용중지 호실 취소 · 이용 중 취소 승인 때 QR 지우기) · admin-service(호실 목록의 연 시각 · 바로 열기 · 시크릿 변경 때 소켓 끊기) · scheduler(이용 시작 · QR 동기화).
> QR 이력은 DB(`t_room_qr`)에 있어 비거나 지워져도 scheduler 가 매분 현재 QR 을 다시 쓰지만, 마지막으로 연 시각은 Redis 에만 있다 — 영속(AOF · 백업)을 켠다.

## 1. 로컬 · 가상 운영 — Docker 묶음

1. `.env` 에 값을 둔다(`.env.example` 의 Redis 절).
   - `REDIS_PASSWORD` — Redis 컨테이너 비밀번호. 서버에서는 반드시 바꾼다.
   - `REDIS_PORT` — 호스트(127.0.0.1)에 여는 포트, 기본 6379.
   - `REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379` — 앱이 접속할 주소. 비밀번호를 위와 같게 둔다(`@` `:` `/` 가 있으면 URL 인코딩).
2. 띄운다.
   ```bash
   npm run docker:network   # 처음 한 번 — 공용 네트워크
   npm run docker:redis     # compose.redis.yml — healthy 까지 기다린다
   ```
   `npm run docker:infra` · `npm run docker:up` 도 redis 를 함께 띄운다.
3. 확인한다.
   ```bash
   docker exec deskless-redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'   # PONG
   ```
   각 앱 로그에 `Redis 연결됨` 이 보이면 붙은 것이다.
4. 앱을 로컬(`npm run start:*`)로 돌리면 hosts 파일에 `127.0.0.1 redis` 를 넣는다(postgres · rabbitmq 와 같은 줄에 둬도 된다).
5. 내린다 — `docker compose -f compose.redis.yml down`(데이터는 볼륨 `deskless-redis-data` 에 남는다). 데이터까지 지우려면 `docker volume rm deskless-redis-data`.

- 비밀번호를 바꿀 때는 `.env` 의 `REDIS_PASSWORD` 와 `REDIS_URL` 을 함께 바꾸고 `docker compose -f compose.redis.yml up -d --force-recreate` 후 Redis 를 쓰는 앱(gateway · user-service · admin-service · scheduler)을 다시 띄운다.
- 영속: `appendonly yes` · `appendfsync everysec` — 최대 1초 분량만 잃을 수 있다.

## 2. 실제 운영 — Amazon ElastiCache (Redis OSS · Valkey)

- **클러스터 모드는 끈다**(샤드 1개 + 복제본) — QR 확인 Lua 스크립트가 두 키(`door-qr:` · `door-opened:`)를 함께 쓰고, 바로 열기는 같은 스크립트에서 PUBLISH 하므로 한 노드에 있어야 한다.
- 전송 중 암호화(TLS) + AUTH 토큰(또는 RBAC 사용자)을 켜고, 보안 그룹은 gateway · user-service · admin-service · scheduler 에서 오는 6379 만 연다.
- 자동 백업(스냅샷)을 켠다 — 마지막으로 연 시각은 Redis 에만 있다(현재 QR 은 scheduler 가 다시 쓴다).
- `.env`: `REDIS_URL=rediss://:<AUTH 토큰>@<기본 엔드포인트>:6379` (TLS 는 `rediss://`). `compose.redis.yml` 묶음은 띄우지 않는다 — 앱 쪽 설정은 그대로다.

## 3. 저장 모양 — 확인 · 디버깅

| 키 | 값 | 예 |
|---|---|---|
| `door-qr:<room_id>` | 그 호실의 현재 QR (만료 = QR 유효 끝) | `9f3c…e1` — 이용 끝 시각에 저절로 사라진다 |
| `door-opened:<room_id>` | 문을 마지막으로 연 시각 (한국 시각 yyyyMMddHHmmss, 만료 없음) | `20261119143005` — QR 확인이 맞았거나 바로 열기를 한 때. 연 적 없으면 키가 없다 |
| 채널 `door-commands` | `{"store_id", "room_id", "command": "open"}` · `{"store_id", "command": "disconnect"}` | 업체 관리자의 바로 열기 → 그 업체 소켓에 `door.open` / 업체 문 시크릿 변경 → 그 업체 소켓을 모두 끊기 — gateway 가 구독한다 |

```bash
docker exec -it deskless-redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli'
GET door-qr:<room_id>
GET door-opened:<room_id>
PTTL door-qr:<room_id>        # 남은 유효 시간(ms)
SCAN 0 MATCH door-qr:* COUNT 100
SUBSCRIBE door-commands       # 바로 열기 명령 지켜보기
```

- 옛 문 상태 키(`door:<room_id>` = `open|close:시각`)는 더 쓰지 않는다(2026-11-19). 남아도 코드가 읽지 않고, 지우려면 `SCAN 0 MATCH door:* COUNT 100` 으로 찾아 `DEL` 한다 — `door-qr:*` · `door-opened:*` 는 지우지 않는다(`door:` 가 아니라 `door-` 로 시작한다).
- QR 은 이용 시간이 된 예약에만 있다 — 이용자가 내 예약 QR 을 열 때나 scheduler 가 매분 돌 때 DB(`t_room_qr`)에서 발급 · 확인하고 이 키를 다시 쓴다. 업체가 이용 중 예약을 취소하면 지운다.

## 4. 문제 해결

| 증상 | 확인 |
|---|---|
| 호실 목록 · 바로 열기 · 내 예약 QR · 문 소켓 QR 확인이 503 `상태 저장소에 연결할 수 없습니다` | Redis 가 떠 있는지(`docker ps`), `REDIS_URL` 주소 · 비밀번호, 같은 네트워크(`deskless-data`)인지, 그 앱 로그의 `Redis 오류` |
| 바로 열기는 200 인데 문 프로그램에 `door.open` 이 안 간다 | gateway 로그의 `Redis 구독 실패` · gateway 가 `deskless-data` 에 붙어 있는지, `SUBSCRIBE door-commands` 로 메시지가 나가는지 |
| 문 소켓 `door.verified` 가 계속 `ok: false` | `GET door-qr:<room_id>` 가 비었으면 이용 시간이 아니거나 QR 이 아직 안 쓰였다 — 내 예약 QR 을 한 번 열거나 scheduler 다음 회차(1분)를 기다린다 |
| 부팅 경고 `REDIS_URL 이 비어 있어` | `.env` 의 `REDIS_URL` |
| 로그에 `WRONGPASS` · `NOAUTH` | `REDIS_URL` 의 비밀번호가 `REDIS_PASSWORD` 와 다르다 |
| 로컬 실행에서 `getaddrinfo ENOTFOUND redis` | hosts 파일에 `127.0.0.1 redis` |

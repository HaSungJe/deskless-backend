# Revision — monitoring-dashboard — 261122-1

> Change plan for an existing feature. The original spec.md / plan.md are not modified, only referenced.

## Reason for Change Request
사용자 요청(2026-11-22, build 뒤 · ship 전 — "이번 작업에 포함해서 같이") — 모니터링 내부망을 붙이며 `networks: monitoring: {name, external}` 블록이 compose 파일마다 늘었다. 공용 네트워크 · 볼륨 선언을 **한곳**에 모아 앞으로 새 공용 리소스를 더할 때 그 파일만 고치게 한다.

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| 공용 네트워크 · 볼륨 선언 | compose 파일 8개가 각자 쓰는 external 네트워크(`edge` · `service` · `broker` · `data` · `monitoring`) · 볼륨(`files`)을 3줄씩 선언 | **`compose.shared.yml` 한곳** — 각 묶음은 맨 위 `include: [compose.shared.yml]` 로 불러와 서비스에서 키로만 쓴다. 묶음 전용(로컬) 네트워크 · 볼륨(DB 데이터 · `default`)은 그 묶음 파일에 그대로 |
| 만드는 쪽 | `scripts/docker-network.mjs` 의 `NETWORKS` · `VOLUMES` 상수(선언과 두 군데) | `docker-network.mjs` 가 **`compose.shared.yml` 을 읽어** 만든다 — `x-internal`(internal 망 여부) · `x-purpose`(설명) 확장 필드. 상수 삭제 |
| 새 공용 리소스를 더할 때 | 스크립트 상수 + 쓰는 묶음마다 선언 | `compose.shared.yml` 에 한 항목 + 쓰는 서비스의 `networks:` 에 키 |
| 실행 · 동작 | — | 그대로(네트워크 · 볼륨 이름 · internal 설정 같음, `docker compose config` 결과의 네트워크 · 볼륨 같음) |

## 결정
- [x] **`include`**(Compose 2.20+ — 이 PC v2.34) — 같은 키를 묶음 파일에 다시 선언하면 충돌하므로 묶음 파일에서는 공용 선언을 모두 뺀다. 시험: 공용 파일을 include 한 묶음의 `config` 에 external 네트워크 · 볼륨 · `x-` 필드가 그대로 들어간다(scratchpad).
- [x] **스크립트는 YAML 파서 없이 이 파일의 정해진 모양만 읽는다** — `docker:network` 는 Node 내장만 쓰는 시작 스크립트라(서버에서 `npm install` 전에도 돈다) 의존성을 늘리지 않는다. `docker compose config` 는 서비스가 쓰지 않는 네트워크를 빼고 JSON 에서는 `x-` 필드를 지워 쓸 수 없다. 모양(들여쓰기 4칸 · 항목마다 `name` · `x-internal` · `x-purpose`)은 파일 머리 주석에 적고, 못 읽으면 스크립트가 바로 멈춘다(빈 목록으로 조용히 넘어가지 않는다).
- [x] **볼륨도 같이** — `deskless-files` 는 같은 스크립트가 만드는 공용 볼륨이라 같은 파일에 둔다(이름이 `compose.shared.yml` 인 이유).

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `compose.shared.yml` | add | 공용 네트워크 5개 · 볼륨 1개 선언 + 형식 주석 |
| `compose.{postgres,rabbitmq,redis,user-service,admin-service,scheduler,gateway,monitoring}.yml` | modify | `include: [compose.shared.yml]`, 공용 선언 삭제(묶음 전용 선언은 그대로), 머리 주석의 네트워크 설명은 그대로 |
| `scripts/docker-network.mjs` | modify | `NETWORKS` · `VOLUMES` 상수 → `readSharedResources()`(compose.shared.yml 읽기) |
| `README.md` · `AGENTS.md` · `docs/architecture.md` · `docs/monitoring.md` | modify | 공용 선언 한곳 · 새 공용 리소스 더하는 법 |
| `.beaver/output/report/monitoring/monitoring-dashboard-report.md` | modify | `## Change - 261122-1` |

## Code Changes

```yaml
# compose.shared.yml — new (일부)
networks:
    edge:
        name: deskless-edge
        external: true
        x-internal: false
        x-purpose: 'gateway-lb · gateway (외부 포트는 gateway-lb 만)'
    # … service(x-internal: true) · broker · data · monitoring(x-internal: true)
volumes:
    files:
        name: deskless-files
        external: true
        x-purpose: '내부 파일 저장소(AWS_S3_BUCKET 이 빌 때) — gateway · user-service · admin-service 의 /app/storage/files'
```

```yaml
# compose.user-service.yml — before (끝부분)
networks:
    service:
        name: deskless-service
        external: true
    # … broker · data · monitoring
volumes:
    files:
        name: deskless-files
        external: true
```

```yaml
# compose.user-service.yml — after
name: deskless-user-service
# 공용 네트워크 · 볼륨(edge · service · broker · data · monitoring · files) — 선언은 compose.shared.yml 한곳
include:
    - compose.shared.yml
# (끝의 networks · volumes 블록 없음 — 서비스의 networks: [service, broker, data, monitoring] · volumes: files:… 는 그대로)
```

```js
// scripts/docker-network.mjs — 상수 대신
/**
 * compose.shared.yml 의 공용 네트워크 · 볼륨 — 이 파일의 정해진 모양(들여쓰기 4칸 · 항목마다 name · x-internal · x-purpose)만 읽는다.
 * YAML 파서 없이 읽는 이유: 이 스크립트는 Node 내장만으로 돌아야 한다(서버에서 npm install 전에도 쓴다).
 *
 * @returns 네트워크 · 볼륨 목록
 */
function readSharedResources() {
    const lines = readFileSync(SHARED_FILE, 'utf8').split(/\r?\n/);
    const result = {networks: [], volumes: []};
    let section = null;
    let item = null;
    for (const line of lines) {
        if (/^\s*(#|$)/.test(line)) continue;
        const top = /^(networks|volumes):\s*$/.exec(line);
        if (top) { section = top[1]; item = null; continue; }
        if (/^\S/.test(line)) { section = null; continue; }
        const key = /^ {4}([a-z][\w-]*):\s*$/.exec(line);
        if (section && key) { item = {key: key[1], name: null, internal: false, purpose: ''}; result[section].push(item); continue; }
        const field = /^ {8}(name|x-internal|x-purpose):\s*(.+?)\s*$/.exec(line);
        if (item && field) { … name / internal(=== 'true') / purpose(따옴표 벗김) … }
    }
    // 이름이 없는 항목 · 빈 목록이면 throw — 조용히 넘어가지 않는다
    return result;
}
```

## 테스트
없음 — 스크립트 · compose 설정(인프라, spec 을 두지 않는다). 확인: 바꾸기 전과 후의 `docker compose -f compose.<묶음>.yml config --format json` 에서 묶음마다 네트워크 · 볼륨(이름 · external) 같음(8개), `node scripts/docker-network.mjs` 의 읽기 결과(네트워크 5 · 볼륨 1 · internal 값)를 바꾸기 전 상수와 대조 — 읽기 함수만 따로 돌려 본다(네트워크를 만들지 않는다).

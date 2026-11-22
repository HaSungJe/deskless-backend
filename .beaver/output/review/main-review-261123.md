# Review — main — 261123

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`
- Included features:
  - 서버 부하 대시보드(Prometheus · Grafana) — spec · plan `monitoring/monitoring-dashboard-*`, report `monitoring/monitoring-dashboard-report.md`
  - 공용 네트워크 · 볼륨 선언 한곳(`compose.shared.yml`) — revision `monitoring/monitoring-dashboard-revision-261122-1`(사용자 요청 — 이번 작업에 포함)
  - 프론트 수정 요청 `changes/2026-11-22-monitoring-web.md`(규격 첫 적용 — 코드 · compose · 확인을 문서 안에)
- Change scope: 새 라이브러리 `libs/monitoring` 6파일 · 계측 4곳(디스패처 · 잠금 · DB 풀 · SSE 스트림) · 앱 루트 모듈 4 · compose 9(새 2) · Prometheus · Grafana 설정 6(대시보드 JSON 2) · 스크립트 1 · 문서(README · AGENTS.md · docs 3 · 새 규약 2) · `.env.example` · 의존성 `prom-client` · beaver 산출물 — 약 50 경로, 삭제 없음

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 라이브러리 `libs/monitoring` · 파일 `<kebab>.<role>.ts`(`metrics.service.ts` · `metrics.server.ts` · `http-metrics.middleware.ts` · `monitoring.module.ts` · `monitoring.util.ts` · `monitoring.constants.ts`), 지표 이름 Prometheus 규칙(단위 접미사 · 표준 이름), env snake 대문자 앱 접두(`<APP>_METRICS_PORT` — 기존 `*_PORT` 와 같은 짓기) |
| Structure & layering | pass | 인프라는 libs(`@Module` · `@Injectable`), 순수 함수는 `monitoring.util.ts`(`toRouteLabel` · `toMonitoringOptions` — `readPositiveInt` 재사용), 로그는 인프라 클래스만(`MetricsServer`). 계측은 그 부품 안에 `@Optional()` — 테스트 · 마이그레이션 실행기는 모듈 없이 그대로. 도메인 계층(service · repository · crontab) 변화 없음 |
| Shared logic extraction | pass | crontab 지표는 모든 crontab 이 거치는 `JobLockService` 한 곳(crontab 파일 무변경), HTTP 는 전역 미들웨어 하나, 공용 네트워크 · 볼륨 선언은 `compose.shared.yml` 한 곳(스크립트도 그 파일을 읽음) |
| Errors & responses | pass | API 응답 · 실패 변화 없음. 지표 서버는 앱을 막지 않음(포트 실패 경고 · 수집 실패 500 · 그 밖의 경로 404) |
| Data layer | pass | 엔티티 · 마이그레이션 변화 없음(`db:check` 일치) |
| Test strength | pass | 새 spec 없음 — 라이브러리 · 인프라(규약). 디스패처 리팩터링(판정 본문을 `decide` 로) 뒤 기존 큐 경로 spec 전부 통과. 지표 출력은 일회용 실행으로 확인(서비스 라벨 · 누적 ELU · 라우트 틀 · DB 풀). Data-Access Smoke 대상 쿼리 변화 없음 |
| Docker / .env 규약 | pass | 비밀값 필수(`GRAFANA_ADMIN_PASSWORD` · `MONITORING_DATABASE_URL` — `${VAR:?}`), 앱에는 모니터링 비밀값을 빈 값으로 덮어 전달하지 않음, compose 는 서버 구성(포트 9464 · 0.0.0.0)만 고정, 호스트 포트 127.0.0.1, 이미지 버전 고정(Prometheus v3.16.0 · Grafana 13.2.6 · postgres-exporter v0.20.1 · redis_exporter v1.97.0-alpine — 며칠 사이 나온 태그는 피함) |

## Intended Behavior Check (against plan/spec)
- 진입점 1(앱 지표): 앱 4개 지표 전용 포트(로컬 9464 ~ 9467 · Docker 9464) `/metrics` — 기본 지표 + `nodejs_eventloop_time_seconds` + HTTP · 큐 명령 · crontab · DB 풀 · SSE 대기. scheduler 는 포트만(HTTP 미들웨어 없음).
- 진입점 2(모니터링 묶음): `compose.monitoring.yml` · 내부망 `deskless-monitoring` · DNS 찾기 5개 앱(+ `web`) · RabbitMQ(큐별 detailed + 전체 — 공식 이미지가 플러그인을 기본으로 켬, docker-library 4.2 Dockerfile 307행) · 수집기 2 · 기록 규칙 7 · Grafana 프로비저닝.
- 진입점 3 · 4(대시보드): 서비스 부하 28 패널(서비스 목록은 `label_values` — 붙은 서비스가 저절로, 70% 기준선 · 안내문 · 어제 · 지난주 비교 · 7일 시간대별 막대) · 인프라 22 패널. 데이터 원본 uid 일치 · 패널 ID 겹침 없음.
- 사용자 요청 반영: 프론트 `web` 받을 자리 + 요청 문서(자족), 다른 프로젝트 연결 규격 `docs/guides/monitoring-integration.md`, 공용 네트워크 · 볼륨 선언 한곳(바꾸기 전 · 후 compose 모델 8개 같음).
- plan 과 달라진 점(리포트에 기록): 큐 명령 라벨 `type · outcome`(회신 결과는 `reply_to` 가 없으면 null 이라 판정에서 직접), crontab 라벨 `task`(`job` 은 Prometheus 가 붙이는 이름).
- 규약 초안 확정: `docs/monitoring.md` 지표 목록 7개 · 라벨이 코드와 같음을 대조하고 초안 표시를 지웠다.
- 검사: typecheck 0 · lint 0 · `db:check` 일치 · `npm test` 124 파일 1,376건 · build(네 앱) · compose config 8 · YAML · JSON · prettier.
- 메모리: frontend — 화면 · API 변화는 없지만 프론트 저장소가 할 일(지표 서버)이 있어 수정 요청 문서 + 목록 줄. db-tools — 모니터링 묶음은 사용자가 정한 예외(메모리 갱신함). 메모리 reconcile 대상(`AGENTS.md 반영: 미반영`) 없음.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | 운영(Docker Compose 버전) | `include` 는 Compose 2.20 이상 — 이 PC v2.34 는 되지만 운영 서버는 확인 전 | ship 보고에 확인 안내 |
| 2 | Low | `scripts/docker-network.mjs` `readSharedResources` | YAML 파서 없이 `compose.shared.yml` 의 정해진 모양만 읽는다 — 형식을 벗어나면(한 줄 표기 등) 읽지 못한다 | 그대로 — 못 읽으면 멈추고(조용히 넘어가지 않음) 형식은 파일 머리 주석에 적었다 |
| 3 | Info | 실행 확인 | 지표 서버 · Prometheus 찾기 · 대시보드는 실제로 띄워 봐야 확인된다(Docker 실행은 사용자 몫) | 배포 뒤 Prometheus Targets · Grafana 로 확인 — 보고에 순서 |
| 4 | Info | 배포 | 앱 묶음 · RabbitMQ 를 한 번 다시 띄워야 모니터링 내부망에 붙는다, `.env` 에 모니터링 값 2개 필수 | ship 보고의 배포 순서 |

## Verdict
Pass — 코드 변경이 필요한 문제 없음(Low 2 · Info 2 는 운영 안내). 커밋 진행.

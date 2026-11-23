# Review — main — 261123-2

> Pre-merge code review. Check the accumulated changes against the memory rules, AGENTS.md conventions, and the plan/spec intent.
> Location: `.beaver/output/review/` — `<stick>-review-<YYMMDD>.md` (stick = branch name with `/`→`-`, one per ship unit). For a re-review on the same day, append `-<N>`.

## Target
- stick: `main`(direct 모드 — 워크트리 없음) → origin: `main`
- Included features:
  - 모니터링 대시보드 재설계 — revision `monitoring/monitoring-dashboard-revision-261123-1`(사용자 요청 — 판정 표 중심 · 한국어 이름), report `monitoring/monitoring-dashboard-report.md` 의 `## Modification - 261123-1`
- Change scope: 대시보드 JSON 2(생성기로 다시 만듦) · Prometheus 수집 설정 · 기록 규칙 · `compose.monitoring.yml` · 문서(README · AGENTS.md · `docs/monitoring.md` · 연결 규격) · beaver 산출물(revision · report · spec 보드) — 13 경로, 앱 코드(`apps/` · `libs/`) 변화 없음

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 기록 규칙 이름 Prometheus 규칙(`job:eventloop_utilization:avg15m` — 기존 `level:metric:operation` 꼴), 대시보드 uid · 파일 그대로(링크 · 홈 경로 유지) |
| Structure & layering | pass | 표시 이름은 수집 설정 한곳(`prometheus.yml` relabel — 새 서비스도 그 한 줄, 사용자가 선호한 "한곳 관리"), 큐 · 작업 · DB 상태 이름은 대시보드 쿼리 안(`label_replace` — 모르는 값은 원래 이름이라 깨지지 않음) |
| Shared logic extraction | pass | 판정 · 그래프 · 7일 칸이 같은 기록 규칙(`avg15m`) 하나를 쓴다 — 쿼리마다 15분 평균을 다시 계산하지 않음 |
| Errors & responses | pass | API · 실패 응답 변화 없음 |
| Data layer | pass | 엔티티 · 마이그레이션 변화 없음 |
| Test strength | pass | 새 spec 없음 — 대시보드 · Prometheus 설정은 인프라(규약상 spec 없음). 대신 쿼리 32개를 실행 중인 Prometheus API 로 조회(문법 오류 0 · 한국어 이름 실제 응답 확인), `promtool check rules/config`, `docker compose config` |
| 모니터링 규약 | pass | 라벨 규칙에 `display_name` 을 Prometheus 가 붙이는 이름으로 더함(`job` · `instance` 와 같은 취급 — AGENTS.md · docs 둘 다), 기록 규칙 표 · 대시보드 절 · 연결 규격의 "백엔드가 할 일" 갱신 |
| Docker / .env 규약 | pass | Grafana 환경 값 2개는 비밀이 아닌 고정 구성값(언어 · 홈 경로)이라 compose 에 둔다 — `.env` 변화 없음 |
| 사라진 것 정리(§1.7) | pass | 쓰는 패널이 없어진 기록 규칙 2개(`:max` · `job:process_cpu:rate1m`) 삭제 · 문서에서도 지움, 지난 비교 패널을 가리키던 compose 주석 수정. 대시보드에서만 뺀 지표(지연 · 처리 중 · SSE 대기 · 큐 명령)는 앱이 계속 내므로 지표 목록 유지 |

## Intended Behavior Check (against plan/spec)
- 서비스 부하: 판정 표(서비스 · 대수 · 지금 · 24시간 최고 · 7일 중 70% 넘은 날 · 판정) + 읽는 법 → 시간대별 부하율(15분 평균 · 70% 점선 · 영역) → 최근 7일 × 시간대 칸(status history, 7일 고정) → 접힌 "늘리기 전에 확인" 8개 — revision 표와 같음. 판정 매핑 3일 이상 · 1~2일 · 0일 = 사용자 결정 그대로. 스케줄러는 판정 · 그래프 · 7일 칸에서 제외(`job!="scheduler"`), 자세히의 인스턴스 · CPU · 메모리에는 포함.
- 인프라: 상태 카드 6개(0 → "없음", AOF 1/0 → 정상 / 꺼짐 · 실패) → 큐(서버별 밀린 작업 — 결과 큐 제외) · DB(상태 3개 + 최대 80% 점선 · 커밋 · 롤백 · 서버별 연결) · Redis 3 · 예약 작업 표(작업별 24시간 성공 · 실패 — 실패 없는 작업도 0 으로 나오게 `or … * 0`).
- 공통: 모든 패널 설명, 범례 이름만, 한국어 화면 · 홈.
- revision 과 달라진 점(report 에 기록): 지난 report 머리글 이름 바꾸기는 하지 않음 — spec 보드는 파일 수정 시각으로 미반영을 판단(보드 확인: "수정 2", 미반영 표시 없음).
- 메모리: frontend — 공개 API · 화면 동작 변화 없음, 프론트가 할 일 없음(`web` 표시 이름은 백엔드 설정이 붙임) → 수정 요청 문서 대상 아님. 메모리 reconcile 대상(`AGENTS.md 반영: 미반영`) 없음.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Info | 실행 확인 | Grafana 화면은 아직 띄워 보지 않았다(모니터링 묶음 재시작은 사용자 몫) — 표 · 칸 패널의 실제 모양은 배포 뒤 확인 | 배포 순서대로 다시 띄워 판정 표 · 7일 칸을 본다 — 고칠 게 있으면 다음 회차 |
| 2 | Low | 기존 Prometheus 데이터 | 지난번 넣은 가짜 데이터에는 `display_name` · `avg15m` 이 없어 판정 표에 이름 빈 줄이 생길 수 있다 | Prometheus 볼륨을 지우고 바뀐 가짜 지표 스크립트를 다시 실행(테스트 데이터) |
| 3 | Low | 판정의 하루 경계 | Prometheus 하위 쿼리가 UTC 0시로 끊어 하루 = 한국 오전 9시 ~ 다음 날 오전 9시 | 그대로 — 밤 피크가 하루에 들어가 오히려 맞다, 표 설명 · docs 에 적었다 |
| 4 | Low | `docker/grafana/dashboards/*.json` | prettier 형식이 아니다(생성기 출력 — 들여쓰기 2) | 그대로 — 바꾸기 전과 같은 상태, 생성 파일 |

## Verdict
Pass — 코드 변경이 필요한 문제 없음(Low 3 · Info 1 은 운영 안내). 커밋 진행.

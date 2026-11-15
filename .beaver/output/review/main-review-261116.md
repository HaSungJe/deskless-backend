# Review — main(direct) — 261116

> 머지 전 코드 리뷰. 쌓인 변경을 메모리 규칙 · AGENTS.md 규약 · revision 의도에 대어 본다.

## Target
- stick: `main`(direct 모드) → origin: `main`
- 포함 기능: 토큰 재발급 IP 검사 없앰 — revision [session-ip-check-revision-261116-1](../revision/user/session-ip-check-revision-261116-1.md)(프론트 수정 요청, 기준 afd6c9a)
- 변경 범위: 코드 9개(service 3 · 내부 controller 3 · spec 3 — +41 −52), 문서(revision · report 회차 · 프론트 수정 요청 + 목록)

## Convention Check (against AGENTS.md)
| Item | Result | Notes |
|------|------|------|
| Naming | pass | 이름 변경 없음 |
| Structure & layering | pass | controller 는 위임 한 줄(인자만 줄었다), service 는 검증 순서 유지(JWT → refresh 해시 · 만료 → 세션 존재 → 회원 상태 · 그룹 → 단축 · 체인) |
| Shared logic extraction | pass | 해당 없음 — 세 도메인 service 가 각자 같은 단계를 갖는 기존 구조 그대로(로그인 그룹 = 도메인) |
| Errors & responses | pass | 남은 401 은 같은 `INVALID_TOKEN_MESSAGE`, 응답 · 실패 모양 그대로 |
| Logging | pass | "거부 대신 로그" 를 두지 않음 — 도메인 계층 로그 금지 |
| Dead code | pass | 쓰이지 않게 된 `ip` 인자 · `@ClientIp()` 를 함께 지움(`ClientIp` import 는 로그인이 계속 쓴다). `findSession` 은 세션 존재 확인에 계속 쓰인다 |
| Test strength | pass | 세 spec 에 다른 IP 성공 케이스 — 상태 · 회원 재검증 호출 인자 · 이전 refresh 단축 값 · 새 refresh 1건 단언. 지운 케이스는 바뀐 동작과 어긋나는 것만(다른 IP 401 · IP 없음 생략) |
| README · docs | pass | IP 검사 서술 없음(grep) — 고칠 곳 없음 |
| 프론트 연계 | pass | `changes/2026-11-16-token-refresh-ip.md` + 목록 한 줄(실패 조건 하나 줄어듦 · 프론트 변경 없음 · 백엔드 배포 먼저) |

## Intended Behavior Check (against revision)
- 세 곳 모두 revision 의 after 코드와 같다 — IP 비교 삭제, 세션 존재 확인 유지, `ip` 인자 삭제, JSDoc 한 줄 교체.
- 재발급 보안 유지: refresh 해시 조회 · DB 만료(한 번 쓴 refresh 1분 뒤 끝) · 세션 존재 · 회원 상태 · 그룹 재검증(안전망 단축) — 손대지 않음.

## Memory reconcile
- beaver 메모리(git · api-log · cache · frontend) — 미반영 항목 없음, frontend 규칙대로 수정 요청 문서 작성.

## Findings
| # | Severity | Location (path:line) | Description | Recommendation |
|---|--------|-----------------|------|------|
| 1 | Low | 설계 | 재발급이 IP 로 묶이지 않아 refresh 토큰이 새면 다른 곳에서 쓸 수 있다 — 프론트 요청서가 검토한 대로 refresh 는 httpOnly 쿠키 · 한 번 쓰면 1분 뒤 끝(재사용 차단) · 회원 상태 재검증으로 막는다 | 그대로 둔다(요청 의도) |

## Verdict
Pass — 막는 문제 없음. typecheck · lint · prettier 통과, 테스트 실행은 ship 뒤 `/beaver:test`.

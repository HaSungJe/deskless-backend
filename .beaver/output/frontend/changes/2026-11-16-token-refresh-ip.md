# 토큰 재발급 IP 검사 없앰 — 프론트 수정 요청 반영 (2026-11-16)

- 백엔드: revision `.beaver/output/revision/user/session-ip-check-revision-261116-1.md` · 커밋 2026.11.16
- 반영 순서: 백엔드 배포 먼저 — 프론트는 바꿀 것 없음

## 바뀐 이유
배포 환경에서 로그인(브라우저)과 재발급(Next 서버)의 요청 IP 가 달라 재발급이 401 → 로그인 약 19분 뒤 로그아웃되던 문제(프론트 요청).

## 영향 화면
- 이용자 · 업체 관리자 · 관리자 세 영역의 로그인 유지(재발급)

## API 변경
| 구분 | 메서드 · 주소 | 방식 | 바뀐 점 |
|---|---|---|---|
| 변경 | `POST /api/v1/user-service/user/token-refresh` | 동기 | 요청 IP 를 보지 않는다 — 로그인 때와 IP 가 달라도 401 이 아니다. 주소 · 요청 · 응답 · 실패 모양은 그대로 |
| 변경 | `POST /api/v1/admin-service/manager/token-refresh` | 동기 | 같음 |
| 변경 | `POST /api/v1/admin-service/admin/token-refresh` | 동기 | 같음 |

## 화면 구성과 쓰는 API 의 변경
- 없음. 재발급이 401 이면 지금처럼 로그아웃 처리한다 — 이제 401 은 refresh 만료 · 재사용(한 번 쓴 refresh 는 1분 뒤 끝) · 지워진 세션 · 회원 상태 · 그룹이 맞지 않을 때만 난다.

## 바뀐 DTO
없음.

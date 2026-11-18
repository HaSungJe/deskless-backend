# Report — Swagger 도메인 선택

## Feature Summary
- **Feature**: Swagger 도메인 선택 — 고른 도메인 API만 보기
- **Entry point**: `GET /swagger` (게이트웨이 Swagger 화면)
- **Domain**: gateway (Swagger 화면)

## Created/Modified/Deleted Files
| File | Change Type | Description |
|------|-----------|------|
| `apps/gateway/src/config/swagger.config.ts` | created | `buildSwaggerCustomOptions()` — swagger-ui 플러그인 2개(기본 DownloadUrl 다시 넣기 · 도메인 선택 상자: `AuthorizeBtnContainer` 감싸기 + 정확히 같은 태그 `opsFilter`) · CSS(기본 글자 필터 칸 숨김 · 선택 상자 왼쪽 끝) |
| `apps/gateway/src/main.ts` | modified | `SwaggerModule.setup(…, buildSwaggerCustomOptions())` · 부트스트랩 주석 |
| `docs/api.md` · `docs/architecture.md` · `AGENTS.md` · `README.md` | modified | Swagger 도메인 선택 상자 · `config/swagger.config.ts` · 태그는 도메인마다 겹치지 않는 하나 |

## Tests Written
- 없음 — 게이트웨이 설정 · 화면은 spec 을 두지 않는다(AGENTS.md Testing · 사용자 확인 2026-11-18). 대신 브라우저로 확인했다(아래).

## Verification
- `npm run typecheck` · `npm run lint` · prettier · `npm run build` 통과, `npm test` 124 파일 · 1,360건 통과.
- scratchpad `swagger-tag-preview.mjs` — 빌드된 `buildSwaggerCustomOptions()` 를 `@nestjs/swagger` 의 `buildSwaggerHTML` · `buildSwaggerInitJS`(SwaggerModule.setup 이 쓰는 것)에 넣어 임시 express 로 띄우고(게이트웨이 기동 아님) 앱 브라우저 창에서 확인: 선택 상자 Authorize 왼쪽 끝(left 20 · 버튼 835) · 기본 전체 · 목록 전체 + 태그 4개(회원 · 업체 둘러보기 · 업체 · 업체 예약) · "업체" → 업체 묶음만(업체 둘러보기 · 업체 예약 숨김) · 고른 뒤에도 목록 그대로 · 기본 글자 필터 칸 안 보임 · "전체" → 모두 · Authorize 인증 창 정상 · 콘솔 오류 없음.
- 계획과 달라진 한 곳: 처음 화면에서 선택 상자가 Authorize 옆에 붙었다 — 그 줄(`.schemes`)이 실제로는 오른쪽 정렬(`justify-content: flex-end`)이었다. 선택 상자 CSS 에 `margin-right:auto` 를 더해 왼쪽 끝으로 — plan 코드도 같이 고쳤다.

## Remaining Issues
- 배포는 사용자 몫 — gateway 새 이미지(`npm run docker:gateway`). 실제 게이트웨이 Swagger(`/swagger`)에서 태그 11개로 한 번 더 보면 된다.
- 선택은 화면을 새로 열면 "전체"로 돌아간다(기억하지 않음 — spec 결정).

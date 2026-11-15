# Revision — 세션 IP 검사(session-ip-check) — 261116-1

> 원래 spec · plan(`.beaver/output/spec/user/session-ip-check-spec.md` · `plan/user/session-ip-check-plan.md`)은 고치지 않고 참고만 한다. 세 로그인 그룹(이용자 · 매니저 · 관리자)의 토큰 재발급이 같은 검사를 갖고 있어 셋을 함께 고친다.

## Reason for Change Request
프론트 수정 요청(기준 커밋 afd6c9a): 배포 환경에서 로그인은 브라우저가, 재발급은 Next 서버가 부른다(refresh 토큰이 httpOnly 쿠키라 브라우저 JS 가 읽지 못한다) → 세션에 저장된 브라우저 IP 와 재발급 요청의 Next 서버 IP 가 달라 401 → 로그인 약 19분 뒤 세 영역 모두 로그아웃. 모바일 · 와이파이 전환만으로도 IP 가 바뀌어 같은 일이 난다. 로컬은 모두 localhost 라 재현되지 않는다.

## Spec Before → After

| Item | Before | After |
|------|--------|-------|
| 재발급 검증 순서 | JWT 검증 → refresh 해시 조회 · DB 만료 → 세션 조회 + **IP 비교(다르면 401)** → 회원 상태 · 그룹 재검증 → 이전 refresh 1분 단축 · 새 refresh 체인 | JWT 검증 → refresh 해시 조회 · DB 만료 → **세션 조회(없으면 401 — 그대로)** → 회원 상태 · 그룹 재검증 → 이전 refresh 1분 단축 · 새 refresh 체인 |
| IP 불일치 | 401 `유효하지 않은 토큰입니다.`(만료 단축 없음) | 검사하지 않음 — 정상 재발급 |
| 세션 없음(지워진 세션) | 401 | 401(그대로) |
| 로그인 · 가입 때 `t_session.ip` 저장 | 저장 | 저장(기록용 — 그대로) |
| service `tokenRefresh` · 내부 controller 의 `ip` 인자 | `@ClientIp() ip` 를 받아 넘김 | 없앤다 — 쓰는 곳이 없다(도메인 계층은 로그를 남기지 않아 "거부 대신 로그" 도 두지 않는다 — AGENTS.md 로깅) |
| 공개 API(주소 · 요청 · 응답 · 실패 모양) | — | 그대로. 401 이 나는 경우가 하나 줄 뿐 |

재발급 보안은 나머지 검사로 유지된다 — refresh 해시 조회 · DB `expires_at`(한 번 쓴 refresh 는 1분 뒤 끝 — 재사용 차단) · 세션 존재 · 회원 상태 · 로그인 그룹 재검증(실패 시 안전망 단축).

검토한 다른 방법(프론트 요청서): Next 서버가 X-Forwarded-For 로 브라우저 IP 를 넘기고 TRUST_PROXY 에 등록 → 설정이 틀리면 IP 위조 가능, 브라우저가 직접 재발급 → refresh 를 JS 가 읽는 곳에 둬야 해 XSS 노출 — 둘 다 택하지 않는다.

## Affected Files
| File | Change Type | Description |
|------|-------------|-------------|
| `apps/user-service/src/user/user.service.ts` | modify | `tokenRefresh` — IP 비교 삭제, `ip` 인자 삭제, JSDoc |
| `apps/user-service/src/user/controllers/user.controller.ts` | modify | `tokenRefresh` — `@ClientIp()` 인자 삭제 |
| `apps/admin-service/src/manager/manager.service.ts` | modify | 같은 변경 |
| `apps/admin-service/src/manager/controllers/manager.controller.ts` | modify | 같은 변경 |
| `apps/admin-service/src/admin/admin.service.ts` | modify | 같은 변경 |
| `apps/admin-service/src/admin/controllers/admin.controller.ts` | modify | 같은 변경 |
| `apps/user-service/src/user/test/user-token-refresh.spec.ts` | modify | IP 불일치 401 케이스 → "다른 IP 여도 재발급" 성공 케이스, "세션 IP 없으면 비교 생략" 케이스 삭제(검사가 없어져 의미 없음) |
| `apps/admin-service/src/manager/test/manager-token-refresh.spec.ts` | modify | IP 불일치 401 케이스 → "다른 IP 여도 재발급" 성공 케이스 |
| `apps/admin-service/src/admin/test/admin-token-refresh.spec.ts` | modify | "다른 IP 여도 재발급" 성공 케이스 추가(회귀 방지) |
| `.beaver/output/frontend/changes/2026-11-16-token-refresh-ip.md` · `changes/README.md` | add · modify | 프론트 안내 — 반영됨 · 프론트 변경 없음 · 백엔드 배포 먼저 |
| `.beaver/output/report/user/session-ip-check-report.md` | modify | `## Modification - 261116-1` 추가(build) |

README · AGENTS.md · docs 는 재발급 IP 검사를 적은 곳이 없어 고칠 것 없음(grep 확인).

## Code Changes

### service — 세 곳이 같은 모양(이용자 기준, 매니저 · 관리자는 repository · 회원 조회 이름만 다르다)

```ts
// apps/user-service/src/user/user.service.ts — before
     * - refresh_hash 로 t_session_refresh 조회, 미존재 · DB expires_at 경과 → 401
     * - 세션 미존재 · 로그인 시점 ip 와 요청 ip 불일치 → 401 (어느 한쪽 ip 가 없으면 비교 생략)
     * - 회원이 ACTIVE 가 아니거나 이용자 그룹이 아니면 401 + 안전망으로 expires_at 단축
     * - old refresh expires_at = now + 1m 단축(grace) 후 새 토큰 발급, previous_refresh_hash 로 체인 연결
     *
     * @param dto refresh token
     * @param ip 클라이언트 IP
     * @returns 토큰 4종
     */
    @Transactional()
    async tokenRefresh(dto: UserTokenRefreshDto, ip: string): Promise<UserTokenRefreshResultDto> {
        …
        // 3. 세션 ip 체크 — 로그인 시점 저장 ip 와 불일치 시 거부(만료 단축 없음)
        const session = await this.userRepository.findSession({session_id: payload.session_id});
        if (!session) {
            throw new UnauthorizedException({message: INVALID_TOKEN_MESSAGE});
        }
        if (session.ip && ip && session.ip !== ip) {
            throw new UnauthorizedException({message: INVALID_TOKEN_MESSAGE});
        }
```

```ts
// apps/user-service/src/user/user.service.ts — after
     * - refresh_hash 로 t_session_refresh 조회, 미존재 · DB expires_at 경과 → 401
     * - 세션 미존재(지워진 세션) → 401. 요청 IP 는 보지 않는다 — 재발급은 Next 서버가 부르고 IP 는 네트워크 전환으로도 바뀐다(로그인 때 저장한 t_session.ip 는 기록용)
     * - 회원이 ACTIVE 가 아니거나 이용자 그룹이 아니면 401 + 안전망으로 expires_at 단축
     * - old refresh expires_at = now + 1m 단축(grace) 후 새 토큰 발급, previous_refresh_hash 로 체인 연결
     *
     * @param dto refresh token
     * @returns 토큰 4종
     */
    @Transactional()
    async tokenRefresh(dto: UserTokenRefreshDto): Promise<UserTokenRefreshResultDto> {
        …
        // 3. 세션 확인 — 지워진 세션이면 거부(IP 는 비교하지 않는다)
        const session = await this.userRepository.findSession({session_id: payload.session_id});
        if (!session) {
            throw new UnauthorizedException({message: INVALID_TOKEN_MESSAGE});
        }
```

```ts
// apps/admin-service/src/manager/manager.service.ts — after (같은 자리)
    async tokenRefresh(dto: ManagerTokenRefreshDto): Promise<ManagerTokenRefreshResultDto> {
        …
        // 3. 세션 확인 — 지워진 세션이면 거부(IP 는 비교하지 않는다)
        const session = await this.managerRepository.findSession({session_id: payload.session_id});
        if (!session) {
            throw new UnauthorizedException({message: INVALID_TOKEN_MESSAGE});
        }
```

```ts
// apps/admin-service/src/admin/admin.service.ts — after (같은 자리)
    async tokenRefresh(dto: AdminTokenRefreshDto): Promise<AdminTokenRefreshResultDto> {
        …
        // 3. 세션 확인 — 지워진 세션이면 거부(IP 는 비교하지 않는다)
        const session = await this.adminRepository.findSession({session_id: payload.session_id});
        if (!session) {
            throw new UnauthorizedException({message: INVALID_TOKEN_MESSAGE});
        }
```
(JSDoc 의 IP 줄 · `@param ip` 도 세 곳 모두 이용자와 같이 고친다.)

### 내부 controller — 세 곳

```ts
// apps/user-service/src/user/controllers/user.controller.ts — before
    async tokenRefresh(@Body() dto: UserTokenRefreshDto, @ClientIp() ip: string): Promise<UserTokenRefreshResultDto> {
        return this.userService.tokenRefresh(dto, ip);
    }
```

```ts
// apps/user-service/src/user/controllers/user.controller.ts — after
    async tokenRefresh(@Body() dto: UserTokenRefreshDto): Promise<UserTokenRefreshResultDto> {
        return this.userService.tokenRefresh(dto);
    }
```

```ts
// apps/admin-service/src/manager/controllers/manager.controller.ts — after
    async tokenRefresh(@Body() dto: ManagerTokenRefreshDto): Promise<ManagerTokenRefreshResultDto> {
        return this.managerService.tokenRefresh(dto);
    }
```

```ts
// apps/admin-service/src/admin/controllers/admin.controller.ts — after
    async tokenRefresh(@Body() dto: AdminTokenRefreshDto): Promise<AdminTokenRefreshResultDto> {
        return this.adminService.tokenRefresh(dto);
    }
```
(`ClientIp` import 는 로그인이 계속 쓰므로 남는다.)

### spec

```ts
// apps/user-service/src/user/test/user-token-refresh.spec.ts — before ([SUCCESS] 안)
        it('세션에 저장된 ip 가 없으면 ip 비교를 건너뛴다', async () => { … internalHeaders('99.99.99.99') … expect(res.status).toBe(200); });
// ([FAIL:service] 안)
        it('로그인 시점 ip 와 다른 ip — 만료 단축 없이 거부', async () => { … expect(res.status).toBe(401); … });
```

```ts
// apps/user-service/src/user/test/user-token-refresh.spec.ts — after ([SUCCESS] 안, 두 케이스를 이것 하나로)
        it('로그인 때와 다른 IP(Next 서버)에서 불러도 재발급한다 — IP 를 보지 않는다', async () => {
            arrangeValid(); // 세션 ip 10.0.0.1

            const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders('10.0.0.2')).send({refresh_token: OLD_REFRESH});

            expect(res.status).toBe(200);
            expect(res.body.access_token).toBe(MOCK_ACCESS_TOKEN);
            expect(repo.findUser).toHaveBeenCalledWith({user_id: PAYLOAD.user_id});
            expect(repo.updateSessionRefresh).toHaveBeenCalledWith({refresh_hash: OLD_HASH}, {expires_at: ONE_MINUTE_LATER});
            expect(repo.insertSessionRefresh).toHaveBeenCalledTimes(1);
        });
```

```ts
// apps/admin-service/src/manager/test/manager-token-refresh.spec.ts — after ('[FAIL:service] 로그인 시점 ip 와 다른 ip 는 만료 단축 없이 401' 자리)
    it('[SUCCESS] 로그인 때와 다른 IP(Next 서버)에서 불러도 재발급한다 — IP 를 보지 않는다', async () => {
        arrange({user_id: PAYLOAD.user_id, state_id: 'ACTIVE', login_scope: 'MANAGER'}); // 세션 ip 10.0.0.1

        const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders('10.0.0.2')).send({refresh_token: OLD_REFRESH});

        expect(res.status).toBe(200);
        expect(res.body.access_token).toBe(MOCK_ACCESS_TOKEN);
        expect(repo.findManager).toHaveBeenCalledWith({user_id: PAYLOAD.user_id});
        expect(repo.updateSessionRefresh).toHaveBeenCalledWith({refresh_hash: OLD_HASH}, {expires_at: ONE_MINUTE_LATER});
        expect(repo.insertSessionRefresh).toHaveBeenCalledTimes(1);
    });
```

```ts
// apps/admin-service/src/admin/test/admin-token-refresh.spec.ts — after ([SUCCESS] 케이스 뒤에 추가)
    it('[SUCCESS] 로그인 때와 다른 IP(Next 서버)에서 불러도 재발급한다 — IP 를 보지 않는다', async () => {
        arrange({user_id: PAYLOAD.user_id, state_id: 'ACTIVE', login_scope: 'ADMIN'}); // 세션 ip 10.0.0.1

        const res = await request(app.getHttpServer()).post(PATH).set(internalHeaders('10.0.0.2')).send({refresh_token: OLD_REFRESH});

        expect(res.status).toBe(200);
        expect(res.body.access_token).toBe(MOCK_ACCESS_TOKEN);
        expect(repo.findAdmin).toHaveBeenCalledWith({user_id: PAYLOAD.user_id});
        expect(repo.updateSessionRefresh).toHaveBeenCalledWith({refresh_hash: OLD_HASH}, {expires_at: ONE_MINUTE_LATER});
        expect(repo.insertSessionRefresh).toHaveBeenCalledTimes(1);
    });
```
(세 spec 의 `ONE_MINUTE_LATER` · `MOCK_ACCESS_TOKEN` · `internalHeaders(ip)` 는 이미 있다. "세션이 없음 401" 케이스는 그대로 둔다.)

### 프론트 안내

```md
<!-- .beaver/output/frontend/changes/2026-11-16-token-refresh-ip.md — 새 파일 전체 -->
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
```

```md
<!-- .beaver/output/frontend/changes/README.md — 목록에 한 줄 -->
| 2026-11-16 | [토큰 재발급 IP 검사 없앰](2026-11-16-token-refresh-ip.md) | 세 영역 로그인 유지(재발급) — 프론트 변경 없음 | 2026.11.16 커밋 |
```

## Decisions
- [x] IP 비교만 없애고 세션 존재 확인은 남긴다 — IP 와 무관한 검사(지워진 세션의 refresh 거부). 근거: 프론트 요청은 "IP 일치 검사" 만, 나머지 보안 검사 유지
- [x] 거부 대신 로그도 남기지 않는다 — AGENTS.md "도메인 계층(service)은 로그를 남기지 않는다". 요청서도 선택 사항으로 적었다. 로그인 때 `t_session.ip` 저장은 기록용으로 그대로
- [x] service · controller 의 `ip` 인자를 없앤다 — 쓰는 곳이 없어지는 인자(§1.7 — 바뀐 뒤 쓰이지 않는 코드는 같이 지운다)
- [x] 프론트 안내 문서를 둔다 — 공개 API 의 실패 조건이 하나 줄었다(프론트 변경은 없음)

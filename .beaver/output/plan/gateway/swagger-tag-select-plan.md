# Plan — Swagger 도메인 선택

> 무엇을·왜는 [spec](../../spec/gateway/swagger-tag-select-spec.md)에 있다. 이 문서는 **어디를, 어떻게**를 적는다.
>
> **코드를 싣는 것** ① 진입점마다 비즈니스 로직 전체 ② 계산 함수 ③ 규약만으로 예측할 수 없는 데이터 규칙·쿼리
> **싣지 않는 것** 진입점 껍데기, 입력 검증 객체, 등록·배선, 형제 코드와 같은 조회 — 따르는 패턴을 표 한 줄로 가리킨다

## 파일

| 파일 | 작업 | 역할 | 코드 |
|---|---|---|---|
| `apps/gateway/src/config/swagger.config.ts` | 신규 | `buildSwaggerCustomOptions()` — 선택 상자 플러그인 · 정확히 같은 태그 필터 · 기본 필터 칸 숨김 | 아래 1 |
| `apps/gateway/src/main.ts` | 수정 | `SwaggerModule.setup(…, buildSwaggerCustomOptions())` · 부트스트랩 주석 | 아래 1 |
| `docs/api.md` · `docs/architecture.md` · `AGENTS.md` · `README.md` | 수정 | Swagger 도메인 선택 상자 · `config/swagger.config.ts` | 생략 |

---

## 1. 비즈니스 로직 — 진입점별 코드

### 1-1. Swagger 도메인 선택 — `buildSwaggerCustomOptions`

빼먹으면 안 되는 것 두 가지:
- `swaggerOptions` 안의 함수는 `@nestjs/swagger` 가 `.toString()` 으로 글자로 바꿔 페이지 초기화 스크립트에 넣는다(`node_modules/@nestjs/swagger/dist/swagger-ui/helpers.js` `buildJSInitOptions`). 그래서 플러그인 함수는 **브라우저에서 돌고**, 파일의 다른 변수 · import 를 쓰면 페이지에서 없는 이름이 된다 — 함수 안에서 끝나야 한다.
- 도메인 목록은 `operationsWithTags()`(거르기 전)에서 만든다. `taggedOperations()` 는 layout 플러그인이 고른 필터를 먼저 적용해(번들의 `taggedOperations=(s,o)=>…currentFilter()…opsFilter`) 도메인을 고른 뒤에는 목록이 그 하나로 줄어든다.

```ts
// apps/gateway/src/config/swagger.config.ts
import type {SwaggerCustomOptions} from '@nestjs/swagger';

/** 브라우저의 swagger-ui 번들 전역 — 기본 플러그인(DownloadUrl)을 다시 넣을 때만 쓴다(서버에서는 부르지 않는다) */
declare const SwaggerUIBundle: {plugins: {DownloadUrl: (system: unknown) => unknown}};

/** 선택 상자가 쓰는 swagger-ui React 일부 */
interface SwaggerUiReact {
    Fragment: unknown;
    createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): unknown;
    useState<T>(initial: T): [T, (value: T) => void];
}

/** 선택 상자가 쓰는 swagger-ui 시스템 일부 */
interface SwaggerUiSystem {
    React: SwaggerUiReact;
    specSelectors: {operationsWithTags(): {keySeq(): {toArray(): string[]}}};
    layoutActions: {updateFilter(filter: string | false): void};
}

/** 태그별 API 묶음(Immutable OrderedMap) — 거르기만 쓴다 */
interface TaggedOperations {
    filter(predicate: (operations: unknown, tag: string) => boolean): TaggedOperations;
}

/**
 * Swagger 화면 옵션 — Authorize 버튼 왼쪽 도메인(태그) 선택 상자(기본 전체) + Swagger 기본 글자 필터 칸 숨김.
 * swaggerOptions 의 함수는 @nestjs/swagger 가 글자로 바꿔 페이지에 넣는다(브라우저에서 돈다) — 플러그인 함수는 바깥 변수 · import 를 쓰지 않는다.
 *
 * @returns SwaggerModule.setup 옵션
 */
export function buildSwaggerCustomOptions(): SwaggerCustomOptions {
    return {
        // plugins 를 주면 @nestjs/swagger 의 기본 목록([DownloadUrl])이 통째로 바뀐다 — 기본 플러그인도 다시 넣는다
        swaggerOptions: {plugins: [swaggerDownloadUrlPlugin, swaggerTagSelectPlugin]},
        // ④ 도메인을 고르면 swagger-ui 가 기본 글자 필터 칸(부분 일치)을 띄운다 — 선택 상자만 쓰므로 숨긴다.
        // 선택 상자는 margin-right:auto 로 줄 왼쪽 끝 — 그 줄(.schemes)은 오른쪽 정렬(flex-end)이라 그대로면 Authorize 옆에 붙는다
        customCss: '.swagger-ui .filter-container{display:none}.swagger-ui .deskless-tag-select{min-width:180px;margin-right:auto}',
    };
}

/**
 * swagger-ui 기본 플러그인(DownloadUrl) — 브라우저에서 돈다.
 *
 * @param system swagger-ui 시스템
 * @returns DownloadUrl 플러그인
 */
function swaggerDownloadUrlPlugin(system: unknown): unknown {
    return SwaggerUIBundle.plugins.DownloadUrl(system);
}

/**
 * 도메인(태그) 선택 상자 플러그인 — 브라우저에서 돈다. 바깥 변수 · import 를 쓰지 않는다.
 *
 * @param system swagger-ui 시스템
 * @returns 플러그인(태그 필터 함수 · Authorize 버튼 감싸기)
 */
function swaggerTagSelectPlugin(system: SwaggerUiSystem): object {
    const React = system.React;
    return {
        fn: {
            // ③ 이름이 정확히 같은 묶음만 — 기본(부분 일치)은 '업체' 를 고르면 '업체 둘러보기' · '업체 예약' 도 남긴다
            opsFilter: (taggedOps: TaggedOperations, phrase: string) => taggedOps.filter((_operations, tag) => tag === phrase),
        },
        wrapComponents: {
            // ① Authorize 버튼 묶음 앞에 선택 상자 — 같은 줄(.schemes)이고 상자의 margin-right:auto(customCss)로 상자는 왼쪽 끝, 버튼은 오른쪽
            AuthorizeBtnContainer: (Original: unknown, sys: SwaggerUiSystem) =>
                function TagSelect(props: Record<string, unknown>): unknown {
                    // 도메인 목록은 거르기 전 묶음에서(화면에 보이는 순서)
                    const tags = sys.specSelectors.operationsWithTags().keySeq().toArray();
                    // ② 처음은 '전체'(빈 값) — 새로 열면 다시 전체
                    const [value, setValue] = React.useState('');
                    const onChange = (event: {target: {value: string}}): void => {
                        setValue(event.target.value);
                        // '전체' 는 false — 빈 문자열이면 swagger-ui 가 기본 글자 필터 칸을 띄운다
                        sys.layoutActions.updateFilter(event.target.value || false);
                    };
                    return React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                            'select',
                            {className: 'deskless-tag-select', value, onChange, 'aria-label': '도메인'},
                            React.createElement('option', {value: ''}, '전체'),
                            ...tags.map((tag) => React.createElement('option', {key: tag, value: tag}, tag)),
                        ),
                        React.createElement(Original, props),
                    );
                },
        },
    };
}
```

```ts
// apps/gateway/src/main.ts — Swagger 줄만
import {buildSwaggerCustomOptions} from './config/swagger.config.js';
// …
    SwaggerModule.setup(process.env.SWAGGER_PATH || 'swagger', app, SwaggerModule.createDocument(app, swaggerConfig), buildSwaggerCustomOptions());
```

부트스트랩 주석(`main.ts:13`)의 "→ Swagger →" 를 "→ Swagger(도메인 선택 상자 — config/swagger.config.ts) →" 로.

---

## 4. 기존 패턴 그대로 — 코드 생략

| 대상 | 따르는 패턴 | 근거 |
|---|---|---|
| 부트스트랩 설정 함수를 `config/` 에 두고 main.ts 가 부른다(인프라 파일 전용 헬퍼는 export 안 함) | CORS 설정 함수 | `apps/gateway/src/config/cors.config.ts:16` · `apps/gateway/src/main.ts:25` |
| 문서 — `docs/api.md:3` Swagger 절(도메인 선택 상자 · 정확히 같은 태그), `docs/architecture.md:144` main.ts 순서, `AGENTS.md` 게이트웨이 트리 `config/` 줄(`swagger.config.ts`), `README.md:78` Swagger 주소 줄 | 기존 Swagger 서술 | 각 줄 |

## 테스트

spec 의 ✓ 행이 없다 — 게이트웨이 설정 · 화면은 spec 을 두지 않는다(AGENTS.md Testing, 사용자 확인 2026-11-18 "Swagger는 테스트 파일 필요없어"). build 확인(scratchpad, 앱 기동 없음): 빌드 결과의 `buildSwaggerCustomOptions()` 를 `@nestjs/swagger` 의 `buildSwaggerHTML` · `buildSwaggerInitJS`(SwaggerModule.setup 이 쓰는 것)에 넣어 임시 express(swagger-ui 정적 파일)로 띄우고, 태그 `회원` · `업체` · `업체 둘러보기` · `업체 예약` + bearer 인증이 있는 작은 문서로 브라우저 창에서 — 선택 상자가 Authorize 왼쪽 · 기본 전체 · "업체" → 업체만 · "전체" → 모두 · 글자 필터 칸 안 보임 · 콘솔 오류 없음. 그 뒤 typecheck · lint · build.

## 만드는 순서

1. `config/swagger.config.ts` → 2. `main.ts` → 3. scratchpad 브라우저 확인 → 4. 문서(docs/api.md · architecture.md · AGENTS.md · README.md)

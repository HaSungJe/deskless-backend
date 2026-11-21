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
                /**
                 * 도메인 선택 상자 + 원래 Authorize 버튼
                 *
                 * @param props 원래 컴포넌트 props
                 * @returns React 요소
                 */
                function TagSelect(props: Record<string, unknown>): unknown {
                    // 도메인 목록은 거르기 전 묶음에서(화면에 보이는 순서) — taggedOperations 는 고른 필터를 먼저 적용해 목록이 줄어든다
                    const tags = sys.specSelectors.operationsWithTags().keySeq().toArray();
                    // ② 처음은 '전체'(빈 값) — 새로 열면 다시 전체
                    const [value, setValue] = React.useState('');
                    /**
                     * 고른 도메인으로 거른다
                     *
                     * @param event select change 이벤트
                     */
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

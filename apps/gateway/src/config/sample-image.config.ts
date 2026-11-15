import {fileURLToPath} from 'node:url';
import type {ServeStaticOptions} from '@nestjs/platform-express/interfaces/serve-static-options.interface.js';
import {SAMPLE_FILE_KEY_PREFIX} from '@app/integration/integration.constants.js';

/**
 * 샘플 사진 폴더 — 이 파일(config/) 옆의 ../assets/sample/. nest-cli assets 가 dist 의 같은 자리로 복사한다(nest start · dist 실행 모두 같은 경로).
 *
 * @returns 폴더 절대 경로
 */
export function sampleImageDir(): string {
    return fileURLToPath(new URL('../assets/sample/', import.meta.url));
}

/**
 * 샘플 사진 정적 경로 옵션 — 저장 키 `sample/<파일>` 이 그대로 `/sample/<파일>` 주소가 된다(GATEWAY_PUBLIC_URL 뒤). 폴더 목록 · index 없음, 하루 캐시, 없는 파일은 다음 처리로(404).
 *
 * @returns useStaticAssets 옵션
 */
export function buildSampleImageStaticOptions(): ServeStaticOptions {
    return {prefix: `/${SAMPLE_FILE_KEY_PREFIX}`, index: false, maxAge: '1d', fallthrough: true};
}

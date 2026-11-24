/**
 * 빌드 산출물 불러오기 확인 — 앱마다 `dist/` 의 루트 모듈을 실제로 import 해 "빌드는 되는데 실행하면 바로 죽는" 경우를 잡는다.
 *
 * 실행: `npm run build:check [앱 …]` (`npm run build` 가 네 앱을 빌드한 뒤 이어서 돌린다 — 앱 이름을 주지 않으면 네 앱 모두)
 *
 * - 루트 모듈을 import 하면 그 앱이 쓰는 모든 파일(DTO · 엔티티 · 컨트롤러 …)의 클래스와 데코레이터가 실행된다. 서버를 띄우지 않는다(main.js 를 부르지 않는다 —
 *   listen · DB · 브로커 · Redis 연결 없음).
 * - 잡는 것: ESM + `emitDecoratorMetadata` 에서 데코레이터가 붙은 필드 · 매개변수의 타입이 같은 파일의 **아래에 선언된 클래스**면, 클래스를 만드는 순간
 *   `design:type` 을 값으로 읽어 `ReferenceError: Cannot access 'X' before initialization`(TDZ)로 죽는다 — tsc · typecheck 는 통과한다. 그 DTO 를 부르는 spec 이
 *   있으면 `npm test` 도 잡지만 테스트는 ship 뒤 따로 돌려서, 테스트 없이 내보낸 커밋이 이미지까지 갔다(deskless 요청 2026-11-25 — changes/2026-11-25-dto-declaration-order.md).
 *   그 밖에 import 때 던지는 오류도 같이 잡는다.
 * - 이미지 빌드(Dockerfile)도 같은 확인을 그 앱 하나에 한다.
 *
 * 하나라도 불러오지 못하면 종료 코드 1.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/** 확인할 앱 — package.json build:<앱> 과 같은 네 앱 */
const APPS = ['gateway', 'user-service', 'admin-service', 'scheduler'];

const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : APPS;
let failed = 0;

for (const app of targets) {
    if (!APPS.includes(app)) {
        console.error(`✗ ${app}: 모르는 앱입니다 (${APPS.join(' | ')})`);
        failed++;
        continue;
    }
    // 루트 모듈 — nest build 산출물 위치(dist/apps/<앱>/apps/<앱>/src/<앱>.module.js — Dockerfile CMD 의 main.js 와 같은 폴더)
    const file = `dist/apps/${app}/apps/${app}/src/${app}.module.js`;
    if (!existsSync(file)) {
        console.error(`✗ ${app}: ${file} 이 없습니다 — 먼저 npm run build:${app}`);
        failed++;
        continue;
    }
    // 앱마다 따로 띄운 node 로 import 한다 — 한 프로세스에서 여러 앱을 불러오면 앱끼리 전역 등록(TypeORM 기본 연결 이름 등)이 겹친다
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(file).href)});`], {encoding: 'utf8'});
    if (result.status === 0) {
        console.log(`✓ ${app}: 불러옴`);
    } else {
        console.error(`✗ ${app}: 불러오지 못했습니다\n${(result.stderr || result.error?.message || '').trim()}`);
        failed++;
    }
}

if (failed > 0) {
    console.error(`\n빌드 산출물 불러오기 실패 ${failed}건 — 데코레이터가 붙은 필드 타입이 같은 파일 아래의 클래스면 그 클래스를 위로 옮긴다(docs/conventions.md DTO 절)`);
    process.exit(1);
}

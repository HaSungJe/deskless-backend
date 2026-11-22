/**
 * Docker 공용 네트워크 · 볼륨 만들기 — postgres · rabbitmq · redis · user-service · admin-service · scheduler · gateway 를 각자 따로 띄워도 서로 이름으로 찾고,
 * 내부 파일 저장소 폴더(AWS_S3_BUCKET 이 빌 때)를 gateway · user-service · admin-service 가 같이 보게 한다.
 *
 * 실행: `npm run docker:network` (이미 있으면 건너뛴다 — 몇 번을 돌려도 같다)
 *
 * 무엇을 만들지는 compose.shared.yml 한곳에서 읽는다 — 묶음(compose.*.yml)은 그 파일을 include 해 같은 이름을 `external: true` 로 쓴다.
 * 한 묶음을 내려도(`down`) 지워지지 않아 다른 묶음이 계속 동작한다. 새 공용 네트워크 · 볼륨은 compose.shared.yml 에만 더한다.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/** 공용 네트워크 · 볼륨 선언 파일(저장소 루트) */
const SHARED_FILE = fileURLToPath(new URL('../compose.shared.yml', import.meta.url));

/**
 * compose.shared.yml 의 공용 네트워크 · 볼륨 — 이 파일의 정해진 모양(들여쓰기 4칸 · 항목마다 name · x-internal · x-purpose 한 줄씩)만 읽는다.
 * YAML 파서 없이 읽는 이유: 이 스크립트는 Node 내장만으로 돌아야 한다(서버에서 npm install 전에도 쓴다). 못 읽으면 멈춘다(빈 목록으로 넘어가지 않는다).
 *
 * @returns {{networks: {key: string, name: string, internal: boolean, purpose: string}[], volumes: {key: string, name: string, internal: boolean, purpose: string}[]}} 네트워크 · 볼륨
 */
function readSharedResources() {
    const result = {networks: [], volumes: []};
    let section = null;
    let item = null;
    for (const line of readFileSync(SHARED_FILE, 'utf8').split(/\r?\n/)) {
        if (/^\s*(#|$)/.test(line)) {
            continue;
        }
        const top = /^(networks|volumes):\s*$/.exec(line);
        if (top) {
            section = top[1];
            item = null;
            continue;
        }
        if (/^\S/.test(line)) {
            section = null;
            item = null;
            continue;
        }
        const key = /^ {4}([a-z][\w-]*):\s*$/.exec(line);
        if (section && key) {
            item = {key: key[1], name: '', internal: false, purpose: ''};
            result[section].push(item);
            continue;
        }
        const field = /^ {8}(name|x-internal|x-purpose):\s*(.+?)\s*$/.exec(line);
        if (item && field) {
            const value = field[2].replace(/^'(.*)'$/, '$1');
            if (field[1] === 'name') {
                item.name = value;
            } else if (field[1] === 'x-internal') {
                item.internal = value === 'true';
            } else {
                item.purpose = value;
            }
        }
    }
    const missing = [...result.networks, ...result.volumes].filter((entry) => !entry.name);
    if (result.networks.length === 0 || missing.length > 0) {
        throw new Error(`compose.shared.yml 을 읽지 못함 — 형식(파일 머리 주석)을 확인하세요${missing.length > 0 ? `: name 없는 항목 ${missing.map((entry) => entry.key).join(', ')}` : ''}`);
    }
    return result;
}

/**
 * docker CLI 를 실행하고 표준 출력을 돌려준다. 실패하면 null.
 *
 * @param args docker 인자
 * @returns 표준 출력(앞뒤 공백 제거) 또는 null
 */
function docker(args) {
    try {
        return execFileSync('docker', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    } catch {
        return null;
    }
}

/**
 * 네트워크를 확인하고 없으면 만든다. 이미 있는데 internal 설정이 다르면 경고만 한다(연결된 컨테이너가 있을 수 있어 지우지 않는다).
 *
 * @param network compose.shared.yml 의 네트워크 항목
 * @returns 문제가 없으면 true
 */
function ensure(network) {
    const internal = docker(['network', 'inspect', '--format', '{{.Internal}}', network.name]);
    if (internal !== null) {
        if (internal !== String(network.internal)) {
            console.log(`! ${network.name}: 이미 있으나 internal=${internal} (기대 ${network.internal}) — 컨테이너를 내린 뒤 docker network rm ${network.name} 후 다시 실행`);
            return false;
        }
        console.log(`· ${network.name}: 이미 있음 — ${network.purpose}`);
        return true;
    }
    const created = docker(['network', 'create', ...(network.internal ? ['--internal'] : []), '--label', 'deskless.network=shared', network.name]);
    if (created === null) {
        console.log(`✗ ${network.name}: 만들지 못함 — Docker 가 실행 중인지 확인`);
        return false;
    }
    console.log(`✓ ${network.name}: 만듦 — ${network.purpose}`);
    return true;
}

/**
 * 볼륨을 확인하고 없으면 만든다.
 *
 * @param volume compose.shared.yml 의 볼륨 항목
 * @returns 문제가 없으면 true
 */
function ensureVolume(volume) {
    if (docker(['volume', 'inspect', '--format', '{{.Name}}', volume.name]) !== null) {
        console.log(`· ${volume.name}: 이미 있음 — ${volume.purpose}`);
        return true;
    }
    if (docker(['volume', 'create', '--label', 'deskless.volume=shared', volume.name]) === null) {
        console.log(`✗ ${volume.name}: 만들지 못함 — Docker 가 실행 중인지 확인`);
        return false;
    }
    console.log(`✓ ${volume.name}: 만듦 — ${volume.purpose}`);
    return true;
}

if (docker(['version', '--format', '{{.Server.Version}}']) === null) {
    console.log('✗ Docker 에 연결할 수 없습니다 — Docker Desktop 이 실행 중인지 확인하세요.');
    process.exitCode = 1;
} else {
    const shared = readSharedResources();
    const results = [...shared.networks.map(ensure), ...shared.volumes.map(ensureVolume)];
    process.exitCode = results.every(Boolean) ? 0 : 1;
}

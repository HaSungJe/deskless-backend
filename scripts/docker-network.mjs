/**
 * Docker 공용 네트워크 · 볼륨 만들기 — postgres · rabbitmq · redis · user-service · admin-service · scheduler · gateway 를 각자 따로 띄워도 서로 이름으로 찾고,
 * 내부 파일 저장소 폴더(AWS_S3_BUCKET 이 빌 때)를 gateway · user-service · admin-service 가 같이 보게 한다.
 *
 * 실행: `npm run docker:network` (이미 있으면 건너뛴다 — 몇 번을 돌려도 같다)
 *
 * compose 파일 7개는 이 네트워크 · 볼륨을 `external: true` 로 쓴다. 한 묶음을 내려도(`down`) 지워지지 않아
 * 다른 묶음이 계속 동작한다.
 */
import {execFileSync} from 'node:child_process';

/** 공용 네트워크 — internal 이면 외부로 나가는 길도, 호스트 포트도 없다 */
const NETWORKS = [
    {name: 'deskless-edge', internal: false, purpose: 'gateway-lb · gateway (외부 포트는 gateway-lb 만)'},
    {name: 'deskless-service', internal: true, purpose: 'gateway → user-service-lb → user-service 내부 HTTP'},
    {name: 'deskless-broker', internal: false, purpose: 'rabbitmq · gateway · user-service'},
    {name: 'deskless-data', internal: false, purpose: 'postgres · redis · migrate · user-service · admin-service · scheduler'},
];

/** 공용 볼륨 — 묶음끼리 같은 파일을 본다 */
const VOLUMES = [{name: 'deskless-files', purpose: '내부 파일 저장소(AWS_S3_BUCKET 이 빌 때) — gateway · user-service · admin-service 의 /app/storage/files'}];

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
 * @param network NETWORKS 항목
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
 * @param volume VOLUMES 항목
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
    const results = [...NETWORKS.map(ensure), ...VOLUMES.map(ensureVolume)];
    process.exitCode = results.every(Boolean) ? 0 : 1;
}

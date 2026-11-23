/**
 * Express 'trust proxy' 값을 환경변수 TRUST_PROXY 로 만든다.
 * 게이트웨이는 앞단 프록시(쿠버네티스 Ingress — deskless 저장소) 뒤에서 여러 대로 뜨므로, 요청을 보낸 주소는 그 프록시다. 실제 클라이언트 IP(`@Ip()`)는
 * 프록시가 붙인 X-Forwarded-For 에서 읽어야 하고, 그 헤더를 믿을 앞단을 이 값으로 정한다(단 수는 배포 구성을 아는 deskless 가 넣는다).
 *
 * - 비어 있음: null — 설정하지 않는다(로컬 직접 실행). 요청을 보낸 주소를 그대로 쓴다.
 * - 정수: 믿을 앞단 프록시 수(Ingress 1단이면 1, 그 앞에 클라우드 로드밸런서가 더 있으면 2).
 * - true / false
 * - 그 밖: 믿을 주소 목록(쉼표 구분, `loopback` · `uniquelocal` 같은 이름 가능) — Express 에 그대로 넘긴다.
 *
 * 앞단 프록시가 없는데 값을 주면 클라이언트가 X-Forwarded-For 로 IP 를 위조할 수 있다.
 *
 * @param value TRUST_PROXY 값
 * @returns `app.set('trust proxy', 값)` 에 넘길 값, 설정하지 않으면 null
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string | null {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return null;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return trimmed;
}

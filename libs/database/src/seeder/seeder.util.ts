/**
 * 확인 컬럼(PK 또는 유일 컬럼) 기준으로 아직 DB 에 없는 행만 골라낸다 (멱등 시드용 순수함수).
 *
 * @param rows 기본 데이터 전체(SEED_DATA)
 * @param existing 현재 DB 에 존재하는 행 목록(같은 확인 컬럼 보유)
 * @param key 확인 컬럼 프로퍼티명
 * @returns existing 에 그 값이 없는 rows 의 부분집합
 */
export function pickMissingRows<T>(rows: T[], existing: T[], key: string): T[] {
    const existingValues = new Set(existing.map((e) => (e as Record<string, unknown>)[key]));
    return rows.filter((r) => !existingValues.has((r as Record<string, unknown>)[key]));
}

/**
 * 샘플 시드(테스트 데이터)를 넣을지 — SEED_SAMPLE_DATA 가 '1' 일 때만. 운영 DB 에서는 켜지 않는다(docs/guides/sample-data.md).
 *
 * @param value SEED_SAMPLE_DATA 값
 * @returns '1' 이면 true
 */
export function isSampleSeedEnabled(value: string | undefined): boolean {
    return value === '1';
}

/**
 * 샘플 고정 ID — `5a3e` + 종류 2자리 + 번호 26자리(10진 숫자라 32자 hex 형식 — 업체코드 · 경로 파라미터 검사를 통과한다).
 * 고정이라 다시 부팅해도 같은 행이고(PK 멱등), 눈으로 샘플 행을 가를 수 있다.
 *
 * @param kind 종류(SAMPLE_ID_KIND)
 * @param no 번호
 * @returns 32자 ID
 */
export function sampleId(kind: number, no: number): string {
    return `5a3e${String(kind).padStart(2, '0')}${String(no).padStart(26, '0')}`;
}

/**
 * 샘플 업체 번호 2자리 — 사진 파일 이름 · 사업자등록번호 · 연락처에 쓴다.
 *
 * @param no 업체 번호(1 ~ 10)
 * @returns '01' ~ '10'
 */
export function sampleNo(no: number): string {
    return String(no).padStart(2, '0');
}

/**
 * 한 층의 샘플 호실 — 호실명은 `<층>01` 부터(업체 안 유일 — 그룹마다 층이 다르다).
 *
 * @param floor 층
 * @param count 호실 수
 * @returns 층 · 호실명
 */
export function sampleRooms(floor: number, count: number): {floor: number; room_name: string}[] {
    return Array.from({length: count}, (_, index) => ({floor, room_name: `${floor}${String(index + 1).padStart(2, '0')}`}));
}

/**
 * 일(0) ~ 토(6) 샘플 영업시간 — 휴무 요일은 null(행은 is_closed 1 · 두 시각 NULL — CHK_StoreHour_OpenCloseTime).
 *
 * @param open_time 영업 시작(HH:mm)
 * @param close_time 영업 마감(HH:mm — 시작보다 이르면 다음 날)
 * @param closed_days 휴무 요일
 * @returns 7개 요일
 */
export function sampleHours(open_time: string, close_time: string, closed_days: number[] = []): ({open_time: string; close_time: string} | null)[] {
    return Array.from({length: 7}, (_, day_of_week) => (closed_days.includes(day_of_week) ? null : {open_time, close_time}));
}

#!/usr/bin/env node
// 샘플 이미지(PNG) 생성기 — 테스트 데이터 시드(SEED_SAMPLE_DATA=1)의 업체 사진 · 객실 그룹 사진을 그린다.
// 외부 패키지 없이 node:zlib 로 PNG(RGB 8bit)를 만든다. 결과는 apps/gateway/src/assets/sample/ 에 저장하고 커밋한다 — 게이트웨이가 /sample/<파일> 로 내준다.
// 업체 수 · 업체별 객실 그룹 수(GROUP_COUNTS)는 libs/database/src/seeder/sample-seed.data.ts 의 SAMPLE_STORES 와 같아야 한다.
//   npm run sample:images            (기본 폴더에 다시 그린다 — 폴더의 기존 PNG 는 지운다)
//   node scripts/sample-images.mjs <폴더>   (다른 폴더에 그려 본다)
import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';

const OUT_DIR = process.argv[2] ?? fileURLToPath(new URL('../apps/gateway/src/assets/sample/', import.meta.url));
const WIDTH = 960;
const HEIGHT = 640;
/** 업체별 객실 그룹 수 — SAMPLE_STORES 순서(업체 01 ~ 10) */
const GROUP_COUNTS = [3, 2, 3, 2, 2, 3, 2, 3, 2, 3];
/** 사진 수 — 업체 · 그룹마다 */
const PHOTOS = 2;
const WHITE = [255, 255, 255];

/** 5×7 비트맵 글꼴 — 라벨에 쓰는 글자만 */
const FONT = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/**
 * 빈 그림판.
 *
 * @param {number} width 가로
 * @param {number} height 세로
 * @returns {{width: number, height: number, data: Uint8Array}} RGB 픽셀
 */
function createCanvas(width, height) {
    return {width, height, data: new Uint8Array(width * height * 3)};
}

/**
 * HSL → RGB.
 *
 * @param {number} h 색상(0 ~ 360)
 * @param {number} s 채도(0 ~ 100)
 * @param {number} l 명도(0 ~ 100)
 * @returns {number[]} [r, g, b]
 */
function hsl(h, s, l) {
    const hue = (((h % 360) + 360) % 360) / 360;
    const sat = s / 100;
    const light = l / 100;
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    const channel = (t) => {
        const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
        if (x < 1 / 6) return p + (q - p) * 6 * x;
        if (x < 1 / 2) return q;
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
        return p;
    };
    return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)].map((v) => Math.round(v * 255));
}

/**
 * 같은 seed 면 같은 수열을 내는 난수(mulberry32).
 *
 * @param {number} seed 시작 값
 * @returns {() => number} 0 이상 1 미만
 */
function random(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 사각형 채우기(alpha 가 1 보다 작으면 섞는다).
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} x 왼쪽
 * @param {number} y 위
 * @param {number} w 가로
 * @param {number} h 세로
 * @param {number[]} color [r, g, b]
 * @param {number} [alpha] 불투명도(0 ~ 1)
 */
function fillRect(canvas, x, y, w, h, color, alpha = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(canvas.width, Math.round(x + w));
    const y1 = Math.min(canvas.height, Math.round(y + h));
    for (let row = y0; row < y1; row += 1) {
        for (let col = x0; col < x1; col += 1) {
            const at = (row * canvas.width + col) * 3;
            for (let c = 0; c < 3; c += 1) {
                canvas.data[at + c] = alpha >= 1 ? color[c] : Math.round(canvas.data[at + c] * (1 - alpha) + color[c] * alpha);
            }
        }
    }
}

/**
 * 위에서 아래로 두 색을 잇는 사각형.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} x 왼쪽
 * @param {number} y 위
 * @param {number} w 가로
 * @param {number} h 세로
 * @param {number[]} top 위 색
 * @param {number[]} bottom 아래 색
 */
function fillGradient(canvas, x, y, w, h, top, bottom) {
    const rows = Math.max(1, Math.round(h));
    for (let i = 0; i < rows; i += 1) {
        const t = rows === 1 ? 0 : i / (rows - 1);
        fillRect(
            canvas,
            x,
            y + i,
            w,
            1,
            [0, 1, 2].map((c) => Math.round(top[c] + (bottom[c] - top[c]) * t)),
        );
    }
}

/**
 * 원 채우기.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} cx 중심 x
 * @param {number} cy 중심 y
 * @param {number} r 반지름
 * @param {number[]} color [r, g, b]
 * @param {number} [alpha] 불투명도
 */
function fillCircle(canvas, cx, cy, r, color, alpha = 1) {
    for (let dy = -r; dy <= r; dy += 1) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        fillRect(canvas, cx - half, cy + dy, half * 2 + 1, 1, color, alpha);
    }
}

/**
 * 위 · 아래 너비가 다른 사다리꼴(가운데 정렬) — 스탠드 갓.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} cx 가운데 x
 * @param {number} y 위
 * @param {number} topWidth 위 너비
 * @param {number} bottomWidth 아래 너비
 * @param {number} h 높이
 * @param {number[]} color [r, g, b]
 */
function fillTrapezoid(canvas, cx, y, topWidth, bottomWidth, h, color) {
    for (let i = 0; i < h; i += 1) {
        const w = topWidth + ((bottomWidth - topWidth) * i) / Math.max(1, h - 1);
        fillRect(canvas, cx - w / 2, y + i, w, 1, color);
    }
}

/**
 * 글자 그리기(5×7 글꼴 × scale).
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {string} text 글자(FONT 에 있는 것만)
 * @param {number} x 왼쪽
 * @param {number} y 위
 * @param {number} scale 배율
 * @param {number[]} color [r, g, b]
 */
function drawText(canvas, text, x, y, scale, color) {
    [...text].forEach((char, index) => {
        const glyph = FONT[char] ?? FONT[' '];
        glyph.forEach((line, row) => {
            [...line].forEach((bit, col) => {
                if (bit === '1') fillRect(canvas, x + index * 6 * scale + col * scale, y + row * scale, scale, scale, color);
            });
        });
    });
}

/**
 * 글자 폭(픽셀).
 *
 * @param {string} text 글자
 * @param {number} scale 배율
 * @returns {number} 폭
 */
function textWidth(text, scale) {
    return text.length * 6 * scale - scale;
}

/**
 * 왼쪽 아래 라벨(어두운 상자 + 흰 글자) — 어느 업체 · 그룹 사진인지 보이게.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {string} text 라벨
 */
function drawLabel(canvas, text) {
    const scale = 4;
    const boxWidth = textWidth(text, scale) + 32;
    const boxHeight = 7 * scale + 24;
    fillRect(canvas, 24, canvas.height - 24 - boxHeight, boxWidth, boxHeight, [20, 24, 32], 0.6);
    drawText(canvas, text, 40, canvas.height - 24 - boxHeight + 12, scale, WHITE);
}

/**
 * 업체 외관(낮) — 하늘 · 뒤 건물 · 건물 · 창 · 간판 · 1층 유리.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 업체 색상
 * @param {() => number} rand 난수
 */
function drawStoreDay(canvas, hue, rand) {
    const ground = 500;
    fillGradient(canvas, 0, 0, WIDTH, ground, hsl(205, 70, 70), hsl(200, 60, 92));
    for (let i = 0; i < 9; i += 1) {
        const h = 140 + Math.floor(rand() * 160);
        fillRect(canvas, i * 115 - 20, ground - h, 100, h, hsl(215, 14, 80));
    }
    fillRect(canvas, 0, ground, WIDTH, HEIGHT - ground, hsl(30, 8, 64));
    fillRect(canvas, 0, ground, WIDTH, 8, hsl(30, 8, 48));
    const bx = 150;
    const bw = 660;
    const by = 70;
    fillRect(canvas, bx - 12, by - 16, bw + 24, 20, hsl(hue, 18, 62));
    fillRect(canvas, bx, by, bw, ground - by, hsl(hue, 28, 86));
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 6; col += 1) {
            const wx = bx + 40 + col * 100;
            const wy = by + 30 + row * 70;
            fillRect(canvas, wx - 4, wy - 4, 72, 54, hsl(hue, 15, 60));
            fillGradient(canvas, wx, wy, 64, 46, hsl(205, 45, 78), hsl(205, 35, 62));
        }
    }
    const sy = by + 240;
    fillRect(canvas, bx, sy, bw, 60, hsl(hue, 55, 36));
    drawText(canvas, 'ROOMLESS', bx + (bw - textWidth('ROOMLESS', 6)) / 2, sy + 9, 6, WHITE);
    fillRect(canvas, bx + 40, sy + 76, bw - 80, ground - sy - 76, hsl(hue, 15, 55));
    fillGradient(canvas, bx + 48, sy + 84, bw - 96, ground - sy - 84, hsl(200, 35, 72), hsl(200, 30, 52));
    fillRect(canvas, bx + bw / 2 - 50, sy + 84, 100, ground - sy - 84, hsl(200, 25, 40));
    fillRect(canvas, bx + bw / 2 - 2, sy + 84, 4, ground - sy - 84, hsl(hue, 15, 70));
    for (const px of [90, 870]) {
        fillRect(canvas, px - 30, ground - 40, 60, 40, hsl(25, 45, 45));
        fillCircle(canvas, px, ground - 80, 52, hsl(120, 35, 42));
        fillCircle(canvas, px - 18, ground - 100, 30, hsl(120, 38, 50));
    }
}

/**
 * 업체 외관(밤) — 어두운 하늘 · 불 켜진 창 · 밝은 간판 · 가로등.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 업체 색상
 * @param {() => number} rand 난수
 */
function drawStoreNight(canvas, hue, rand) {
    const ground = 500;
    fillGradient(canvas, 0, 0, WIDTH, ground, hsl(235, 45, 14), hsl(260, 35, 30));
    for (let i = 0; i < 40; i += 1) fillRect(canvas, Math.floor(rand() * WIDTH), Math.floor(rand() * 200), 3, 3, hsl(50, 30, 85));
    fillRect(canvas, 0, ground, WIDTH, HEIGHT - ground, hsl(230, 10, 22));
    fillRect(canvas, 0, ground, WIDTH, 8, hsl(230, 10, 32));
    const bx = 150;
    const bw = 660;
    const by = 70;
    fillRect(canvas, bx, by, bw, ground - by, hsl(hue, 14, 24));
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 6; col += 1) {
            const lit = rand() > 0.35;
            fillRect(canvas, bx + 40 + col * 100, by + 30 + row * 70, 64, 46, lit ? hsl(42, 90, 68) : hsl(225, 20, 16));
        }
    }
    const sy = by + 240;
    fillRect(canvas, bx - 6, sy - 6, bw + 12, 72, hsl(hue, 70, 55), 0.35);
    fillRect(canvas, bx, sy, bw, 60, hsl(hue, 70, 50));
    drawText(canvas, 'ROOMLESS', bx + (bw - textWidth('ROOMLESS', 6)) / 2, sy + 9, 6, WHITE);
    fillGradient(canvas, bx + 48, sy + 84, bw - 96, ground - sy - 84, hsl(40, 80, 72), hsl(35, 70, 55));
    fillRect(canvas, bx + bw / 2 - 2, sy + 84, 4, ground - sy - 84, hsl(hue, 15, 30));
    fillRect(canvas, 70, 240, 10, ground - 240, hsl(220, 8, 40));
    fillCircle(canvas, 75, 240, 46, hsl(45, 90, 70), 0.25);
    fillCircle(canvas, 75, 240, 16, hsl(48, 95, 82));
}

/**
 * 객실(침대 쪽) — 벽 · 마루 · 창 · 액자 · 침대 · 협탁 · 스탠드 · 러그.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 그룹 색상
 */
function drawRoomBed(canvas, hue) {
    const floor = 420;
    fillRect(canvas, 0, 0, WIDTH, floor, hsl(hue, 28, 88));
    fillRect(canvas, 0, floor - 14, WIDTH, 14, hsl(hue, 12, 96));
    fillRect(canvas, 0, floor, WIDTH, HEIGHT - floor, hsl(30, 38, 56));
    for (let y = floor + 36; y < HEIGHT; y += 36) fillRect(canvas, 0, y, WIDTH, 3, hsl(30, 36, 48));
    fillRect(canvas, 70, 80, 240, 220, WHITE);
    fillGradient(canvas, 82, 92, 216, 196, hsl(205, 70, 72), hsl(195, 60, 90));
    fillRect(canvas, 187, 92, 6, 196, WHITE);
    fillRect(canvas, 82, 187, 216, 6, WHITE);
    fillRect(canvas, 700, 110, 170, 120, hsl(hue, 10, 30));
    fillRect(canvas, 712, 122, 146, 96, hsl(hue + 40, 45, 70));
    fillCircle(canvas, 785, 170, 26, hsl(hue + 160, 45, 60));
    fillRect(canvas, 330, 220, 380, 160, hsl(hue, 30, 38));
    fillRect(canvas, 310, 340, 420, 70, hsl(40, 25, 96));
    fillRect(canvas, 360, 300, 130, 50, WHITE);
    fillRect(canvas, 550, 300, 130, 50, WHITE);
    fillRect(canvas, 310, 375, 420, 110, hsl(hue, 45, 60));
    fillRect(canvas, 310, 375, 420, 16, hsl(hue, 45, 70));
    fillRect(canvas, 270, 485, 500, 110, hsl(hue, 18, 76));
    fillRect(canvas, 750, 360, 100, 90, hsl(28, 35, 38));
    fillRect(canvas, 760, 395, 80, 4, hsl(28, 35, 28));
    fillRect(canvas, 796, 320, 8, 40, hsl(28, 20, 30));
    fillTrapezoid(canvas, 800, 270, 44, 76, 52, hsl(45, 70, 82));
}

/**
 * 객실(TV · 책상 쪽) — 벽 TV · 수납장 · 책상 · 모니터 · 의자 · 화분 · 러그.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @param {number} hue 그룹 색상
 */
function drawRoomDesk(canvas, hue) {
    const floor = 430;
    fillRect(canvas, 0, 0, WIDTH, floor, hsl(hue + 20, 24, 84));
    fillRect(canvas, 0, floor - 14, WIDTH, 14, hsl(hue, 10, 95));
    fillRect(canvas, 0, floor, WIDTH, HEIGHT - floor, hsl(28, 30, 62));
    for (let y = floor + 36; y < HEIGHT; y += 36) fillRect(canvas, 0, y, WIDTH, 3, hsl(28, 28, 54));
    fillRect(canvas, 120, 140, 320, 185, hsl(220, 10, 12));
    fillGradient(canvas, 130, 150, 300, 165, hsl(hue + 180, 50, 45), hsl(hue + 200, 55, 25));
    fillRect(canvas, 100, 360, 360, 70, hsl(28, 32, 40));
    fillRect(canvas, 110, 372, 165, 46, hsl(28, 30, 46));
    fillRect(canvas, 285, 372, 165, 46, hsl(28, 30, 46));
    fillRect(canvas, 560, 320, 330, 22, hsl(28, 35, 42));
    fillRect(canvas, 575, 342, 14, 120, hsl(28, 30, 32));
    fillRect(canvas, 861, 342, 14, 120, hsl(28, 30, 32));
    fillRect(canvas, 650, 200, 170, 110, hsl(220, 10, 14));
    fillRect(canvas, 658, 208, 154, 94, hsl(hue + 180, 35, 55));
    fillRect(canvas, 728, 310, 14, 10, hsl(220, 10, 20));
    fillRect(canvas, 680, 360, 110, 120, hsl(hue, 35, 34));
    fillRect(canvas, 665, 470, 140, 22, hsl(hue, 35, 28));
    fillRect(canvas, 728, 492, 14, 60, hsl(220, 8, 30));
    fillRect(canvas, 485, 400, 56, 64, hsl(18, 55, 50));
    fillCircle(canvas, 513, 370, 38, hsl(125, 35, 40));
    fillCircle(canvas, 495, 345, 24, hsl(125, 40, 48));
    fillCircle(canvas, 535, 350, 22, hsl(125, 40, 46));
    fillRect(canvas, 90, 480, 400, 120, hsl(hue, 20, 72));
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

/**
 * CRC32(PNG 청크).
 *
 * @param {Buffer} buf 바이트
 * @returns {number} CRC
 */
function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/**
 * PNG 청크 하나(길이 · 종류 · 본문 · CRC).
 *
 * @param {string} type 청크 종류
 * @param {Buffer} body 본문
 * @returns {Buffer} 청크
 */
function chunk(type, body) {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(typed));
    return Buffer.concat([head, typed, tail]);
}

/**
 * 그림판 → PNG(RGB 8bit). 줄마다 None · Sub · Up 필터 중 바이트 합이 작은 것을 고른다.
 *
 * @param {{width: number, height: number, data: Uint8Array}} canvas 그림판
 * @returns {Buffer} PNG 파일
 */
function encodePng(canvas) {
    const stride = canvas.width * 3;
    const raw = Buffer.alloc((stride + 1) * canvas.height);
    let previous = new Uint8Array(stride);
    for (let y = 0; y < canvas.height; y += 1) {
        const row = canvas.data.subarray(y * stride, (y + 1) * stride);
        const candidates = [0, 1, 2].map((type) => {
            const out = new Uint8Array(stride);
            for (let i = 0; i < stride; i += 1) {
                const left = i >= 3 ? row[i - 3] : 0;
                out[i] = type === 0 ? row[i] : type === 1 ? row[i] - left : row[i] - previous[i];
            }
            const cost = out.reduce((sum, v) => sum + (v < 128 ? v : 256 - v), 0);
            return {type, out, cost};
        });
        const best = candidates.reduce((a, b) => (b.cost < a.cost ? b : a));
        raw[y * (stride + 1)] = best.type;
        raw.set(best.out, y * (stride + 1) + 1);
        previous = row;
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(canvas.width, 0);
    header.writeUInt32BE(canvas.height, 4);
    header[8] = 8;
    header[9] = 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * 그림 하나를 파일로 쓴다.
 *
 * @param {string} name 파일 이름
 * @param {(canvas: {width: number, height: number, data: Uint8Array}) => void} draw 그리는 함수
 * @param {string} label 왼쪽 아래 라벨
 * @returns {number} 파일 크기(바이트)
 */
function writeImage(name, draw, label) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    draw(canvas);
    drawLabel(canvas, label);
    const png = encodePng(canvas);
    writeFileSync(join(OUT_DIR, name), png);
    return png.length;
}

mkdirSync(OUT_DIR, {recursive: true});
for (const name of readdirSync(OUT_DIR)) {
    if (name.endsWith('.png')) rmSync(join(OUT_DIR, name));
}
let count = 0;
let bytes = 0;
GROUP_COUNTS.forEach((groups, index) => {
    const nn = String(index + 1).padStart(2, '0');
    const hue = (index * 36 + 10) % 360;
    for (let photo = 1; photo <= PHOTOS; photo += 1) {
        const rand = random((index + 1) * 100 + photo);
        bytes += writeImage(`store-${nn}-${photo}.png`, (canvas) => (photo === 1 ? drawStoreDay(canvas, hue, rand) : drawStoreNight(canvas, hue, rand)), `STORE ${nn}`);
        count += 1;
    }
    for (let group = 1; group <= groups; group += 1) {
        const groupHue = (hue + group * 47) % 360;
        for (let photo = 1; photo <= PHOTOS; photo += 1) {
            bytes += writeImage(`room-${nn}-${group}-${photo}.png`, (canvas) => (photo === 1 ? drawRoomBed(canvas, groupHue) : drawRoomDesk(canvas, groupHue)), `ROOM ${nn}-${group}`);
            count += 1;
        }
    }
});
console.log(`[sample-images] ${count}개 · ${Math.round(bytes / 1024)}KB → ${OUT_DIR}`);

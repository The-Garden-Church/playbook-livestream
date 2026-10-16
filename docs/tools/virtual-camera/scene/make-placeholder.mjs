import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const W = 1600;
const H = 994;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};
function writePng(name, channels, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 3 ? 2 : 0;
  const stride = W * channels;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  writeFileSync(join(OUT, name), png);
  console.log(`wrote scene/${name} (${png.length} bytes)`);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const cover = (d) => clamp01(0.5 - d);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const scale = (c, k) => c.map((v) => v * k);
const toSrgb = (v) => {
  const x = clamp01(v);
  return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
};
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const ellipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const box = (x, y, x0, y0, x1, y1, r = 0) => {
  const qx = Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + r;
  const qy = Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const segment = (x, y, ax, ay, bx, by, r) => {
  const px = x - ax;
  const py = y - ay;
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01((px * dx + py * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - dx * t, py - dy * t) - r;
};
const trapezoid = (x, y, top, bottom, xt0, xt1, xb0, xb1) => {
  const t = clamp01((y - top) / (bottom - top));
  const left = xt0 + (xb0 - xt0) * t;
  const right = xt1 + (xb1 - xt1) * t;
  return Math.max(left - x, x - right, top - y, y - bottom);
};

const WALL_BOTTOM = Math.round(H * 0.3);
const FLOOR_TOP = 860;
const CX = 1010;

function wall(x, y) {
  const u = x / W;
  const v = y / WALL_BOTTOM;
  let c = mix([0.06, 0.03, 0.22], [0.85, 0.32, 0.08], clamp01((v - 0.05) / 0.6));
  c = mix(c, [0.55, 0.08, 0.35], 0.35 * (0.5 + 0.5 * Math.sin(u * 9 + v * 3)));
  const sun = ellipse(x, y, W * 0.72, WALL_BOTTOM * 0.42, 70, 70);
  c = mix(c, [0.95, 0.82, 0.5], cover(sun / 3));
  c = mix(c, [0.98, 0.95, 0.8], cover((sun + 25) / 3));
  const hill1 = WALL_BOTTOM * (0.62 + 0.08 * Math.sin(u * 7 + 1) + 0.04 * Math.sin(u * 23));
  c = mix(c, [0.04, 0.3, 0.1], cover((hill1 - y) / 1.5));
  const hill2 = WALL_BOTTOM * (0.8 + 0.06 * Math.sin(u * 11 + 2.5));
  c = mix(c, [0.02, 0.12, 0.32], cover((hill2 - y) / 1.5));
  const flowers = Math.max(0, Math.sin(x * 0.21) * Math.sin(y * 0.33 + x * 0.05));
  if (y > hill1 && y < hill2) c = mix(c, [0.8, 0.15, 0.45], 0.6 * flowers ** 6);
  const brush = 0.88 + 0.12 * Math.sin(x * 0.09 + Math.sin(y * 0.15) * 2) * Math.sin(y * 0.07);
  c = scale(c, brush);
  const grid = x % 5 === 0 || y % 5 === 0 ? 0.72 : 1;
  return scale(c, grid);
}

function curtain(x, y) {
  const fold = 0.5 + 0.5 * Math.sin(x / 19 + Math.sin(x / 71) * 2);
  const spill = 0.03 * Math.exp(-(((x - CX) / 420) ** 2) - ((y - 560) / 380) ** 2);
  const k = 0.008 + 0.014 * fold ** 2 + spill;
  return [k, k * 0.98, k * 1.04];
}

function trussCoverage(x, y) {
  const x0 = 150;
  const x1 = 250;
  const top = WALL_BOTTOM + 4;
  const bottom = FLOOR_TOP + 20;
  if (x < x0 - 10 || x > x1 + 10 || y < top - 10 || y > bottom + 10) return { cov: 0, lit: 0 };
  let d = Math.min(box(x, y, x0, top, x0 + 10, bottom), box(x, y, x1 - 10, top, x1, bottom));
  let lit = cover(Math.abs(x - (x0 + 2)) - 1.5) + cover(Math.abs(x - (x1 - 8)) - 1.5);
  for (let ry = top; ry < bottom; ry += 64) {
    d = Math.min(d, segment(x, y, x0, ry, x1, ry, 3));
    d = Math.min(d, segment(x, y, x0, ry, x1, ry + 64, 2.2));
    lit += cover(Math.abs(y - (ry - 2)) - 0.8) * (x > x0 && x < x1 ? 1 : 0);
  }
  return { cov: cover(d), lit: clamp01(lit) };
}

function rails(x, y) {
  if (x < 270) return 0;
  return Math.max(cover(Math.abs(y - 612) - 3.5), cover(Math.abs(y - 646) - 3.5));
}

function floor(x, y) {
  const pool = 0.07 * Math.exp(-(((x - CX) / 360) ** 2) - ((y - 960) / 120) ** 2);
  const plank = 0.85 + 0.15 * (Math.floor(x / 140 + (y - FLOOR_TOP) * 0.01) % 2);
  const k = (0.025 + pool) * plank;
  const edge = cover(Math.abs(y - FLOOR_TOP) - 1.2) * 0.12;
  return [k + edge, k * 0.97 + edge, k * 0.93 + edge];
}

const SKIN = [0.62, 0.3, 0.19];
const SHIRT = [0.02, 0.02, 0.022];
const CAP = [0.025, 0.035, 0.07];

function speaker(x, y) {
  const parts = [];
  const torso = box(x, y, CX - 150, 510, CX + 150, H + 80, 70);
  const fabric = 0.85 + 0.3 * Math.sin(x * 0.08 + Math.sin(y * 0.05) * 3) * Math.sin(y * 0.03);
  let shirt = scale(SHIRT, fabric);
  const print = Math.abs(ellipse(x, y, CX, 590, 32, 32)) - 2.5;
  shirt = mix(shirt, [0.22, 0.2, 0.17], cover(print));
  const letters = box(x, y, CX - 22, 586, CX + 22, 594);
  shirt = mix(shirt, [0.2, 0.19, 0.17], cover(letters) * (Math.floor(x / 4) % 2));
  parts.push({ d: torso, c: shirt });
  const neck = box(x, y, CX - 26, 470, CX + 26, 525, 8);
  parts.push({ d: neck, c: scale(SKIN, 0.62) });
  const collar = Math.abs(ellipse(x, y, CX, 512, 46, 22)) - 3;
  parts.push({ d: Math.max(collar, 505 - y), c: [0.035, 0.035, 0.04] });
  for (const side of [-1, 1]) parts.push({ d: ellipse(x, y, CX + side * 50, 438, 9, 17), c: scale(SKIN, 0.7) });
  const face = ellipse(x, y, CX, 432, 50, 62);
  const light = 0.75 + 0.35 * clamp01(0.5 - (x - CX) / 100) - 0.25 * clamp01((y - 470) / 30);
  let skin = scale(SKIN, light);
  for (const ex of [CX - 20, CX + 21]) {
    skin = mix(skin, [0.92, 0.9, 0.86], cover(ellipse(x, y, ex, 428, 7.5, 4)));
    skin = mix(skin, [0.03, 0.02, 0.015], cover(ellipse(x, y, ex + 1, 428, 3.2, 3.2)));
    skin = mix(skin, [0.08, 0.04, 0.03], cover(segment(x, y, ex - 9, 414, ex + 9, 413, 1.6)));
  }
  const smile = Math.abs(Math.hypot(x - CX, y - 432) - 34) - 1.6;
  skin = mix(skin, [0.18, 0.06, 0.05], cover(Math.max(smile, 452 - y, Math.abs(x - CX) - 18)));
  const teeth = Math.max(Math.hypot(x - CX, y - 432) - 33, 456 - y, Math.abs(x - CX) - 13);
  skin = mix(skin, [0.8, 0.78, 0.72], cover(teeth));
  skin = mix(skin, scale(skin, 0.75), cover(segment(x, y, CX + 2, 430, CX + 5, 448, 1.5)));
  parts.push({ d: face, c: skin });
  const crown = Math.max(ellipse(x, y, CX, 392, 56, 50), y - 392);
  const capLight = 0.8 + 0.6 * clamp01(0.5 - (x - CX) / 120);
  let cap = scale(CAP, capLight);
  cap = mix(cap, [0.55, 0.53, 0.5], cover(box(x, y, CX - 13, 366, CX + 13, 378, 2)) * (Math.floor((x - CX) / 3) % 2 ? 1 : 0.6));
  parts.push({ d: crown, c: cap });
  parts.push({ d: ellipse(x, y, CX + 14, 394, 74, 10), c: scale(CAP, 0.7) });
  for (const side of [-1, 1]) {
    parts.push({ d: segment(x, y, CX + side * 140, 560, CX + side * 118, 650, 26), c: scale(SHIRT, 0.9) });
    parts.push({ d: ellipse(x, y, CX + side * 108, 660, 30, 17), c: scale(SKIN, side < 0 ? 1.0 : 0.85) });
  }
  let cov = 0;
  let col = [0, 0, 0];
  for (const p of parts) {
    const a = cover(p.d);
    col = mix(col, p.c, a);
    cov = cov + (1 - cov) * a;
  }
  return { cov, col: cov > 0 ? scale(col, 1 / cov) : col };
}

function lectern(x, y, behind) {
  const top = 668;
  const slab = box(x, y, CX - 160, top - 9, CX + 160, top + 9, 3);
  const body = trapezoid(x, y, top, H + 40, CX - 140, CX + 140, CX - 118, CX + 118);
  const mug = box(x, y, CX + 38, top - 58, CX + 76, top - 8, 5);
  const handle = Math.abs(ellipse(x, y, CX + 80, top - 36, 13, 15)) - 3.5;
  const paperD = trapezoid(x, y, top - 14, top - 7, CX - 110, CX - 10, CX - 118, CX - 2);
  const cov = Math.max(cover(slab), cover(body), cover(mug), cover(handle), cover(paperD));
  let c = mix(scale(behind, 0.7), [0.03, 0.045, 0.06], 0.25);
  const sheen = 0.06 * Math.exp(-(((x - (CX - 60)) / 18) ** 2));
  c = c.map((v) => v + sheen);
  const edgeL = cover(Math.abs(x - (CX - 140 + ((CX - 118 - (CX - 140)) * (y - top)) / (H - top))) - 1.5);
  const edgeR = cover(Math.abs(x - (CX + 140 - ((CX + 140 - (CX + 118)) * (y - top)) / (H - top))) - 1.5);
  if (y > top) c = mix(c, [0.4, 0.45, 0.5], Math.max(edgeL, edgeR) * 0.8);
  c = mix(c, [0.45, 0.5, 0.55], cover(slab));
  c = mix(c, [0.85, 0.88, 0.9], cover(Math.max(Math.abs(y - (top - 8)) - 1, Math.abs(x - CX) - 158)));
  const paperLines = Math.floor(x / 3) % 3 === 0 ? 0.35 : 1;
  c = mix(c, scale([0.78, 0.78, 0.74], y < top - 9 && y > top - 13 ? paperLines : 1), cover(paperD));
  const mugShade = 0.78 + 0.18 * clamp01(1 - (x - (CX + 38)) / 22);
  c = mix(c, scale([0.82, 0.82, 0.8], mugShade), Math.max(cover(mug), cover(handle)));
  return { cov, col: c };
}

const rgb = Buffer.alloc(W * H * 3);
const masks = { wall: Buffer.alloc(W * H), mid: Buffer.alloc(W * H), speaker: Buffer.alloc(W * H), lectern: Buffer.alloc(W * H) };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const wallCov = cover(y - WALL_BOTTOM);
    let col = wallCov > 0 ? scale(wall(x, y), 1) : [0, 0, 0];
    const curtainCov = cover(WALL_BOTTOM - y + 0.5) * cover(y - FLOOR_TOP);
    const truss = trussCoverage(x, y);
    const railCov = rails(x, y);
    const midCov = clamp01(Math.max(curtainCov, truss.cov, railCov));
    let mid = curtain(x, y);
    mid = mix(mid, mix([0.03, 0.03, 0.032], [0.24, 0.24, 0.25], truss.lit), truss.cov);
    const railLit = 0.18 + 0.4 * Math.exp(-(((x - CX + 200) / 260) ** 2));
    mid = mix(mid, [railLit, railLit, railLit * 1.03], railCov);
    col = mix(col, mid, midCov);
    const floorCov = cover(FLOOR_TOP - y);
    col = mix(col, floor(x, y), floorCov);
    const sp = speaker(x, y);
    col = mix(col, sp.col, sp.cov);
    const lec = lectern(x, y, col);
    col = mix(col, lec.col, lec.cov);

    const visLectern = lec.cov;
    const visSpeaker = sp.cov * (1 - visLectern);
    const visFloor = floorCov * (1 - sp.cov) * (1 - visLectern);
    const visMid = midCov * (1 - floorCov) * (1 - sp.cov) * (1 - visLectern);
    const visWall = wallCov * (1 - midCov) * (1 - floorCov) * (1 - sp.cov) * (1 - visLectern);
    const i = y * W + x;
    masks.wall[i] = Math.round(visWall * 255);
    masks.mid[i] = Math.round(visMid * 255);
    masks.speaker[i] = Math.round(visSpeaker * 255);
    masks.lectern[i] = Math.round(visLectern * 255);
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = toSrgb(col[k]);
  }
}

writePng("stage.png", 3, rgb);
writePng("mask-wall.png", 1, masks.wall);
writePng("mask-mid.png", 1, masks.mid);
writePng("mask-subject.png", 1, masks.speaker);
writePng("mask-lectern.png", 1, masks.lectern);

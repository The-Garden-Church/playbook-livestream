import * as k from "../anatomy/kit/iso-kit.mjs";
import * as G from "../anatomy/kit/lathe.mjs";
import { kitScript } from "../anatomy/scripts/inline-kit.mjs";
import { writeFigure } from "../embed.mjs";
import { springTo } from "../spring.mjs";

const WIDTH = 600;
const HEIGHT = 400;
const AZIMUTH = 50;

const STOPS = [2, 2.8, 4, 5.6, 8, 11, 16];
const lightOf = (n) => (2 / n) ** 2;
const stopsBelow = (n) => Math.round(Math.log2((n / 2) ** 2));
const readoutOf = (n) => (n === 2 ? "f/2 · wide open, most light" : `f/${n} · ${stopsBelow(n)} stop${stopsBelow(n) === 1 ? "" : "s"} less light than f/2`);

const AXIS_Z = 54;
const YF = 36;
const DEPTH = 2;
const YI = YF - DEPTH;
const LENGTH = 55;
const YR = YF - LENGTH;
const YS = -72;
const YFAR = 170;

const BORE = 26;
const OPEN_MAX = 19;
const BEAM = 23;
const HOUSING_R = 34;
const RING_R = 36;
const GRIP_R = 36.8;
const PIN_R = 30;
const RING_FRONT = 4.4;
const GRIP_FROM = 14.8;
const RING_BACK = 19;
const NUMBER_S = 9.6;
const STEP_DEG = 24;
const RIBS = 72;

const DIE = { w: 22, h: 16 };
const PLATE = { x: -58, y: -104, w: 116, d: 166, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;
const RAIL = { x: -9, y: -98, w: 18, d: 154, r: 1.5 };
const RAIL_H = 4;
const STRIP = { x: PLATE.x + PLATE.w - 13, y: -92, w: 7, d: 138, r: 1 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [0, YF, AXIS_Z + RING_R + 1],
    [RING_R, YF, AXIS_Z],
    [-RING_R, YF, AXIS_Z],
    [0, YF - RING_BACK, AXIS_Z + GRIP_R],
    [-32, YS - 5, 88],
    [32, YS - 5, 88],
  ],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: AZIMUTH },
);

const F = G.frameOf([0, YF, AXIS_Z], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
const V = G.viewOf(P);
const FACE_ANGLE = G.angleToward(F, V);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const r2 = (n) => Math.round(n * 100) / 100;
const flatOf = (vector) => {
  const a = at([0, 0, 0]);
  const b = at(vector);
  return [b[0] - a[0], b[1] - a[1]];
};
const matrixOf = (origin, right, down) => {
  const o = at(origin);
  const x = flatOf(right);
  const y = flatOf(down);
  return `matrix(${[x[0], x[1], y[0], y[1], o[0], o[1]].map(r2).join(" ")})`;
};
const faceAt = (y) => matrixOf([0, y, AXIS_Z], [1, 0, 0], [0, 0, -1]);
const FACE_FRONT = faceAt(YF);
const FACE_IRIS = faceAt(YI);
const FACE_DIE = faceAt(YS);
const circleD = (r, steps = 72) => k.pathOf(Array.from({ length: steps }, (_, i) => [r * Math.cos((i / steps) * 2 * Math.PI), r * Math.sin((i / steps) * 2 * Math.PI)]), true);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const N_BLADES = 7;
const RHO = 34;
const PIVOT = (() => {
  const c0 = 33;
  const reach = 17;
  const gamma = Math.acos((PIN_R * PIN_R + c0 * c0 - reach * reach) / (2 * PIN_R * c0));
  const angle = Math.PI - gamma;
  return { q: [PIN_R * Math.cos(angle), PIN_R * Math.sin(angle)], c0: [-c0, 0], reach };
})();

function irisOf(r) {
  const n = IRIS.n, rho = IRIS.rho, bore = IRIS.bore, q = IRIS.q, c0 = IRIS.c0;
  const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const w0 = [c0[0] - q[0], c0[1] - q[1]];
  const qd = Math.hypot(q[0], q[1]);
  const wd = Math.hypot(w0[0], w0[1]);
  const start = Math.atan2(q[0] * w0[1] - q[1] * w0[0], q[0] * w0[0] + q[1] * w0[1]);
  const want = rho - r;
  const cos = Math.max(-1, Math.min(1, (want * want - qd * qd - wd * wd) / (2 * qd * wd)));
  const swing = Math.sign(start) * Math.acos(cos) - start;
  const w = rot(w0, swing);
  const c = [q[0] + w[0], q[1] + w[1]];
  const centres = [];
  const pins = [];
  for (let i = 0; i < n; i++) {
    centres.push(rot(c, (i / n) * Math.PI * 2));
    pins.push(rot(q, (i / n) * Math.PI * 2));
  }
  const meet = (a, b) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const half = Math.hypot(dx, dy) / 2;
    const h = Math.sqrt(Math.max(0, rho * rho - half * half));
    const px = -dy / (2 * half), py = dx / (2 * half);
    const one = [mx + px * h, my + py * h], two = [mx - px * h, my - py * h];
    return Math.hypot(one[0], one[1]) < Math.hypot(two[0], two[1]) ? one : two;
  };
  const corners = centres.map((centre, i) => meet(centre, centres[(i + 1) % n]));
  const angleAt = (centre, p) => Math.atan2(p[1] - centre[1], p[0] - centre[0]);
  const along = (centre, a) => [centre[0] + rho * Math.cos(a), centre[1] + rho * Math.sin(a)];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const sides = [];
  const curves = [];
  for (let i = 0; i < n; i++) {
    const centre = centres[i];
    const from = corners[(i + n - 1) % n];
    const to = corners[i];
    const a0 = angleAt(centre, from);
    const span = wrap(angleAt(centre, to) - a0);
    const side = [];
    for (let j = 0; j <= 10; j++) side.push(along(centre, a0 + (span * j) / 10));
    sides.push(side);
    const curve = [to];
    const dir = Math.sign(span) || 1;
    for (let j = 1; j < 200; j++) {
      const p = along(centre, a0 + span + dir * j * 0.02);
      curve.push(p);
      if (Math.hypot(p[0], p[1]) > bore + 3) break;
    }
    curves.push(curve);
  }
  const rim = bore + 3;
  const regions = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const outer = curves[next][curves[next].length - 1];
    const inner = curves[i][curves[i].length - 1];
    const a0 = Math.atan2(outer[1], outer[0]);
    const span = wrap(Math.atan2(inner[1], inner[0]) - a0);
    const arc = [];
    for (let j = 0; j <= 12; j++) arc.push([rim * Math.cos(a0 + (span * j) / 12), rim * Math.sin(a0 + (span * j) / 12)]);
    regions.push([...sides[next], ...curves[next].slice(1), ...arc, ...[...curves[i]].reverse().slice(1)]);
  }
  const fmt = (points, closed) => points.map(([x, y], j) => (j ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2)).join("") + (closed ? "Z" : "");
  const hole = [];
  sides.forEach((side, i) => hole.push(...(i ? side.slice(1) : side)));
  const inside = (p) => Math.min(...centres.map((centre) => rho - Math.hypot(p[0] - centre[0], p[1] - centre[1])));
  return {
    hole: fmt(hole, true),
    curves: curves.map((curve) => fmt(curve, false)),
    regions: regions.map((region) => fmt(region, true)),
    pins,
    inside,
  };
}

const IRIS = { n: N_BLADES, rho: RHO, bore: BORE, q: PIVOT.q, c0: PIVOT.c0 };
const openOf = (n) => (OPEN_MAX * 2) / n;
const START = 2;
const iris0 = irisOf(openOf(STOPS[START]));

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 16))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "lo", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  out.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(STRIP.y + 3, STRIP.y + STRIP.d - 3, 4, 5, STRIP.x + STRIP.w - 0.2, 0.6, [-2, -3.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const label = { x: 12, y: 44, w: 26, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  [[4, 20], [7, 16], [10, 12]].forEach(([dy, w]) => out.push(L(k.lineOnTop([label.x + 3.5, label.y + label.d - dy], [label.x + 3.5 + w, label.y + label.d - dy], 0.8, P), { tone: "lo", free: true })));
  out.push(S(k.slabOf(RAIL, 0, RAIL_H, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([RAIL.x + RAIL.w / 2, RAIL.y], [RAIL.x + RAIL.w / 2, RAIL.y + RAIL.d], RAIL_H, P), { tone: "faint" }));
  for (const y of [RAIL.y - 4, RAIL.y + RAIL.d]) {
    out.push(S(k.slabOf({ x: RAIL.x - 3, y, w: RAIL.w + 6, d: 4, r: 1 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([RAIL.x, y + 2, 7]), at([RAIL.x + RAIL.w, y + 2, 7])], { size: 0.45 }));
  }
  return out.join("");
}

function carriage(y, w, d) {
  const plan = { x: -w / 2, y: y - d / 2, w, d, r: 2 };
  const out = [S(k.slabOf(plan, RAIL_H, 4, P, 4, 0.6), { tone: "mid" })];
  out.push(D([at([plan.x + 3, y - d / 2 + 2.5, RAIL_H + 4]), at([plan.x + 3, y + d / 2 - 2.5, RAIL_H + 4])], { size: 0.45 }));
  const knob = [plan.x + plan.w + 3.4, y];
  out.push(S(k.slabOf({ x: plan.x + plan.w - 0.5, y: y - 1.4, w: 2.4, d: 2.8, r: 0.8 }, RAIL_H + 1, 2.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(knob[0], knob[1], 2.6, RAIL_H - 0.5, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 2.6, RAIL_H - 0.5, RAIL_H + 4.5, 18, P), { tone: "lo" }));
  return out.join("");
}

function cradle(y) {
  const half = 18;
  const top = AXIS_Z - Math.sqrt(HOUSING_R * HOUSING_R - half * half);
  const plan = { x: -half - 2, y: y - 4, w: (half + 2) * 2, d: 8, r: 1.4 };
  const out = [carriage(y, 46, 14)];
  out.push(S(k.slabOf(plan, RAIL_H + 4, top - RAIL_H - 4 + 1.2, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, RAIL_H + 8, P, 3), { tone: "faint" }) }));
  out.push(D([at([plan.x + plan.w - 3, y + 4, RAIL_H + 5.5]), at([plan.x + 3, y + 4, RAIL_H + 5.5])], { size: 0.45 }));
  return out.join("");
}

function sensorStand() {
  const out = [carriage(YS - 6, 52, 18)];
  const post = { x: -26, y: YS - 12, w: 52, d: 4, r: 1.2 };
  out.push(S(k.slabOf(post, RAIL_H + 4, 72, P, 3, 0.5), { tone: "mid" }));
  const board = { x: -32, y: YS - 8, w: 64, d: 2.2, r: 0.8 };
  out.push(S(k.slabOf(board, 20, 68, P, 2, 0.4), { tone: "mid" }));
  const front = YS - 5.8;
  const corner = (x, z) => at([x, front, z]);
  out.push(D([corner(-28, 24), corner(28, 24), corner(-28, 84), corner(28, 84)], { size: 0.55, tone: "hi" }));
  out.push(L([[-28, 24], [28, 24], [-28, 84], [28, 84]].map(([x, z]) => k.pathOf(Array.from({ length: 17 }, (_, i) => at([x + 2 * Math.cos((i / 16) * 2 * Math.PI), front, z + 2 * Math.sin((i / 16) * 2 * Math.PI)])))).join(""), { tone: "lo" }));
  for (const [x, z, w, h] of [[-26, 30, 6, 3], [-26, 36, 6, 3], [18, 30, 8, 4], [20, 74, 6, 6], [-25, 72, 4, 8]]) {
    out.push(S(k.slabOf({ x, y: front, w, d: 1.2, r: 0.3 }, z, h, P, 1), { tone: "lo", crease: "none" }));
  }
  const pack = { x: -16, y: front, w: 32, d: 1.6, r: 1 };
  out.push(S(k.slabOf(pack, AXIS_Z - 13, 26, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  const glass = { x: -DIE.w / 2, y: front + 1.6, w: DIE.w, d: YS - front - 1.6, r: 0.4 };
  out.push(S(k.slabOf(glass, AXIS_Z - DIE.h / 2, DIE.h, P, 2), { tone: "hi", crease: "lo" }));
  const pads = [];
  for (let i = 0; i < 8; i++) {
    const x = -13 + (i * 26) / 7;
    pads.push(at([x, front + 1.6, AXIS_Z + 11.4]), at([x, front + 1.6, AXIS_Z - 11.4]));
  }
  out.push(D(pads, { size: 0.4, tone: "mid" }));
  return out.join("");
}

function lens() {
  const out = [];
  out.push(S(G.disc(49.5, LENGTH, 27, F, P), { tone: "lo" }));
  out.push(S(G.disc(46, 49.5, 32, F, P), { tone: "mid", inner: L(G.arcOf(F, 47.8, 32, P), { tone: "faint" }) }));
  for (const a of [0.4, 2.5, 4.6]) {
    out.push(S(G.prismOf(G.frameOf(G.pointOf(F, 49.5, 0, 0), F.a, G.radialOf(F, a), G.tangentOf(F, a)), [[27, -5], [30.5, -4], [30.5, 4], [27, 5]], 0, 2.2, P), { tone: "lo" }));
  }
  out.push(S(G.solidOf([[RING_BACK + 0.4, HOUSING_R], [42, HOUSING_R], [46, 30.5]], F, P), { tone: "mid", inner: L(G.arcOf(F, 30, HOUSING_R, P), { tone: "faint" }) }));
  out.push(D(G.dotsOf(F, 36, HOUSING_R, 3, P, { phase: FACE_ANGLE - 0.5, fade: [0.04, 0.42] }), { size: 0.5 }));
  out.push(S(G.solidOf([[RING_FRONT, RING_R], [GRIP_FROM, RING_R], [GRIP_FROM, GRIP_R], [RING_BACK, GRIP_R]], F, P), { tone: "mid" }));
  out.push(`<g data-part="ribs">${Array.from({ length: RIBS }, () => `<path class="iso-line" data-tone="lo" d=""/>`).join("")}</g>`);
  out.push(`<g data-part="numbers">${STOPS.map((stop) => `<text class="iso-face-text" data-tone="mid" font-size="4" text-anchor="middle" dominant-baseline="central">${stop}</text>`).join("")}</g>`);
  out.push(S(G.disc(0, RING_FRONT, HOUSING_R, F, P), { tone: "mid" }));
  const tick = [G.pointOf(F, 0.8, HOUSING_R, FACE_ANGLE), G.pointOf(F, RING_FRONT, HOUSING_R, FACE_ANGLE)].map(at);
  out.push(L(k.pathOf(tick), { tone: "hi" }));
  out.push(D([at(G.pointOf(F, 0.8, HOUSING_R, FACE_ANGLE))], { size: 0.7, tone: "hi" }));
  return out.join("");
}

function face() {
  const out = [];
  out.push(`<g transform="${FACE_FRONT}">`);
  out.push(`<path class="iso-line" data-tone="lo" d="${circleD(BORE + 1.4)}"/>`);
  out.push(`<path class="ap-wall" d="${circleD(BORE)}"/>`);
  out.push(D(iris0.pins.map(([x, y]) => [x, y]), { size: 0.55, tone: "mid" }).replace('<g class="iso-dots"', '<g class="iso-dots" data-part="pins"'));
  out.push(`</g>`);
  out.push(`<clipPath id="ap-bore"><path transform="${FACE_FRONT}" d="${circleD(BORE)}"/></clipPath>`);
  out.push(`<clipPath id="ap-hole"><path data-part="hole-clip" transform="${FACE_IRIS}" d="${iris0.hole}"/></clipPath>`);
  out.push(`<g clip-path="url(#ap-bore)"><g transform="${FACE_IRIS}">`);
  out.push(`<path class="ap-blade" d="${circleD(BORE + 3)}"/>`);
  for (let i = 0; i < N_BLADES; i++) out.push(`<clipPath id="ap-blade-${i}"><path data-part="region" d="${iris0.regions[i]}"/></clipPath>`);
  for (let i = 0; i < N_BLADES; i++) out.push(`<path class="ap-tone" data-part="tone" style="opacity:${r2(0.025 + 0.06 * (0.5 + 0.5 * Math.cos((i / N_BLADES) * 2 * Math.PI - 0.9)))}" d="${iris0.regions[i]}"/>`);
  for (let i = 0; i < N_BLADES; i++) out.push(`<path class="ap-shadow" data-part="shadow" clip-path="url(#ap-blade-${i})" d="${iris0.curves[i]}"/>`);
  out.push(`<path class="ap-glint" d="${circleD(BEAM)}"/>`);
  for (let i = 0; i < N_BLADES; i++) out.push(`<path class="iso-line" data-tone="hi" data-part="curve" d="${iris0.curves[i]}"/>`);
  out.push(`<path class="ap-hole" data-part="hole" d="${iris0.hole}"/>`);
  out.push(`<path class="iso-line" data-tone="lit" data-part="hole-edge" d="${iris0.hole}"/>`);
  out.push(`</g></g>`);
  return out.join("");
}

const RAYS = [[-3, 2], [6, -6], [-10, -8], [12.5, 8.5], [-16, 6.5], [4, 17.5], [-7.5, 19.5], [19.5, -6]];

function beam() {
  const ring = (y, r) => Array.from({ length: 48 }, (_, i) => at([r * Math.cos((i / 48) * 2 * Math.PI), y, AXIS_Z + r * Math.sin((i / 48) * 2 * Math.PI)]));
  const far = at([0, YFAR, AXIS_Z]);
  const near = at([0, YF + 4, AXIS_Z]);
  const hull = k.pathOf(convex([...ring(YFAR, BEAM), ...ring(YF, BEAM)]), true);
  const out = [];
  out.push(`<linearGradient id="ap-beam" gradientUnits="userSpaceOnUse" x1="${r2(far[0])}" y1="${r2(far[1])}" x2="${r2(near[0])}" y2="${r2(near[1])}"><stop offset="0" stop-color="var(--anatomy-lit)" stop-opacity="0"/><stop offset=".55" stop-color="var(--anatomy-lit)" stop-opacity=".07"/><stop offset="1" stop-color="var(--anatomy-lit)" stop-opacity=".1"/></linearGradient>`);
  out.push(`<path d="${hull}" fill="url(#ap-beam)"/>`);
  return out.join("");
}

function rays() {
  const out = [];
  RAYS.forEach(([u, v], i) => {
    const x = u, z = AXIS_Z - v;
    const start = at([x, YFAR - 30, z]);
    const hit = at([x, YI, z]);
    out.push(k.fadeLineSvg([start, at([x, (YFAR - 30 + YI) / 2, z]), hit], { fade: [60, 0], tone: "lit", className: "ap-ray" }));
    out.push(`<path class="iso-line ap-through" data-tone="lit" clip-path="url(#ap-hole)" d="${k.pathOf([hit, at([x, YI - 90, z])])}"/>`);
    out.push(`<circle class="ap-splash" data-part="splash" data-ray="${i}" cx="${r2(hit[0])}" cy="${r2(hit[1])}" r="1.6" opacity="0"/>`);
  });
  return out.join("");
}

function convex(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const CSS = `<style>
.ap-wall{fill:var(--anatomy-shade-0)}
.ap-blade{fill:var(--anatomy-top)}
.ap-tone{fill:var(--anatomy-lit)}
.ap-shadow{fill:none;stroke:#000;stroke-opacity:.7;stroke-width:4;stroke-linecap:round}
.ap-glint{fill:var(--anatomy-lit);opacity:.06}
.ap-hole{fill:var(--anatomy-lit);opacity:.9}
.ap-splash{fill:url(#ap-glow)}
.ap-ray .iso-line,.ap-ray.iso-line{stroke-opacity:.6}
.ap-ray stop{stop-opacity:.6}
.ap-through{stroke-opacity:.35}
.ap-cone{fill:var(--anatomy-lit)}
.ap-patch{fill:url(#ap-glow)}
.iso-stage{touch-action:none;cursor:grab;outline:none;overflow:hidden}
@media (max-width:560px){.iso-stage .iso-svg{width:122%;margin:-4% -14% -4% -8%}}
.iso-stage[data-drag]{cursor:grabbing}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const DATA = {
  P,
  F,
  V,
  stops: STOPS,
  start: START,
  faceAngle: FACE_ANGLE,
  step: (STEP_DEG * Math.PI) / 180,
  ringR: RING_R,
  gripR: GRIP_R,
  gripFrom: GRIP_FROM,
  ringBack: RING_BACK,
  numberS: NUMBER_S,
  ribs: RIBS,
  openMax: OPEN_MAX,
  axisZ: AXIS_Z,
  yr: YR,
  ys: YS,
  die: DIE,
  rays: RAYS,
  iris: IRIS,
  readouts: STOPS.map(readoutOf),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A camera lens on a test bench with its front glass taken off, so you can see the iris inside: seven curved metal blades that overlap to leave a hole in the middle. A beam of light comes in from the front. Only the light that fits through the hole carries on out of the back of the lens and lands on the image sensor standing behind it. Turning the ribbed aperture ring swings the blades open or closed.",
  body: [
    `<defs><radialGradient id="ap-glow"><stop offset="0" stop-color="var(--anatomy-lit)" stop-opacity="1"/><stop offset=".7" stop-color="var(--anatomy-lit)" stop-opacity=".85"/><stop offset="1" stop-color="var(--anatomy-lit)" stop-opacity=".55"/></radialGradient></defs>`,
    bench(),
    sensorStand(),
    `<g transform="${FACE_DIE}"><rect class="ap-patch" data-part="patch" x="${-DIE.w / 2 + 0.8}" y="${-DIE.h / 2 + 0.8}" width="${DIE.w - 1.6}" height="${DIE.h - 1.6}" rx="1" opacity="${r2(2 / STOPS[START])}"/></g>`,
    `<path class="ap-cone" data-part="cone" d=""/>`,
    cradle(YF - 40),
    cradle(YF - 26),
    lens(),
    face(),
    beam(),
    rays(),
  ],
});

const live = `
const DATA = ${JSON.stringify(DATA)};
const IRIS = DATA.iris;
const irisOf = ${irisOf.toString()};
const springTo = ${springTo.toString()};
const { P, F, V } = DATA;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const q = (sel) => [...svg.querySelectorAll(sel)];
const ribs = q('[data-part="ribs"] path');
const numbers = q('[data-part="numbers"] text');
const regions = q('[data-part="region"], [data-part="tone"]');
const shadows = q('[data-part="shadow"]');
const curves = q('[data-part="curve"]');
const hole = svg.querySelector('[data-part="hole"]');
const holeEdge = svg.querySelector('[data-part="hole-edge"]');
const holeClip = svg.querySelector('[data-part="hole-clip"]');
const pins = q('[data-part="pins"] circle');
const splashes = q('[data-part="splash"]');
const cone = svg.querySelector('[data-part="cone"]');
const patch = svg.querySelector('[data-part="patch"]');
const last = DATA.stops.length - 1;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fOf = (pos) => { const i = clamp(Math.floor(pos), 0, last - 1); const t = clamp(pos - i, 0, 1); return Math.exp(Math.log(DATA.stops[i]) * (1 - t) + Math.log(DATA.stops[i + 1]) * t); };
const point = (s, r, a) => [F.o[0] + F.a[0] * s + r * (Math.cos(a) * F.u[0] + Math.sin(a) * F.v[0]), F.o[1] + F.a[1] * s + r * (Math.cos(a) * F.u[1] + Math.sin(a) * F.v[1]), F.o[2] + F.a[2] * s + r * (Math.cos(a) * F.u[2] + Math.sin(a) * F.v[2])];
const radial = (a) => [Math.cos(a) * F.u[0] + Math.sin(a) * F.v[0], Math.cos(a) * F.u[1] + Math.sin(a) * F.v[1], Math.cos(a) * F.u[2] + Math.sin(a) * F.v[2]];
const facing = (a) => { const n = radial(a); return n[0] * V[0] + n[1] * V[1] + n[2] * V[2]; };
const flat = (v) => { const a = iso([0, 0, 0], P), b = iso(v, P); return [b[0] - a[0], b[1] - a[1]]; };
const fx = (n) => Math.round(n * 100) / 100;
const tangentFlat = flat([-Math.sin(DATA.faceAngle) * F.u[0] + Math.cos(DATA.faceAngle) * F.v[0], -Math.sin(DATA.faceAngle) * F.u[1] + Math.cos(DATA.faceAngle) * F.v[1], -Math.sin(DATA.faceAngle) * F.u[2] + Math.cos(DATA.faceAngle) * F.v[2]]);
const perStop = Math.hypot(tangentFlat[0], tangentFlat[1]) * DATA.ringR * DATA.step;
const dragDir = [-tangentFlat[0] / Math.hypot(...tangentFlat), -tangentFlat[1] / Math.hypot(...tangentFlat)];
const axisFlat = flat(F.a);
function drawRing(pos) {
  const turn = -pos * DATA.step;
  ribs.forEach((path, j) => {
    const a = turn + (j / DATA.ribs) * Math.PI * 2;
    const alpha = smooth(0.1, 0.55, facing(a));
    if (alpha < 0.02) { if (path.getAttribute("d")) path.setAttribute("d", ""); return; }
    path.setAttribute("d", pathOf([iso(point(DATA.gripFrom, DATA.gripR, a), P), iso(point(DATA.ringBack, DATA.gripR, a), P)]));
    path.setAttribute("opacity", alpha.toFixed(2));
  });
  numbers.forEach((text, j) => {
    const a = DATA.faceAngle + (j - pos) * DATA.step;
    const alpha = smooth(0.25, 0.7, facing(a));
    text.setAttribute("opacity", alpha.toFixed(2));
    if (alpha < 0.02) return;
    const o = iso(point(DATA.numberS, DATA.ringR, a), P);
    const t = flat([-(-Math.sin(a) * F.u[0] + Math.cos(a) * F.v[0]), -(-Math.sin(a) * F.u[1] + Math.cos(a) * F.v[1]), -(-Math.sin(a) * F.u[2] + Math.cos(a) * F.v[2])]);
    text.setAttribute("transform", "matrix(" + [axisFlat[0], axisFlat[1], t[0], t[1], o[0], o[1]].map(fx).join(" ") + ")");
    text.setAttribute("data-tone", Math.abs(j - pos) < 0.5 ? "hi" : "mid");
  });
}
function drawLight(pos) {
  const n = fOf(pos);
  const r = DATA.openMax * 2 / n;
  const shape = irisOf(r);
  regions.forEach((path, i) => path.setAttribute("d", shape.regions[i % IRIS.n]));
  shadows.forEach((path, i) => path.setAttribute("d", shape.curves[i]));
  curves.forEach((path, i) => path.setAttribute("d", shape.curves[i]));
  hole.setAttribute("d", shape.hole);
  holeEdge.setAttribute("d", shape.hole);
  holeClip.setAttribute("d", shape.hole);
  pins.forEach((dot, i) => { dot.setAttribute("cx", fx(shape.pins[i][0])); dot.setAttribute("cy", fx(shape.pins[i][1])); });
  splashes.forEach((dot, i) => dot.setAttribute("opacity", smooth(0.5, -0.5, shape.inside(DATA.rays[i])).toFixed(2)));
  const strength = 2 / n;
  const ring = [];
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; ring.push(iso([r * Math.cos(a), DATA.yr, DATA.axisZ + r * Math.sin(a)], P)); }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ring.push(iso([x * DATA.die.w / 2, DATA.ys, DATA.axisZ + z * DATA.die.h / 2], P));
  cone.setAttribute("d", pathOf(convexHull(ring), true));
  cone.setAttribute("opacity", (0.05 + 0.2 * strength).toFixed(3));
  patch.setAttribute("opacity", (0.08 + 0.92 * strength).toFixed(3));
}
let pos = DATA.start, target = DATA.start, spin = { x: DATA.start, v: 0 }, shown = -1, frame = 0, lastTime = 0, clock = 0, touring = !still.matches, visible = false, idle = 0, drag = null;
const TOUR = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
const tourAt = (t) => TOUR[Math.floor(t / 1.6) % TOUR.length];
function describe() {
  const i = Math.round(pos);
  if (i === shown) return;
  shown = i;
  readout.textContent = DATA.readouts[i];
  stage.setAttribute("aria-valuenow", String(DATA.stops[i]));
  stage.setAttribute("aria-valuetext", DATA.readouts[i]);
}
function draw() { drawRing(pos); drawLight(pos); describe(); }
function tick(now) {
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
  lastTime = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = tourAt(clock); }
  let moving = false;
  if (calm) pos = target;
  else if (touring) {
    pos += (target - pos) * (1 - Math.exp(-dt / 0.22));
    if (Math.abs(target - pos) < 0.002) pos = target;
    moving = pos !== target;
  } else {
    spin.x = pos;
    moving = springTo(spin, target, dt);
    pos = spin.x;
  }
  if (calm || touring) spin.v = 0;
  draw();
  frame = visible && (touring || moving) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { lastTime = 0; frame = requestAnimationFrame(tick); } };
const hold = () => { touring = false; clearTimeout(idle); };
const rest = () => { clearTimeout(idle); idle = setTimeout(() => { if (drag) return; touring = !still.matches; clock = (TOUR.indexOf(target) + 0.5) * 1.6; run(); }, 3600); };
const steer = (next, from) => { hold(); target = clamp(next, 0, last); if (target !== from) window.detent(); rest(); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const svgScale = () => svg.getBoundingClientRect().width / ${WIDTH};
stage.addEventListener("pointerdown", (event) => {
  if (event.button > 0) return;
  hold();
  stage.focus({ preventScroll: true });
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: Math.round(pos) };
  target = drag.from;
  stage.setPointerCapture(event.pointerId);
  stage.setAttribute("data-drag", "");
  event.preventDefault();
});
stage.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  const along = (dx * dragDir[0] + dy * dragDir[1]) / Math.max(26, perStop * 0.95 * svgScale());
  const to = clamp(Math.round(drag.from + along), 0, last);
  if (to === target) return;
  target = to;
  window.detent();
  run();
});
const release = (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  drag = null;
  stage.removeAttribute("data-drag");
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  rest();
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const here = touring ? Math.round(pos) : target;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = here + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = here - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = last;
  if (to === null) return;
  event.preventDefault();
  steer(to, here);
});
if (still.matches) touring = false;
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Aperture",
  hint: "Drag the ring or use arrow keys",
  readout: readoutOf(STOPS[START]),
  keys: [
    { mark: "raised", label: "The iris blades" },
    { mark: "lit", label: "The light reaching the sensor" },
  ],
  caption:
    "The aperture is an adjustable hole inside the lens, made by overlapping blades. Each step down the ring (a “stop”) lets in half as much light. A smaller f-number means a bigger hole.",
  body: `${CSS}<div class="iso-stage" tabindex="0" role="slider" aria-label="Aperture ring. Use the arrow keys to step through the f-stops." aria-valuemin="2" aria-valuemax="16" aria-valuenow="${STOPS[START]}" aria-valuetext="${readoutOf(STOPS[START])}">${svg}</div>`,
});

writeFigure("aperture", { title: "Aperture", body, script: kitScript() + live, width: 650 });

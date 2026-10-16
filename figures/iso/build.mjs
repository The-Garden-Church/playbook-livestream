import * as k from "../anatomy/kit/iso-kit.mjs";
import { kitScript } from "../anatomy/scripts/inline-kit.mjs";
import { writeFigure } from "../embed.mjs";
import { springTo } from "../spring.mjs";

const WIDTH = 650;
const HEIGHT = 330;

const STOPS = [100, 200, 400, 800, 1600, 3200, 6400];
const HOME = 2;
const COLLECTED = 20;
const BASE_NOISE = 2;
const FULL = 100;

const gainOf = (iso) => iso / 400;
const dbOf = (iso) => 6 * Math.log2(iso / 400);
const MINUS = "−";
function readoutOf(iso) {
  const gain = gainOf(iso);
  const db = dbOf(iso);
  const dbText = db === 0 ? "0 dB" : `${db > 0 ? "+" : MINUS}${Math.abs(db)} dB`;
  let say;
  if (gain === 1) say = "as the sensor saw it";
  else if (gain > 1) say = `${gain}× brighter, ${gain}× the noise`;
  else if (gain === 0.5) say = "half as bright, half the noise";
  else say = "\u00bc as bright, \u00bc the noise";
  return `ISO ${iso} · ${dbText} · ${say}`;
}

const PLATE = { x: -206, y: -46, w: 412, d: 100, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const WIN_Z0 = 30;
const WIN_Z1 = 108;
const WIN_H = WIN_Z1 - WIN_Z0;
const BODY_TOP = 118;
const RECESS = 3.4;

const WELL = { plinth: { x: -190, y: -32, w: 72, d: 70, r: 3 }, body: { x: -182, y: -22, w: 56, d: 40, r: 2.4 }, win: [-168, -140], clip: "ig-well-clip" };
const METER = { plinth: { x: 118, y: -32, w: 72, d: 70, r: 3 }, body: { x: 126, y: -22, w: 56, d: 40, r: 2.4 }, win: [140, 168], clip: "ig-meter-clip" };
const AMP = { plinth: { x: -74, y: -38, w: 148, d: 78, r: 3 }, body: { x: -64, y: -28, w: 128, d: 56, r: 3 } };
const PLINTH_H = 4;
const AMP_TOP = 46;
const KNOB = [6, -2];
const SKIRT_R = 27;
const KNOB_R = 17;
const KNOB_Z = AMP_TOP + 1.2 + 3;
const KNOB_TOP = KNOB_Z + 13;
const SWEEP_FROM = (-135 * Math.PI) / 180;
const SWEEP = (270 * Math.PI) / 180;
const angleAt = (index) => SWEEP_FROM + (index / (STOPS.length - 1)) * SWEEP;

const POSTS = { well: [-122, 32], ampIn: [-58, 32], ampOut: [58, 32], meter: [122, 32] };
const POST_TOP = PLINTH_H + 15;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [WELL.body.x, WELL.body.y, BODY_TOP + 8], [METER.body.x + METER.body.w, METER.body.y, BODY_TOP + 12]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 76 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const poly = (points) => k.pathOf(points.map(at), true);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -60, y: PLATE.y + PLATE.d - 12, w: 120, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.45 }));
  return out.join("");
}

function plinth(plan) {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 2), 0, PLINTH_H, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(plan, 0, PLINTH_H, P, 4, 0.6), { tone: "mid" }));
  const screws = k.corners(plan, 4.5);
  out.push(D(screws.map(([x, y]) => at([x, y, PLINTH_H])), { size: 0.5 }));
  return out.join("");
}

function meet([a, b], [c, d]) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const q = [d[0] - c[0], d[1] - c[1]];
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / (r[0] * q[1] - r[1] * q[0]);
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

function window(face, [x0, x1], id) {
  const back = face - RECESS;
  const hole = poly([[x0, face, WIN_Z0], [x1, face, WIN_Z0], [x1, face, WIN_Z1], [x0, face, WIN_Z1]]);
  const reach = 12;
  const walls = [
    `<path class="ig-hole" d="${hole}"/>`,
    `<path class="iso-shade" data-shade="1" d="${poly([[x0, face, WIN_Z0], [x0, back, WIN_Z0], [x0, back, WIN_Z1 + reach], [x0, face, WIN_Z1 + reach]])}"/>`,
    `<path class="iso-top" d="${poly([[x0, face, WIN_Z0], [x1 + reach, face, WIN_Z0], [x1 + reach, back, WIN_Z0], [x0, back, WIN_Z0]])}"/>`,
  ];
  const corner = at([x0, back, WIN_Z0]);
  const up = meet([corner, at([x0, back, WIN_Z1])], [at([x0, face, WIN_Z1]), at([x1, face, WIN_Z1])]);
  const along = meet([corner, at([x1, back, WIN_Z0])], [at([x1, face, WIN_Z0]), at([x1, face, WIN_Z1])]);
  const edges = L(k.pathOf([up, corner, along]), { tone: "faint" });
  return `<clipPath id="${id}"><path d="${hole}"/></clipPath><g clip-path="url(#${id})">${walls.join("")}</g>${edges}${L(k.pathOf([at([x0, face, WIN_Z0]), at([x1, face, WIN_Z0]), at([x1, face, WIN_Z1]), at([x0, face, WIN_Z1])], true), { tone: "lo" })}`;
}

const zOf = (level) => WIN_Z0 + (Math.max(0, Math.min(FULL, level)) / FULL) * WIN_H;

function scale(face, x0, { zero }) {
  const minor = [];
  const major = [];
  const width = 6.4;
  for (let level = 0; level <= FULL; level += 5) {
    const big = level % 25 === 0;
    const z = zOf(level);
    (big ? major : minor).push(k.segment([x0, face, z], [x0 - (big ? width : 3.2), face, z], P));
  }
  const strip = k.pathOf([at([x0, face, WIN_Z0]), at([x0 - width, face, WIN_Z0]), at([x0 - width, face, WIN_Z1]), at([x0, face, WIN_Z1])]);
  const mark = k.segment([x0, face, zOf(zero)], [x0 - width, face, zOf(zero)], P);
  return L(strip, { tone: "faint" }) + L(minor.join(""), { tone: "lo" }) + L(major.join(""), { tone: "mid" }) + L(mark, { tone: "hi" });
}

function housing(unit, { lens }) {
  const { body, win } = unit;
  const face = body.y + body.d;
  const out = [plinth(unit.plinth)];
  const seam = k.sideSeam(body, PLINTH_H + 8, P, 4);
  out.push(S(k.slabOf(body, PLINTH_H, BODY_TOP - PLINTH_H, P, 4, 0.8), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(body, -1.6), BODY_TOP, 3.4, P, 4, 0.6), { tone: "mid" }));
  const top = BODY_TOP + 3.4;
  const cx = body.x + body.w / 2;
  const cy = body.y + body.d / 2;
  out.push(D(k.corners(k.insetPlan(body, -1.6), 3.6).map(([x, y]) => at([x, y, top])), { size: 0.5 }));
  out.push(window(face, win, unit.clip));
  const [x0, x1] = win;
  out.push(D([at([x0 - 9, face, WIN_Z1 + 5]), at([x1 + 7, face, WIN_Z1 + 5]), at([x0 - 9, face, WIN_Z0 - 9]), at([x1 + 7, face, WIN_Z0 - 9])], { size: 0.5 }));
  if (lens) {
    out.push(S(k.cylinder(cx, cy, 17, top, 2.4, P, 48, 0.5), { tone: "mid" }));
    out.push(S(k.cylinder(cx, cy, 13.4, top + 2.4, 2.2, P, 48), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(cx, cy, 9, top + 4.6, P, 40), { tone: "faint" }));
    out.push(L(k.ring(cx, cy, 4.6, top + 4.6, P, 28), { tone: "faint" }));
  }
  return out.join("");
}

function post([x, y]) {
  const out = [];
  out.push(S(k.cylinder(x, y, 3.6, PLINTH_H, 1.6, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2.4, PLINTH_H + 1.6, 6, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 3.4, PLINTH_H + 7.6, 4.4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 3.4, PLINTH_H + 7.6, PLINTH_H + 12, 22, P), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.5, PLINTH_H + 12, POST_TOP - PLINTH_H - 12, P, 16), { tone: "hi", crease: "none" }));
  return out.join("");
}

function smoothRoute(control, per = 8) {
  const out = [];
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(control.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  out.push(control[control.length - 1]);
  return out;
}

function wire([x0, y0], edge0, [x1, y1], edge1) {
  const lane = 49;
  const control = [
    [x0, y0, POST_TOP],
    [x0 + 1.5, y0 + 2.5, POST_TOP + 0.6],
    [x0 + 3.5, edge0 + 2, PLINTH_H + 3],
    [x0 + 8, lane, 0.7],
    [x1 - 8, lane, 0.7],
    [x1 - 3.5, edge1 + 2, PLINTH_H + 3],
    [x1 - 1.5, y1 + 2.5, POST_TOP + 0.6],
    [x1, y1, POST_TOP],
  ];
  const points = smoothRoute(control).map(at);
  const end = ([x, y]) => `<circle class="iso-wire-end" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3"/>`;
  return `<g class="iso-wire" data-tone="mid">${L(k.pathOf(points), { tone: "mid" })}${end(points[0])}${end(points[points.length - 1])}</g>`;
}

function amplifier() {
  const { body } = AMP;
  const face = body.y + body.d;
  const out = [plinth(AMP.plinth)];
  const seam = k.sideSeam(body, AMP_TOP - 6, P, 4);
  out.push(S(k.slabOf(body, PLINTH_H, AMP_TOP - PLINTH_H, P, 4, 1), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  out.push(D(k.corners(body, 5).map(([x, y]) => at([x, y, AMP_TOP])), { size: 0.5 }));
  const slots = [];
  for (let i = 0; i < 7; i++) {
    const x = body.x + 12 + i * 5;
    slots.push(k.pathOf([[x, 0], [x + 2, 0], [x + 2, 16], [x, 16]].map(([u, v]) => at([u, face, AMP_TOP - 14 - v])), true));
  }
  out.push(L(slots.join(""), { tone: "lo" }));
  const plateX = body.x + body.w - 50;
  out.push(L(k.pathOf([[0, 0], [38, 0], [38, 14], [0, 14]].map(([u, v]) => at([plateX + u, face, AMP_TOP - 12 - v])), true), { tone: "lo" }));
  out.push(D([at([plateX + 3, face, AMP_TOP - 15]), at([plateX + 35, face, AMP_TOP - 15]), at([plateX + 3, face, AMP_TOP - 23]), at([plateX + 35, face, AMP_TOP - 23])], { size: 0.45 }));
  out.push(L(k.segment([plateX + 7, face, AMP_TOP - 16.5], [plateX + 29, face, AMP_TOP - 16.5], P) + k.segment([plateX + 7, face, AMP_TOP - 19], [plateX + 24, face, AMP_TOP - 19], P) + k.segment([plateX + 7, face, AMP_TOP - 21.5], [plateX + 19, face, AMP_TOP - 21.5], P), { tone: "lo", free: true }));
  const [cx, cy] = KNOB;
  out.push(S(k.cylinder(cx, cy, SKIRT_R, AMP_TOP, 1.2, P, 72, 0.4), { tone: "lo" }));
  const ticks = k.radialTicks(cx, cy, SKIRT_R - 0.2, (STOPS.length - 1) * 2, 2, AMP_TOP + 1.2, [2.6, 5], P, SWEEP_FROM, SWEEP);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const home = angleAt(HOME);
  out.push(L(k.lineOnTop([cx + Math.sin(home) * (SKIRT_R - 6.4), cy - Math.cos(home) * (SKIRT_R - 6.4)], [cx + Math.sin(home) * (SKIRT_R - 0.2), cy - Math.cos(home) * (SKIRT_R - 0.2)], AMP_TOP + 1.2, P), { tone: "hi" }));
  out.push(S(k.cylinder(cx, cy, KNOB_R + 1.4, AMP_TOP + 1.2, 3, P, 64), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, KNOB_R, KNOB_Z, KNOB_TOP - KNOB_Z, P, 72, 0.9), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, KNOB_R, KNOB_Z + 1.2, KNOB_TOP - 1.4, 64, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, KNOB_R, KNOB_Z + 1.2, P, 40) + k.sideArc(cx, cy, KNOB_R, KNOB_TOP - 1.4, P, 40), { tone: "faint" }));
  out.push(L(k.ring(cx, cy, KNOB_R - 3.4, KNOB_TOP, P, 64), { tone: "lo" }));
  out.push(L(k.ring(cx, cy, 2.6, KNOB_TOP, P, 20), { tone: "mid" }));
  return out.join("");
}

const pointerAt = (angle) => {
  const [cx, cy] = KNOB;
  const s = Math.sin(angle);
  const c = -Math.cos(angle);
  return k.lineOnTop([cx + s * 2.6, cy + c * 2.6], [cx + s * (KNOB_R - 3.4), cy + c * (KNOB_R - 3.4)], KNOB_TOP + 0.1, P);
};

const WELL_FACE = WELL.body.y + WELL.body.d;
const METER_FACE = METER.body.y + METER.body.d;
const COLUMNS = 10;

function wellContent() {
  const [x0, x1] = WELL.win;
  return `<g clip-path="url(#ig-well-clip)"><path class="ig-light" data-part="light" d=""/><path class="iso-line" data-tone="hi" data-part="light-top" data-free="" d=""/></g>${scale(WELL_FACE, x0, { zero: COLLECTED })}${label()}`;
}

function label() {
  const cx = WELL.body.x + WELL.body.w / 2;
  const line = (text, z) => k.faceTextSvg(k.sideMatrix([cx, WELL_FACE], z, P, "left"), text, { size: 5.2, tone: "hi", anchor: "middle" });
  return line("light collected:", 21) + line("unchanged", 13);
}

function meterContent() {
  const [x0, x1] = METER.win;
  const back = METER_FACE - RECESS;
  const stop = L(k.segment([x0, back, WIN_Z1 - 0.6], [x1, back, WIN_Z1 - 0.6], P), { tone: "mid" });
  return `<g clip-path="url(#ig-meter-clip)"><path class="ig-band" data-part="band" d=""/><path class="ig-signal" data-part="signal" d=""/><path class="iso-line" data-tone="lit" data-part="signal-top" data-free="" d="" style="stroke-width:.9"/>${stop}</g>${scale(METER_FACE, x0, { zero: COLLECTED })}`;
}

function lamp() {
  const { body } = METER;
  const cx = body.x + body.w / 2;
  const cy = body.y + body.d / 2;
  const top = BODY_TOP + 3.4;
  return (
    S(k.cylinder(cx, cy, 8, top, 2, P, 40, 0.4), { tone: "mid" }) +
    `<g data-part="lamp">${S(k.cylinder(cx, cy, 5.6, top + 2, 4.2, P, 40), { tone: "mid", crease: "lo" })}</g>`
  );
}

const CSS = `<style>
.ig-hole{fill:var(--anatomy-shade-0);stroke:none}
.ig-light{fill:var(--anatomy-hi);opacity:.42;stroke:none}
.ig-signal{fill:var(--anatomy-lit);opacity:.9;stroke:none}
.ig-band{fill:var(--anatomy-lit);opacity:.16;stroke:none}
.iso-stage{touch-action:none;cursor:grab;outline:none;-webkit-user-select:none;user-select:none}
.iso-stage[data-dragging]{cursor:grabbing}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:560px){.iso-stage .iso-svg{width:110%;margin:0 -5%}.iso-plate{overflow:hidden}}
</style>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench with three units joined by wires. On the left, one sensor photosite drawn as a well with a window, holding a fixed amount of collected light. In the middle, an amplifier with a big gain knob. On the right, a brightness meter. Turning the knob raises or lowers the meter and the jitter of noise on it together, while the light in the well never changes. Past ISO 1600 the meter hits its top and clips.",
  body: [
    bench(),
    housing(WELL, { lens: true }),
    wellContent(),
    post(POSTS.well),
    amplifier(),
    `<path class="iso-line" data-tone="hi" data-part="pointer" data-free="end" d="${pointerAt(angleAt(HOME))}" style="stroke-width:1.2"/>`,
    post(POSTS.ampIn),
    post(POSTS.ampOut),
    housing(METER, { lens: false }),
    meterContent(),
    lamp(),
    post(POSTS.meter),
    wire(POSTS.well, WELL.plinth.y + WELL.plinth.d, POSTS.ampIn, AMP.plinth.y + AMP.plinth.d),
    wire(POSTS.ampOut, AMP.plinth.y + AMP.plinth.d, POSTS.meter, METER.plinth.y + METER.plinth.d),
  ],
});

const DATA = {
  P,
  STOPS,
  HOME,
  COLLECTED,
  BASE_NOISE,
  FULL,
  COLUMNS,
  WIN: [WIN_Z0, WIN_Z1],
  WELL: { x: WELL.win, y: WELL_FACE - RECESS },
  METER: { x: METER.win, y: METER_FACE - RECESS },
  KNOB,
  KNOB_R,
  KNOB_TOP,
  SWEEP_FROM,
  SWEEP,
  READOUTS: STOPS.map(readoutOf),
};

const live = `
const DATA = ${JSON.stringify(DATA)};
const { P, STOPS, HOME, COLLECTED, BASE_NOISE, FULL, COLUMNS, WIN, WELL, METER, KNOB, KNOB_R, KNOB_TOP, SWEEP_FROM, SWEEP, READOUTS } = DATA;
const springTo = ${springTo.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const pointer = part("pointer"), light = part("light"), lightTop = part("light-top");
const band = part("band"), signal = part("signal"), signalTop = part("signal-top"), lampSolid = part("lamp").firstElementChild;
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const angleAt = (index) => SWEEP_FROM + (index / (STOPS.length - 1)) * SWEEP;
const zOf = (level) => WIN[0] + (clamp(level, 0, FULL) / FULL) * (WIN[1] - WIN[0]);
const project = (x, y, z) => iso([x, y, z], P);
const path = (points, closed) => pathOf(points, closed);
let seed = 7;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
const lanes = (count) => Array.from({ length: count + 1 }, () => ({ x: random() * 0.8, to: random() * 0.8, from: 0, t: Math.random() }));
const wellNoise = lanes(COLUMNS), meterNoise = lanes(COLUMNS);
function drift(list, dt, calm) {
  for (const lane of list) {
    if (calm) continue;
    lane.t += dt / 0.34;
    if (lane.t >= 1) { lane.from = lane.to; lane.to = random(); lane.t = 0; }
    const s = lane.t * lane.t * (3 - 2 * lane.t);
    lane.x = lane.from + (lane.to - lane.from) * s;
  }
}
function column(x0, x1, y, level, amp, list) {
  return list.map((lane, i) => {
    const x = x0 + (i / COLUMNS) * (x1 - x0);
    return project(x, y, zOf(level + lane.x * amp));
  });
}
function fillShape(x0, x1, y, top) {
  return path([project(x0, y, WIN[0] - 1), project(x1, y, WIN[0] - 1), ...[...top].reverse()], true);
}
let index = HOME, target = HOME, shown = -1;
let db = 0, angle = angleAt(HOME), knob = { x: angleAt(HOME), v: 0 };
let frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idleTimer = 0;
const TOUR = [2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1, 0, 0, 1];
const dbAt = (i) => 6 * Math.log2(STOPS[i] / 400);
function draw() {
  pointer.setAttribute("d", lineOnTop([KNOB[0] + Math.sin(angle) * 2.6, KNOB[1] - Math.cos(angle) * 2.6], [KNOB[0] + Math.sin(angle) * (KNOB_R - 3.4), KNOB[1] - Math.cos(angle) * (KNOB_R - 3.4)], KNOB_TOP + 0.1, P));
  const wellTop = column(WELL.x[0], WELL.x[1], WELL.y, COLLECTED, BASE_NOISE, wellNoise);
  light.setAttribute("d", fillShape(WELL.x[0], WELL.x[1], WELL.y, wellTop));
  lightTop.setAttribute("d", path(wellTop));
  const gain = Math.pow(2, db / 6);
  const out = COLLECTED * gain, amp = BASE_NOISE * gain;
  const top = column(METER.x[0], METER.x[1], METER.y, out, amp, meterNoise);
  signal.setAttribute("d", fillShape(METER.x[0], METER.x[1], METER.y, top));
  signalTop.setAttribute("d", path(top));
  const lo = zOf(out - amp), hi = zOf(out + amp);
  band.setAttribute("d", hi - lo > 0.05 ? path([project(METER.x[0], METER.y, lo), project(METER.x[1], METER.y, lo), project(METER.x[1], METER.y, hi), project(METER.x[0], METER.y, hi)], true) : "");
  const clipped = out - amp >= FULL - 0.5;
  if (clipped !== lampSolid.hasAttribute("data-lit")) clipped ? lampSolid.setAttribute("data-lit", "") : lampSolid.removeAttribute("data-lit");
  let near = 0;
  STOPS.forEach((_, i) => { if (Math.abs(dbAt(i) - db) < Math.abs(dbAt(near) - db)) near = i; });
  if (near !== shown) {
    shown = near;
    readout.textContent = READOUTS[near];
  }
}
function describe() {
  stage.setAttribute("aria-valuenow", String(STOPS[target]));
  stage.setAttribute("aria-valuetext", READOUTS[target] + (STOPS[target] >= 3200 ? ", clipped at the top of the meter" : ""));
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    const next = TOUR[Math.floor(clock / 1.5) % TOUR.length];
    if (next !== target) { target = next; describe(); }
  }
  const wantDb = dbAt(target), wantAngle = angleAt(target);
  db = calm ? wantDb : db + (wantDb - db) * (1 - Math.exp(-dt / 0.2));
  if (calm || touring) {
    angle = calm ? wantAngle : angle + (wantAngle - angle) * (1 - Math.exp(-dt / 0.14));
    if (Math.abs(wantAngle - angle) < 0.0005) angle = wantAngle;
    knob.v = 0;
  } else {
    knob.x = angle;
    springTo(knob, wantAngle, dt);
    angle = knob.x;
  }
  if (Math.abs(wantDb - db) < 0.002) db = wantDb;
  drift(wellNoise, dt, calm);
  drift(meterNoise, dt, calm);
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } if (still.matches) requestAnimationFrame(tick); };
const quiet = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!still.matches && !drag) { touring = true; clock = Math.max(0, TOUR.indexOf(target)) * 1.5; run(); } }, 3600); };
const steer = (next) => { touring = false; const to = clamp(next, 0, STOPS.length - 1); if (to !== target) { target = to; describe(); window.detent(); } quiet(); run(); };
let drag = null;
stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: target };
  stage.setPointerCapture(event.pointerId);
  stage.setAttribute("data-dragging", "");
  touring = false;
  clearTimeout(idleTimer);
  stage.focus({ preventScroll: true });
  event.preventDefault();
});
stage.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const step = svg.getBoundingClientRect().width / 22;
  const moved = (event.clientX - drag.x) - (event.clientY - drag.y);
  steer(drag.from + Math.round(moved / step));
});
const release = (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  drag = null;
  stage.removeAttribute("data-dragging");
  quiet();
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const from = target;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "PageUp") to = from + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "PageDown") to = from - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = STOPS.length - 1;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
describe();
draw();
`;

const body =
  CSS +
  k.plateHtml({
    fig: "Fig 3",
    title: "ISO and gain",
    hint: "Drag the knob or use arrow keys",
    readout: readoutOf(STOPS[HOME]),
    keys: [
      { mark: "raised", label: "The light the sensor collected" },
      { mark: "lit", label: "The amplified signal, and its noise" },
    ],
    caption:
      "ISO doesn't let in more light. It amplifies what the sensor already collected, noise included, and every +6 dB doubles both. Turn it too far and the signal hits the top of the meter and clips.",
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Gain knob: arrow keys step through ISO 100 to 6400" aria-valuemin="100" aria-valuemax="6400" aria-valuenow="400">${svg}</div>`,
  });

writeFigure("iso", { title: "ISO and gain", body, script: kitScript() + live, width: WIDTH });

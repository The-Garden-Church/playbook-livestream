import * as k from "../anatomy/kit/iso-kit.mjs";
import * as G from "../anatomy/kit/lathe.mjs";
import { kitScript } from "../anatomy/scripts/inline-kit.mjs";
import { writeFigure } from "../embed.mjs";
import { springTo } from "../spring.mjs";

const WIDTH = 600;
const HEIGHT = 390;
const TAU = Math.PI * 2;

const ZOOM_MM = [35, 50, 70, 100];
const FOCUS_M = [1, 2, 4, 8, "∞"];
const ZOOM_START = 1;
const FOCUS_START = 2;
const SENSOR_W = 17.3;
const aovOf = (f) => (2 * Math.atan(SENSOR_W / (2 * f)) * 180) / Math.PI;

const ZA = 58;
const R_BARREL = 30.5;
const R_INNER = 28;
const R_RING = 33;
const R_BAND = 32;
const ZOOM_BAND = [34, 47];
const ZOOM_GRIP = [47, 72];
const CUT = [72, 150];
const FOCUS_GRIP = [150, 160];
const FOCUS_BAND = [160, 170];
const LIP = [170, 180];
const ZOOM_STEP = 0.62;
const FOCUS_STEP = 0.5;
const RIBS = 64;
const ROD = { y: -3, z: 25.2, r: 1.2, bush: 2.1 };

const GROUPS = [
  { name: "zoomB", r: 17, tc: 2.4, te: 6.4, cell: 8, at: (z) => 104 - (8 * z) / 3, kind: "zoom" },
  { name: "zoomA", r: 19, tc: 8, te: 3, cell: 5, at: (z) => 112 + (16 * z) / 3, kind: "zoom" },
  { name: "focus", r: 14, tc: 6, te: 2.6, cell: 6, at: (f) => 144 - (8 * f) / 4, kind: "focus" },
];

const BOARD_X = 345;
const BOARD = { x: BOARD_X, y: -50, w: 4, d: 100, r: 1 };
const BOARD_Z = [ZA - 32, ZA + 32];
const APEX = [LIP[1], 0, ZA];
const PLATE = { x: -16, y: -40, w: 210, d: 80, r: 6 };
const PLATE_H = 8;
const FOOT_H = 4;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, ZA + R_RING + 4], [LIP[1], 0, ZA + R_RING], ...k.boxCorners({ ...BOARD, x: BOARD_X - 16, w: 34 }, 0, BOARD_Z[1])],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 122 },
);
const V = G.viewOf(P);
const F = G.frameOf([0, 0, ZA], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const READ = Math.atan2(V[2], V[1]) - 0.08;

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const path = (points, closed = false) => points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + (closed ? "Z" : "");
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function halfOf(meridian, { closed = true, steps = 36, from = Math.PI / 2, to = (3 * Math.PI) / 2, flat = null } = {}) {
  const m = meridian.length;
  const segs = [];
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const a = meridian[i];
    const b = meridian[(i + 1) % m];
    if (a[1] < 1e-9 && b[1] < 1e-9) continue;
    segs.push({ a, b, i });
  }
  const angle = (j) => from + ((to - from) * j) / steps;
  const P3 = (s, r, t) => G.pointOf(F, s, r, t);
  const vis = segs.map(({ a, b }) =>
    Array.from({ length: steps }, (_, j) => {
      const t = (angle(j) + angle(j + 1)) / 2;
      const ds = b[0] - a[0];
      const dr = b[1] - a[1];
      const radial = G.radialOf(F, t);
      const n = G.unit3(G.add3(G.mul3(F.a, -dr), G.mul3(radial, ds)));
      return { seen: G.dot3(n, V) > 1e-6, tone: flat ?? G.toneOf(n, P) };
    }),
  );
  const buckets = [[], [], [], [], []];
  const fill = [];
  const outline = [];
  const crease = [];
  const ring = (s, r, j0, j1) => Array.from({ length: j1 - j0 + 1 }, (_, i) => at(P3(s, r, angle(j0 + i))));
  const runs = (flags) => {
    const out = [];
    let j = 0;
    while (j < flags.length) {
      if (flags[j] === null) { j++; continue; }
      let e = j;
      while (e + 1 < flags.length && flags[e + 1] === flags[j]) e++;
      out.push([j, e, flags[j]]);
      j = e + 1;
    }
    return out;
  };
  const linkedBefore = (si) => (closed || si > 0) && segs[(si - 1 + segs.length) % segs.length].b === segs[si].a;
  segs.forEach(({ a, b }, si) => {
    for (const [j0, j1] of runs(vis[si].map((c) => (c.seen ? 1 : null)))) fill.push(path([...ring(a[0], a[1], j0, j1 + 1), ...ring(b[0], b[1], j0, j1 + 1).reverse()], true));
    for (const [j0, j1, tone] of runs(vis[si].map((c) => (c.seen ? c.tone : null)))) buckets[tone].push(path([...ring(a[0], a[1], j0, j1 + 1), ...ring(b[0], b[1], j0, j1 + 1).reverse()], true));
    const prev = vis[(si - 1 + segs.length) % segs.length];
    const joined = linkedBefore(si);
    const knot = vis[si].map((c, j) => (!c.seen ? null : !joined || !prev[j].seen ? "o" : !a[2] ? "c" : null));
    for (const [j0, j1, kind] of runs(knot)) (kind === "o" ? outline : crease).push(path(ring(a[0], a[1], j0, j1 + 1)));
    const nextJoined = si + 1 < segs.length ? linkedBefore(si + 1) : closed && linkedBefore(0);
    const next = vis[(si + 1) % segs.length];
    const tail = vis[si].map((c, j) => (c.seen && (!nextJoined || !next[j].seen) ? "o" : null));
    for (const [j0, j1] of runs(tail)) outline.push(path(ring(b[0], b[1], j0, j1 + 1)));
  });
  for (let jb = 0; jb <= steps; jb++) {
    const flags = segs.map((_, si) => {
      const left = jb > 0 && vis[si][jb - 1].seen;
      const right = jb < steps && vis[si][jb].seen;
      return left !== right || ((jb === 0 || jb === steps) && (left || right)) ? 1 : null;
    });
    for (const [s0, s1] of runs(flags)) {
      let pts = [];
      for (let si = s0; si <= s1; si++) {
        if (si > s0 && !linkedBefore(si)) {
          outline.push(path(pts));
          pts = [];
        }
        if (!pts.length) pts.push(at(P3(segs[si].a[0], segs[si].a[1], angle(jb))));
        pts.push(at(P3(segs[si].b[0], segs[si].b[1], angle(jb))));
      }
      outline.push(path(pts));
    }
  }
  return { fill: fill.join(""), shades: buckets.slice(0, 4).map((list) => list.join("")), top: buckets[4].join(""), outline: outline.join(""), crease: crease.join(""), seamless: true };
}

function sectionOf(meridian, { closed = true } = {}) {
  const top = meridian.map(([s, r]) => at([s, 0, ZA + r]));
  const bottom = meridian.map(([s, r]) => at([s, 0, ZA - r]));
  const touches = meridian[0][1] < 1e-9 && meridian[meridian.length - 1][1] < 1e-9;
  if (touches) return path([...top, ...bottom.reverse()], true);
  return path(top, closed) + path(bottom, closed);
}

function lensMeridian(c, r, tc, te) {
  const out = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([c - tc / 2 + ((tc - te) / 2) * t * t, r * t, i > 0 && i < n ? 1 : 0]);
  }
  for (let i = n; i >= 0; i -= 1) {
    const t = i / n;
    out.push([c + tc / 2 - ((tc - te) / 2) * t * t, r * t, i > 0 && i < n ? 1 : 0]);
  }
  return out;
}

function board() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: BOARD_X - 16, y: -48, w: 36, d: 96, r: 4 }, 0, 4, P)}"/>`];
  for (const y of [40, -40].sort((a, b) => k.depthOf([0, a, 0], P) - k.depthOf([0, b, 0], P))) {
    const foot = { x: BOARD_X - 14, y: y - 4, w: 32, d: 8, r: 2 };
    out.push(S(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "lo" }));
    out.push(D([at([foot.x + 4, y, 4]), at([foot.x + foot.w - 4, y, 4])], { size: 0.45 }));
    out.push(S(k.cylinder(BOARD_X + 2, y, 3.4, 4, 2, P, 20), { tone: "mid" }));
    out.push(S(k.cylinder(BOARD_X + 2, y, 2.2, 6, BOARD_Z[0] - 6, P, 20), { tone: "mid", crease: "none" }));
  }
  out.push(S(k.slabOf(BOARD, BOARD_Z[0], BOARD_Z[1] - BOARD_Z[0], P, 3, 0.6), { tone: "mid" }));
  const m = faceX(BOARD_X - 0.05);
  const inset = 5;
  const H = (BOARD_Z[1] - BOARD_Z[0]) / 2;
  const W = BOARD.d / 2;
  const chart = [
    `<rect x="${-W + inset}" y="${-H + inset}" width="${2 * (W - inset)}" height="${2 * (H - inset)}" rx="1.5" class="iso-line" data-tone="lo"/>`,
    ...[8, 16, 24].map((r) => `<circle r="${r}" class="iso-line" data-tone="${r === 8 ? "mid" : "lo"}"/>`),
    `<path class="iso-line" data-tone="faint" d="M${-W + inset} 0H${W - inset}M0 ${-H + inset}V${H - inset}"/>`,
    `<circle r="1.3" class="lr-bull"/>`,
  ];
  out.push(`<g transform="${m}" class="lr-chart">${chart.join("")}</g>`);
  return out.join("");
}

function faceX(x) {
  const o = at([x, 0, ZA]);
  const ex = at([x, 1, ZA]);
  const ey = at([x, 0, ZA - 1]);
  const f = (v) => v.toFixed(4);
  return `matrix(${f(ex[0] - o[0])} ${f(ex[1] - o[1])} ${f(ey[0] - o[0])} ${f(ey[1] - o[1])} ${f(o[0])} ${f(o[1])})`;
}

function cone() {
  return `<g class="lr-cone"><path data-part="cone-fill" class="lr-cone-fill" d=""/><path data-part="cone-edge" class="iso-line" data-tone="lit" d=""/><path data-part="frame" class="iso-line lr-frame" data-tone="lit" d=""/></g>`;
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 16))) {
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: 40, y: PLATE.y + PLATE.d - 13, w: 118, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.6, strip.y + 3, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 3, 0.6])], { size: 0.4 }));
  const label = { x: 2, y: PLATE.y + PLATE.d - 15, w: 30, d: 9, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(L([[6, 16], [6, 22], [6, 12]].map(([x0, w], i) => k.lineOnTop([label.x + x0, label.y + 2.6 + i * 1.9], [label.x + x0 + w, label.y + 2.6 + i * 1.9], 0.8, P)).join(""), { tone: "lo", free: true }));
  return out.join("");
}

function posts() {
  const out = [];
  const front = 175;
  const padTop = ZA - R_BAND;
  out.push(S(k.cylinder(front, 0, 6.5, 0, 2.4, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(front, 0, 3.6, 2.4, padTop - 3 - 2.4, P, 24), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(front, 0, 3.6, 10, P, 16), { tone: "faint" }));
  out.push(S(k.slabOf({ x: front - 5, y: -7, w: 10, d: 14, r: 1.5 }, padTop - 3, 3, P, 3, 0.4), { tone: "mid" }));
  const rear = 18;
  const lugTop = ZA - 34.4;
  out.push(S(k.cylinder(rear, 0, 7, 0, 2.4, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(rear, 0, 4.2, 2.4, lugTop - 6 - 2.4, P, 24), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(rear, 0, 4.2, 9, P, 16), { tone: "faint" }));
  out.push(S(k.slabOf({ x: rear - 5, y: -5.5, w: 10, d: 11, r: 1.5 }, lugTop - 6, 6, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([rear - 3, 3.5, lugTop - 3]), at([rear + 3, 3.5, lugTop - 3])].map((p) => p), { size: 0.4 }));
  return out.join("");
}

const DS = { steps: 72 };
const arc = (s, r, opts) => G.arcOf(F, s, r, P, opts);

function frontEnd() {
  const out = [];
  out.push(S(G.disc(LIP[0], LIP[1], R_BAND, F, P, DS), { tone: "mid", inner: L(arc(175, R_BAND) + arc(177.5, R_BAND), { tone: "faint" }) }));
  out.push(L(indexLine(170, 175, R_BAND), { tone: "green", className: "lr-index" }));
  out.push(S(G.disc(FOCUS_BAND[0], FOCUS_BAND[1], R_BAND, F, P, DS), { tone: "mid", className: "lr-ringpart" }));
  out.push(`<g data-part="focus-nums" class="lr-nums lr-nums-f">${FOCUS_M.map((v) => `<text class="iso-face-text" font-size="${v === "∞" ? 7.4 : 5.2}" text-anchor="middle" dominant-baseline="central">${v}</text>`).join("")}</g>`);
  out.push(S(G.disc(FOCUS_GRIP[0], FOCUS_GRIP[1], R_RING, F, P, DS), { tone: "mid", className: "lr-ringpart", inner: `<path class="lr-bore" d="${G.circleOf(F, FOCUS_GRIP[0], 17, P)}"/>` }));
  out.push(`<g data-part="focus-ribs" class="lr-ribs">${`<path class="iso-line" data-tone="lo"/>`.repeat(RIBS)}</g>`);
  return `<g class="lr-ring" data-ring="focus">${out.join("")}</g>`;
}

function indexLine(s0, s1, r) {
  return path([at(G.pointOf(F, s0, r, READ)), at(G.pointOf(F, s1, r, READ))]);
}

function cutaway() {
  const out = [];
  const cavity = [];
  cavity.push(S(halfOf([[CUT[1], R_INNER], [CUT[0], R_INNER]], { closed: false, steps: 48 }), { tone: "lo", crease: "none" }));
  for (const [s0, s1] of [[CUT[0], CUT[0] + 2], [CUT[1] - 2, CUT[1]]]) cavity.push(S(halfOf([[s0, 17], [s0, R_INNER], [s1, R_INNER], [s1, 17]], { steps: 40 }), { tone: "lo" }));
  out.push(`<g class="lr-cavity">${cavity.join("")}</g>`);
  out.push(S(halfOf([[CUT[0], R_BARREL], [CUT[1], R_BARREL]], { closed: false, steps: 48 }), { tone: "mid", crease: "none" }));
  const ordered = [...GROUPS].sort((a, b) => b.at(ZOOM_START) - a.at(ZOOM_START));
  const layers = { glass: [], rig: [], cut: [] };
  for (const g of ordered) {
    const lens = lensMeridian(0, g.r, g.tc, g.te);
    const cellM = [[-g.cell / 2, g.r], [-g.cell / 2, g.r + 2], [g.cell / 2, g.r + 2], [g.cell / 2, g.r]];
    const glass = S(halfOf(lens, { steps: 32, flat: 2 }), { tone: "hi", className: `lr-glass lr-${g.kind}` });
    const cell = S(halfOf(cellM, { closed: false, steps: 32 }), { tone: "mid" });
    layers.glass.push(groupG(g, glass + cell));
    const rig = [];
    for (const side of [1, -1]) {
      const z0 = side > 0 ? ZA + g.r + 2 : ZA - ROD.z + ROD.bush;
      const z1 = side > 0 ? ZA + ROD.z - ROD.bush : ZA - g.r - 2;
      rig.push(S(k.slabOf({ x: -1.4, y: -4.4, w: 2.8, d: 4.4, r: 0.4 }, z0, z1 - z0, P, 2), { tone: "mid" }));
      const RF = G.frameOf([0, ROD.y, ZA + side * ROD.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      rig.push(S(G.disc(-2.6, 2.6, ROD.bush, RF, P), { tone: "mid" }));
    }
    layers.rig.push(groupG(g, rig.join("")));
    const cut = [`<path class="lr-cut-metal" d="${sectionOf(cellM, { closed: true })}"/>`, `<path class="lr-cut-glass" d="${sectionOf(lens)}"/>`];
    layers.cut.push(groupG(g, `<g class="lr-section lr-${g.kind}">${cut.join("")}</g>`));
  }
  out.push(...layers.glass);
  for (const side of [1, -1]) {
    const RF = G.frameOf([0, ROD.y, ZA + side * ROD.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    out.push(S(G.disc(CUT[0] + 2, CUT[1] - 2, ROD.r, RF, P), { tone: "mid", crease: "none" }));
  }
  out.push(...layers.rig);
  const strips = [];
  strips.push(sectionOf([[CUT[0], R_INNER], [CUT[0], R_BARREL], [CUT[1], R_BARREL], [CUT[1], R_INNER]]));
  for (const [s0, s1] of [[CUT[0], CUT[0] + 2], [CUT[1] - 2, CUT[1]]]) strips.push(sectionOf([[s0, 17], [s0, R_INNER], [s1, R_INNER], [s1, 17]]));
  out.push(`<g class="lr-section"><path class="lr-cut-metal" d="${strips.join("")}"/></g>`);
  out.push(...layers.cut);
  return out.join("");
}

function groupG(g, inner) {
  return `<g data-group="${g.name}" transform="${k.translateAlong(P, [g.at(g.kind === "focus" ? FOCUS_START : ZOOM_START), 0, 0])}">${inner}</g>`;
}

function rearEnd() {
  const out = [];
  out.push(`<g class="lr-ring" data-ring="zoom">`);
  out.push(S(G.disc(ZOOM_GRIP[0], ZOOM_GRIP[1], R_RING, F, P, DS), { tone: "mid", className: "lr-ringpart" }));
  out.push(`<g data-part="zoom-ribs" class="lr-ribs">${`<path class="iso-line" data-tone="lo"/>`.repeat(RIBS)}</g>`);
  out.push(S(G.disc(ZOOM_BAND[0], ZOOM_BAND[1], R_BAND, F, P, DS), { tone: "mid", className: "lr-ringpart" }));
  out.push(`<g data-part="zoom-nums" class="lr-nums lr-nums-z">${ZOOM_MM.map((v) => `<text class="iso-face-text" font-size="5.2" text-anchor="middle" dominant-baseline="central">${v}</text>`).join("")}</g>`);
  out.push(`</g>`);
  out.push(S(G.disc(6, ZOOM_BAND[0], R_BARREL, F, P, DS), { tone: "mid", inner: L(arc(28, R_BARREL), { tone: "faint" }) }));
  out.push(L(indexLine(28, ZOOM_BAND[0], R_BARREL), { tone: "blue", className: "lr-index" }));
  out.push(S(G.ringBand(12, 24, R_BARREL, 34.4, F, P, DS), { tone: "mid", inner: L(arc(18, 34.4), { tone: "faint" }) }));
  const kF = G.frameAlong(G.pointOf(F, 18, 34.2, 0.35), G.radialOf(F, 0.35));
  out.push(S(G.disc(0, 2.2, 4.4, kF, P), { tone: "mid" }));
  out.push(S(G.disc(2.2, 6.4, 3.4, kF, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(kF, 2.2, 6.4, 3.4, 20, P, { fade: [0.05, 0.5] }), { tone: "lo" }) }));
  out.push(S(G.solidOf([[0, 22], [3, 22], [3, 25.5], [6, 25.5]], F, P, DS), { tone: "mid" }));
  out.push(D(G.dotsOf(F, 0, 19, 6, P, { all: true, phase: 0.3 }), { size: 0.5, tone: "mid" }));
  out.push(`<path class="lr-glass-face" d="${G.circleOf(F, -0.05, 14, P)}"/>`);
  out.push(L(G.circleOf(F, -0.05, 14, P), { tone: "mid" }));
  out.push(L(G.circleOf(F, -0.05, 16.4, P), { tone: "lo" }));
  return out.join("");
}

function hits() {
  const zone = (s0, s1, ring, label, min, max, now, text) =>
    `<path class="lr-hit" data-hit="${ring}" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${now}" aria-valuetext="${text}" d="${G.disc(s0, s1, R_RING + 3, F, P, DS).fill}"/>`;
  return (
    zone(ZOOM_BAND[0], ZOOM_GRIP[1], "zoom", "Zoom ring. Left and right arrows change the focal length. Tab moves to the focus ring.", 35, 100, ZOOM_MM[ZOOM_START], `${ZOOM_MM[ZOOM_START]} mm`) +
    zone(FOCUS_GRIP[0], FOCUS_BAND[1], "focus", "Focus ring. Up and down arrows choose the sharp distance.", 0, 4, FOCUS_START, `sharp at ${FOCUS_M[FOCUS_START]} m`)
  );
}

const readoutOf = (zi, fi) => `${ZOOM_MM[zi]} mm · sees ${Math.round(aovOf(ZOOM_MM[zi]))}° wide · ${FOCUS_M[fi] === "∞" ? "sharp at ∞ (far away)" : `sharp at ${FOCUS_M[fi]} m`}`;

const C = { blue: "#6b9bff", green: "#6be0a0", lit: "#ffffff", hi: "#d4d4d4", mid: "#6a6a6a", lo: "#3e3e3e", glassCut: "#24313a", cut: "#2a2a2a", cavity: "#0c0c0c" };
const toned = (scope, paper, shades, top) =>
  [`${scope} .iso-solid>.iso-fill{fill:${paper}}`, ...shades.map((c, i) => `${scope} .iso-solid>.iso-shade[data-shade="${i}"]{fill:${c};stroke:${c}}`), `${scope} .iso-solid>.iso-top{fill:${top};stroke:${top}}`].join("\n");
const style = `<style>
.lr-stage{position:relative;touch-action:none;-webkit-user-select:none;user-select:none}
${toned(".lr-cavity", "#0a0a0a", ["#090909", "#0b0b0b", "#0d0d0d", "#0f0f0f"], "#101010")}
${toned(".lr-glass", "#1a2228", ["#141b20", "#172026", "#1b252c", "#1f2a32"], "#23303a").replace(/\.lr-glass \.iso-solid/g, ".iso-solid.lr-glass")}
.lr-glass.lr-zoom>.iso-edge{stroke:${C.blue};stroke-opacity:.75}
.lr-glass.lr-focus>.iso-edge{stroke:${C.green};stroke-opacity:.75}
.lr-cut-metal{fill:${C.cut};stroke:${C.mid};stroke-width:.6;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.lr-cut-glass{fill:${C.glassCut};stroke:${C.hi};stroke-width:.7;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.lr-section.lr-zoom .lr-cut-glass{fill:color-mix(in srgb,${C.blue} 24%,${C.glassCut});stroke:${C.blue}}
.lr-section.lr-focus .lr-cut-glass{fill:color-mix(in srgb,${C.green} 22%,${C.glassCut});stroke:${C.green}}
.lr-stage[data-on="zoom"] .lr-section.lr-zoom .lr-cut-glass,.lr-stage[data-on="focus"] .lr-section.lr-focus .lr-cut-glass{stroke-width:1.3}
.lr-glass-face{fill:${C.glassCut}}
.lr-bore{fill:${C.cavity}}
.lr-bull{fill:${C.mid}}
.lr-cone-fill{fill:${C.lit};fill-opacity:.045;stroke:none}
.lr-cone .iso-line{stroke-opacity:.7}
.lr-frame{stroke-width:1.1}
.lr-nums-z text{fill:${C.blue}}
.lr-nums-f text{fill:${C.green}}
.lr-ring .lr-ringpart>.iso-edge{transition:stroke .25s}
.lr-ring[data-ring="zoom"][data-on] .lr-ringpart>.iso-edge{stroke:${C.blue}}
.lr-ring[data-ring="focus"][data-on] .lr-ringpart>.iso-edge{stroke:${C.green}}
.lr-ring[data-on] .lr-ribs path{stroke:${C.mid}}
.lr-hit{fill:transparent;stroke:none;cursor:grab;outline:none}
.lr-hit:active{cursor:grabbing}
</style>`;

const svg = k
  .figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A zoom lens lying on a stand, aimed at a target board. Part of the barrel is cut away to show three groups of glass on two rails. The wide zoom ring slides the two blue zoom groups apart or together, and a cone of light shows how much of the board the lens sees. The narrow focus ring slides the small green focus group a short way.",
    body: [board(), cone(), plate(), posts(), frontEnd(), cutaway(), rearEnd(), hits()],
  })
  .replace('role="img"', 'role="group"');

const DATA = {
  P,
  ZA,
  READ,
  RIBS,
  ZOOM_MM,
  FOCUS_M,
  ZOOM_START,
  FOCUS_START,
  ZOOM_STEP,
  FOCUS_STEP,
  APEX,
  BOARD_X,
  SENSOR_W,
  rings: {
    zoom: { grip: ZOOM_GRIP, band: ZOOM_BAND, r: R_RING, rb: R_BAND },
    focus: { grip: FOCUS_GRIP, band: FOCUS_BAND, r: R_RING, rb: R_BAND },
  },
  groups: GROUPS.map((g) => ({ name: g.name, kind: g.kind, a: g.at(0), b: g.at(g.kind === "focus" ? 4 : 3) })),
};

const live = `
const DATA = ${JSON.stringify(DATA)};
const { P, ZA, READ, RIBS, ZOOM_MM, FOCUS_M, APEX, BOARD_X, SENSOR_W } = DATA;
const springTo = ${springTo.toString()};
const stage = document.querySelector(".lr-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const V = [Math.cos(P.azimuth * Math.PI / 180) * Math.cos(P.elevation * Math.PI / 180), Math.sin(P.azimuth * Math.PI / 180) * Math.cos(P.elevation * Math.PI / 180), Math.sin(P.elevation * Math.PI / 180)];
const VYZ = Math.hypot(V[1], V[2]);
const P3 = (s, r, t) => [s, r * Math.cos(t), ZA + r * Math.sin(t)];
const at = (p) => iso(p, P);
const fade = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const f1 = (n) => n.toFixed(1);
const rings = {
  zoom: { stops: ZOOM_MM.length, step: DATA.ZOOM_STEP, v: DATA.ZOOM_START, target: DATA.ZOOM_START, el: svg.querySelector('[data-ring="zoom"]'), hit: svg.querySelector('[data-hit="zoom"]'), ribs: [...svg.querySelectorAll('[data-part="zoom-ribs"] path')], nums: [...svg.querySelectorAll('[data-part="zoom-nums"] text')], geo: DATA.rings.zoom, spin: { x: 0, v: 0 } },
  focus: { stops: FOCUS_M.length, step: DATA.FOCUS_STEP, v: DATA.FOCUS_START, target: DATA.FOCUS_START, el: svg.querySelector('[data-ring="focus"]'), hit: svg.querySelector('[data-hit="focus"]'), ribs: [...svg.querySelectorAll('[data-part="focus-ribs"] path')], nums: [...svg.querySelectorAll('[data-part="focus-nums"] text')], geo: DATA.rings.focus, spin: { x: 0, v: 0 } },
};
const groups = DATA.groups.map((g) => ({ ...g, els: [...svg.querySelectorAll('[data-group="' + g.name + '"]')] }));
const coneFill = svg.querySelector('[data-part="cone-fill"]');
const coneEdge = svg.querySelector('[data-part="cone-edge"]');
const frame = svg.querySelector('[data-part="frame"]');
const focalAt = (v) => { const i = Math.min(ZOOM_MM.length - 2, Math.max(0, Math.floor(v))); const t = v - i; return Math.exp(Math.log(ZOOM_MM[i]) * (1 - t) + Math.log(ZOOM_MM[i + 1]) * t); };
const aovOf = (f) => 2 * Math.atan(SENSOR_W / (2 * f));
const textOf = (zi, fi) => ZOOM_MM[zi] + " mm · sees " + Math.round(aovOf(ZOOM_MM[zi]) * 180 / Math.PI) + "° wide · " + (FOCUS_M[fi] === "∞" ? "sharp at ∞ (far away)" : "sharp at " + FOCUS_M[fi] + " m");
function drawRing(ring) {
  const { grip, band, r, rb } = ring.geo;
  const phase = ring.v * ring.step;
  ring.ribs.forEach((el, i) => {
    const t = READ - phase + (i / RIBS) * Math.PI * 2;
    const facing = (V[1] * Math.cos(t) + V[2] * Math.sin(t)) / VYZ;
    const alpha = fade(facing, 0.06, 0.5);
    if (alpha < 0.02) { el.setAttribute("d", ""); return; }
    const a = at(P3(grip[0], r, t)), b = at(P3(grip[1], r, t));
    el.setAttribute("d", "M" + f1(a[0]) + " " + f1(a[1]) + "L" + f1(b[0]) + " " + f1(b[1]));
    el.setAttribute("opacity", alpha.toFixed(2));
  });
  const s = (band[0] + band[1]) / 2;
  ring.nums.forEach((el, i) => {
    const t = READ + (i - ring.v) * ring.step;
    const facing = (V[1] * Math.cos(t) + V[2] * Math.sin(t)) / VYZ;
    const alpha = fade(facing, 0.35, 0.8);
    const o = at(P3(s, rb + 0.05, t));
    const ax = at(P3(s + 1, rb + 0.05, t));
    const tp = [s, rb * Math.cos(t) + Math.sin(t), ZA + rb * Math.sin(t) - Math.cos(t)];
    const dn = at(tp);
    el.setAttribute("transform", "matrix(" + [ax[0] - o[0], ax[1] - o[1], dn[0] - o[0], dn[1] - o[1], o[0], o[1]].map((n) => n.toFixed(3)).join(" ") + ")");
    el.setAttribute("opacity", alpha.toFixed(2));
  });
}
function drawCone(v) {
  const half = aovOf(focalAt(v)) / 2;
  const d = BOARD_X - 0.2 - APEX[0];
  const hw = d * Math.tan(half), hh = hw * 9 / 16;
  const c = [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]].map(([y, z]) => at([BOARD_X - 0.2, y, ZA + z]));
  const a = at(APEX);
  const p = (q) => f1(q[0]) + " " + f1(q[1]);
  coneFill.setAttribute("d", c.map((q, i) => "M" + p(a) + "L" + p(q) + "L" + p(c[(i + 1) % 4]) + "Z").join(""));
  coneEdge.setAttribute("d", c.map((q) => "M" + p(a) + "L" + p(q)).join(""));
  frame.setAttribute("d", "M" + c.map(p).join("L") + "Z");
}
function draw() {
  for (const g of groups) {
    const ring = g.kind === "zoom" ? rings.zoom : rings.focus;
    const share = ring.v / (ring.stops - 1);
    const x = g.a + (g.b - g.a) * share;
    const tr = translateAlong(P, [x, 0, 0]);
    g.els.forEach((el) => el.setAttribute("transform", tr));
  }
  drawRing(rings.zoom);
  drawRing(rings.focus);
  drawCone(rings.zoom.v);
  const text = textOf(Math.round(rings.zoom.v), Math.round(rings.focus.v));
  if (readout.textContent !== text) readout.textContent = text;
}
let active = null;
function light(name) {
  for (const key in rings) {
    if (key === name) rings[key].el.setAttribute("data-on", "");
    else rings[key].el.removeAttribute("data-on");
  }
  stage.setAttribute("data-on", name);
}
function describe() {
  const zi = rings.zoom.target, fi = rings.focus.target;
  rings.zoom.hit.setAttribute("aria-valuenow", String(ZOOM_MM[zi]));
  rings.zoom.hit.setAttribute("aria-valuetext", ZOOM_MM[zi] + " mm, sees " + Math.round(aovOf(ZOOM_MM[zi]) * 180 / Math.PI) + " degrees wide");
  rings.focus.hit.setAttribute("aria-valuenow", String(fi));
  rings.focus.hit.setAttribute("aria-valuetext", FOCUS_M[fi] === "∞" ? "sharp far away" : "sharp at " + FOCUS_M[fi] + " metres");
}
let frameId = 0, last = 0, visible = false, touring = !still.matches, clock = -1.4, idleTimer = 0;
const TOUR = [["zoom", 2], ["zoom", 3], ["zoom", 2], ["zoom", 1], ["zoom", 0], ["zoom", 1], ["focus", 3], ["focus", 4], ["focus", 3], ["focus", 2], ["focus", 1], ["focus", 0], ["focus", 1], ["focus", 2]];
const DWELL = 1.5;
let tourStep = -1;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    const step = clock < 0 ? tourStep : Math.floor(clock / DWELL) % TOUR.length;
    if (step !== tourStep && step >= 0) { tourStep = step; const [name, value] = TOUR[step]; rings[name].target = value; light(name); describe(); }
  }
  let moving = false;
  for (const key in rings) {
    const ring = rings[key];
    if (calm || touring) {
      ring.v = calm ? ring.target : ring.v + (ring.target - ring.v) * (1 - Math.exp(-dt / 0.2));
      if (Math.abs(ring.target - ring.v) < 0.001) ring.v = ring.target;
      ring.spin.v = 0;
      if (ring.v !== ring.target) moving = true;
    } else {
      ring.spin.x = ring.v;
      if (springTo(ring.spin, ring.target, dt)) moving = true;
      ring.v = ring.spin.x;
    }
  }
  draw();
  frameId = visible && (touring || moving) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frameId && visible) { last = 0; frameId = requestAnimationFrame(tick); } };
function hold() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (still.matches || drag) return; touring = true; clock = -0.6; tourStep = -1; run(); }, 3600);
}
function set(name, value, from = rings[name].target) {
  const ring = rings[name];
  const next = Math.max(0, Math.min(ring.stops - 1, value));
  hold();
  light(name);
  if (next !== ring.target) { ring.target = next; describe(); }
  if (next !== from) window.detent();
  run();
}
let drag = null;
const PX_PER_STOP = 52;
function screenScale() { const box = svg.getBoundingClientRect(); return ${WIDTH} / box.width; }
for (const name in rings) {
  const ring = rings[name];
  ring.hit.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    ring.hit.setPointerCapture(event.pointerId);
    drag = { name, id: event.pointerId, x: event.clientX, y: event.clientY, raw: ring.target };
    ring.hit.focus({ preventScroll: true });
    set(name, ring.target);
  });
  ring.hit.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    drag.raw = Math.max(-0.45, Math.min(ring.stops - 0.55, drag.raw + (dx + dy) / PX_PER_STOP));
    set(name, Math.round(drag.raw));
  });
  const end = (event) => { if (drag && drag.id === event.pointerId) { drag = null; hold(); } };
  ring.hit.addEventListener("pointerup", end);
  ring.hit.addEventListener("pointercancel", end);
  ring.hit.addEventListener("pointerenter", (event) => { if (!drag && event.pointerType === "mouse") light(name); });
  ring.hit.addEventListener("focus", () => light(name));
}
stage.addEventListener("keydown", (event) => {
  let name = null, delta = 0;
  if (event.key === "ArrowRight") { name = "zoom"; delta = 1; }
  if (event.key === "ArrowLeft") { name = "zoom"; delta = -1; }
  if (event.key === "ArrowUp") { name = "focus"; delta = 1; }
  if (event.key === "ArrowDown") { name = "focus"; delta = -1; }
  const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.hit : null;
  if (event.key === "Home" && focused) { name = focused; delta = -99; }
  if (event.key === "End" && focused) { name = focused; delta = 99; }
  if (!name) return;
  event.preventDefault();
  const ring = rings[name];
  if (focused !== name) rings[name].hit.focus({ preventScroll: true });
  const here = Math.round(touring ? ring.v : ring.target);
  set(name, here + delta, here);
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
light("zoom");
describe();
draw();
`;

const body =
  style +
  k.plateHtml({
    fig: "Fig 4",
    title: "Zoom and focus rings",
    hint: "Drag a ring · ← → zoom · ↑ ↓ focus",
    readout: readoutOf(ZOOM_START, FOCUS_START),
    keys: [
      { mark: "blue", label: "Zoom groups, moved by the zoom ring" },
      { mark: "green", label: "Focus group, moved by the focus ring" },
      { mark: "lit", label: "What the lens sees" },
    ],
    caption:
      "The zoom ring slides glass apart to change how much the lens sees. The focus ring nudges one small group of glass to choose what distance is sharp. Zooming often shifts focus, so check focus again after you zoom.",
    body: `<div class="lr-stage">${svg}</div>`,
  });

writeFigure("lens-rings", { title: "Zoom and focus rings", body, script: kitScript() + live, width: 650 });

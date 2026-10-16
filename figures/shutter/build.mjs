import * as k from "../anatomy/kit/iso-kit.mjs";
import * as G from "../anatomy/kit/lathe.mjs";
import { kitScript } from "../anatomy/scripts/inline-kit.mjs";
import { writeFigure } from "../embed.mjs";

const WIDTH = 600;
const HEIGHT = 450;

const ANGLES = [45, 90, 180, 270, 360];
const START = 2;
const FPS = 30;
const TURN_SECONDS = 2.5;

const PLATE = { x: -78, y: -66, w: 160, d: 240, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const HOUSING = { x: -64, y: -52, w: 128, d: 42, r: 4 };
const FACE_Y = HOUSING.y + HOUSING.d;
const BODY_TOP = 152;
const LID_TOP = 156;

const HUB_Z = 74;
const R = 56;
const DISC_T = 1.6;
const COLLAR_R = 17;
const GATE = { u: 9, v0: -45, v1: -31 };
const GATE_HALF = (Math.atan(GATE.u / -((GATE.v0 + GATE.v1) / 2)) * 180) / Math.PI;

const MOTOR = { s0: 4, s1: 22, r: 11 };
const CANDLE = [0, 142];
const FLAME_Z = 112;

const KNOB = [34, -31];
const KNOB_STOPS = [104, 142, 180, 218, 256];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(HOUSING, 0, LID_TOP + 8), [CANDLE[0], CANDLE[1], FLAME_Z + 10]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 60 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const face = (y) => k.sideMatrix([0, y], HUB_Z, P, "left");
const AXIS = G.frameAlong([0, 0, HUB_Z], [0, 1, 0]);
const n = (value) => Math.round(value * 100) / 100;

function pie(r, from, span) {
  const RAD = Math.PI / 180;
  const pt = (deg) => `${Math.round(r * Math.sin(deg * RAD) * 100) / 100} ${Math.round(-r * Math.cos(deg * RAD) * 100) / 100}`;
  if (span <= 0.8) return "M0 0Z";
  if (span >= 359.2) return `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`;
  return `M0 0L${pt(from)}A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${pt(from + span)}Z`;
}

function edges(r, span) {
  const RAD = Math.PI / 180;
  if (span <= 0.8 || span >= 359.2) return "M0 0Z";
  const tip = (deg) => `${Math.round(r * Math.sin(deg * RAD) * 100) / 100} ${Math.round(-r * Math.cos(deg * RAD) * 100) / 100}`;
  return `M0 0L${tip(0)}M0 0L${tip(span)}`;
}

function readoutOf(angle) {
  const words = { 45: "open one eighth", 90: "open one quarter", 180: "open half", 270: "open three quarters", 360: "always open" };
  const time = `1/${Math.round((30 * 360) / angle)} s at 30 fps`;
  return angle === 360 ? `360° · ${words[360]} · ${time}` : `${angle}° · ${words[angle]} of each frame · ${time}`;
}

function exposureAt(turn, open, half) {
  if (open >= 360) return 1;
  const gate = (((-turn) % 360) + 360) % 360;
  let lit = 0;
  for (const shift of [-360, 0, 360]) lit += Math.max(0, Math.min(gate + half + shift, 360) - Math.max(gate - half + shift, 360 - open));
  return Math.min(1, lit / (2 * half));
}

function hull(points) {
  const list = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of list) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of list.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return k.pathOf([...lower.slice(0, -1), ...upper.slice(0, -1)], true);
}

const gateCorners = (y) => [
  [-GATE.u, y, HUB_Z - GATE.v0],
  [GATE.u, y, HUB_Z - GATE.v0],
  [GATE.u, y, HUB_Z - GATE.v1],
  [-GATE.u, y, HUB_Z - GATE.v1],
];
const rect = (u0, v0, u1, v1) => `M${u0} ${v0}H${u1}V${v1}H${u0}Z`;

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: 67, y: -36, w: 7, d: 196, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 4, 5, strip.x + 0.8, 0.6, [2, 3.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3.5, strip.y + 2, 0.6]), at([strip.x + 3.5, strip.y + strip.d - 2, 0.6])], { size: 0.45 }));
  const label = { x: 10, y: 44, w: 54, d: 14, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + 9], 0.8, P, "x"), "slowed way down", { size: 5.4, tone: "hi", anchor: "middle" }));
  out.push(D([at([label.x + 3, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  return out.join("");
}

function housing() {
  const out = [`<path class="iso-halo" d="${k.haloOf(HOUSING, 0, 10, P)}"/>`];
  out.push(S(k.slabOf(k.insetPlan(HOUSING, -2.5), 0, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(HOUSING, 5, BODY_TOP - 5, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(HOUSING, 28, P, 4), { tone: "faint" }) }));
  const side = k.sideMatrix([HOUSING.x + HOUSING.w, 0], 0, P, "right");
  const slots = [-44, -38, -32, -26, -20].map((y) => `<path class="iso-line" data-tone="lo" d="M${-y - 1.4} -128V-92A1.4 1.4 0 0 1 ${-y + 1.4} -92V-128A1.4 1.4 0 0 1 ${-y - 1.4} -128Z"/>`);
  out.push(`<g transform="${side}">${slots.join("")}</g>`);
  out.push(D([at([HOUSING.x + HOUSING.w, HOUSING.y + 6, 136]), at([HOUSING.x + HOUSING.w, FACE_Y - 6, 136]), at([HOUSING.x + HOUSING.w, HOUSING.y + 6, 40]), at([HOUSING.x + HOUSING.w, FACE_Y - 6, 40])], { size: 0.45 }));
  out.push(D([[-58, 144], [58, 144], [-58, 14], [58, 14]].map(([x, z]) => at([x, FACE_Y, z])), { size: 0.5 }));
  const front = [];
  front.push(`<circle class="sh-well" cx="0" cy="0" r="61"/>`);
  front.push(`<circle class="iso-line" data-tone="lo" cx="0" cy="0" r="61"/>`);
  front.push(`<circle class="iso-line" data-tone="faint" cx="0" cy="0" r="58.6"/>`);
  front.push(`<path class="iso-fill" style="fill:var(--anatomy-shade-1)" d="${rect(-15, -50, 15, -26)}"/>`);
  front.push(`<path class="iso-line" data-tone="lo" d="${rect(-15, -50, 15, -26)}"/>`);
  front.push(`<path class="iso-fill" style="fill:var(--anatomy-shade-0)" d="${rect(-GATE.u, GATE.v0, GATE.u, GATE.v1)}"/>`);
  front.push(`<path class="iso-line" data-tone="mid" d="${rect(-GATE.u, GATE.v0, GATE.u, GATE.v1)}"/>`);
  const grid = [];
  for (let u = -6; u <= 6; u += 3) grid.push(`M${u} ${GATE.v0}V${GATE.v1}`);
  for (let v = GATE.v0 + 3.5; v < GATE.v1; v += 3.5) grid.push(`M${-GATE.u} ${v}H${GATE.u}`);
  front.push(`<path class="iso-line" data-tone="faint" d="${grid.join("")}"/>`);
  front.push(`<path data-part="glow" class="sh-glow" clip-path="url(#sh-open)" d="${rect(-GATE.u, GATE.v0, GATE.u, GATE.v1)}"/>`);
  for (const [u, v] of [[-12.4, -47.4], [12.4, -47.4], [-12.4, -28.6], [12.4, -28.6]]) front.push(`<circle class="sh-screw" cx="${u}" cy="${v}" r="0.9"/>`);
  front.push(`<path class="iso-fill" style="fill:var(--anatomy-shade-0)" d="${rect(-58, -77, -32, -64)}"/>`);
  front.push(`<path class="iso-line" data-tone="mid" d="${rect(-58, -77, -32, -64)}"/>`);
  front.push(`<text data-part="count" class="iso-face-text sh-count" x="-45" y="-67.6" text-anchor="middle" font-size="9">0001</text>`);
  front.push(`<path class="iso-fill" style="fill:var(--anatomy-shade-0)" d="${rect(26, -76, 58, -65)}"/>`);
  front.push(`<path data-part="span" class="sh-span" d="${rect(26, -76, 26 + 32 * (ANGLES[START] / 360), -65)}"/>`);
  front.push(`<path class="iso-line" data-tone="mid" d="${rect(26, -76, 58, -65)}"/>`);
  front.push(`<path data-part="head" class="iso-line" data-tone="lit" d="M26 -76V-65" style="stroke-width:1"/>`);
  out.push(`<g transform="${face(FACE_Y)}">${front.join("")}</g>`);
  const lid = k.insetPlan(HOUSING, 1.5);
  out.push(S(k.slabOf(lid, BODY_TOP, LID_TOP - BODY_TOP, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(lid, 4), LID_TOP, P, 4), { tone: "faint" }));
  out.push(D(k.corners(lid, 7.5).map(([x, y]) => at([x, y, LID_TOP])), { size: 0.45 }));
  return out.join("");
}

function knob() {
  const [x, y] = KNOB;
  const out = [];
  const base = LID_TOP + 1.6;
  out.push(S(k.cylinder(x, y, 18, LID_TOP, 1.6, P, 56, 0.4), { tone: "mid" }));
  const RAD = Math.PI / 180;
  const ticks = KNOB_STOPS.map((deg) => {
    const s = Math.sin(deg * RAD), c = -Math.cos(deg * RAD);
    return k.lineOnTop([x + s * 12, y + c * 12], [x + s * 18, y + c * 18], base, P);
  });
  out.push(L(ticks.join(""), { tone: "hi" }));
  out.push(L(k.ring(x, y, 15.4, base, P, 56), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 12, base, 8, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, 12, base, base + 8, 48, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, 9.4, base + 8, P, 40), { tone: "faint" }));
  return out.join("");
}

const pointerAt = (deg) => {
  const RAD = Math.PI / 180;
  const [x, y] = KNOB;
  const s = Math.sin(deg * RAD), c = -Math.cos(deg * RAD);
  return k.lineOnTop([x - s * 3, y - c * 3], [x + s * 11, y + c * 11], LID_TOP + 9.6, P);
};

const tipAt = (deg) => {
  const RAD = Math.PI / 180;
  return k.iso([KNOB[0] + Math.sin(deg * RAD) * 11, KNOB[1] - Math.cos(deg * RAD) * 11, LID_TOP + 9.6], P);
};

function shaft() {
  return S(G.disc(-10, -DISC_T, 3, AXIS, P), { tone: "mid", crease: "none" });
}

function beamBack() {
  const pts = [...gateCorners(-DISC_T), ...gateCorners(FACE_Y)].map(at);
  return `<path data-part="beam-back" class="sh-beam-back" d="${hull(pts)}" style="opacity:0"/>`;
}

function disc(span) {
  const back = [];
  back.push(`<g data-turn><path data-part="blade-back" class="sh-blade-back" d="${pie(R, 0, span)}"/></g>`);
  const fr = [];
  fr.push(`<g data-turn>`);
  fr.push(`<path data-part="blade" class="sh-blade" d="${pie(R, 0, span)}"/>`);
  fr.push(`<g clip-path="url(#sh-blade-still)">`);
  fr.push(`<circle class="iso-line" data-tone="faint" cx="0" cy="0" r="${R - 5}"/>`);
  fr.push(`<circle class="iso-line" data-tone="faint" cx="0" cy="0" r="${COLLAR_R + 6}"/>`);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    fr.push(`<circle class="sh-rivet" cx="${n(Math.sin(a) * (R - 8.4))}" cy="${n(-Math.cos(a) * (R - 8.4))}" r="0.55"/>`);
  }
  fr.push(`</g>`);
  fr.push(`<path data-part="edges" class="iso-line" data-tone="lit" d="${edges(R, span)}" style="stroke-width:1.1"/>`);
  fr.push(`</g>`);
  fr.push(`<path class="sh-patch" clip-path="url(#sh-blade)" d="${rect(-GATE.u, GATE.v0, GATE.u, GATE.v1)}"/>`);
  return `<g transform="${face(-DISC_T)}">${back.join("")}</g><g transform="${face(0)}">${fr.join("")}</g>`;
}

function collar() {
  const out = [S(G.disc(0, 3, COLLAR_R, AXIS, P), { tone: "hi", crease: "lo" })];
  const screws = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    screws.push(`<circle class="sh-screw" cx="${n(Math.sin(a) * 14)}" cy="${n(-Math.cos(a) * 14)}" r="1"/>`);
  }
  screws.push(`<circle class="sh-index" cx="0" cy="-14" r="1.5"/>`);
  out.push(`<g transform="${face(3)}"><g data-turn>${screws.join("")}</g></g>`);
  return out.join("");
}

function motor() {
  const out = [];
  const foot = { x: -14, y: 2, w: 28, d: 24, r: 2 };
  out.push(S(k.slabOf(foot, 0, 3, P, 3, 0.5), { tone: "mid" }));
  out.push(D(k.corners(foot, 3.4).map(([x, y]) => at([x, y, 3])), { size: 0.45 }));
  const post = { x: -8, y: 6, w: 16, d: 14, r: 1.4 };
  out.push(S(k.slabOf(post, 3, HUB_Z - MOTOR.r - 3, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(post, 40, P, 3), { tone: "faint" }) }));
  out.push(S(G.disc(MOTOR.s0, MOTOR.s0 + 2, MOTOR.r + 1.5, AXIS, P), { tone: "mid" }));
  const seams = [10, 16].map((s) => G.arcOf(AXIS, s, MOTOR.r, P)).join("");
  out.push(S(G.disc(MOTOR.s0 + 2, MOTOR.s1, MOTOR.r, AXIS, P), { tone: "mid", inner: L(seams, { tone: "faint" }) }));
  out.push(S(G.disc(MOTOR.s1, MOTOR.s1 + 2, MOTOR.r - 2, AXIS, P), { tone: "mid" }));
  out.push(D(G.dotsOf(AXIS, MOTOR.s1 + 2, MOTOR.r - 4.4, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.5 }));
  out.push(L(G.circleOf(AXIS, MOTOR.s1 + 2, 2.2, P), { tone: "lo" }));
  return out.join("");
}

function beamFront() {
  const flame = at([CANDLE[0], CANDLE[1], FLAME_Z]);
  const gate = at([0, 0, HUB_Z - (GATE.v0 + GATE.v1) / 2]);
  const grad = `<linearGradient id="sh-beam" gradientUnits="userSpaceOnUse" x1="${n(flame[0])}" y1="${n(flame[1])}" x2="${n(gate[0])}" y2="${n(gate[1])}"><stop offset="0" stop-color="var(--sh-light)" stop-opacity=".34"/><stop offset="1" stop-color="var(--sh-light)" stop-opacity=".1"/></linearGradient>`;
  return `<defs>${grad}</defs><path class="sh-beam" d="${hull([flame, ...gateCorners(0).map(at)])}"/>`;
}

function candle() {
  const [x, y] = CANDLE;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 15, y: y - 15, w: 30, d: 30, r: 15 }, 0, 4, P)}"/>`];
  out.push(S(k.cylinder(x, y, 15, 0, 3, P, 56, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 10, 3, 3, P, 48, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 2.6, 6, 34, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 5, 40, 4, P, 28, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 2.6, 44, 36, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 11, 80, 2, P, 48, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 6, 82, 22, P, 32, 0.6), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x, y, 0.5, 104, 3, P, 8), { tone: "lo", crease: "none" }));
  const base = at([x, y, 105.5]);
  const tip = at([x, y, 121]);
  const w = 3.6 * P.scale;
  const h = tip[1] - base[1];
  const drop = (wide, lift) => `M${n(tip[0])} ${n(tip[1] + lift)}C${n(tip[0] + wide * 0.35)} ${n(tip[1] - h * 0.42)} ${n(base[0] + wide)} ${n(base[1] + h * 0.1)} ${n(base[0])} ${n(base[1])}C${n(base[0] - wide)} ${n(base[1] + h * 0.1)} ${n(tip[0] - wide * 0.35)} ${n(tip[1] - h * 0.42)} ${n(tip[0])} ${n(tip[1] + lift)}Z`;
  out.push(`<circle class="sh-flare" cx="${n(base[0])}" cy="${n(base[1] + h * 0.45)}" r="${n(16 * P.scale)}"/>`);
  out.push(`<path data-part="flame" class="sh-flame" d="${drop(w, 0)}"/>`);
  out.push(`<path class="sh-flame-core" d="${drop(w * 0.45, -h * 0.4)}"/>`);
  return out.join("");
}

const span0 = 360 - ANGLES[START];
const defs = `<defs><radialGradient id="sh-flare"><stop offset="0" stop-color="var(--sh-light)" stop-opacity=".32"/><stop offset="1" stop-color="var(--sh-light)" stop-opacity="0"/></radialGradient><clipPath id="sh-blade"><path data-part="blade-clip" data-turn-self d="${pie(R, 0, span0)}"/></clipPath><clipPath id="sh-blade-still"><path data-part="blade-still" d="${pie(R, 0, span0)}"/></clipPath><clipPath id="sh-open"><path data-part="open-clip" data-turn-self d="${pie(R + 30, span0, 360 - span0)}"/></clipPath></defs>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A rotary shutter on a bench. A candle shines into a camera body. In front of the body, a motor spins a metal disc with a slice cut out of it, once for every frame. The image sensor on the body only lights up while the open slice passes in front of it. A dial on top sets how big the slice is.",
  body: [defs, plate(), housing(), knob(), `<path data-part="pointer" class="iso-line" data-tone="lit" data-free="end" d="${pointerAt(KNOB_STOPS[START])}" style="stroke-width:1.2"/><circle data-part="tip" class="sh-index" r="1.6" cx="${n(tipAt(KNOB_STOPS[START])[0])}" cy="${n(tipAt(KNOB_STOPS[START])[1])}"/>`, shaft(), beamBack(), disc(span0), collar(), motor(), beamFront(), candle()],
});

const STYLE = `<style>
.sh{--sh-light:#ffc46b;--sh-light-hot:#fff1d6}
.sh .iso-stage{touch-action:none;cursor:grab;outline:none;-webkit-user-select:none;user-select:none}
.sh .iso-stage:active{cursor:grabbing}
.sh .iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:2px}
.sh-well{fill:#080808}
.sh-blade{fill:#272727;stroke:var(--anatomy-hi);stroke-width:.7;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.sh-blade-back{fill:#151515;stroke:var(--anatomy-mid);stroke-width:.6;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.sh-rivet{fill:var(--anatomy-dot);opacity:.32}
.sh-screw{fill:var(--anatomy-dot);opacity:.5}
.sh-index{fill:var(--anatomy-lit)}
.sh-glow{fill:var(--sh-light)}
.sh-span{fill:var(--sh-light);opacity:.85}
.sh-count{fill:var(--sh-light);letter-spacing:.12em}
.sh-patch{fill:var(--sh-light);opacity:.42}
.sh-beam{fill:url(#sh-beam)}
.sh-beam-back{fill:var(--sh-light)}
.sh-flare{fill:url(#sh-flare)}
.sh-flame{fill:var(--sh-light)}
.sh-flame-core{fill:var(--sh-light-hot)}
.sh .iso-key:nth-child(2) .iso-swatch path{stroke:var(--sh-light);fill:var(--sh-light)}
.sh .iso-plate{padding-bottom:68px;overflow:hidden}
.sh .iso-plate-corner[data-corner="hint"]{bottom:20px}
@media (max-width:560px){.sh .iso-plate{padding:40px 12px 84px}.sh .iso-svg{width:126%;margin:-6% -13% -4%}.sh .iso-plate-corner[data-corner="hint"]{bottom:38px}.sh .iso-plate-corner[data-corner="readout"]{white-space:normal;left:0;text-align:right}}
@media (max-width:420px){.sh .iso-plate-corner{font-size:9px}}
</style>`;

const live = `
const ANGLES = ${JSON.stringify(ANGLES)};
const P = ${JSON.stringify(P)};
const R = ${R}, TURN_SECONDS = ${TURN_SECONDS}, GATE_HALF = ${GATE_HALF}, KNOB = ${JSON.stringify(KNOB)}, LID_TOP = ${LID_TOP};
const KNOB_STOPS = ${JSON.stringify(KNOB_STOPS)};
const pie = ${pie.toString()};
const edges = ${edges.toString()};
const readoutOf = ${readoutOf.toString()};
const exposureAt = ${exposureAt.toString()};
const pointerAt = ${pointerAt.toString().replace("k.lineOnTop", "lineOnTop")};
const tipAt = ${tipAt.toString().replace("k.iso", "iso")};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const turners = [...svg.querySelectorAll("[data-turn]"), ...svg.querySelectorAll("[data-turn-self]")];
const blades = [part("blade"), part("blade-back"), part("blade-clip"), part("blade-still")];
const openClip = part("open-clip"), edgeLine = part("edges"), pointer = part("pointer"), counter = part("count");
const span = part("span"), head = part("head"), beamBack = part("beam-back"), tip = part("tip");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let index = ${START}, open = { x: ANGLES[index], v: 0 }, dial = { x: KNOB_STOPS[index], v: 0 };
let turn = 0, frames = 1, frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourTurns = 0, tourStep = 0, drag = null, drawnOpen = -1;
const TOUR = [2, 1, 0, 1, 2, 3, 4, 3];
const settle = (state, target, dt, seconds, calm) => {
  if (calm) { state.x = target; state.v = 0; return false; }
  const w = 1 / seconds;
  for (let i = 0; i < 4; i++) { state.v += (w * w * (target - state.x) - 2 * w * state.v) * dt / 4; state.x += state.v * dt / 4; }
  if (Math.abs(target - state.x) < 0.02 && Math.abs(state.v) < 0.05) { state.x = target; state.v = 0; return false; }
  return true;
};
function shape() {
  const spanDeg = 360 - open.x;
  const blade = pie(R, 0, spanDeg);
  blades.forEach((node) => node.setAttribute("d", blade));
  openClip.setAttribute("d", pie(R + 30, spanDeg, open.x));
  edgeLine.setAttribute("d", edges(R, spanDeg));
  span.setAttribute("d", "M26 -76H" + (26 + 32 * open.x / 360).toFixed(2) + "V-65H26Z");
  drawnOpen = open.x;
}
function draw() {
  if (open.x !== drawnOpen) shape();
  const t = "rotate(" + turn.toFixed(2) + ")";
  turners.forEach((node) => node.setAttribute("transform", t));
  pointer.setAttribute("d", pointerAt(dial.x));
  const [tx, ty] = tipAt(dial.x);
  tip.setAttribute("cx", tx.toFixed(2));
  tip.setAttribute("cy", ty.toFixed(2));
  const lit = exposureAt(turn, open.x, GATE_HALF);
  beamBack.style.opacity = (0.3 * lit).toFixed(3);
  head.setAttribute("d", "M" + (26 + 32 * turn / 360).toFixed(2) + " -76V-65");
  const count = String(frames % 10000).padStart(4, "0");
  if (counter.textContent !== count) counter.textContent = count;
  const text = readoutOf(ANGLES[index]);
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(ANGLES[index]));
  stage.setAttribute("aria-valuetext", readoutOf(ANGLES[index]));
}
function choose(next) {
  index = Math.max(0, Math.min(ANGLES.length - 1, next));
  describe();
  if (still.matches) turn = ANGLES[index] / 2;
  run();
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (!calm) {
    turn += (360 * dt) / TURN_SECONDS;
    if (turn >= 360) {
      turn -= 360;
      frames += 1;
      if (touring && ++tourTurns % 2 === 0) { tourStep = (tourStep + 1) % TOUR.length; index = TOUR[tourStep]; describe(); }
    }
  }
  const moving = settle(open, ANGLES[index], dt, 0.13, calm) | settle(dial, KNOB_STOPS[index], dt, 0.12, calm);
  draw();
  frame = visible && (!calm || moving) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const takeOver = () => {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!drag && !still.matches) { touring = true; tourTurns = 0; tourStep = Math.max(0, TOUR.indexOf(index)); run(); } }, 8000);
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) turn = ANGLES[index] / 2;
stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  try { stage.setPointerCapture(event.pointerId); } catch {}
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: index };
  takeOver();
  stage.focus({ preventScroll: true });
});
stage.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const box = svg.getBoundingClientRect();
  const step = Math.max(22, box.width / 16);
  const moved = (event.clientX - drag.x) - (event.clientY - drag.y);
  const raw = drag.from + moved / step;
  if (raw < -0.5 || raw > ANGLES.length - 0.5) {
    drag.from = raw < 0 ? 0 : ANGLES.length - 1;
    drag.x = event.clientX;
    drag.y = event.clientY;
  }
  const next = drag.from + Math.round((event.clientX - drag.x - (event.clientY - drag.y)) / step);
  if (next !== index) choose(next);
});
const release = (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  try { stage.releasePointerCapture(event.pointerId); } catch {}
  drag = null;
  takeOver();
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = index + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = index - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = ANGLES.length - 1;
  if (to === null) return;
  event.preventDefault();
  takeOver();
  choose(to);
});
describe();
draw();
`;

const body =
  STYLE +
  `<div class="sh">` +
  k.plateHtml({
    fig: "Fig 2",
    title: "Shutter angle",
    hint: "Drag the dial or use arrow keys",
    readout: readoutOf(ANGLES[START]),
    keys: [
      { mark: "lit", label: "The open slice: the gap in the spinning disc" },
      { mark: "raised", label: "Light on the sensor" },
    ],
    caption: "The disc turns once for every frame. The open slice decides how long light reaches the sensor, and 180° means half the frame.",
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Shutter angle. Drag the dial, or use the arrow keys, to make the open slice bigger or smaller." aria-valuemin="45" aria-valuemax="360" aria-valuenow="${ANGLES[START]}" aria-valuetext="${readoutOf(ANGLES[START])}">${svg}</div>`,
  }) +
  `</div>`;

writeFigure("shutter", { title: "Shutter angle", body, script: kitScript() + live, width: 650 });

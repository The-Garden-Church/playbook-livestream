import { CONTROLS, CONTROL_ORDER, FPS, readiness, snap, standardCamera } from "./model.js";
import { SCENARIOS, scenarioCamera } from "./scenarios.js";
import { explain } from "./explain.js";
import { loadScene, loadSceneList } from "./scene-loader.js";
import { createRenderer, HIST_BINS } from "./renderer.js";

const RENDER_WIDTH = 1280;
const MAX_DPR = 1.5;
const $ = (sel) => document.querySelector(sel);

new ResizeObserver(() =>
  parent.postMessage({ figure: "virtual-camera", height: Math.ceil(document.documentElement.getBoundingClientRect().height) }, "*"),
).observe(document.documentElement);

let loaded;
try {
  const sceneBase = new URL("scene/", import.meta.url);
  loaded = await loadScene((await loadSceneList(sceneBase))[0], sceneBase, RENDER_WIDTH);
} catch (error) {
  $("#nogl").textContent = "The practice scene didn't load. Refresh the page to try again.";
  $("#nogl").hidden = false;
  throw error;
}
const { scene } = loaded;
const standard = standardCamera(scene);
const canvas = $("#view");
canvas.style.aspectRatio = `${loaded.width} / ${loaded.height}`;
const renderer = createRenderer(canvas, loaded);
if (!renderer) {
  canvas.hidden = true;
  $("#nogl").hidden = false;
}
canvas.addEventListener("webglcontextlost", () => {
  console.error("virtual camera: WebGL context lost");
  canvas.hidden = true;
  $("#nogl").textContent = "The camera picture stopped. Refresh the page to start it again.";
  $("#nogl").hidden = false;
});

const state = {
  camera: { ...standard },
  mode: "free",
  scenarioId: null,
  result: null,
  completed: new Set(),
  overlays: { zebras: false, falseColor: false, peaking: false, histogram: false },
};
const currentScenario = () => SCENARIOS.find((s) => s.id === state.scenarioId) ?? null;

const focusToPos = (m) => Math.round((1000 * Math.log(m / CONTROLS.focusM.min)) / Math.log(CONTROLS.focusM.max / CONTROLS.focusM.min));
const posToFocus = (p) => CONTROLS.focusM.min * (CONTROLS.focusM.max / CONTROLS.focusM.min) ** (p / 1000);

const SLIDER = {
  list: {
    attrs: (c) => ({ min: 0, max: c.values.length - 1, step: 1 }),
    toPos: (c, v) => c.values.indexOf(v),
    fromPos: (c, p) => c.values[p],
  },
  range: {
    attrs: (c) => ({ min: c.min, max: c.max, step: c.step }),
    toPos: (c, v) => v,
    fromPos: (c, p, key) => snap(key, p),
  },
  log: {
    attrs: () => ({ min: 0, max: 1000, step: 1 }),
    toPos: (c, v) => focusToPos(v),
    fromPos: (c, p) => posToFocus(p),
  },
};

const controlEls = {};
for (const key of CONTROL_ORDER) {
  const c = CONTROLS[key];
  const kind = SLIDER[c.kind];
  const row = document.createElement("div");
  row.className = "control";
  row.innerHTML = `<div class="control-head"><label for="ctl-${key}">${c.label}</label><output id="out-${key}"></output></div>
    <div class="slider"><input type="range" id="ctl-${key}" aria-describedby="why-${key}"></div>
    <p class="why" id="why-${key}"></p>`;
  const input = row.querySelector("input");
  Object.entries(kind.attrs(c)).forEach(([k, v]) => input.setAttribute(k, v));
  input.addEventListener("input", () => setCamera({ [key]: kind.fromPos(c, Number(input.value), key) }));
  if (key === "focusM") {
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.style.setProperty("--at", `${focusToPos(scene.subjectM) / 10}%`);
    mark.textContent = `Speaker ${CONTROLS.focusM.format(scene.subjectM)}`;
    row.querySelector(".slider").append(mark);
  }
  $("#controls").append(row);
  controlEls[key] = { input, out: row.querySelector("output"), why: row.querySelector(".why"), kind, c };
}

for (const button of document.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;
    state.overlays[tool] = !state.overlays[tool];
    update();
  });
}

for (const tab of document.querySelectorAll("[data-mode]")) {
  tab.addEventListener("click", () => {
    state.mode = tab.dataset.mode;
    if (state.mode === "free") {
      state.scenarioId = null;
      state.camera = { ...standard };
    }
    state.result = null;
    update();
  });
}

const list = $("#scenario-list");
SCENARIOS.forEach((s, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<button type="button" data-scenario="${s.id}"><span class="num">${i + 1}</span><span class="title">${s.title}</span><span class="done" aria-label="completed">✓</span></button>`;
  li.querySelector("button").addEventListener("click", () => startScenario(s.id));
  list.append(li);
});

function startScenario(id) {
  state.scenarioId = id;
  state.camera = scenarioCamera(currentScenario(), scene);
  state.result = null;
  update();
}

function setCamera(patch) {
  state.camera = { ...state.camera, ...patch };
  state.result = null;
  update();
}

$("#reset").addEventListener("click", () => setCamera({ ...standard }));
$("#check").addEventListener("click", () => {
  state.result = readiness(state.camera, currentScenario(), scene);
  if (state.result.ready && state.scenarioId) state.completed.add(state.scenarioId);
  update();
  $("#results").scrollIntoView({ block: "nearest", behavior: "smooth" });
});

function renderResults() {
  const box = $("#results");
  const { result } = state;
  box.replaceChildren();
  if (!result) return;
  if (result.ready) {
    const next = SCENARIOS[SCENARIOS.findIndex((s) => s.id === state.scenarioId) + 1];
    box.innerHTML = `<div class="ready"><p class="ready-title">Director ready</p><p>${
      state.scenarioId ? "You spotted it and fixed it before anyone had to ask. That's owning your camera." : "Every check passes. This shot is ready to go live."
    }</p></div>`;
    if (state.scenarioId && next) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary";
      btn.textContent = `Next challenge: ${next.title}`;
      btn.addEventListener("click", () => startScenario(next.id));
      box.firstChild.append(btn);
    }
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "checks";
  for (const check of [...result.checks].sort((a, b) => a.pass - b.pass)) {
    const li = document.createElement("li");
    li.className = check.pass ? "pass" : "fail";
    li.innerHTML = `<span class="mark-icon" aria-hidden="true">${check.pass ? "✓" : "✕"}</span><span><strong>${check.label}.</strong> ${check.message}</span>`;
    ul.append(li);
  }
  const failing = result.checks.filter((c) => !c.pass).length;
  const count = ["", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things", "Seven things"][failing];
  box.innerHTML = `<p class="not-ready">Not ready yet. ${count} to fix.</p>`;
  box.append(ul);
}

function update() {
  const { camera } = state;
  for (const [key, el] of Object.entries(controlEls)) {
    const pos = el.kind.toPos(el.c, camera[key]);
    if (Number(el.input.value) !== pos) el.input.value = pos;
    const label = el.c.format(camera[key]);
    el.out.textContent = label;
    el.input.setAttribute("aria-valuetext", label);
    el.why.textContent = explain(key, camera, scene);
  }
  $("#status").innerHTML = [
    CONTROLS.fStop.format(camera.fStop),
    CONTROLS.shutterDeg.format(camera.shutterDeg),
    CONTROLS.iso.format(camera.iso),
    `${camera.wbK}K`,
    `TINT ${CONTROLS.tint.format(camera.tint)}`,
    `${FPS} fps`,
  ]
    .map((s) => `<span>${s}</span>`)
    .join("");
  for (const button of document.querySelectorAll("[data-tool]")) button.setAttribute("aria-pressed", String(state.overlays[button.dataset.tool]));
  $("#legend").hidden = !state.overlays.falseColor;
  $("#histogram").hidden = !state.overlays.histogram;
  for (const tab of document.querySelectorAll("[data-mode]")) tab.setAttribute("aria-selected", String(tab.dataset.mode === state.mode));
  $("#challenges").hidden = state.mode !== "challenges";
  for (const btn of list.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.scenario === state.scenarioId);
    btn.classList.toggle("completed", state.completed.has(btn.dataset.scenario));
  }
  const scenario = currentScenario();
  $("#brief").hidden = !scenario;
  if (scenario) $("#brief").innerHTML = `<p class="brief-title">${scenario.title}</p><p>${scenario.brief}</p>`;
  $("#pick-hint").hidden = state.mode !== "challenges" || Boolean(scenario);
  renderResults();
  dirty = true;
  wake();
}

const histCanvas = $("#histogram");
const hctx = histCanvas.getContext("2d");
function drawHistogram(bins) {
  const { width: w, height: h } = histCanvas;
  hctx.clearRect(0, 0, w, h);
  hctx.fillStyle = "rgba(0,0,0,0.6)";
  hctx.fillRect(0, 0, w, h);
  const peak = Math.max(...bins.map((b) => Math.sqrt(b)), 1);
  hctx.fillStyle = "rgba(255,255,255,0.85)";
  const bw = w / HIST_BINS;
  bins.forEach((b, i) => {
    const bh = (Math.sqrt(b) / peak) * (h - 6);
    hctx.fillRect(i * bw, h - bh - 2, Math.ceil(bw), bh);
  });
  hctx.strokeStyle = "rgba(255,255,255,0.25)";
  hctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round((w * loaded.height) / loaded.width);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    dirty = true;
    wake();
  }
}
new ResizeObserver(resizeCanvas).observe(canvas);

let dirty = true;
let lastFrame = -1;
let onScreen = true;
let running = false;
new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  wake();
}).observe(canvas);
document.addEventListener("visibilitychange", wake);

function wake() {
  if (running || !renderer || !onScreen || document.hidden) return;
  running = true;
  requestAnimationFrame(tick);
}

function tick(now) {
  if (!onScreen || document.hidden) {
    running = false;
    return;
  }
  const timeS = now / 1000;
  const frame = Math.floor(timeS * FPS);
  if (dirty || frame !== lastFrame) {
    dirty = false;
    lastFrame = renderer.render({ camera: state.camera, scenario: currentScenario(), overlays: state.overlays, timeS });
    if (state.overlays.histogram) drawHistogram(renderer.histogram());
  }
  requestAnimationFrame(tick);
}

update();
document.documentElement.dataset.ready = "true";

import { clampFrame, frameHeight, LIVE_LIMITS, measure, motionBumps, parseScene, placementLabel, readiness, shotLabel, SHOT_SIZES, widthLimits } from "./model.js";
import { SHOT_CALLS } from "./calls.js";

const EASE_S = 0.07;
const PAN_STEP = 0.03;
const ZOOM_STEP = 1.08;
const MAX_DPR = 2;
const $ = (sel) => document.querySelector(sel);

new ResizeObserver(() =>
  parent.postMessage({ figure: "framing", height: Math.ceil(document.documentElement.getBoundingClientRect().height) }, "*"),
).observe(document.documentElement);

const sceneUrl = new URL("scene/", import.meta.url);
let scene;
let picture;
try {
  scene = parseScene(await (await fetch(new URL("scene.json", sceneUrl))).json());
  const img = new Image();
  img.src = new URL(scene.image, sceneUrl).href;
  await img.decode();
  picture = document.createElement("canvas");
  picture.width = scene.bounds.width;
  picture.height = scene.bounds.height;
  const pctx = picture.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const strip = scene.mirrorRight;
  pctx.save();
  pctx.translate(2 * img.width, 0);
  pctx.scale(-1, 1);
  pctx.drawImage(img, img.width - strip, 0, strip, img.height, img.width - strip, 0, strip, img.height);
  pctx.restore();
} catch (error) {
  $("#failed").hidden = false;
  throw error;
}

const canvas = $("#view");
const ctx = canvas.getContext("2d");
canvas.setAttribute("aria-label", scene.alt);
const limits = widthLimits(scene);
const freeStart = () => clampFrame({ cx: scene.photo.width / 2, cy: Infinity, width: Infinity }, scene);

const state = {
  mode: "free",
  callId: null,
  target: freeStart(),
  frame: freeStart(),
  guides: { thirds: false, headroom: false, lowerThird: false, safe: false },
  lowerThirdForCall: false,
  live: false,
  samples: [],
  bumps: [],
  result: null,
  completed: new Set(),
};
const currentCall = () => SHOT_CALLS.find((c) => c.id === state.callId) ?? null;

const zoom = $("#zoom");
const toPos = (width) => Math.round((1000 * Math.log(limits.max / width)) / Math.log(limits.max / limits.min));
const fromPos = (pos) => limits.max * (limits.min / limits.max) ** (pos / 1000);

function setTarget(patch) {
  state.target = clampFrame({ ...state.target, ...patch }, scene);
  state.result = null;
  update();
  wake();
}

zoom.addEventListener("input", () => setTarget({ width: fromPos(Number(zoom.value)) }));

const pointers = new Map();
canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.classList.add("dragging");
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener("pointermove", (event) => {
  const prev = pointers.get(event.pointerId);
  if (!prev) return;
  const scale = state.target.width / canvas.clientWidth;
  if (pointers.size === 1) {
    setTarget({ cx: state.target.cx - (event.clientX - prev.x) * scale, cy: state.target.cy - (event.clientY - prev.y) * scale });
  } else {
    const [a, b] = [...pointers.values()];
    const before = Math.hypot(a.x - b.x, a.y - b.y);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const [c, d] = [...pointers.values()];
    const after = Math.hypot(c.x - d.x, c.y - d.y);
    if (before > 0 && after > 0) setTarget({ width: (state.target.width * before) / after });
    return;
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
});
const release = (event) => {
  pointers.delete(event.pointerId);
  if (pointers.size === 0) canvas.classList.remove("dragging");
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
  const step = PAN_STEP * (event.shiftKey ? 4 : 1);
  const t = state.target;
  const moves = {
    ArrowLeft: { cx: t.cx - step * t.width },
    ArrowRight: { cx: t.cx + step * t.width },
    ArrowUp: { cy: t.cy - step * t.width },
    ArrowDown: { cy: t.cy + step * t.width },
    "+": { width: t.width / ZOOM_STEP },
    "=": { width: t.width / ZOOM_STEP },
    "-": { width: t.width * ZOOM_STEP },
    _: { width: t.width * ZOOM_STEP },
  };
  const patch = moves[event.key];
  if (!patch) return;
  event.preventDefault();
  setTarget(patch);
});

for (const button of document.querySelectorAll("[data-guide]")) {
  button.addEventListener("click", () => {
    state.guides[button.dataset.guide] = !state.guides[button.dataset.guide];
    if (button.dataset.guide === "lowerThird") state.lowerThirdForCall = false;
    update();
    wake();
  });
}

function goLive(on) {
  state.live = on;
  state.samples = [];
  state.bumps = [];
  $("#toast").hidden = true;
}

for (const tab of document.querySelectorAll("[data-mode]")) {
  tab.addEventListener("click", () => {
    state.mode = tab.dataset.mode;
    state.callId = null;
    goLive(false);
    if (state.mode === "free") jumpTo(freeStart());
    state.result = null;
    update();
  });
}

$("#live").addEventListener("click", () => {
  goLive(!state.live);
  state.result = null;
  update();
  wake();
});

const reach = scene.bounds.height;
const sizeItems = SHOT_SIZES.map((size) => {
  const li = document.createElement("li");
  li.innerHTML = `<abbr title="${size.name}">${size.abbr === null ? "Cowboy" : size.id}</abbr><span>${size.abbr === null ? size.what : `${size.name}, ${size.what}`}</span>`;
  li.classList.toggle("out-of-reach", scene.anchors[size.id] > reach);
  $("#sizes").append(li);
  return li;
});

const list = $("#call-list");
SHOT_CALLS.forEach((c, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<button type="button" data-call="${c.id}"><span class="num">${i + 1}</span><span class="title">${c.call}</span><span class="done" aria-label="completed">✓</span></button>`;
  li.querySelector("button").addEventListener("click", () => startCall(c.id));
  list.append(li);
});

function jumpTo(frame) {
  state.target = clampFrame(frame, scene);
  state.frame = { ...state.target };
}

function startCall(id) {
  const call = SHOT_CALLS.find((c) => c.id === id);
  state.callId = id;
  jumpTo(call.start);
  goLive(Boolean(call.live));
  if (state.lowerThirdForCall) state.guides.lowerThird = false;
  state.lowerThirdForCall = Boolean(call.lowerThird) && !state.guides.lowerThird;
  if (call.lowerThird) state.guides.lowerThird = true;
  state.result = null;
  update();
  wake();
}

$("#reset").addEventListener("click", () => {
  const call = currentCall();
  jumpTo(call ? call.start : freeStart());
  if (call?.live) goLive(true);
  state.result = null;
  update();
  wake();
});

$("#check").addEventListener("click", () => {
  const call = currentCall();
  state.result = readiness(state.frame, call, scene, { bumps: state.bumps });
  if (state.result.ready && call) {
    state.completed.add(call.id);
    if (call.live) goLive(false);
  }
  update();
  $("#results").scrollIntoView({ block: "nearest", behavior: "smooth" });
});

function renderResults() {
  const box = $("#results");
  const { result } = state;
  box.replaceChildren();
  if (!result) return;
  const call = currentCall();
  if (result.ready) {
    const next = SHOT_CALLS[SHOT_CALLS.findIndex((c) => c.id === state.callId) + 1];
    const words = call?.live ? "Clear. That was smooth, and the shot is right." : call ? "That's the shot. Hold it there." : "Every check passes. This shot is ready to take.";
    box.innerHTML = `<div class="ready"><p class="ready-title">Director ready</p><p>${words}</p></div>`;
    if (call && next) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary";
      btn.textContent = `Next call: ${next.call}`;
      btn.addEventListener("click", () => startCall(next.id));
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
  const m = measure(state.frame, scene);
  const size = SHOT_SIZES.find((s) => s.id === m.shotSize);
  const placement = placementLabel(m, scene);
  $("#readout .long").textContent = `${shotLabel(size)}, ${placement}`;
  $("#readout .short").textContent = `${size.abbr === null ? "Cowboy" : size.id}, ${size.what}, ${placement.replace(/^on the /, "")}`;
  SHOT_SIZES.forEach((s, i) => sizeItems[i].classList.toggle("current", s.id === size.id));
  const magnification = `${(limits.max / state.frame.width).toFixed(1)}×`;
  $("#zoom-readout").textContent = magnification;
  $("#zoom-out").textContent = magnification;
  const pos = toPos(state.target.width);
  if (Number(zoom.value) !== pos) zoom.value = pos;
  zoom.style.setProperty("--fill", `${pos / 10}%`);
  zoom.setAttribute("aria-valuetext", `${magnification}, ${size.name.toLowerCase()}`);
  for (const button of document.querySelectorAll("[data-guide]")) button.setAttribute("aria-pressed", String(state.guides[button.dataset.guide]));
  for (const tab of document.querySelectorAll("[data-mode]")) tab.setAttribute("aria-selected", String(tab.dataset.mode === state.mode));
  $("#calls").hidden = state.mode !== "calls";
  const call = currentCall();
  for (const btn of list.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.call === state.callId);
    btn.classList.toggle("completed", state.completed.has(btn.dataset.call));
  }
  $("#brief").hidden = !call;
  if (call) $("#brief").innerHTML = `<p class="brief-title">“${call.call}”</p><p>${call.brief}</p>`;
  $("#pick-hint").hidden = state.mode !== "calls" || Boolean(call);
  $("#tally").hidden = !state.live;
  const live = $("#live");
  live.setAttribute("aria-pressed", String(state.live));
  live.textContent = state.live ? "Clear" : "Go live";
  live.hidden = Boolean(call);
  renderResults();
  dirty = true;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(w / (16 / 9));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    dirty = true;
    wake();
  }
}
new ResizeObserver(resizeCanvas).observe(canvas);

function draw() {
  const { frame, guides } = state;
  const W = canvas.width;
  const H = canvas.height;
  const fh = frameHeight(frame);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(picture, frame.cx - frame.width / 2, frame.cy - fh / 2, frame.width, fh, 0, 0, W, H);
  const px = Math.max(1, W / 640);
  ctx.font = `600 ${Math.round(11 * px)}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textBaseline = "bottom";
  const label = (text, x, y, align = "left") => {
    ctx.textAlign = align;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(text, x + px, y + px);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x, y);
  };
  if (guides.thirds) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = px;
    ctx.beginPath();
    for (const f of [1 / 3, 2 / 3]) {
      ctx.moveTo(W * f, 0);
      ctx.lineTo(W * f, H);
      ctx.moveTo(0, H * f);
      ctx.lineTo(W, H * f);
    }
    ctx.stroke();
  }
  if (guides.safe) {
    ctx.lineWidth = px;
    for (const [share, name, dash] of [
      [0.93, "Action safe", []],
      [0.9, "Title safe", [4 * px, 4 * px]],
    ]) {
      const mx = (W * (1 - share)) / 2;
      const my = (H * (1 - share)) / 2;
      ctx.setLineDash(dash);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.strokeRect(mx, my, W - 2 * mx, H - 2 * my);
      if (name === "Title safe") label(name, mx + 4 * px, H - my - 4 * px);
      else label(name, W - mx - 4 * px, my + 15 * px, "right");
    }
    ctx.setLineDash([]);
  }
  if (guides.lowerThird) {
    const lt = scene.lowerThird;
    const x = W * lt.left;
    const y = H * lt.top;
    ctx.fillStyle = "rgba(168,149,107,0.42)";
    ctx.fillRect(x, y, W * (lt.right - lt.left), H * (lt.bottom - lt.top));
    label("Lower third", x + 6 * px, y + 16 * px);
  }
  if (guides.headroom) {
    const y = H * scene.houseHeadroom;
    ctx.strokeStyle = "#a8956b";
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.moveTo(W * 0.3, y);
    ctx.lineTo(W * 0.7, y);
    ctx.stroke();
    label("Top of head", W * 0.7 + 6 * px, y + 6 * px);
  }
}

let dirty = true;
let running = false;
let last = 0;
let toastUntil = 0;
document.addEventListener("visibilitychange", wake);

function wake() {
  if (running || document.hidden) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(tick);
}

function settled() {
  const { frame, target } = state;
  return Math.abs(frame.cx - target.cx) < 0.05 && Math.abs(frame.cy - target.cy) < 0.05 && Math.abs(frame.width - target.width) < 0.05;
}

function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const before = state.frame;
  if (!settled()) {
    const k = 1 - Math.exp(-dt / EASE_S);
    const { frame, target } = state;
    state.frame = {
      cx: frame.cx + (target.cx - frame.cx) * k,
      cy: frame.cy + (target.cy - frame.cy) * k,
      width: Math.exp(Math.log(frame.width) + (Math.log(target.width) - Math.log(frame.width)) * k),
    };
    if (settled()) state.frame = { ...target };
  }
  if (state.live) recordMotion(now / 1000);
  if (state.frame !== before) update();
  if (toastUntil && now > toastUntil) {
    toastUntil = 0;
    $("#toast").hidden = true;
  }
  if (dirty) {
    dirty = false;
    draw();
  }
  if (!settled() || state.live || toastUntil) requestAnimationFrame(tick);
  else running = false;
}

function recordMotion(t) {
  state.samples.push({ t, ...state.frame });
  const windowStart = t - 2;
  while (state.samples.length && state.samples[0].t < windowStart) state.samples.shift();
  for (const bump of motionBumps(state.samples)) {
    if (bump.t > (state.bumps.at(-1)?.t ?? -Infinity) + LIVE_LIMITS.mergeS) {
      state.bumps.push(bump);
      $("#toast").hidden = false;
      toastUntil = performance.now() + 1600;
    }
  }
}

update();
draw();
document.documentElement.dataset.ready = "true";

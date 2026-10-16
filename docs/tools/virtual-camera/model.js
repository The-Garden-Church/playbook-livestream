export const FPS = 30;
export const MAINS_HZ = 60;
export const NOISE_CHROMA_RATIO = 0.35;
export const DOF_COC_FRACTION = 1 / 1200;

export const CONTROLS = {
  shutterDeg: { label: "Shutter", kind: "list", values: [45, 90, 172.8, 180, 270, 360], format: (v) => `${v}°` },
  wbK: { label: "White balance", kind: "range", min: 2500, max: 8000, step: 100, format: (v) => `${v} K` },
  tint: { label: "Tint", kind: "range", min: -30, max: 30, step: 1, format: (v) => (v > 0 ? `+${v}` : `${v}`) },
  fStop: { label: "Aperture", kind: "list", values: [2, 2.8, 4, 5.6, 8, 11, 16], format: (v) => `f/${v}` },
  iso: { label: "ISO", kind: "list", values: [100, 200, 400, 800, 1600, 3200, 6400], format: (v) => `ISO ${v}` },
  focusM: { label: "Focus", kind: "log", min: 1, max: 30, format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} m` },
};

export const CONTROL_ORDER = ["shutterDeg", "wbK", "tint", "fStop", "iso", "focusM"];

export function snap(key, value) {
  const c = CONTROLS[key];
  if (c.kind === "list") return c.values.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best));
  const clamped = Math.min(c.max, Math.max(c.min, value));
  return c.kind === "range" ? Math.round((clamped - c.min) / c.step) * c.step + c.min : clamped;
}

export function parseScene(raw) {
  const layers = [...raw.layers].sort((a, b) => b.distanceM - a.distanceM);
  const ids = new Set(layers.map((l) => l.id));
  for (const ref of [raw.subject, raw.ledWall.layer, raw.motion.layer]) {
    if (!ids.has(ref)) throw new Error(`scene.json names layer "${ref}" but has no layer with that id`);
  }
  if (layers.filter((l) => l.mask === "remainder").length !== 1) throw new Error('scene.json needs exactly one layer with mask "remainder"');
  return {
    ...raw,
    layers,
    reference: { ...raw.reference },
    subjectM: layers.find((l) => l.id === raw.subject).distanceM,
  };
}

export function standardCamera(scene) {
  const { fStop, shutterDeg, iso, wbK, tint } = scene.reference;
  return { fStop, shutterDeg, iso, wbK, tint, focusM: scene.subjectM };
}

const apertureValue = (fStop) => Math.round(2 * Math.log2(fStop) * 3) / 3;

export function stopsBetween(key, value, refValue) {
  if (key === "fStop") return apertureValue(refValue) - apertureValue(value);
  return Math.log2(value / refValue);
}

export function exposureStops(camera, ref) {
  return stopsBetween("fStop", camera.fStop, ref.fStop) + stopsBetween("shutterDeg", camera.shutterDeg, ref.shutterDeg) + stopsBetween("iso", camera.iso, ref.iso);
}

export function planckianXY(kelvin) {
  const t = kelvin;
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039;
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

export function blackbodyRgb(kelvin) {
  const [x, y] = planckianXY(kelvin);
  const X = x / y;
  const Z = (1 - x - y) / y;
  return [3.2406 * X - 1.5372 - 0.4986 * Z, -0.9689 * X + 1.8758 + 0.0415 * Z, 0.0557 * X - 0.204 + 1.057 * Z];
}

const LUMA = [0.2126, 0.7152, 0.0722];

export function wbGains(wbK, tint, lightK) {
  const light = blackbodyRgb(lightK);
  const assumed = blackbodyRgb(wbK);
  const raw = light.map((c, i) => c / light[1] / (assumed[i] / assumed[1]));
  raw[1] *= 2 ** (-tint / 45);
  const luma = raw.reduce((s, g, i) => s + g * LUMA[i], 0);
  return raw.map((g) => g / luma);
}

export function noiseSigma(iso) {
  const gain = iso / 100;
  return 0.0025 * Math.sqrt(gain) + 0.0005 * gain;
}

export function cocMm(layerDepthM, focusM, fStop, focalMm) {
  const s1 = focusM * 1000;
  const s2 = layerDepthM * 1000;
  return ((focalMm * focalMm) / fStop) * (Math.abs(s2 - s1) / (s2 * (s1 - focalMm)));
}

export function blurRadiusPx(layerDepthM, focusM, fStop, focalMm, sensorMm, imageWidthPx) {
  return (cocMm(layerDepthM, focusM, fStop, focalMm) / 2 / sensorMm) * imageWidthPx;
}

export function inDepthOfField(depthM, camera, lens) {
  return cocMm(depthM, camera.focusM, camera.fStop, lens.focalMm) <= lens.sensorMm * DOF_COC_FRACTION;
}

export function motionBlurPx(shutterDeg, speedPxPerSec) {
  return Math.abs(speedPxPerSec) * (shutterDeg / 360 / FPS);
}

export function ledBanding(shutterDeg, fps, refreshHz = MAINS_HZ) {
  const cycles = (shutterDeg / 360 / fps) * refreshHz;
  const amplitude = Math.abs(Math.sin(Math.PI * cycles) / (Math.PI * cycles));
  const actualFps = (fps * 1000) / 1001;
  const beat = refreshHz / actualFps;
  const rollHz = (beat - Math.round(beat)) * actualFps;
  return { amplitude: amplitude < 1e-9 ? 0 : amplitude, rollHz: amplitude < 1e-9 ? 0 : rollHz };
}

export function sceneExposure(camera, scene, scenario) {
  return exposureStops(camera, scene.reference) + (scenario?.sceneExposureOffset ?? 0);
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

export function stopWord(n) {
  const r = Math.round(Math.abs(n) * 3) / 3;
  const whole = Math.floor(r + 1e-9);
  const thirds = Math.round((r - whole) * 3);
  const frac = thirds === 0 ? "" : thirds === 1 ? "⅓" : "⅔";
  if (whole === 0) return `${frac} of a stop`;
  if (!frac) return `${NUMBER_WORDS[whole] ?? whole} stop${whole === 1 ? "" : "s"}`;
  return `${whole}${frac} stops`;
}

const CHECKS = [
  {
    id: "shutter",
    label: "Shutter",
    evaluate: (camera) =>
      camera.shutterDeg === 180
        ? { pass: true, message: "Shutter is locked at 180°, so motion looks natural and the LED wall is clean." }
        : {
            pass: false,
            message: `The shutter is at ${camera.shutterDeg}°. Put it back to 180° so motion looks natural and the LED wall stops banding.`,
          },
  },
  {
    id: "whiteBalance",
    label: "White balance",
    evaluate: (camera, { scene }) => {
      const diff = camera.wbK - scene.lightK;
      if (Math.abs(diff) <= 300) return { pass: true, message: `White balance ${camera.wbK} K matches the room light, so white looks white.` };
      return diff > 0
        ? { pass: false, message: `Faces look orange. Lower the white balance number toward ${scene.lightK} K.` }
        : { pass: false, message: `Faces look blue. Raise the white balance number toward ${scene.lightK} K.` };
    },
  },
  {
    id: "tint",
    label: "Tint",
    evaluate: (camera) => {
      if (Math.abs(camera.tint) <= 3) return { pass: true, message: "Tint is close to 0, so skin isn't green or pink." };
      return camera.tint > 0
        ? { pass: false, message: "Skin looks pink. Move tint back toward green, close to 0." }
        : { pass: false, message: "Skin looks a little green. Move tint toward magenta, close to 0." };
    },
  },
  {
    id: "exposure",
    label: "Brightness",
    evaluate: (camera, { scene, scenario }) => {
      const e = sceneExposure(camera, scene, scenario);
      if (Math.abs(e) <= 1 / 3 + 1e-9) return { pass: true, message: "Brightness is right on. Faces sit in the skin range." };
      if (camera.shutterDeg !== 180) {
        return { pass: false, message: "Brightness is off, but fix the shutter first. Putting it back to 180° changes the brightness too." };
      }
      return e > 0
        ? { pass: false, message: `The picture is ${stopWord(e)} too bright. Close the aperture or lower ISO.` }
        : { pass: false, message: `The picture is ${stopWord(e)} too dark. Open the aperture first, then raise ISO if you still need to.` };
    },
  },
  {
    id: "iso",
    label: "ISO",
    evaluate: (camera) =>
      camera.iso <= 1600
        ? { pass: true, message: `ISO ${camera.iso} keeps the grain under control.` }
        : { pass: false, message: `ISO ${camera.iso} is adding a lot of grain. Bring it down to 1600 or lower and open the aperture instead.` },
  },
  {
    id: "focus",
    label: "Focus",
    evaluate: (camera, { scene }) => {
      if (inDepthOfField(scene.subjectM, camera, scene.lens)) return { pass: true, message: "The speaker is sharp." };
      return camera.focusM > scene.subjectM
        ? { pass: false, message: "The speaker is soft because focus is set behind them. Turn focus closer, to the lectern." }
        : { pass: false, message: "The speaker is soft because focus is set in front of them. Turn focus farther, to the lectern." };
    },
  },
];

export const SCENARIO_CHECKS = {
  apertureFirst: {
    id: "apertureFirst",
    label: "Aperture before ISO",
    evaluate: (camera) =>
      camera.iso > 400 && camera.fStop > CONTROLS.fStop.values[0]
        ? {
            pass: false,
            message: `You raised ISO while the aperture still had room to open. Open up to f/${CONTROLS.fStop.values[0]} first, then add only the ISO you still need.`,
          }
        : { pass: true, message: "You opened the aperture before reaching for ISO." },
  },
};

export function readiness(camera, scenario, scene) {
  const ctx = { scene, scenario };
  const extra = (scenario?.checks ?? []).map((id) => SCENARIO_CHECKS[id]);
  const checks = [...CHECKS, ...extra].map((c) => ({ id: c.id, label: c.label, ...c.evaluate(camera, ctx) }));
  return { ready: checks.every((c) => c.pass), checks };
}

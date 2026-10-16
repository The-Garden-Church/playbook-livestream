import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  exposureStops,
  wbGains,
  noiseSigma,
  addedNoiseSigma,
  blurRadiusPx,
  ledBanding,
  readiness,
  parseScene,
  inLight,
  standardCamera,
  snap,
  stopWord,
} from "./model.js";
import { SCENARIOS, scenarioCamera, scenarioScene } from "./scenarios.js";
import { explain, explainLight } from "./explain.js";
import { frameUniforms } from "./renderer.js";

const rawScene = JSON.parse(readFileSync(new URL("./scene/scene.json", import.meta.url)));
const scene = parseScene(rawScene);
const ref = scene.reference;
const standard = standardCamera(scene);
const close = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not within ${eps} of ${expected}`);

test("exposure counts stops the way the lessons do", () => {
  assert.equal(exposureStops(standard, ref), 0);
  assert.equal(exposureStops({ ...standard, fStop: 2 }, ref), 1);
  assert.equal(exposureStops({ ...standard, fStop: 4 }, ref), -1);
  assert.equal(exposureStops({ ...standard, fStop: 11 }, ref), -4);
  assert.equal(exposureStops({ ...standard, iso: 1600 }, ref), 2);
  assert.equal(exposureStops({ ...standard, shutterDeg: 360 }, ref), 1);
  assert.equal(exposureStops({ ...standard, shutterDeg: 90 }, ref), -1);
  close(exposureStops({ ...standard, shutterDeg: 172.8 }, ref), -0.0589, 1e-4);
  assert.equal(exposureStops({ ...standard, iso: 6400, fStop: 11 }, ref), 0);
});

test("white balance gains are neutral when the camera matches the light", () => {
  const [r, g, b] = wbGains(4000, 0, 4000);
  close(r, 1);
  close(g, 1);
  close(b, 1);
});

test("setting white balance below the light turns the picture blue, above turns it orange", () => {
  const [r1, , b1] = wbGains(3200, 0, 4000);
  assert.ok(b1 > r1, `blue ${b1} should beat red ${r1}`);
  close(r1, 0.796, 0.005);
  close(b1, 1.544, 0.005);
  const [r2, , b2] = wbGains(5600, 0, 4000);
  assert.ok(r2 > b2, `red ${r2} should beat blue ${b2}`);
  close(r2, 1.265, 0.005);
  close(b2, 0.612, 0.005);
});

test("positive tint pushes magenta by pulling green down", () => {
  const [r, g, b] = wbGains(4000, 30, 4000);
  assert.ok(g < r && g < b, `green ${g} should be the smallest of ${[r, g, b]}`);
  close(r / g, 2 ** (30 / 45), 1e-9);
  const [, gGreen] = wbGains(4000, -30, 4000);
  assert.ok(gGreen > 1, `negative tint should lift green, got ${gGreen}`);
});

test("noise grows with ISO", () => {
  close(noiseSigma(100), 0.003);
  close(noiseSigma(400), 0.007);
  close(noiseSigma(1600), 0.018);
  close(noiseSigma(6400), 0.052);
});

test("the photo already carries the standard ISO's grain, so only the extra grain is added", () => {
  close(addedNoiseSigma(400, 400), 0);
  close(addedNoiseSigma(100, 400), 0);
  close(addedNoiseSigma(1600, 400), 0.016583, 1e-6);
  close(addedNoiseSigma(6400, 400), 0.051527, 1e-6);
});

test("thin lens blur is zero at the focus distance and grows with aperture", () => {
  const { focalMm, sensorMm } = scene.lens;
  close(blurRadiusPx(7, 7, 2.8, focalMm, sensorMm, 1280), 0);
  close(blurRadiusPx(10, 7, 2.8, focalMm, sensorMm, 1280), 1.575, 0.001);
  close(blurRadiusPx(10, 7, 2, focalMm, sensorMm, 1280), 2.205, 0.001);
  close(blurRadiusPx(10, 7, 16, focalMm, sensorMm, 1280), 0.276, 0.001);
});

test("LED banding vanishes at 180 and 360 and shows at the other angles", () => {
  assert.equal(ledBanding(180, 30), 0);
  assert.equal(ledBanding(360, 30), 0);
  close(ledBanding(172.8, 30), 0.0415, 1e-3);
  close(ledBanding(90, 30), 0.6366, 1e-3);
  close(ledBanding(45, 30), 0.9003, 1e-3);
  close(ledBanding(270, 30), 0.2122, 1e-3);
});

test("the standard settings are director ready", () => {
  const result = readiness(standard, null, scene);
  assert.equal(result.ready, true);
  assert.deepEqual(
    result.checks.map((c) => [c.id, c.pass]),
    [
      ["shutter", true],
      ["whiteBalance", true],
      ["tint", true],
      ["exposure", true],
      ["iso", true],
      ["focus", true],
    ],
  );
});

test("readiness coaches in plain sentences", () => {
  const { checks } = readiness({ ...standard, wbK: 5000, iso: 3200, fStop: 16 }, null, scene);
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId.whiteBalance.message, "Faces look orange. Lower the white balance number toward 4000 K.");
  assert.equal(byId.iso.message, "ISO 3200 is adding a lot of grain. Bring it down to 1600 or lower and open the aperture instead.");
  assert.equal(byId.exposure.message, "The picture is two stops too dark. Open the aperture first, then raise ISO if you still need to.");
});

test("focus passes only near the speaker", () => {
  const focusAt = (focusM, fStop = 2.8) => readiness({ ...standard, focusM, fStop }, null, scene).checks.find((c) => c.id === "focus");
  assert.equal(focusAt(7.5).pass, true);
  assert.equal(focusAt(8).pass, false);
  assert.equal(focusAt(7.7, 2).pass, false);
  assert.equal(focusAt(16).message, "The speaker is soft because focus is set behind them. Turn focus closer, to the speaker.");
  assert.equal(focusAt(4).message, "The speaker is soft because focus is set in front of them. Turn focus farther, to the speaker.");
});

test("every scenario starts broken and has a reachable fix", () => {
  const fixes = {
    "lighting-change": { fStop: 2, iso: 800 },
    "sun-came-out": { wbK: 3600 },
    "clouds-rolled-in": { wbK: 4600 },
  };
  assert.deepEqual(
    SCENARIOS.map((s) => s.id),
    ["auto", "bumped-shutter", "lighting-change", "grainy", "soft", "sun-came-out", "clouds-rolled-in", "everything"],
  );
  for (const scenario of SCENARIOS) {
    const lit = scenarioScene(scenario, scene);
    const failing = readiness(scenarioCamera(scenario, lit), scenario, lit).checks.filter((c) => !c.pass);
    assert.ok(failing.length > 0, `${scenario.id} start state passes every check`);
    const fixed = { ...standard, ...fixes[scenario.id] };
    assert.equal(readiness(fixed, scenario, lit).ready, true, `${scenario.id} fix does not pass`);
  }
});

test("the weather changes the room light, so the right white balance moves with it", () => {
  const cloudy = inLight(scene, "cloudy");
  const sunny = inLight(scene, "sunny");
  const wbCheck = (camera, lit) => readiness(camera, null, lit).checks.find((c) => c.id === "whiteBalance");
  assert.deepEqual(wbCheck(standard, cloudy), {
    id: "whiteBalance",
    label: "White balance",
    pass: false,
    message: "Faces look blue. Raise the white balance number toward 4600 K.",
  });
  assert.equal(wbCheck(standard, sunny).message, "Faces look orange. Lower the white balance number toward 3600 K.");
  assert.equal(wbCheck({ ...standard, wbK: 4600 }, cloudy).message, "White balance 4600 K matches the room light, so white looks white.");
  assert.equal(wbCheck({ ...standard, wbK: 3600 }, sunny).pass, true);
  assert.equal(readiness({ ...standard, wbK: 4600 }, null, cloudy).ready, true);
});

test("the white balance explainer compares against the current room light", () => {
  assert.equal(explain("wbK", standard, inLight(scene, "cloudy")), "4000 K: 600 K below the room light, so the picture turns blue.");
  assert.equal(explain("wbK", standard, inLight(scene, "sunny")), "4000 K: 400 K above the room light, so the picture turns orange.");
  assert.equal(explain("wbK", { ...standard, wbK: 4600 }, inLight(scene, "cloudy")), "4600 K: matches the room light, so white looks white.");
  assert.equal(explain("wbK", { ...standard, wbK: 3800 }, inLight(scene, "sunny")), "3800 K: 200 K above the room light, a touch warmer.");
});

test("the room light line says what the weather did", () => {
  assert.equal(explainLight(scene), "Typical: House lights with a little daylight from the windows. The room is about 4000 K.");
  assert.equal(explainLight(inLight(scene, "cloudy")), "Cloudy: Blue daylight from the windows. The room is about 4600 K.");
  assert.equal(explainLight(inLight(scene, "sunny")), "Sunny: Sun bouncing off the warm gym floor and walls. The room is about 3600 K.");
});

test("the viewfinder white balance follows the room light", () => {
  const wbAt = (wbK, lightId) => frameUniforms({ ...standard, wbK }, inLight(scene, lightId), null, 0).wb;
  wbAt(4600, "cloudy").forEach((g) => close(g, 1));
  [0.889, 1.008, 1.244].forEach((g, i) => close(wbAt(4000, "cloudy")[i], g, 0.001));
  [1.098, 0.989, 0.821].forEach((g, i) => close(wbAt(4000, "sunny")[i], g, 0.001));
});

test("the standard settings come from the scene and brightness is counted from them", () => {
  assert.deepEqual(standard, { fStop: 2.8, shutterDeg: 180, iso: 400, wbK: 4000, tint: 0, focusM: 7 });
  const atF2 = readiness({ ...standard, fStop: 2 }, null, scene).checks.find((c) => c.id === "exposure");
  assert.equal(atF2.message, "The picture is one stop too bright. Close the aperture or lower ISO.");
  assert.equal(explain("fStop", standard, scene), "f/2.8: standard. Bright enough, and forgiving focus. Many cameras show this as f/2.9.");
});

test("the shutter explainer says what happens to motion and the LED wall", () => {
  assert.equal(explain("shutterDeg", { ...standard, shutterDeg: 360 }, scene), "360°: one stop brighter, moving hands smear, no flicker.");
  assert.equal(explain("shutterDeg", { ...standard, shutterDeg: 45 }, scene), "45°: two stops darker, motion looks choppy, and the LED wall bands.");
  assert.equal(explain("shutterDeg", standard, scene), "180°: standard. Half of each frame, natural motion, no flicker.");
});

test("the lighting change rewards aperture before ISO", () => {
  const scenario = SCENARIOS.find((s) => s.id === "lighting-change");
  const isoFirst = readiness({ ...standard, fStop: 2.8, iso: 1600 }, scenario, scene);
  assert.deepEqual(
    isoFirst.checks.filter((c) => !c.pass).map((c) => c.id),
    ["apertureFirst"],
  );
  const start = readiness(scenarioCamera(scenario, scene), scenario, scene);
  assert.equal(start.checks.find((c) => c.id === "exposure").message, "The picture is two stops too dark. Open the aperture first, then raise ISO if you still need to.");
});

test("a wrong shutter points at the shutter before brightness", () => {
  const { checks } = readiness({ ...standard, shutterDeg: 90 }, null, scene);
  assert.equal(checks.find((c) => c.id === "exposure").message, "Brightness is off, but fix the shutter first. Putting it back to 180° changes the brightness too.");
});

test("sliders snap to real camera values", () => {
  assert.equal(snap("fStop", 3), 2.8);
  assert.equal(snap("shutterDeg", 175), 172.8);
  assert.equal(snap("wbK", 4049), 4000);
  assert.equal(snap("wbK", 9000), 8000);
  assert.equal(snap("tint", -31), -30);
});

test("stop counts read naturally", () => {
  assert.equal(stopWord(1), "one stop");
  assert.equal(stopWord(-3), "three stops");
  assert.equal(stopWord(0.585), "⅔ of a stop");
  assert.equal(stopWord(1.585), "1⅔ stops");
});

test("explainers say what the setting is doing right now", () => {
  assert.equal(explain("fStop", { ...standard, fStop: 2 }, scene), "f/2: one stop brighter than standard, background softer.");
  assert.equal(explain("wbK", { ...standard, wbK: 2500 }, scene), "2500 K: 1500 K below the room light, so the picture turns blue.");
  assert.equal(
    explain("shutterDeg", { ...standard, shutterDeg: 90 }, scene),
    "90°: one stop darker, motion looks choppy, and the LED wall bands.",
  );
  assert.equal(explain("focusM", { ...standard, focusM: 11 }, scene), "11 m: focus is on the LED wall and the curtains and truss, so the speaker is soft.");
  assert.equal(explain("focusM", { ...standard, focusM: 9 }, scene), "9.0 m: focus is on the curtains and truss, so the speaker is soft.");
  assert.equal(explain("focusM", standard, scene), "7.0 m: the speaker is sharp.");
  assert.equal(explain("focusM", { ...standard, focusM: 2 }, scene), "2.0 m: nothing in the shot is sharp. The speaker is at 7.0 m.");
});

test("the scene loads with layers back to front and rejects unknown ids", () => {
  assert.deepEqual(
    scene.layers.map((l) => l.id),
    ["wall", "back", "speaker"],
  );
  assert.throws(() => parseScene({ ...rawScene, subject: "pastor" }), /scene.json names layer "pastor"/);
  assert.throws(() => parseScene({ ...rawScene, light: { ...rawScene.light, default: "foggy" } }), /needs a "light" whose default is one of its conditions/);
  assert.throws(() => inLight(scene, "foggy"), /no room light "foggy"/);
  assert.throws(() => parseScene({ ...rawScene, layers: [...rawScene.layers, { id: "x", distanceM: 3, mask: { rects: [] } }] }), /layer "x" needs a mask file or "remainder"/);
});

test("the viewfinder lifts faint LED bands so 172.8° is visible but still the faintest", () => {
  const bandAt = (shutterDeg) => frameUniforms({ ...standard, shutterDeg }, scene, null, 0).bandAmp;
  close(bandAt(172.8), 0.148, 1e-3);
  close(bandAt(90), 0.763, 1e-3);
  close(bandAt(45), 0.939, 1e-3);
  assert.equal(bandAt(180), 0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  exposureStops,
  wbGains,
  noiseSigma,
  blurRadiusPx,
  motionBlurPx,
  ledBanding,
  readiness,
  parseScene,
  standardCamera,
  snap,
  stopWord,
} from "./model.js";
import { SCENARIOS, scenarioCamera } from "./scenarios.js";
import { explain } from "./explain.js";

const scene = parseScene(JSON.parse(readFileSync(new URL("./scene/scene.json", import.meta.url))));
const ref = scene.reference;
const standard = standardCamera(scene);
const close = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not within ${eps} of ${expected}`);

test("exposure counts stops the way the lessons do", () => {
  assert.equal(exposureStops(standard, ref), 0);
  assert.equal(exposureStops({ ...standard, fStop: 2.8 }, ref), 1);
  assert.equal(exposureStops({ ...standard, fStop: 2 }, ref), 2);
  assert.equal(exposureStops({ ...standard, fStop: 11 }, ref), -3);
  assert.equal(exposureStops({ ...standard, iso: 1600 }, ref), 2);
  assert.equal(exposureStops({ ...standard, shutterDeg: 360 }, ref), 1);
  assert.equal(exposureStops({ ...standard, shutterDeg: 90 }, ref), -1);
  close(exposureStops({ ...standard, shutterDeg: 172.8 }, ref), -0.0589, 1e-4);
  assert.equal(exposureStops({ ...standard, iso: 6400, fStop: 11 }, ref), 1);
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

test("thin lens blur is zero at the focus distance and grows with aperture", () => {
  const { focalMm, sensorMm } = scene.lens;
  close(blurRadiusPx(8, 8, 4, focalMm, sensorMm, 1280), 0);
  close(blurRadiusPx(14, 8, 4, focalMm, sensorMm, 1280), 2.4, 0.05);
  close(blurRadiusPx(14, 8, 2, focalMm, sensorMm, 1280), 4.9, 0.05);
  close(blurRadiusPx(14, 8, 16, focalMm, sensorMm, 1280), 0.61, 0.01);
});

test("motion blur is the distance moved while the shutter is open", () => {
  close(motionBlurPx(180, 120), 2);
  close(motionBlurPx(360, 120), 4);
  close(motionBlurPx(45, -120), 0.5);
});

test("LED banding vanishes at 180 and 360 and shows at the other angles", () => {
  assert.deepEqual(ledBanding(180, 30), { amplitude: 0, rollHz: 0 });
  assert.equal(ledBanding(360, 30).amplitude, 0);
  close(ledBanding(172.8, 30).amplitude, 0.0415, 1e-3);
  close(ledBanding(90, 30).amplitude, 0.6366, 1e-3);
  close(ledBanding(45, 30).amplitude, 0.9003, 1e-3);
  close(ledBanding(270, 30).amplitude, 0.2122, 1e-3);
  close(ledBanding(90, 30).rollHz, 0.06, 1e-3);
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
  assert.equal(byId.exposure.message, "The picture is one stop too dark. Open the aperture first, then raise ISO if you still need to.");
});

test("focus passes only near the lectern", () => {
  const focusAt = (focusM, fStop = 4) => readiness({ ...standard, focusM, fStop }, null, scene).checks.find((c) => c.id === "focus");
  assert.equal(focusAt(8.5).pass, true);
  assert.equal(focusAt(9.2).pass, false);
  assert.equal(focusAt(14).message, "The speaker is soft because focus is set behind them. Turn focus closer, to the lectern.");
  assert.equal(focusAt(6).message, "The speaker is soft because focus is set in front of them. Turn focus farther, to the lectern.");
});

test("every scenario starts broken and has a reachable fix", () => {
  for (const scenario of SCENARIOS) {
    const start = scenarioCamera(scenario, standard, scene);
    const failing = readiness(start, scenario, scene).checks.filter((c) => !c.pass);
    assert.ok(failing.length > 0, `${scenario.id} start state passes every check`);
  }
  const fixes = {
    auto: standard,
    "bumped-shutter": standard,
    "lighting-change": { ...standard, fStop: 2, iso: 800 },
    grainy: standard,
    soft: standard,
    everything: standard,
  };
  for (const scenario of SCENARIOS) assert.equal(readiness(fixes[scenario.id], scenario, scene).ready, true, `${scenario.id} fix does not pass`);
});

test("the lighting change rewards aperture before ISO", () => {
  const scenario = SCENARIOS.find((s) => s.id === "lighting-change");
  const isoFirst = readiness({ ...standard, fStop: 2.8, iso: 1600 }, scenario, scene);
  assert.deepEqual(
    isoFirst.checks.filter((c) => !c.pass).map((c) => c.id),
    ["apertureFirst"],
  );
  const start = readiness(scenarioCamera(scenario, standard, scene), scenario, scene);
  assert.equal(start.checks.find((c) => c.id === "exposure").message, "The picture is three stops too dark. Open the aperture first, then raise ISO if you still need to.");
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
  assert.equal(explain("fStop", { ...standard, fStop: 2.8 }, scene), "f/2.8: one stop brighter than standard, background softer.");
  assert.equal(explain("fStop", standard, scene), "f/4: standard. Bright enough, and forgiving focus.");
  assert.equal(explain("wbK", { ...standard, wbK: 2500 }, scene), "2500 K: 1500 K below the room light, so the picture turns blue.");
  assert.equal(explain("shutterDeg", { ...standard, shutterDeg: 90 }, scene), "90°: one stop darker, choppy motion, and the LED wall bands.");
  assert.equal(explain("focusM", { ...standard, focusM: 14 }, scene), "14 m: the LED wall is sharp and the speaker is soft.");
  assert.equal(explain("focusM", standard, scene), "8.0 m: the speaker is sharp.");
});

test("parseScene orders layers back to front and rejects unknown ids", () => {
  assert.deepEqual(
    scene.layers.map((l) => l.id),
    ["wall", "mid", "stage", "subject"],
  );
  assert.throws(() => parseScene({ ...scene, subject: "pastor" }), /names layer "pastor"/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clampFrame, idealFrame, measure, motionBumps, parseScene, readiness, shotLabel, SHOT_SIZES } from "./model.js";
import { SHOT_CALLS, solve } from "./calls.js";

const scene = parseScene(JSON.parse(readFileSync(new URL("./scene/scene.json", import.meta.url))));
const close = (actual, expected, eps = 1e-3) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not within ${eps} of ${expected}`);
const frameWithBottom = (bottom, width = 1200) => ({ cx: 1417, cy: bottom - width / (16 / 9) / 2, width });
const failing = (result) => result.checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.message}`);

test("the photo is mirrored on the right so a wide shot can center the speaker", () => {
  assert.deepEqual(scene.bounds, { width: 2522, height: 1306 });
});

test("the frame stays inside the picture and inside the zoom range", () => {
  assert.deepEqual(clampFrame({ cx: 0, cy: 0, width: 9000 }, scene), { cx: 1051, cy: 591.1875, width: 2102 });
  assert.deepEqual(clampFrame({ cx: 3000, cy: 2000, width: 10 }, scene), { cx: 2437, cy: 1258.1875, width: 170 });
});

test("the shot size comes from the body part nearest the bottom of the frame", () => {
  const sizeAt = (bottom) => measure(frameWithBottom(bottom), scene).shotSize;
  assert.deepEqual(
    [420, 550, 690, 1005, 1150, 1225, 1306].map(sizeAt),
    ["ECU", "CU", "MCU", "MS", "cowboy", "MLS", "MLS"],
  );
});

test("the readout names the shot the way the lesson does", () => {
  assert.deepEqual(SHOT_SIZES.map(shotLabel), [
    "Extreme close-up (ECU), eyes and mouth",
    "Close-up (CU), head and shoulders",
    "Medium close-up (MCU), chest up",
    "Medium shot (MS), waist up",
    "Cowboy shot, mid-thigh up",
    "Medium long shot (MLS), knees up",
    "Wide shot (WS), head to toe",
    "Extreme wide shot (EWS), the whole stage",
  ]);
});

test("measure reports headroom, eye line and placement as fractions of the frame", () => {
  const m = measure({ cx: 1417, cy: 711, width: 1827 }, scene);
  close(m.headroomRatio, 0.0700, 1e-4);
  close(m.eyeLineRatio, 0.1682, 1e-4);
  close(m.subjectX, 0.5);
  close(m.leadRoomRatio, 0.5);
  assert.equal(m.headCropped, false);
  assert.deepEqual(m.jointCuts, []);
});

test("a frame that ends on the knees is a cut at a joint", () => {
  const result = readiness(frameWithBottom(1275, 1900), null, scene);
  assert.deepEqual(failing(result), [
    "Joints: The bottom of the frame cuts right at the knees. Go a little tighter or a little wider so it doesn't land on a joint.",
  ]);
});

test("a side edge on the elbow is a cut at a joint, and moving off it clears the check", () => {
  const onElbow = { cx: 1100 + 700, cy: 600, width: 1400 };
  assert.deepEqual(measure(onElbow, scene).jointCuts, [{ edge: "left", word: "elbows" }]);
  assert.deepEqual(measure({ ...onElbow, cx: onElbow.cx + 80 }, scene).jointCuts, []);
});

test("headroom coaching says which way to tilt", () => {
  const msg = (frame) => readiness(frame, null, scene).checks.find((c) => c.id === "headroom").message;
  assert.equal(msg({ cx: 1417, cy: 370, width: 1127 }), "Too much headroom. Tilt down until the eyes sit on the top third line.");
  assert.equal(msg({ cx: 1417, cy: 666, width: 1300 }), "The top of his head is cut off. Tilt up until there's a little space above his head.");
  assert.equal(msg({ cx: 1417, cy: 715, width: 2102 }), "There's a little room above his head, just right for a medium long shot.");
  assert.equal(msg({ cx: 1417, cy: 591, width: 2102 }), "Too much headroom. Tilt down until the top of his head sits just under the headroom line.");
});

test("placement coaching pans the camera the right way", () => {
  const msg = (frame, placement) => readiness(frame, { placement }, scene).checks.find((c) => c.id === "placement").message;
  assert.equal(msg({ cx: 1199, cy: 572, width: 1560 }, "centered"), "He's right of center. Pan right a little to center him.");
  assert.equal(msg({ cx: 1600, cy: 572, width: 1560 }, "centered"), "He's left of center. Pan left a little to center him.");
  assert.equal(
    msg({ cx: 1417, cy: 572, width: 1560 }, "leadRoom"),
    "He's looking toward frame left, so leave more room on that side. Pan left until his face sits near the right third line.",
  );
  assert.equal(msg({ cx: 1199, cy: 572, width: 1560 }, "leadRoom"), "He's on the right third, with lead room on the side he's looking toward.");
});

test("the lower third check needs the chin above the graphic", () => {
  const check = (frame) => readiness(frame, { lowerThird: true }, scene).checks.find((c) => c.id === "lowerThird");
  assert.deepEqual(check({ cx: 1417, cy: 370, width: 500 }), {
    id: "lowerThird",
    label: "Lower third",
    pass: false,
    message: "The lower third will cover his chin. Pull out a little or tilt down so his chin sits above the graphic.",
  });
  assert.equal(check(idealFrame("MCU", "centered", scene)).pass, true);
});

test("the size check says whether to push in or pull out", () => {
  const msg = (frame, shot) => readiness(frame, { shot }, scene).checks[0].message;
  assert.equal(
    msg({ cx: 1417, cy: 711, width: 1827 }, "MS"),
    "This is a medium long shot. The director wants a medium shot, waist up. Push in until the bottom of the frame sits just below his belt.",
  );
  assert.equal(
    msg({ cx: 1417, cy: 451, width: 842 }, "MLS"),
    "This is a medium close-up. The director wants a medium long shot, knees up. Pull out until the bottom of the frame sits just above his knees.",
  );
  assert.equal(msg({ cx: 1417, cy: 451, width: 842 }, undefined), "This is a medium close-up (MCU), chest up.");
});

test("every shot call starts wrong and has a framing that passes", () => {
  for (const call of SHOT_CALLS) {
    const motion = { bumps: [] };
    const start = readiness(call.start, call, scene, motion);
    assert.equal(start.ready, false, `${call.id} starts ready`);
    const fixed = readiness(solve(call, scene), call, scene, motion);
    assert.deepEqual(failing(fixed), [], `${call.id} has no passing fix`);
  }
});

test("each call starts with the problem its name promises", () => {
  const firstFailures = Object.fromEntries(SHOT_CALLS.map((c) => [c.id, readiness(c.start, c, scene, { bumps: [] }).checks.filter((x) => !x.pass).map((x) => x.id)]));
  assert.deepEqual(firstFailures, {
    house: ["size", "placement"],
    wide: ["size", "widest"],
    medium: ["size", "placement"],
    prayer: ["size"],
    closeup: ["size", "placement"],
    "lower-third": ["size", "headroom", "lowerThird"],
    "live-push": ["size"],
    "cut-off": ["headroom"],
    "too-much-air": ["headroom"],
    "lead-room": ["placement"],
  });
});

test("a live call fails on a bump even when the frame is right", () => {
  const call = SHOT_CALLS.find((c) => c.id === "live-push");
  const result = readiness(solve(call, scene), call, scene, { bumps: [{ t: 1.2, kind: "zoom" }] });
  assert.deepEqual(failing(result), [
    "Smooth moves: Smooth it out. One move was too quick while you were live, and the stream saw it. Move slower, and ease into and out of each move.",
  ]);
});

const sequence = (seconds, at) => Array.from({ length: Math.round(seconds * 60) + 1 }, (_, i) => ({ t: i / 60, ...at(i / 60) }));

test("a slow, steady pan and zoom has no bumps", () => {
  const smooth = sequence(3, (t) => {
    const ease = (1 - Math.cos((Math.PI * t) / 3)) / 2;
    return { cx: 1417, cy: 711 - 140 * ease, width: 1827 * Math.exp(-0.16 * ease) };
  });
  assert.deepEqual(motionBumps(smooth), []);
});

test("a quick flick of the frame counts as one bump", () => {
  const flick = sequence(2, (t) => ({ cx: t < 1 ? 1400 : 1400 + 600, cy: 700, width: 1500 }));
  assert.deepEqual(motionBumps(flick), [{ t: 1.1, kind: "pan" }]);
});

test("a fast zoom counts as a bump", () => {
  const snapZoom = sequence(1, (t) => ({ cx: 1400, cy: 700, width: 1800 * Math.exp(-Math.min(t, 0.3) * 1.5) }));
  assert.deepEqual(motionBumps(snapZoom).map((b) => b.kind), ["zoom"]);
});

test("whipping back the other way is a jerk even below the speed limit", () => {
  const whip = sequence(1, (t) => ({ cx: 1000 + 1500 * 0.8 * (t < 0.5 ? t : 1 - t), cy: 700, width: 1500 }));
  assert.deepEqual(motionBumps(whip).map((b) => b.kind), ["jerk"]);
  const stop = sequence(1, (t) => ({ cx: 1000 + 1500 * 0.8 * Math.min(t, 0.5), cy: 700, width: 1500 }));
  assert.deepEqual(motionBumps(stop), []);
});

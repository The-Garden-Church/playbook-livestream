import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLayers, partitionMasks, rectMask } from "./layers.js";

const RED = [1, 0, 0];
const BLUE = [0, 0, 1];
const GREEN = [0, 1, 0];

test("a back layer is filled with its own colour behind the layer in front, so blur leaves no dark halo", () => {
  const color = Float32Array.from([...RED, ...RED, ...BLUE, ...BLUE]);
  const [back, front] = buildLayers(color, [Float32Array.from([1, 1, 0, 0]), Float32Array.from([0, 0, 1, 1])], 4, 1);
  assert.deepEqual([...back], [255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]);
  assert.deepEqual([...front], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255]);
});

test("an edge pixel shared with the layer in front does not leave a ghost outline in the layer behind", () => {
  const color = Float32Array.from([...RED, 0.5, 0, 0.5, ...BLUE]);
  const [back] = buildLayers(color, [Float32Array.from([1, 0.5, 0]), Float32Array.from([0, 0.5, 1])], 3, 1);
  assert.deepEqual([...back.slice(4, 8)], [255, 0, 0, 255]);
});

test("a moving layer is not extended under the layers in front of it", () => {
  const color = Float32Array.from([...BLUE, ...BLUE, ...RED]);
  const masks = [Float32Array.from([1, 0, 0]), Float32Array.from([0, 1, 0]), Float32Array.from([0, 0, 1])];
  assert.deepEqual([...buildLayers(color, masks, 3, 1)[1].slice(8)], [0, 0, 255, 255]);
  assert.deepEqual([...buildLayers(color, masks, 3, 1, { extend: (i) => i !== 1 })[1].slice(8)], [0, 0, 0, 0]);
});

test("the hole behind a moving hand is filled from everything behind it, not just the body, so the hand leaves no skin colored smear", () => {
  const color = Float32Array.from([...RED, ...BLUE, ...GREEN, ...BLUE, ...BLUE]);
  const curtain = Float32Array.from([0, 1, 0, 1, 1]);
  const body = Float32Array.from([1, 0, 0, 0, 0]);
  const hand = Float32Array.from([0, 0, 1, 0, 0]);
  const [, bodyLayer] = buildLayers(color, [curtain, body, hand], 5, 1, { extend: (i) => i !== 2 });
  assert.deepEqual([...bodyLayer.slice(8, 12)], [130, 0, 228, 255]);
});

test("where drawn masks overlap the nearer layer wins, and the remainder layer takes whatever is left", () => {
  const [wall, rest, subject] = partitionMasks([Float32Array.from([1, 0.5, 0.75]), null, Float32Array.from([0, 0, 0.75])], 3);
  assert.deepEqual([...subject], [0, 0, 0.75]);
  assert.deepEqual([...wall], [1, 0.5, 0.25]);
  assert.deepEqual([...rest], [0, 0.5, 0]);
});

test("a rectangle mask is soft across its edge and scales from photo pixels to the render size", () => {
  const round = (m) => [...m].map((v) => Math.round(v * 1e4) / 1e4);
  const expected = [0, 0.1563, 0.8438, 1, 1, 0.8438, 0.1563, 0];
  assert.deepEqual(round(rectMask([[2, -10, 6, 10]], 2, 1, 8, 1)), expected);
  assert.deepEqual(round(rectMask([[4, -20, 12, 20]], 4, 0.5, 8, 1)), expected);
});

test("where a moving part is feathered out of its parent, the parent keeps its own colors, so the cut leaves no seam at rest", () => {
  const color = Float32Array.from([...RED, ...GREEN, ...BLUE]);
  const arm = Float32Array.from([1, 0.5, 0]);
  const hand = Float32Array.from([0, 0.5, 1]);
  const region = Float32Array.from([0, 0.5, 1]);
  const asDepth = buildLayers(color, [arm, hand], 3, 1, { extend: (i) => i !== 1 })[0];
  const asPart = buildLayers(color, [arm, hand], 3, 1, { extend: (i) => i !== 1, partsOf: (i) => (i === 0 ? [{ index: 1, region }] : []) })[0];
  assert.deepEqual([...asDepth.slice(4, 8)], [255, 0, 0, 255]);
  assert.deepEqual([...asPart.slice(4, 8)], [0, 255, 0, 255]);
});

test("behind a moving part the parent covers the whole cut region, so a gap between fingers leaves no hand shaped ghost when the hand moves", () => {
  const color = Float32Array.from([...BLUE, ...RED, ...BLUE, ...RED, ...BLUE]);
  const curtain = Float32Array.from([1, 0, 1, 0, 1]);
  const handInPhoto = Float32Array.from([0, 1, 0, 1, 0]);
  const region = Float32Array.from([0, 1, 1, 1, 0]);
  const body = new Float32Array(5);
  const hand = handInPhoto.map((v, i) => v * region[i]);
  const [, bodyLayer] = buildLayers(color, [curtain, body, hand], 5, 1, {
    extend: (i) => i !== 2,
    partsOf: (i) => (i === 1 ? [{ index: 2, region }] : []),
  });
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => bodyLayer[i * 4 + 3]),
    [0, 255, 255, 255, 0],
  );
  assert.deepEqual([...bodyLayer.slice(8, 12)], [0, 0, 255, 255]);
});

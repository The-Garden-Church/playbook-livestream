import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLayers, partitionMasks } from "./layers.js";

const RED = [1, 0, 0];
const BLUE = [0, 0, 1];

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
  const color = Float32Array.from([...RED, ...BLUE, ...RED]);
  const masks = [Float32Array.from([1, 0, 0]), Float32Array.from([0, 1, 0]), Float32Array.from([0, 0, 1])];
  assert.deepEqual([...buildLayers(color, masks, 3, 1)[1].slice(8)], [0, 0, 255, 255]);
  assert.deepEqual([...buildLayers(color, masks, 3, 1, (i) => i !== 1)[1].slice(8)], [0, 0, 0, 0]);
});

test("the remainder layer takes whatever the drawn masks leave, and overlaps are shared out", () => {
  const [wall, rest, subject] = partitionMasks([Float32Array.from([1, 0.5, 0.8]), null, Float32Array.from([0, 0, 0.8])], 3);
  assert.deepEqual([...wall], [1, 0.5, 0.5]);
  assert.deepEqual([...rest], [0, 0.5, 0]);
  assert.deepEqual([...subject], [0, 0, 0.5]);
});

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

test("where drawn masks overlap the nearer layer wins, and the remainder layer takes whatever is left", () => {
  const [wall, rest, subject] = partitionMasks([Float32Array.from([1, 0.5, 0.75]), null, Float32Array.from([0, 0, 0.75])], 3);
  assert.deepEqual([...subject], [0, 0, 0.75]);
  assert.deepEqual([...wall], [1, 0.5, 0.25]);
  assert.deepEqual([...rest], [0, 0.5, 0]);
});

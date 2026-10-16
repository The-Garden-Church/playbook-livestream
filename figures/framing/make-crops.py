"""Crop the lesson's cheat-sheet pictures from the practice photo.

The frames come from the framing tool's own model (docs/tools/framing/model.js), so the
pictures match what the tool calls each shot. Needs Node 20 or later and Pillow.

Run from the repository root: python figures/framing/make-crops.py
Writes docs/assets/framing/*.webp.
"""

import json
import subprocess
from pathlib import Path

from scene import ROOT, extended_photo

OUT = ROOT / "docs/assets/framing"
WIDTH = 640

FRAMES_JS = """
import { readFileSync } from "node:fs";
import { idealFrame, parseScene } from "./docs/tools/framing/model.js";
import { SHOT_CALLS } from "./docs/tools/framing/calls.js";
const scene = parseScene(JSON.parse(readFileSync("docs/tools/framing/scene/scene.json")));
const start = (id) => SHOT_CALLS.find((c) => c.id === id).start;
const ms = idealFrame("MS", "centered", scene);
const frames = {
  ...Object.fromEntries(["ECU", "CU", "MCU", "MS", "cowboy", "MLS"].map((id) => [id.toLowerCase(), idealFrame(id, "centered", scene)])),
  "headroom-right": ms,
  "headroom-too-much": start("too-much-air"),
  "headroom-cut": start("cut-off"),
  "lead-room": idealFrame("MS", "leadRoom", scene),
  "no-lead-room": { ...ms, cx: ms.cx + 0.14 * ms.width },
  "cut-at-knees": { cx: 1417, cy: 1275 - 1900 / (16 / 9) / 2, width: 1900 },
};
console.log(JSON.stringify(frames));
"""


def main():
    scene = json.loads((ROOT / "docs/tools/framing/scene/scene.json").read_text())
    frames = json.loads(subprocess.run(["node", "--input-type=module", "-e", FRAMES_JS], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    photo = extended_photo(scene)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, f in frames.items():
        h = f["width"] * 9 / 16
        box = (f["cx"] - f["width"] / 2, f["cy"] - h / 2, f["cx"] + f["width"] / 2, f["cy"] + h / 2)
        crop = photo.resize((WIDTH, round(WIDTH * 9 / 16)), box=box, resample=3)
        crop.save(OUT / f"{name}.webp", quality=72, method=6)
        print("wrote", name, [round(v) for v in box])


main()

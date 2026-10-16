import { clampFrame, idealFrame } from "./model.js";

export const SHOT_CALLS = [
  {
    id: "house",
    call: "Knees up, centered",
    brief: "The main camera's house shot. Frame him from just above the knees, centered, with a little room above his head. Stay wide enough that he can take a step without leaving the frame.",
    shot: "MLS",
    placement: "centered",
    start: { cx: 1199, cy: 572, width: 1560 },
  },
  {
    id: "wide",
    call: "Go wide",
    brief: "The director wants your widest shot. On a camera that can see his feet, a wide shot is head to toe with a little floor under the shoes. From this spot the widest you can go stops at his knees, so pull all the way out.",
    shot: "MLS",
    widest: true,
    start: { cx: 1417, cy: 451, width: 842 },
  },
  {
    id: "medium",
    call: "Give me a medium",
    brief: "A medium shot is waist up. Keep him centered.",
    shot: "MS",
    placement: "centered",
    start: { cx: 1161, cy: 711, width: 1827 },
  },
  {
    id: "prayer",
    call: "Medium close-up for the prayer",
    brief: "The prayer is a quiet moment, so the director wants to be closer. Frame him from the chest up, centered.",
    shot: "MCU",
    placement: "centered",
    start: { cx: 1417, cy: 572, width: 1560 },
  },
  {
    id: "closeup",
    call: "Tighten to a close-up",
    brief: "Head and shoulders, centered. In a close-up it's fine to trim a little off the top of the head, but never the chin.",
    shot: "CU",
    placement: "centered",
    start: { cx: 1299, cy: 451, width: 842 },
  },
  {
    id: "lower-third",
    call: "Lower third coming",
    brief: "Graphics is about to put his name on screen, and the lower third guide shows where it will go. Make sure his chin sits above it. A medium close-up, centered.",
    shot: "MCU",
    placement: "centered",
    lowerThird: true,
    start: { cx: 1417, cy: 370, width: 500 },
  },
  {
    id: "live-push",
    call: "You're live, push in to a medium",
    brief: "Your camera is on the stream right now, so everyone sees every move. Push in from knees up to waist up, slowly and smoothly.",
    shot: "MS",
    placement: "centered",
    live: true,
    start: { cx: 1417, cy: 711, width: 1827 },
  },
  {
    id: "cut-off",
    call: "Give him more headroom",
    brief: "Somebody bumped the camera and the top of his head is cut off. Fix it and keep the medium shot.",
    shot: "MS",
    placement: "centered",
    start: { cx: 1417, cy: 644, width: 1300 },
  },
  {
    id: "too-much-air",
    call: "Lose some headroom",
    brief: "There's a lot of empty space above his head, so he looks like he's sinking out of the frame. Keep the medium close-up.",
    shot: "MCU",
    placement: "centered",
    start: { cx: 1417, cy: 370, width: 1127 },
  },
  {
    id: "lead-room",
    call: "More lead room",
    brief: "He's talking to the people on one side of the room. Give him space on the side he's looking toward, in a medium shot.",
    shot: "MS",
    placement: "leadRoom",
    start: { cx: 1417, cy: 572, width: 1560 },
  },
];

export function solve(call, scene) {
  if (call.widest) return clampFrame({ cx: scene.landmarks.eyes.x, cy: Infinity, width: Infinity }, scene);
  return idealFrame(call.shot, call.placement ?? "centered", scene);
}

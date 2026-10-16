import { inLight, standardCamera } from "./model.js";

export const SCENARIOS = [
  {
    id: "auto",
    title: "Left on auto",
    brief: "The last operator left the camera on auto white balance and it drifted. Faces look off next to the other cameras.",
    start: { wbK: 5600, tint: 8 },
  },
  {
    id: "bumped-shutter",
    title: "Someone bumped the shutter",
    brief: "Dark bands are crawling across the LED wall, and the picture looks a little darker than the other cameras.",
    start: { shutterDeg: 90 },
  },
  {
    id: "lighting-change",
    title: "Too dark after the lighting change",
    brief: "The lighting team brought the stage lights down two stops for the message. Get the speaker bright again. Use the aperture first, then ISO, and don't go past ISO 1600.",
    start: {},
    sceneExposureOffset: -2,
    checks: ["apertureFirst"],
  },
  {
    id: "grainy",
    title: "Grainy picture",
    brief: "The director says your camera looks grainy and a little hot compared to the others.",
    start: { iso: 6400, fStop: 11 },
  },
  {
    id: "soft",
    title: "Soft shot",
    brief: "The speaker looks soft, but the LED wall behind them looks crisp.",
    start: { focusM: "wall" },
  },
  {
    id: "sun-came-out",
    title: "The sun came out",
    brief: "Halfway through the service the sun broke through and started pouring in the windows. Faces suddenly look warm next to a few minutes ago.",
    light: "sunny",
    start: {},
  },
  {
    id: "clouds-rolled-in",
    title: "Clouds rolled in",
    brief: "The sky went gray during worship. Faces look cold and a little blue, and nobody touched your camera.",
    light: "cloudy",
    start: {},
  },
  {
    id: "everything",
    title: "Everything's wrong",
    brief: "You just sat down at a camera nobody set up. Run the whole dial-in routine before the service starts.",
    start: { shutterDeg: 270, wbK: 3200, tint: -10, fStop: 8, iso: 3200, focusM: 2.5 },
  },
];

export function scenarioScene(scenario, scene) {
  return scenario.light ? inLight(scene, scenario.light) : scene;
}

export function scenarioCamera(scenario, scene) {
  const start = { ...standardCamera(scene), ...scenario.start };
  if (typeof start.focusM === "string") start.focusM = scene.layers.find((l) => l.id === start.focusM).distanceM;
  return start;
}

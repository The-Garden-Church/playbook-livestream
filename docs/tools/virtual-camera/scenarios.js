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
    brief: "The lighting team brought the stage lights way down for the message. Get the speaker bright again. Use the aperture first, then ISO, and don't go past ISO 1600.",
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
    id: "everything",
    title: "Everything's wrong",
    brief: "You just sat down at a camera nobody set up. Run the whole dial-in routine before the service starts.",
    start: { shutterDeg: 270, wbK: 3200, tint: -10, fStop: 8, iso: 3200, focusM: 2.5 },
  },
];

export function scenarioCamera(scenario, standard, scene) {
  const start = { ...standard, ...scenario.start };
  if (typeof start.focusM === "string") start.focusM = scene.layers.find((l) => l.id === start.focusM).distanceM;
  return start;
}

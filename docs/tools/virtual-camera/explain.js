import { CONTROLS, FPS, ledBanding, inDepthOfField, stopWord, stopsBetween } from "./model.js";

function brightness(stops) {
  if (stops === 0) return null;
  if (Math.abs(stops) < 0.15) return stops > 0 ? "a hair brighter" : "a hair darker";
  return `${stopWord(stops)} ${stops > 0 ? "brighter" : "darker"}`;
}

const EXPLAINERS = {
  shutterDeg(camera, scene) {
    const v = camera.shutterDeg;
    const label = CONTROLS.shutterDeg.format(v);
    const wall = scene.ledWall;
    if (v === scene.reference.shutterDeg) return `${label}: standard. Half of each frame, natural motion${wall ? ", no flicker" : ""}.`;
    const mover = scene.motion.label;
    const motion = v < 150 ? `${mover} freeze mid-move, so motion looks choppy` : v > 200 ? `${mover} smear as they move` : "natural motion";
    const parts = [brightness(stopsBetween("shutterDeg", v, scene.reference.shutterDeg)), motion];
    if (wall) {
      const { amplitude } = ledBanding(v, FPS, wall.refreshHz);
      parts.push(amplitude === 0 ? "no flicker" : amplitude < 0.1 ? "faint bands on the LED wall" : "and the LED wall bands");
    }
    return `${label}: ${parts.join(", ")}.`;
  },
  wbK(camera, scene) {
    const diff = camera.wbK - scene.lightK;
    const label = CONTROLS.wbK.format(camera.wbK);
    if (diff === 0) return `${label}: matches the room light, so white looks white.`;
    const where = `${Math.abs(diff)} K ${diff > 0 ? "above" : "below"} the room light`;
    if (Math.abs(diff) <= 300) return `${label}: ${where}, a touch ${diff > 0 ? "warmer" : "cooler"}.`;
    return `${label}: ${where}, so the picture turns ${diff > 0 ? "orange" : "blue"}.`;
  },
  tint(camera) {
    const t = camera.tint;
    const label = CONTROLS.tint.format(t);
    if (t === 0) return `${label}: no green or magenta shift.`;
    const toward = t > 0 ? "magenta" : "green";
    if (Math.abs(t) <= 3) return `${label}: a barely visible push toward ${toward}.`;
    return `${label}: pushes the picture toward ${toward}, so skin looks ${t > 0 ? "pink" : "sickly"}.`;
  },
  fStop(camera, scene) {
    const label = CONTROLS.fStop.format(camera.fStop);
    const stops = stopsBetween("fStop", camera.fStop, scene.reference.fStop);
    const line =
      stops === 0
        ? `${label}: standard. Bright enough, and forgiving focus.`
        : stops > 0
          ? `${label}: ${brightness(stops)} than standard, background softer.`
          : `${label}: ${brightness(stops)} than standard, more of the room is sharp.`;
    return camera.fStop === 2.8 ? `${line} Many cameras show this as f/2.9.` : line;
  },
  iso(camera, scene) {
    const label = CONTROLS.iso.format(camera.iso);
    const stops = stopsBetween("iso", camera.iso, scene.reference.iso);
    if (stops === 0) return `${label}: standard. Clean picture.`;
    const grain = stops < 0 ? "very clean" : camera.iso > 1600 ? "heavy grain" : "more grain";
    return `${label}: ${brightness(stops)} than standard, ${grain}.`;
  },
  focusM(camera, scene) {
    const label = CONTROLS.focusM.format(camera.focusM);
    const subject = scene.layers.find((l) => l.id === scene.subject);
    if (inDepthOfField(subject.distanceM, camera, scene.lens)) return `${label}: ${subject.label} is sharp.`;
    const sharp = scene.layers.filter((l) => inDepthOfField(l.distanceM, camera, scene.lens));
    if (sharp.length === 0) return `${label}: nothing in the shot is sharp. ${capitalize(subject.label)} is at ${CONTROLS.focusM.format(subject.distanceM)}.`;
    return `${label}: ${sharp.map((l) => l.label).join(" and ")} ${sharp.length > 1 ? "are" : "is"} sharp and ${subject.label} is soft.`;
  },
};

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

export function explain(key, camera, scene) {
  return EXPLAINERS[key](camera, scene);
}

export const ASPECT = 16 / 9;

export const SHOT_SIZES = [
  {
    id: "ECU",
    name: "Extreme close-up",
    what: "eyes and mouth",
    anchor: ["eyes", "chin", 0.6],
    bottomAt: "just under his mouth",
    eyes: { ideal: 0.4, min: 0.28, max: 0.52 },
    headCrop: -Infinity,
  },
  {
    id: "CU",
    name: "Close-up",
    what: "head and shoulders",
    anchor: ["shoulders", "chest", 0.3],
    bottomAt: "just below his shoulders",
    eyes: { ideal: 0.36, min: 0.28, max: 0.45 },
    headCrop: -0.08,
  },
  {
    id: "MCU",
    name: "Medium close-up",
    what: "chest up",
    anchor: ["chest", "elbows", 0.3],
    bottomAt: "across the middle of his chest",
    eyes: { ideal: 0.33, min: 0.25, max: 0.4 },
    headCrop: 0,
  },
  {
    id: "MS",
    name: "Medium shot",
    what: "waist up",
    anchor: ["waist", "hips", 0.7],
    bottomAt: "just below his belt",
    eyes: { ideal: 0.27, min: 0.18, max: 0.38 },
    headCrop: 0,
  },
  {
    id: "cowboy",
    abbr: null,
    name: "Cowboy shot",
    what: "mid-thigh up",
    anchor: ["midThigh", "midThigh", 0],
    bottomAt: "at the middle of his thighs",
    headroom: { ideal: 0.07, min: 0.02, max: 0.14 },
    headCrop: 0,
  },
  {
    id: "MLS",
    name: "Medium long shot",
    what: "knees up",
    anchor: ["knees", "midThigh", 0.4],
    bottomAt: "just above his knees",
    headroom: { ideal: 0.07, min: 0.02, max: 0.14 },
    headCrop: 0,
  },
  {
    id: "WS",
    name: "Wide shot",
    what: "head to toe",
    anchor: ["feet", "knees", -0.12],
    bottomAt: "a little below his feet",
    headroom: { ideal: 0.07, min: 0.02, max: 0.2 },
    headCrop: 0,
  },
  {
    id: "EWS",
    name: "Extreme wide shot",
    what: "the whole stage",
    anchor: ["feet", "knees", -1.5],
    bottomAt: "well below his feet",
    headroom: { ideal: 0.15, min: 0, max: 1 },
    headCrop: 0,
  },
];

const SIZE_BY_ID = Object.fromEntries(SHOT_SIZES.map((s) => [s.id, s]));

export const JOINTS = [
  { landmark: "chin", word: "neck" },
  { landmark: "elbows", word: "elbows" },
  { landmark: "waist", word: "waist" },
  { landmark: "knees", word: "knees" },
  { landmark: "ankles", word: "ankles" },
];
export const JOINT_BAND = { bottom: 0.02, side: 0.02 };

export const PLACEMENT = {
  centeredTolerance: 0.05,
  leadRoom: { ideal: 0.64, min: 0.56, max: 0.72 },
};

export const LIVE_LIMITS = { windowS: 0.1, maxPan: 0.9, maxZoom: 0.6, maxAccel: 9, mergeS: 0.4 };

export const WIDEST_SHARE = 0.97;

export function parseScene(raw) {
  const { landmarks } = raw;
  return {
    ...raw,
    bounds: { width: raw.photo.width + (raw.mirrorRight ?? 0), height: raw.photo.height },
    anchors: Object.fromEntries(
      SHOT_SIZES.map((s) => {
        const [a, b, t] = s.anchor;
        return [s.id, landmarks[a].y + (landmarks[b].y - landmarks[a].y) * t];
      }),
    ),
  };
}

export const frameHeight = (frame) => frame.width / ASPECT;

export function widthLimits(scene) {
  const max = Math.min(scene.zoom.maxWidth, scene.bounds.width, scene.bounds.height * ASPECT);
  return { min: scene.zoom.minWidth, max };
}

export function clampFrame(frame, scene) {
  const { min, max } = widthLimits(scene);
  const width = Math.min(max, Math.max(min, frame.width));
  const height = width / ASPECT;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    cx: clamp(frame.cx, width / 2, scene.bounds.width - width / 2),
    cy: clamp(frame.cy, height / 2, scene.bounds.height - height / 2),
    width,
  };
}

export function classify(bottom, scene) {
  let best = SHOT_SIZES[0];
  for (const size of SHOT_SIZES) {
    if (Math.abs(scene.anchors[size.id] - bottom) < Math.abs(scene.anchors[best.id] - bottom)) best = size;
  }
  return best;
}

export function shotLabel(size) {
  const abbr = size.abbr === null ? "" : ` (${size.id})`;
  return `${size.name}${abbr}, ${size.what}`;
}

export function measure(frame, scene) {
  const { landmarks: lm, lookDirection, lowerThird } = scene;
  const width = frame.width;
  const height = frameHeight(frame);
  const top = frame.cy - height / 2;
  const bottom = top + height;
  const left = frame.cx - width / 2;
  const right = left + width;
  const relY = (y) => (y - top) / height;
  const subjectX = (lm.eyes.x - left) / width;
  const jointCuts = [];
  for (const joint of JOINTS) {
    const y = lm[joint.landmark].y;
    if (Math.abs(bottom - y) < JOINT_BAND.bottom * height) jointCuts.push({ edge: "bottom", word: joint.word });
    if (y > top && y < bottom) {
      for (const x of lm[joint.landmark].xs ?? []) {
        if (Math.abs(left - x) < JOINT_BAND.side * width) jointCuts.push({ edge: "left", word: joint.word });
        if (Math.abs(right - x) < JOINT_BAND.side * width) jointCuts.push({ edge: "right", word: joint.word });
      }
    }
  }
  const headroomRatio = relY(lm.headTop.y);
  const chinRatio = relY(lm.chin.y);
  return {
    shotSize: classify(bottom, scene).id,
    headroomRatio,
    headCropped: headroomRatio < 0,
    eyeLineRatio: relY(lm.eyes.y),
    subjectX,
    leadRoomRatio: lookDirection.x < 0 ? subjectX : 1 - subjectX,
    jointCuts,
    chinRatio,
    lowerThirdClear: chinRatio <= lowerThird.top,
  };
}

export function idealFrame(sizeId, placement, scene) {
  const size = SIZE_BY_ID[sizeId];
  const { landmarks: lm } = scene;
  const bottom = scene.anchors[sizeId];
  const height = size.eyes ? (bottom - lm.eyes.y) / (1 - size.eyes.ideal) : (bottom - lm.headTop.y) / (1 - size.headroom.ideal);
  const width = height * ASPECT;
  const faceAt = placement === "leadRoom" ? (scene.lookDirection.x < 0 ? PLACEMENT.leadRoom.ideal : 1 - PLACEMENT.leadRoom.ideal) : 0.5;
  return clampFrame({ cx: lm.eyes.x + (0.5 - faceAt) * width, cy: bottom - height / 2, width }, scene);
}

const withArticle = (words) => `${/^[aeiou]/i.test(words) ? "an" : "a"} ${words}`;

const lookSide = (scene) => (scene.lookDirection.x < 0 ? "left" : "right");
const otherSide = (side) => (side === "left" ? "right" : "left");

function sizeCheck(m, call, scene) {
  const now = SIZE_BY_ID[m.shotSize];
  if (!call?.shot) return { pass: true, message: `This is ${withArticle(shotLabel(now).replace(/^./, (c) => c.toLowerCase()))}.` };
  const want = SIZE_BY_ID[call.shot];
  if (now.id === want.id) return { pass: true, message: `That's ${withArticle(want.name.toLowerCase())}, ${want.what}.` };
  const tighter = SHOT_SIZES.indexOf(want) < SHOT_SIZES.indexOf(now);
  return {
    pass: false,
    message: `This is ${withArticle(now.name.toLowerCase())}. The director wants ${withArticle(want.name.toLowerCase())}, ${want.what}. ${
      tighter ? "Push in" : "Pull out"
    } until the bottom of the frame sits ${want.bottomAt}.`,
  };
}

function headroomCheck(m) {
  const size = SIZE_BY_ID[m.shotSize];
  if (m.headroomRatio < size.headCrop) {
    return {
      pass: false,
      message:
        size.headCrop < 0
          ? "Too much of his head is cut off. A close-up can trim a little off the top of the head, but not this much. Tilt up a little."
          : "The top of his head is cut off. Tilt up until there's a little space above his head.",
    };
  }
  if (size.eyes) {
    if (m.eyeLineRatio > size.eyes.max) return { pass: false, message: "Too much headroom. Tilt down until the eyes sit on the top third line." };
    if (m.eyeLineRatio < size.eyes.min) return { pass: false, message: "His eyes are too close to the top of the frame. Tilt up until they sit on the top third line." };
    return { pass: true, message: "His eyes sit near the top third line, so the headroom looks right." };
  }
  if (m.headroomRatio > size.headroom.max) {
    return { pass: false, message: "Too much headroom. Tilt down until the top of his head sits just under the headroom line." };
  }
  if (m.headroomRatio < size.headroom.min) {
    return { pass: false, message: "His head is almost touching the top of the frame. Tilt up a little to give him some headroom." };
  }
  return { pass: true, message: `There's a little room above his head, just right for ${withArticle(size.name.toLowerCase())}.` };
}

function placementCheck(m, placement, scene) {
  if (placement === "centered") {
    const off = m.subjectX - 0.5;
    if (Math.abs(off) <= PLACEMENT.centeredTolerance) return { pass: true, message: "He's centered." };
    return off > 0
      ? { pass: false, message: "He's right of center. Pan right a little to center him." }
      : { pass: false, message: "He's left of center. Pan left a little to center him." };
  }
  const side = lookSide(scene);
  const { min, max } = PLACEMENT.leadRoom;
  if (m.leadRoomRatio >= min && m.leadRoomRatio <= max) return { pass: true, message: `He's on the ${otherSide(side)} third, with lead room on the side he's looking toward.` };
  return m.leadRoomRatio < min
    ? {
        pass: false,
        message: `He's looking toward frame ${side}, so leave more room on that side. Pan ${side} until his face sits near the ${otherSide(side)} third line.`,
      }
    : { pass: false, message: `He's too close to the ${otherSide(side)} edge. Pan ${otherSide(side)} a little so his face sits on the third line.` };
}

function jointCheck(m) {
  const cut = m.jointCuts[0];
  if (!cut) return { pass: true, message: "No edge of the frame lands on a joint." };
  if (cut.edge === "bottom") {
    return { pass: false, message: `The bottom of the frame cuts right at the ${cut.word}. Go a little tighter or a little wider so it doesn't land on a joint.` };
  }
  return { pass: false, message: `The ${cut.edge} edge of the frame cuts right at his ${cut.word}. Pan or zoom a little so the edge doesn't land on a joint.` };
}

function lowerThirdCheck(m) {
  return m.lowerThirdClear
    ? { pass: true, message: "His chin clears the lower third, so the graphic won't cover his face." }
    : { pass: false, message: "The lower third will cover his chin. Pull out a little or tilt down so his chin sits above the graphic." };
}

function widestCheck(frame, scene) {
  return frame.width >= WIDEST_SHARE * widthLimits(scene).max
    ? { pass: true, message: "You're all the way out." }
    : { pass: false, message: "Pull out all the way. The director wants this camera's widest shot." };
}

function smoothCheck(motion) {
  const n = motion?.bumps.length ?? 0;
  if (n === 0) return { pass: true, message: "Smooth and steady the whole time you were live." };
  return {
    pass: false,
    message: `Smooth it out. ${n === 1 ? "One move was" : `${n} moves were`} too quick while you were live, and the stream saw it. Move slower, and ease into and out of each move.`,
  };
}

export function readiness(frame, call, scene, motion) {
  const m = measure(frame, scene);
  const checks = [
    { id: "size", label: "Shot size", ...sizeCheck(m, call, scene) },
    { id: "headroom", label: "Headroom", ...headroomCheck(m) },
  ];
  if (call?.placement) checks.push({ id: "placement", label: call.placement === "centered" ? "Centered" : "Lead room", ...placementCheck(m, call.placement, scene) });
  checks.push({ id: "joints", label: "Joints", ...jointCheck(m) });
  if (call?.lowerThird) checks.push({ id: "lowerThird", label: "Lower third", ...lowerThirdCheck(m) });
  if (call?.widest) checks.push({ id: "widest", label: "Widest shot", ...widestCheck(frame, scene) });
  if (call?.live) checks.push({ id: "smooth", label: "Smooth moves", ...smoothCheck(motion) });
  return { ready: checks.every((c) => c.pass), checks, measure: m };
}

export function placementLabel(m, scene) {
  if (Math.abs(m.subjectX - 0.5) <= PLACEMENT.centeredTolerance) return "centered";
  const { min, max } = PLACEMENT.leadRoom;
  if (m.leadRoomRatio >= min && m.leadRoomRatio <= max) return `on the ${otherSide(lookSide(scene))} third`;
  return m.subjectX > 0.5 ? "right of center" : "left of center";
}

export function motionBumps(samples, limits = LIVE_LIMITS) {
  const segments = [];
  let from = samples[0];
  for (const s of samples.slice(1)) {
    const dt = s.t - from.t;
    if (dt < limits.windowS) continue;
    const h = from.width / ASPECT;
    segments.push({
      t: s.t,
      vx: (s.cx - from.cx) / from.width / dt,
      vy: (s.cy - from.cy) / h / dt,
      vz: Math.log(s.width / from.width) / dt,
    });
    from = s;
  }
  const raw = [];
  segments.forEach((seg, i) => {
    if (Math.hypot(seg.vx, seg.vy) > limits.maxPan) raw.push({ t: seg.t, kind: "pan" });
    if (Math.abs(seg.vz) > limits.maxZoom) raw.push({ t: seg.t, kind: "zoom" });
    const prev = segments[i - 1];
    if (prev && Math.hypot(seg.vx - prev.vx, seg.vy - prev.vy, seg.vz - prev.vz) / (seg.t - prev.t) > limits.maxAccel) raw.push({ t: seg.t, kind: "jerk" });
  });
  const bumps = [];
  for (const b of raw) {
    const last = bumps.at(-1);
    if (last && b.t - last.t <= limits.mergeS) continue;
    bumps.push(b);
  }
  return bumps;
}

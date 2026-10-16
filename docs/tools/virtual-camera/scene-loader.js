import { parseScenes } from "./model.js";
import { buildLayers, decodeSrgb, partitionMasks, rectMask } from "./layers.js";

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });

function rasterize(img, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

export async function loadSceneList(baseUrl) {
  const response = await fetch(new URL("scenes.json", baseUrl));
  return parseScenes(await response.json());
}

export async function loadScene(scene, baseUrl, maxWidth) {
  const photo = await loadImage(new URL(scene.image, baseUrl));
  const width = Math.min(maxWidth, photo.naturalWidth);
  const height = Math.round((width * photo.naturalHeight) / photo.naturalWidth);
  const count = width * height;
  const scale = width / photo.naturalWidth;
  const color = decodeSrgb(rasterize(photo, width, height), count);
  const imageMask = async (file) => {
    const rgba = rasterize(await loadImage(new URL(file, baseUrl)), width, height);
    return Float32Array.from({ length: count }, (_, i) => rgba[i * 4] / 255);
  };
  const byId = new Map(scene.layers.map((l) => [l.id, l]));
  const regions = scene.layers.map(({ mask }) => (mask.rects ? rectMask(mask.rects, mask.featherPx ?? 0, scale, width, height) : null));
  const drawn = await Promise.all(
    scene.layers.map(async ({ mask, partOf }, i) => {
      if (mask === "remainder") return null;
      if (typeof mask === "string") return imageMask(mask);
      if (!partOf) return regions[i];
      const base = await imageMask(byId.get(partOf).mask);
      return base.map((v, k) => v * regions[i][k]);
    }),
  );
  const masks = partitionMasks(drawn, count);
  const ids = scene.layers.map((l) => l.id);
  const layers = buildLayers(color, masks, width, height, {
    extend: (i) => ids[i] !== scene.motion.layer,
    partsOf: (i) => scene.layers.flatMap((l, j) => (l.partOf === ids[i] ? [{ index: j, region: regions[j] }] : [])),
  });
  return { scene, width, height, layers };
}

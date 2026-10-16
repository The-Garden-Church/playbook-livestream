import { parseScene } from "./model.js";
import { buildLayers, decodeSrgb, partitionMasks } from "./layers.js";

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

export async function loadScene(baseUrl, maxWidth) {
  const response = await fetch(new URL("scene.json", baseUrl));
  const scene = parseScene(await response.json());
  const photo = await loadImage(new URL(scene.image, baseUrl));
  const width = Math.min(maxWidth, photo.naturalWidth);
  const height = Math.round((width * photo.naturalHeight) / photo.naturalWidth);
  const count = width * height;
  const color = decodeSrgb(rasterize(photo, width, height), count);
  const drawn = await Promise.all(
    scene.layers.map(async (layer) => {
      if (layer.mask === "remainder") return null;
      const rgba = rasterize(await loadImage(new URL(layer.mask, baseUrl)), width, height);
      return Float32Array.from({ length: count }, (_, i) => rgba[i * 4] / 255);
    }),
  );
  const masks = partitionMasks(drawn, count);
  return { scene, width, height, layers: buildLayers(color, masks, width, height, (i) => scene.layers[i].id !== scene.motion.layer) };
}

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
  const scene = parseScene(await (await fetch(new URL("scene.json", baseUrl))).json());
  const photo = await loadImage(new URL(scene.image, baseUrl));
  const width = Math.min(maxWidth, photo.naturalWidth);
  const height = Math.round((width * photo.naturalHeight) / photo.naturalWidth);
  const count = width * height;
  const color = decodeSrgb(rasterize(photo, width, height), count);
  const imageMask = async (file) => {
    const rgba = rasterize(await loadImage(new URL(file, baseUrl)), width, height);
    return Float32Array.from({ length: count }, (_, i) => rgba[i * 4] / 255);
  };
  const drawn = await Promise.all(scene.layers.map(({ mask }) => (mask === "remainder" ? null : imageMask(mask))));
  const layers = buildLayers(color, partitionMasks(drawn, count), width, height);
  return { scene, width, height, layers };
}

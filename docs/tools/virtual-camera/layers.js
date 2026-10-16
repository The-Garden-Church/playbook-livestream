const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

export const linearToSrgb8 = (v) => {
  const x = Math.min(1, Math.max(0, v));
  return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
};

export function decodeSrgb(rgba, count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = SRGB_TO_LINEAR[rgba[i * 4 + k]];
  return out;
}

export function partitionMasks(masks, count) {
  const remainderIndex = masks.indexOf(null);
  const out = masks.map((m) => (m ? new Float32Array(count) : null));
  const free = new Float32Array(count).fill(1);
  for (let l = masks.length - 1; l >= 0; l--) {
    if (l === remainderIndex) continue;
    for (let i = 0; i < count; i++) {
      const take = Math.min(masks[l][i], free[i]);
      out[l][i] = take;
      free[i] -= take;
    }
  }
  out[remainderIndex] = free;
  return out;
}

const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function rectMask(rects, featherPx, scale, w, h) {
  const out = new Float32Array(w * h);
  const f = Math.max(featherPx * scale, 1e-6);
  for (const [x0, y0, x1, y1] of rects.map((r) => r.map((v) => v * scale))) {
    for (let y = 0; y < h; y++) {
      const wy = smoothstep((Math.min(y + 0.5 - y0, y1 - y - 0.5) + f / 2) / f);
      if (wy === 0) continue;
      for (let x = 0; x < w; x++) {
        const v = wy * smoothstep((Math.min(x + 0.5 - x0, x1 - x - 0.5) + f / 2) / f);
        if (v > out[y * w + x]) out[y * w + x] = v;
      }
    }
  }
  return out;
}

function pushPullFill(color, weight, w, h) {
  const levels = [{ p: new Float32Array(w * h * 3), wt: Float32Array.from(weight), w, h }];
  for (let i = 0; i < w * h; i++) for (let k = 0; k < 3; k++) levels[0].p[i * 3 + k] = color[i * 3 + k] * weight[i];
  while (levels.at(-1).w > 1 || levels.at(-1).h > 1) {
    const src = levels.at(-1);
    const nw = Math.ceil(src.w / 2);
    const nh = Math.ceil(src.h / 2);
    const p = new Float32Array(nw * nh * 3);
    const wt = new Float32Array(nw * nh);
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const s = y * src.w + x;
        const d = (y >> 1) * nw + (x >> 1);
        wt[d] += src.wt[s] / 4;
        for (let k = 0; k < 3; k++) p[d * 3 + k] += src.p[s * 3 + k] / 4;
      }
    }
    levels.push({ p, wt, w: nw, h: nh });
  }
  let parent = null;
  for (let l = levels.length - 1; l >= 0; l--) {
    const { p, wt, w: lw, h: lh } = levels[l];
    const fill = new Float32Array(lw * lh * 3);
    const pw = parent && levels[l + 1].w;
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) {
        const i = y * lw + x;
        const a = Math.min(1, wt[i] * 2);
        const pi = parent ? ((y >> 1) * pw + (x >> 1)) * 3 : 0;
        for (let k = 0; k < 3; k++) {
          const own = wt[i] > 0 ? p[i * 3 + k] / wt[i] : 0;
          fill[i * 3 + k] = parent ? own * a + parent[pi + k] * (1 - a) : own;
        }
      }
    }
    parent = fill;
  }
  return parent;
}

export function buildLayers(color, masks, w, h, extendIndex = () => true) {
  const count = w * h;
  const total = new Float32Array(count);
  for (const m of masks) for (let i = 0; i < count; i++) total[i] += m[i];
  const upTo = new Float32Array(count);
  return masks.map((mask, l) => {
    for (let i = 0; i < count; i++) upTo[i] += mask[i];
    const front = Float32Array.from(total, (t, i) => Math.max(0, t - upTo[i]));
    const open = (i) => front[i] < 0.02;
    const fill = pushPullFill(color, Float32Array.from(upTo, (u, i) => (open(i) ? u : 0)), w, h);
    const extend = extendIndex(l);
    const out = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      const alpha = Math.min(1, mask[i] + (extend ? front[i] : 0));
      const own = open(i) && mask[i] > 0;
      for (let k = 0; k < 3; k++) out[i * 4 + k] = linearToSrgb8((own ? color[i * 3 + k] : fill[i * 3 + k]) * alpha);
      out[i * 4 + 3] = Math.round(alpha * 255);
    }
    return out;
  });
}

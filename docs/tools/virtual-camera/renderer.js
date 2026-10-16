import { FPS, NOISE_CHROMA_RATIO, addedNoiseSigma, blurRadiusPx, exposureStops, ledBanding, wbGains } from "./model.js";

const MAX_LAYERS = 8;
const HIST_W = 128;
const HIST_H = 72;
export const HIST_BINS = 64;

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BLUR = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray src;
uniform float layer;
uniform float radius;
uniform float lod;
uniform vec2 texel;
out vec4 color;
const int TAPS = 96;
void main() {
  vec2 uv = gl_FragCoord.xy * texel;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < TAPS; i++) {
    float r = sqrt((float(i) + 0.5) / float(TAPS)) * radius;
    float a = float(i) * 2.39996323;
    sum += textureLod(src, vec3(uv + vec2(cos(a), sin(a)) * r * texel, layer), lod);
  }
  color = sum / float(TAPS);
}`;

const CAMERA = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray layers;
uniform int layerCount;
uniform int wallIndex;
uniform float bandAmp;
uniform float bandPhase;
uniform float bandCount;
uniform float gain;
uniform vec3 wb;
uniform float sigma;
uniform float chroma;
uniform float seed;
uniform vec2 size;
out vec4 color;

uint hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
float rand(inout uint state) {
  state = hash(state);
  return (float(state >> 8) + 0.5) / 16777216.0;
}
float gauss(inout uint state) {
  return sqrt(-2.0 * log(rand(state))) * cos(6.2831853 * rand(state));
}
vec3 encode(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAX_LAYERS}; i++) {
    if (i >= layerCount) break;
    vec4 s = texture(layers, vec3(uv, float(i)));
    if (i == wallIndex) s.rgb *= max(0.0, 1.0 + bandAmp * cos(6.2831853 * (uv.y * bandCount + bandPhase)));
    acc = acc * (1.0 - s.a) + s.rgb;
  }
  vec3 lin = acc * gain;
  uint state = hash(uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(seed) * 26699u);
  float level = sigma * (0.35 + 0.65 * sqrt(max(dot(lin, vec3(0.2126, 0.7152, 0.0722)), 0.0) / 0.18));
  vec3 n = vec3(gauss(state)) + chroma * vec3(gauss(state), gauss(state), gauss(state));
  lin = (lin + n * level) * wb;
  color = vec4(encode(clamp(lin, 0.0, 1.0)), 1.0);
}`;

const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform vec2 srcSize;
uniform vec2 dstSize;
uniform bool zebras;
uniform bool falseColor;
uniform bool peaking;
uniform float time;
uniform float stripe;
out vec4 color;

float luma(vec2 uv) { return dot(texture(image, uv).rgb, vec3(0.2126, 0.7152, 0.0722)); }

vec3 falseColorOf(float y, vec3 c) {
  float g = y;
  if (y < 0.02) return vec3(0.45, 0.12, 0.62);
  if (y < 0.1) return vec3(0.1, 0.35, 0.9);
  if (y < 0.41) return vec3(g);
  if (y < 0.5) return vec3(0.2, 0.75, 0.3);
  if (y < 0.55) return vec3(g);
  if (y < 0.7) return vec3(0.95, 0.55, 0.7);
  if (y < 0.93) return vec3(g);
  if (y < 0.99) return vec3(0.95, 0.85, 0.15);
  return vec3(0.9, 0.12, 0.1);
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x / dstSize.x, 1.0 - gl_FragCoord.y / dstSize.y);
  vec3 c = texture(image, uv).rgb;
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (falseColor) c = falseColorOf(y, c);
  if (peaking) {
    vec2 t = 1.0 / srcSize;
    float tl = luma(uv + t * vec2(-1, -1)), tc = luma(uv + t * vec2(0, -1)), tr = luma(uv + t * vec2(1, -1));
    float ml = luma(uv + t * vec2(-1, 0)), mr = luma(uv + t * vec2(1, 0));
    float bl = luma(uv + t * vec2(-1, 1)), bc = luma(uv + t * vec2(0, 1)), br = luma(uv + t * vec2(1, 1));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    float edge = smoothstep(0.55, 0.75, length(vec2(gx, gy)));
    c = mix(c, vec3(0.2, 1.0, 0.25), edge);
  }
  if (zebras && y >= 0.95) {
    float s = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / stripe - time * 1.5));
    c = mix(c, vec3(s), 0.8);
  }
  color = vec4(c, 1.0);
}`;

function compile(gl, fragment) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const uniforms = {};
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
    const { name } = gl.getActiveUniform(program, i);
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

// The true amplitude at 172.8° is about 4%, which a real camera shows clearly but a small screen hides, so the display lifts faint bands while keeping their order.
const BAND_DISPLAY_GAMMA = 0.6;

export function frameUniforms(camera, scene, scenario, timeS) {
  const frame = Math.floor(timeS * FPS);
  return {
    frame,
    bandAmp: scene.ledWall ? ledBanding(camera.shutterDeg, FPS, scene.ledWall.refreshHz) ** BAND_DISPLAY_GAMMA : 0,
    bandPhase: scene.ledWall ? (frame / FPS) * scene.ledWall.rollBandsPerS : 0,
    bandCount: scene.ledWall?.bandsPerFrame ?? 0,
    gain: 2 ** (exposureStops(camera, scene.reference) + (scenario?.sceneExposureOffset ?? 0)),
    wb: wbGains(camera.wbK, camera.tint, scene.lightK),
    sigma: addedNoiseSigma(camera.iso, scene.reference.iso),
  };
}

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const blur = compile(gl, BLUR);
  const cameraProgram = compile(gl, CAMERA);
  const display = compile(gl, DISPLAY);
  gl.bindVertexArray(gl.createVertexArray());
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  const arrayTexture = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const target = (w, h) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  };
  const hist = target(HIST_W, HIST_H);
  const histPixels = new Uint8Array(HIST_W * HIST_H * 4);

  function upload({ scene, width, height, layers }) {
    const n = layers.length;
    const source = arrayTexture();
    const packed = new Uint8Array(width * height * 4 * n);
    layers.forEach((l, i) => packed.set(l, i * width * height * 4));
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.SRGB8_ALPHA8, width, height, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, packed);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    const blurred = arrayTexture();
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.SRGB8_ALPHA8, width, height, n);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const blurTargets = layers.map((_, i) => {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, blurred, 0, i);
      return fb;
    });
    const ids = scene.layers.map((l) => l.id);
    return {
      scene,
      width,
      height,
      n,
      source,
      blurred,
      blurTargets,
      output: target(width, height),
      wallIndex: scene.ledWall ? ids.indexOf(scene.ledWall.layer) : -1,
      opticsKey: "",
    };
  }

  const uploaded = new Map();
  let current = null;

  function blurLayers(g, camera) {
    const key = `${camera.fStop}|${camera.focusM}`;
    if (key === g.opticsKey) return;
    g.opticsKey = key;
    const { scene, width, height } = g;
    gl.useProgram(blur.program);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.source);
    gl.uniform1i(blur.uniforms.src, 0);
    gl.uniform2f(blur.uniforms.texel, 1 / width, 1 / height);
    scene.layers.forEach((layer, i) => {
      const r = blurRadiusPx(layer.distanceM, camera.focusM, camera.fStop, scene.lens.focalMm, scene.lens.sensorMm, width);
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.blurTargets[i]);
      gl.uniform1f(blur.uniforms.layer, i);
      gl.uniform1f(blur.uniforms.radius, r);
      gl.uniform1f(blur.uniforms.lod, Math.max(0, Math.log2(r / 7)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
  }

  function render({ loaded, camera, scenario, overlays, timeS }) {
    if (!uploaded.has(loaded)) uploaded.set(loaded, upload(loaded));
    const g = uploaded.get(loaded);
    current = g;
    const { scene, width, height } = g;
    blurLayers(g, camera);
    const u = frameUniforms(camera, scene, scenario, timeS);
    gl.useProgram(cameraProgram.program);
    const cu = cameraProgram.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.output.fb);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.blurred);
    gl.uniform1i(cu.layers, 0);
    gl.uniform1i(cu.layerCount, g.n);
    gl.uniform1i(cu.wallIndex, g.wallIndex);
    gl.uniform1f(cu.bandAmp, u.bandAmp);
    gl.uniform1f(cu.bandPhase, u.bandPhase);
    gl.uniform1f(cu.bandCount, u.bandCount);
    gl.uniform1f(cu.gain, u.gain);
    gl.uniform3fv(cu.wb, u.wb);
    gl.uniform1f(cu.sigma, u.sigma);
    gl.uniform1f(cu.chroma, NOISE_CHROMA_RATIO);
    gl.uniform1f(cu.seed, u.frame % 100000);
    gl.uniform2f(cu.size, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(display.program);
    const du = display.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, g.output.tex);
    gl.uniform1i(du.image, 0);
    gl.uniform2f(du.srcSize, width, height);
    gl.uniform2f(du.dstSize, canvas.width, canvas.height);
    gl.uniform1i(du.zebras, overlays.zebras ? 1 : 0);
    gl.uniform1i(du.falseColor, overlays.falseColor ? 1 : 0);
    gl.uniform1i(du.peaking, overlays.peaking ? 1 : 0);
    gl.uniform1f(du.time, timeS);
    gl.uniform1f(du.stripe, 10 * (canvas.width / canvas.clientWidth || 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return u.frame;
  }

  function histogram() {
    const { output, width, height } = current;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, output.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, hist.fb);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, HIST_W, HIST_H, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, hist.fb);
    gl.readPixels(0, 0, HIST_W, HIST_H, gl.RGBA, gl.UNSIGNED_BYTE, histPixels);
    const bins = new Uint32Array(HIST_BINS);
    for (let i = 0; i < histPixels.length; i += 4) {
      const y = 0.2126 * histPixels[i] + 0.7152 * histPixels[i + 1] + 0.0722 * histPixels[i + 2];
      bins[Math.min(HIST_BINS - 1, Math.floor((y / 256) * HIST_BINS))]++;
    }
    return bins;
  }

  return { render, histogram };
}

import sharp from 'sharp';
import { ort, session } from './models.ts';

// Image work for tag avatars: face detection (YuNet), identity embeddings
// (SFace), person cut-out (U^2-Net) and the pencil sketch. Ports of what
// OpenCV's FaceDetectorYN / FaceRecognizerSF and rembg do in Python, so the
// worker needs no Python runtime.

/** Packed 8-bit RGB pixels. */
export type Rgb = { data: Uint8Array; width: number; height: number };

/** A detected face: box, five landmarks (right eye, left eye, nose, mouth right, mouth left), score. */
export type Face = { x: number; y: number; w: number; h: number; landmarks: [number, number][]; score: number };

export async function decode(input: Buffer | Uint8Array): Promise<Rgb> {
  const { data, info } = await sharp(input).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

const toSharp = (img: Rgb) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } });

async function resized(img: Rgb, width: number, height: number): Promise<Rgb> {
  const { data, info } = await toSharp(img).resize(width, height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

// ---- YuNet -------------------------------------------------------------

const YUNET = 640;
const STRIDES = [8, 16, 32] as const;

const iou = (a: Face, b: Face) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a.w * a.h + b.w * b.h - w * h);
};

/**
 * Faces, largest first. The model takes a fixed 640×640 input, so the photo
 * is scaled to fit (which also catches faces that fill the frame — YuNet
 * misses those at full resolution) and the boxes scaled back.
 */
export async function detectFaces(img: Rgb, minScore = 0.8): Promise<Face[]> {
  const k = YUNET / Math.max(img.width, img.height);
  const small = await resized(img, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
  // NCHW, BGR, raw 0–255, zero padding right/bottom (as cv::dnn::blobFromImage after padding).
  const plane = YUNET * YUNET;
  const input = new Float32Array(3 * plane);
  for (let y = 0; y < small.height; y++)
    for (let x = 0; x < small.width; x++) {
      const s = (y * small.width + x) * 3;
      const d = y * YUNET + x;
      input[d] = small.data[s + 2];
      input[plane + d] = small.data[s + 1];
      input[2 * plane + d] = small.data[s];
    }
  const net = await session('yunet');
  const out = await net.run({ [net.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, YUNET, YUNET]) });
  const found: Face[] = [];
  for (const stride of STRIDES) {
    const cls = out[`cls_${stride}`].data as Float32Array;
    const obj = out[`obj_${stride}`].data as Float32Array;
    const bbox = out[`bbox_${stride}`].data as Float32Array;
    const kps = out[`kps_${stride}`].data as Float32Array;
    const cols = YUNET / stride;
    for (let i = 0; i < cls.length; i++) {
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      const score = Math.sqrt(clamp(cls[i]) * clamp(obj[i]));
      if (score < minScore) continue;
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cx = (c + bbox[i * 4]) * stride;
      const cy = (r + bbox[i * 4 + 1]) * stride;
      const w = Math.exp(bbox[i * 4 + 2]) * stride;
      const h = Math.exp(bbox[i * 4 + 3]) * stride;
      const landmarks = Array.from({ length: 5 }, (_, n): [number, number] => [
        ((kps[i * 10 + 2 * n] + c) * stride) / k,
        ((kps[i * 10 + 2 * n + 1] + r) * stride) / k,
      ]);
      found.push({ x: (cx - w / 2) / k, y: (cy - h / 2) / k, w: w / k, h: h / k, landmarks, score });
    }
  }
  found.sort((a, b) => b.score - a.score);
  const kept: Face[] = [];
  for (const f of found) if (kept.every((g) => iou(f, g) <= 0.3)) kept.push(f);
  return kept.sort((a, b) => b.w * b.h - a.w * a.h);
}

// ---- SFace -------------------------------------------------------------

// ArcFace's five-point template on a 112×112 crop (cv::FaceRecognizerSF::alignCrop).
const TEMPLATE: [number, number][] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/** Least-squares similarity transform (rotation, uniform scale, shift) from `src` points onto `dst`. */
export function similarity(src: [number, number][], dst: [number, number][]) {
  const n = src.length;
  const ms = [src.reduce((s, p) => s + p[0], 0) / n, src.reduce((s, p) => s + p[1], 0) / n];
  const md = [dst.reduce((s, p) => s + p[0], 0) / n, dst.reduce((s, p) => s + p[1], 0) / n];
  let a = 0;
  let b = 0;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - ms[0];
    const sy = src[i][1] - ms[1];
    const dx = dst[i][0] - md[0];
    const dy = dst[i][1] - md[1];
    a += sx * dx + sy * dy;
    b += sx * dy - sy * dx;
    ss += sx * sx + sy * sy;
  }
  const c = a / ss;
  const s = b / ss;
  // dst = [[c, -s], [s, c]] · src + t
  return { c, s, tx: md[0] - (c * ms[0] - s * ms[1]), ty: md[1] - (s * ms[0] + c * ms[1]) };
}

/** The face warped onto the 112×112 template (bilinear, black outside the photo). */
export function alignFace(img: Rgb, face: Face): Rgb {
  const { c, s, tx, ty } = similarity(face.landmarks, TEMPLATE);
  const det = c * c + s * s;
  const out = new Uint8Array(112 * 112 * 3);
  for (let v = 0; v < 112; v++)
    for (let u = 0; u < 112; u++) {
      // inverse map: src = R⁻¹ (dst − t)
      const px = u - tx;
      const py = v - ty;
      const x = (c * px + s * py) / det;
      const y = (-s * px + c * py) / det;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= img.width || y0 + 1 >= img.height) continue;
      const fx = x - x0;
      const fy = y - y0;
      for (let ch = 0; ch < 3; ch++) {
        const p = (yy: number, xx: number) => img.data[(yy * img.width + xx) * 3 + ch];
        const top = p(y0, x0) * (1 - fx) + p(y0, x0 + 1) * fx;
        const bottom = p(y0 + 1, x0) * (1 - fx) + p(y0 + 1, x0 + 1) * fx;
        out[(v * 112 + u) * 3 + ch] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  return { data: out, width: 112, height: 112 };
}

/** Unit-length identity embedding of an aligned face. */
export async function embed(aligned: Rgb): Promise<Float32Array> {
  const plane = 112 * 112;
  const input = new Float32Array(3 * plane);
  // FaceRecognizerSF feeds RGB, unscaled.
  for (let i = 0; i < plane; i++) for (let ch = 0; ch < 3; ch++) input[ch * plane + i] = aligned.data[i * 3 + ch];
  const net = await session('sface');
  const out = await net.run({ [net.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, 112, 112]) });
  const v = Float32Array.from(out[net.outputNames[0]].data as Float32Array);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export const cosine = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i], 0);

/** SFace's cosine threshold for "same person". */
export const SAME_PERSON = 0.363;

// ---- U^2-Net -----------------------------------------------------------

const U2 = 320;

/** Person mask 0–255 at the image's size (rembg's u2net_human_seg pre/post-processing). */
export async function personMask(img: Rgb): Promise<Uint8Array> {
  const small = await resized(img, U2, U2);
  const max = Math.max(
    1e-6,
    small.data.reduce((m, v) => Math.max(m, v), 0),
  );
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const plane = U2 * U2;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++)
    for (let ch = 0; ch < 3; ch++) input[ch * plane + i] = (small.data[i * 3 + ch] / max - mean[ch]) / std[ch];
  const net = await session('u2net');
  const out = await net.run({ [net.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, U2, U2]) });
  const pred = out[net.outputNames[0]].data as Float32Array;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < plane; i++) {
    lo = Math.min(lo, pred[i]);
    hi = Math.max(hi, pred[i]);
  }
  const mask = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) mask[i] = Math.round(((pred[i] - lo) / (hi - lo || 1)) * 255);
  const { data } = await sharp(mask, { raw: { width: U2, height: U2, channels: 1 } })
    .resize(img.width, img.height, { fit: 'fill', kernel: 'lanczos3' })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, data.length);
}

/** Zero every pixel outside the largest 4-connected region where mask > 128. */
export function keepLargest(mask: Uint8Array, width: number) {
  const label = new Int32Array(mask.length);
  const sizes = [0];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] <= 128 || label[start]) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop() as number;
      size++;
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width])
        if (q >= 0 && q < mask.length && mask[q] > 128 && !label[q]) {
          label[q] = id;
          stack.push(q);
        }
    }
    sizes.push(size);
  }
  if (sizes.length <= 2) return mask;
  const best = sizes.indexOf(Math.max(...sizes.slice(1)));
  return mask.map((m, i) => (label[i] === best ? m : 0));
}

// ---- pixels ------------------------------------------------------------

export const gray = (img: Rgb) => {
  const g = new Uint8Array(img.width * img.height);
  for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * img.data[i * 3] + 0.587 * img.data[i * 3 + 1] + 0.114 * img.data[i * 3 + 2]);
  return g;
};

/** Variance of the 4-neighbour Laplacian: higher is sharper. */
export function laplacianVariance(g: Uint8Array, width: number, height: number) {
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = g[i - 1] + g[i + 1] + g[i - width] + g[i + width] - 4 * g[i];
      sum += v;
      sq += v * v;
      n++;
    }
  return sq / n - (sum / n) ** 2;
}

export const meanStd = (g: Uint8Array) => {
  const mean = g.reduce((s, v) => s + v, 0) / g.length;
  return { mean, std: Math.sqrt(g.reduce((s, v) => s + (v - mean) ** 2, 0) / g.length) };
};

export { resized, toSharp };

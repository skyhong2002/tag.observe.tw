import sharp from 'sharp';
import {
  alignFace,
  cosine,
  detectFaces,
  embed,
  type Face,
  gray,
  keepLargest,
  laplacianVariance,
  meanStd,
  personMask,
  type Rgb,
  SAME_PERSON,
  toSharp,
} from './vision.ts';

// Turning one photo into a sketch avatar, and judging whether it should
// (docs/tag-avatars.md): the main face must be big enough and alone in the
// head-and-shoulders crop; passing photos are scored so the best one is used.

export const MIN_FACE = 80; // px of face width in the ~1200px photo
const RIVAL = 0.6; // a second face this big (by side) = a group photo
const SIDE = 2.1; // crop side, in face heights
const TOP = 0.55; // crop top, in face heights above the face box
export const AVATAR = 256;

export type Verdict = 'ok' | 'bystander' | 'group' | 'small' | 'noface';

/** Head-and-shoulders square around the face, in photo pixels. */
export const cropBox = (f: Face) => {
  const side = f.h * SIDE;
  return { left: f.x + f.w / 2 - side / 2, top: f.y - f.h * TOP, side };
};

export function judge(faces: Face[]): Verdict {
  const [main, ...rest] = faces;
  if (!main) return 'noface';
  if (main.w < MIN_FACE) return 'small';
  if (rest.length && rest[0].w * rest[0].h >= RIVAL ** 2 * main.w * main.h) return 'group';
  const box = cropBox(main);
  const inside = (f: Face) => {
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    return cx > box.left && cx < box.left + box.side && cy > box.top && cy < box.top + box.side;
  };
  // Usable, but the cut-out may keep part of the other person.
  return rest.some(inside) ? 'bystander' : 'ok';
}

export type Scores = { size: number; front: number; sharp: number; light: number; same: number; det: number };

const WEIGHTS: Scores = { size: 0.25, front: 0.2, sharp: 0.15, light: 0.2, same: 0.1, det: 0.1 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0–1 photo quality for an avatar; `similarity` is the face's cosine to the person's reference face. */
export function quality(face: Face, aligned: Rgb, similarity: number, verdict: Verdict) {
  const [[rex, rey], [lex, ley], [nx]] = face.landmarks;
  const eye = Math.max(1, Math.abs(lex - rex));
  const g = gray(aligned);
  const { mean, std } = meanStd(g);
  const parts: Scores = {
    size: clamp01(face.w / 300),
    // Nose centred between the eyes and the eyes level: facing the camera.
    front: clamp01(1 - (Math.abs(nx - (rex + lex) / 2) / eye) * 2.5 - (Math.abs(ley - rey) / eye) * 2),
    sharp: clamp01(laplacianVariance(g, aligned.width, aligned.height) / 2500),
    light: clamp01(1 - Math.abs(mean - 140) / 100) * clamp01(std / 45),
    same: clamp01((similarity - SAME_PERSON) / (0.7 - SAME_PERSON)),
    det: face.score,
  };
  let score = (Object.keys(WEIGHTS) as (keyof Scores)[]).reduce((s, k) => s + parts[k] * WEIGHTS[k], 0);
  if (verdict === 'bystander') score *= 0.7;
  return { score: Math.round(score * 1000) / 1000, parts };
}

/** Faces plus the main face's aligned crop and embedding. */
export async function inspect(img: Rgb) {
  const faces = await detectFaces(img);
  const verdict = judge(faces);
  const main = faces[0];
  const aligned = main ? alignFace(img, main) : null;
  return { faces, verdict, main, aligned, embedding: aligned ? await embed(aligned) : null };
}

/**
 * Re-crops of one shot (Commons keeps "X.jpg" and "X (cropped).jpg"): their
 * aligned faces correlate almost perfectly at 32px; different shots ~0.5.
 */
export async function sameShot(a: Rgb, b: Rgb) {
  const tiny = async (img: Rgb) => {
    const { data } = await toSharp(img).resize(32, 32, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
    const { mean, std } = meanStd(data);
    return Array.from(data, (v) => (v - mean) / (std || 1));
  };
  const [x, y] = await Promise.all([tiny(a), tiny(b)]);
  return x.reduce((s, v, i) => s + v * y[i], 0) / x.length >= 0.85;
}

export const sameFace = (a: Float32Array, b: Float32Array) => cosine(a, b) >= SAME_PERSON;

/** The pencil-sketch avatar (WebP): crop around the face, cut the person out onto white, colour-dodge sketch. */
export async function renderAvatar(img: Rgb, face: Face) {
  const { left, top, side } = cropBox(face);
  const pad = Math.ceil(side);
  // White padding keeps faces near the edge centred. Two passes: sharp
  // would otherwise extract before extending.
  const padded = await toSharp(img)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const head = await sharp(padded.data, { raw: { width: padded.info.width, height: padded.info.height, channels: 3 } })
    .extract({ left: Math.round(left) + pad, top: Math.round(top) + pad, width: Math.round(side), height: Math.round(side) })
    .resize(512, 512, { fit: 'fill' })
    .raw()
    .toBuffer();
  const crop: Rgb = { data: new Uint8Array(head.buffer, head.byteOffset, head.length), width: 512, height: 512 };
  const mask = await personMask(crop);
  // Only the main person: head width above the chin, widening to the shoulders.
  for (let y = 0; y < 512; y++) {
    const half = 0.36 + clamp01((y / 512 - 0.62) / 0.25) * 0.14;
    for (let x = 0; x < 512; x++) if (Math.abs(x - 256) / 512 >= half) mask[y * 512 + x] = 0;
  }
  const kept = keepLargest(mask, 512);
  const onWhite = new Uint8Array(512 * 512);
  const g = gray(crop);
  for (let i = 0; i < onWhite.length; i++) onWhite[i] = Math.round((g[i] * kept[i] + 255 * (255 - kept[i])) / 255);
  const small = await sharp(onWhite, { raw: { width: 512, height: 512, channels: 1 } })
    .resize(AVATAR, AVATAR)
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  const blurred = await sharp(Buffer.from(small.map((v) => 255 - v)), { raw: { width: AVATAR, height: AVATAR, channels: 1 } })
    .blur(6)
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  // Colour dodge (cv2.divide(gray, 255 - blur(inverted), scale=256)), then a little more contrast.
  const sketch = new Uint8Array(AVATAR * AVATAR);
  for (let i = 0; i < sketch.length; i++) {
    const dodge = Math.min(255, (small[i] * 256) / Math.max(1, 255 - blurred[i]));
    sketch[i] = Math.min(255, Math.max(0, Math.round(dodge * 1.2 - 40)));
  }
  return sharp(sketch, { raw: { width: AVATAR, height: AVATAR, channels: 1 } })
    .webp({ quality: 80 })
    .toBuffer();
}

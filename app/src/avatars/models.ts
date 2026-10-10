import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as ort from 'onnxruntime-node';

// The three ONNX models behind tag avatars (docs/tag-avatars.md). They are
// too big for git (u2net alone is 168 MB), so the first run downloads them
// into AVATAR_MODEL_DIR and checks each file's SHA-256 before loading it.
export const MODELS = {
  // Face boxes + five landmarks (OpenCV Zoo, MIT).
  yunet: {
    file: 'face_detection_yunet_2023mar.onnx',
    url: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
  },
  // 128-d identity embedding on a landmark-aligned 112×112 face (OpenCV Zoo, Apache-2.0).
  sface: {
    file: 'face_recognition_sface_2021dec.onnx',
    url: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx',
    sha256: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
  },
  // Person cut-out mask (U^2-Net human segmentation, Apache-2.0; rembg's mirror).
  u2net: {
    file: 'u2net_human_seg.onnx',
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx',
    sha256: '01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c',
  },
} as const;

export type ModelName = keyof typeof MODELS;

export const modelDir = () => process.env.AVATAR_MODEL_DIR || join(homedir(), '.cache', 'tag-avatars', 'models');

const sha256 = (buf: Uint8Array) => createHash('sha256').update(buf).digest('hex');

async function modelBytes(name: ModelName) {
  const spec = MODELS[name];
  const dir = modelDir();
  const path = join(dir, spec.file);
  const cached = await readFile(path).catch(() => null);
  if (cached && sha256(cached) === spec.sha256) return cached;
  const res = await fetch(spec.url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) throw Error(`download ${spec.file}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (sha256(buf) !== spec.sha256) throw Error(`download ${spec.file}: SHA-256 mismatch`);
  await mkdir(dir, { recursive: true });
  await writeFile(`${path}.partial`, buf);
  await rename(`${path}.partial`, path);
  return buf;
}

const sessions = new Map<ModelName, Promise<ort.InferenceSession>>();

/** One shared session per model; the first call downloads and verifies the file. */
export function session(name: ModelName) {
  let s = sessions.get(name);
  if (!s) {
    // Keep inference off most cores: the same host serves the site.
    s = modelBytes(name).then((buf) => ort.InferenceSession.create(buf, { intraOpNumThreads: 2, interOpNumThreads: 1 }));
    s.catch(() => sessions.delete(name));
    sessions.set(name, s);
  }
  return s;
}

export { ort };

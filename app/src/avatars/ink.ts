import sharp from 'sharp';

// Serving a stored avatar's mask layers. Kept apart from portrait.ts so the
// gateway does not load the image models (onnxruntime) to send a picture.

export type AvatarLayer = 'ink' | 'fill';

/**
 * One mask layer of a stored avatar (docs/tag-avatars.md): `ink` is the
 * strokes, painted orange; `fill` is the person's silhouette, painted white
 * under them, so the person stays white paper on dark pages too.
 */
export async function inkImage(stored: Buffer, layer: AvatarLayer) {
  const { data, info } = await sharp(stored).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const ink = data[i * 4 + 3];
    out[i * 4 + 3] = layer === 'ink' ? ink : data[i * 4];
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}

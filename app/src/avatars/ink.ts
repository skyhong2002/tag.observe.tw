import sharp from 'sharp';

// Serving a stored avatar's mask layers. Kept apart from portrait.ts so the
// gateway does not load the image models (onnxruntime) to send a picture.

export type AvatarLayer = 'ink' | 'fill' | 'color';

// The site's brand-600 (Tailwind orange-600, oklch(64.6% 0.222 41.116)).
const ORANGE = [245, 73, 0];

/**
 * One layer of a stored avatar (docs/tag-avatars.md): `ink` is the strokes
 * and `fill` the person's silhouette, as alpha masks the page paints orange
 * and white; `color` is both already painted (orange strokes over a white
 * person, transparent around), one picture for places that cannot mask, such
 * as the home page cloud's SVG.
 */
/**
 * Move the picture down so the person's shoulders touch the bottom edge: a
 * photo cut off at the chest leaves the bottom of the crop empty, which under
 * the home cloud put a gap between the face and its name.
 */
function sinkToBottom(px: Uint8Array, width: number, height: number) {
  let last = height - 1;
  const visible = (row: number) => {
    for (let x = 0; x < width; x++) if (px[(row * width + x) * 4 + 3] > 24) return true;
    return false;
  };
  while (last > 0 && !visible(last)) last--;
  const shift = height - 1 - last;
  if (!shift || last <= 0) return;
  px.copyWithin(shift * width * 4, 0, (last + 1) * width * 4);
  px.fill(0, 0, shift * width * 4);
}

export async function inkImage(stored: Buffer, layer: AvatarLayer, accent: string | null = null) {
  // Another service's accent (six hex digits), for the painted layer.
  const paint = accent ? [0, 8, 16].map((shift) => (Number.parseInt(accent, 16) >> (16 - shift)) & 255) : ORANGE;
  const { data, info } = await sharp(stored).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const ink = data[i * 4 + 3];
    const fill = data[i * 4];
    if (layer !== 'color') {
      out[i * 4 + 3] = layer === 'ink' ? ink : fill;
      continue;
    }
    // Orange ink over white paper: alpha = a + f(1 − a), colour premultiplied then divided back.
    const a = ink / 255;
    const f = fill / 255;
    const alpha = a + f * (1 - a);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = alpha ? Math.round((paint[c] * a + 255 * f * (1 - a)) / alpha) : 0;
    out[i * 4 + 3] = Math.round(alpha * 255);
  }
  if (layer === 'color') sinkToBottom(out, info.width, info.height);
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}

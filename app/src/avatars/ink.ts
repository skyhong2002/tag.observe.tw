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
export async function inkImage(stored: Buffer, layer: AvatarLayer) {
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
    for (let c = 0; c < 3; c++) out[i * 4 + c] = alpha ? Math.round((ORANGE[c] * a + 255 * f * (1 - a)) / alpha) : 0;
    out[i * 4 + 3] = Math.round(alpha * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}

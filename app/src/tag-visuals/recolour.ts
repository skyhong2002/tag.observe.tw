import sharp from 'sharp';

// Logos in the site's one colour (docs/tag-visuals.md). Only the hue is
// replaced: every pixel keeps its lightness, stretched over the logo's own
// range onto a white → orange ramp that ends a little darker than the brand
// orange, so a blue-and-red logo stays two shades and white stays white.
// Lightness is OKLab's L; the orange is the brand's OKLCH hue, its chroma
// cut back where sRGB cannot show it.

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function oklab(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [r, g, b].map((x) => lin(x / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function linearRgb(L: number, a: number, b: number) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// The site's brand-600 (Tailwind orange-600).
const [BRAND_L, BRAND_A, BRAND_B] = oklab(245, 73, 0);
const BRAND_C = Math.hypot(BRAND_A, BRAND_B);
const HUE = Math.atan2(BRAND_B, BRAND_A);
/** The ramp: darkest a little below the brand orange (the user's pick), lightest near white. */
export const DARKEST = BRAND_L - 0.08;
export const LIGHTEST = 0.97;
// Lighter than this, with little colour: the logo's white parts, kept white.
const WHITE_L = 0.93;

/** sRGB of the brand hue at lightness `L`: full chroma at the brand's lightness, less toward white and black. */
export function orangeAt(L: number): [number, number, number] {
  let C = L >= BRAND_L ? BRAND_C * (1 - (L - BRAND_L) / (1 - BRAND_L)) : BRAND_C * (L / BRAND_L);
  for (;;) {
    const c = linearRgb(L, C * Math.cos(HUE), C * Math.sin(HUE));
    if (c.every((x) => x >= -1e-4 && x <= 1.0001) || C < 1e-3)
      return c.map((x) => Math.round(255 * gam(Math.min(1, Math.max(0, x))))) as [number, number, number];
    C *= 0.95;
  }
}

/** Per-logo mapping from a pixel's lightness to the ramp's. */
export function lightnessMap(lightness: number[]) {
  const sorted = [...lightness].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  const lo = at(0.02);
  const hi = at(0.98);
  const hasWhite = hi > WHITE_L;
  const top = hasWhite ? 1 : hi;
  const span = top - lo;
  return (L: number) => {
    if (hasWhite && L > WHITE_L) return 1;
    // One colour (and white): all of it the darkest orange.
    const u = span < 0.08 ? 0 : Math.min(1, Math.max(0, (L - lo) / span));
    return DARKEST + u * (LIGHTEST - DARKEST);
  };
}

/**
 * Any image sharp reads → the recoloured logo as WebP with alpha, inside a
 * `width` × `height` box: square emblems come out `height` px, wide
 * wordmarks up to `width` px wide so their letters stay legible.
 */
export async function recolourLogo(input: Buffer | Uint8Array, width = 512, height = 192) {
  const { data, info } = await sharp(input, { density: 300 })
    .resize(width, height, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const L = new Float32Array(n);
  const seen: number[] = [];
  for (let i = 0; i < n; i++) {
    L[i] = oklab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])[0];
    // Half-transparent white (民進黨's cross) is still part of the logo.
    if (data[i * 4 + 3] > 120) seen.push(L[i]);
  }
  if (!seen.length) throw Error('logo is fully transparent');
  const map = lightnessMap(seen);
  const cache = new Map<number, [number, number, number]>();
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const target = Math.round(map(L[i]) * 500) / 500;
    let c = cache.get(target);
    if (!c) {
      c = target >= 1 ? [255, 255, 255] : orangeAt(target);
      cache.set(target, c);
    }
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = data[i * 4 + 3];
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toBuffer();
}

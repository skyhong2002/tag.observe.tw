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

/**
 * An accent colour as the ramp's ends: its OKLab lightness, chroma and hue,
 * and the darkest shade (a little below the accent, the user's pick). Very
 * light accents (a pale yellow) still get a darkest shade dark enough to read.
 */
export type Accent = { hex: string; L: number; C: number; H: number; darkest: number };
export function accentOf(hex: string): Accent {
  const n = Number.parseInt(hex, 16);
  const [L, a, b] = oklab((n >> 16) & 255, (n >> 8) & 255, n & 255);
  return { hex: hex.toLowerCase(), L, C: Math.hypot(a, b), H: Math.atan2(b, a), darkest: Math.min(L - 0.08, 0.62) };
}
/** The site's brand-600 (Tailwind orange-600): every stored picture is in it. */
export const BRAND_HEX = 'f54900';
export const BRAND = accentOf(BRAND_HEX);
/** `accent` query parameter: six hex digits, with or without #; null when absent, invalid or the brand's own. */
export function parseAccent(value: unknown) {
  if (typeof value !== 'string') return null;
  const hex = value.replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) && hex !== BRAND_HEX ? hex : null;
}

/** The ramp: darkest a little below the brand orange (the user's pick), lightest near white. */
export const DARKEST = BRAND.darkest;
export const LIGHTEST = 0.97;
// Lighter than this, with little colour: the logo's white parts, kept white.
const WHITE_L = 0.93;

/** sRGB of an accent's hue at lightness `L`: full chroma at the accent's lightness, less toward white and black. */
export function accentAt(L: number, accent: Accent): [number, number, number] {
  let C = L >= accent.L ? accent.C * (1 - (L - accent.L) / (1 - accent.L)) : accent.C * (L / accent.L);
  for (;;) {
    const c = linearRgb(L, C * Math.cos(accent.H), C * Math.sin(accent.H));
    if (c.every((x) => x >= -1e-4 && x <= 1.0001) || C < 1e-3)
      return c.map((x) => Math.round(255 * gam(Math.min(1, Math.max(0, x))))) as [number, number, number];
    C *= 0.95;
  }
}
export const orangeAt = (L: number) => accentAt(L, BRAND);

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

type Raw = { data: Buffer; info: { width: number; height: number } };
const distance = (d: Buffer, i: number, c: number[]) => Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);
// Background colour distances: closer than CUT is background; up to SOFT, an
// anti-aliased edge that fades out.
const CUT = 28;
const SOFT = 70;

// A border colour counts as background when this share of the border has it.
const BACKGROUND_SHARE = 0.12;

/**
 * The colours the border is made of, most common first: each colour that
 * covers at least BACKGROUND_SHARE of the border (a two-tone backdrop has
 * two), as the mean of its pixels. Colours are grouped coarsely (32 levels a
 * channel) so JPEG noise and gentle shading fall together.
 */
export function borderColours(data: Buffer, border: number[]) {
  const groups = new Map<number, { n: number; sum: [number, number, number] }>();
  for (const p of border) {
    const i = p * 4;
    const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const g = groups.get(key) ?? { n: 0, sum: [0, 0, 0] };
    g.n++;
    g.sum[0] += data[i];
    g.sum[1] += data[i + 1];
    g.sum[2] += data[i + 2];
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.n >= border.length * BACKGROUND_SHARE)
    .sort((a, b) => b.n - a.n)
    .map((g) => g.sum.map((v) => v / g.n));
}

/**
 * Takes a solid background off a logo that has none transparent (an upload
 * of a seal on white, a wordmark on a two-tone panel): every colour a good
 * share of the border has is flooded from the edges, so white inside the
 * emblem, walled off by its ring, stays. A logo whose border is already
 * mostly transparent is left as it is.
 */
export function cutOut({ data, info }: Raw) {
  const { width: w, height: h } = info;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  if (border.filter((p) => data[p * 4 + 3] < 128).length > border.length / 2) return;
  const backgrounds = borderColours(data, border);
  if (!backgrounds.length) return;
  // How far a pixel is from the nearest background colour.
  const far = (i: number) => Math.min(...backgrounds.map((bg) => distance(data, i, bg)));
  const seen = new Uint8Array(w * h);
  const queue = border.filter((p) => far(p * 4) < SOFT);
  for (const p of queue) seen[p] = 1;
  while (queue.length) {
    const p = queue.pop() as number;
    const d = far(p * 4);
    data[p * 4 + 3] = Math.round(data[p * 4 + 3] * Math.max(0, Math.min(1, (d - CUT) / (SOFT - CUT))));
    // Only background spreads; a soft edge pixel fades but goes no further.
    if (d >= CUT) continue;
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
      if (q >= 0 && q < w * h && !seen[q] && far(q * 4) < SOFT) {
        seen[q] = 1;
        queue.push(q);
      }
  }
}

/** The box around everything visible, with a 2% margin; null when nothing is. */
export function visibleBox({ data, info }: Raw) {
  const { width: w, height: h } = info;
  let [left, top, right, bottom] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 16) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < 0) return null;
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.02);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  return { left, top, width: Math.min(w, right + pad + 1) - left, height: Math.min(h, bottom + pad + 1) - top };
}

/**
 * A logo cut out and trimmed to what it shows, fitted inside `width` ×
 * `height`: square emblems come out `height` px, wide wordmarks up to
 * `width` px wide so their letters stay legible. Raw RGBA.
 */
async function cleanLogo(input: Buffer | Uint8Array, width: number, height: number, cut = true): Promise<Raw> {
  // A flag is its whole rectangle: nothing to cut out or trim.
  if (!cut)
    return sharp(input, { density: 300 })
      .resize(width, height, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  const big = await sharp(input, { density: 300 })
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const before = Buffer.from(big.data);
  cutOut(big);
  // A logo that is one solid block (a coloured rectangle) would vanish: keep it whole.
  let box = visibleBox(big);
  if (!box) {
    before.copy(big.data);
    box = visibleBox(big);
  }
  if (!box) throw Error('logo is fully transparent');
  // Two passes: within one pipeline sharp may reorder extract and resize.
  const cropped = await sharp(big.data, { raw: { width: big.info.width, height: big.info.height, channels: 4 } })
    .extract(box)
    .png()
    .toBuffer();
  return sharp(cropped)
    .resize(width, height, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

/** A logo already in the site's orange (stored before cut-outs existed), cut out and trimmed again. */
export async function recutLogo(stored: Buffer | Uint8Array, width = 512, height = 192) {
  const { data, info } = await cleanLogo(stored, width, height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toBuffer();
}

/**
 * Any image sharp reads → the logo cut out of a solid background, trimmed to
 * what it shows and recoloured, as WebP with alpha (see cleanLogo for the size).
 */
export async function recolourLogo(input: Buffer | Uint8Array, width = 512, height = 192, { cut = true } = {}) {
  const { data, info } = await cleanLogo(input, width, height, cut);
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

/**
 * A stored picture (in the brand orange) in another service's accent: each
 * pixel keeps its place on the ramp (white stays white, the darkest stays the
 * darkest), only the hue and the ramp's ends change. Alpha is kept.
 */
export async function reaccent(stored: Buffer | Uint8Array, hex: string) {
  const accent = accentOf(hex);
  const { data, info } = await sharp(stored).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cache = new Map<number, [number, number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    const [L, a, b] = oklab(data[i], data[i + 1], data[i + 2]);
    if (L > WHITE_L && Math.hypot(a, b) < 0.02) continue;
    const u = Math.min(1, Math.max(0, (L - BRAND.darkest) / (LIGHTEST - BRAND.darkest)));
    const target = Math.round((accent.darkest + u * (LIGHTEST - accent.darkest)) * 500) / 500;
    let c = cache.get(target);
    if (!c) {
      c = accentAt(target, accent);
      cache.set(target, c);
    }
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toBuffer();
}

/** A stored SVG (place outlines) in another accent: the brand orange swapped for it. */
export const reaccentSvg = (svg: Buffer | string, hex: string) => Buffer.from(svg.toString().replaceAll(`#${BRAND_HEX}`, `#${hex}`));

// Downloads every outlet's favicon once and stores it as a 192×192 PNG under
// web/public/favicons/<media>.png, so pages no longer hotlink icons that
// break (404/410), refuse foreign requests (403) or are formats the image
// optimizer rejects (.ico). Writes app/data/favicon-local.json with the URL
// each icon came from.
//
//   node tools/fetch-favicons.ts            only outlets without a stored icon
//   node tools/fetch-favicons.ts --all      refetch everything
//   node tools/fetch-favicons.ts ltn udn    just these
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// sharp is a web/ dependency; type just what we use so the root typecheck
// does not need web/node_modules (CI's test job never installs it).
interface Sharp {
  metadata(): Promise<{ width?: number; height?: number }>;
  stats(): Promise<{ isOpaque: boolean }>;
  resize(w: number, h: number, o: { fit: 'contain'; background: { r: number; g: number; b: number; alpha: number } }): Sharp;
  png(): Sharp;
  toBuffer(): Promise<Buffer>;
}
const sharp = createRequire(new URL('../web/package.json', import.meta.url))('sharp') as (
  input: Buffer,
  o?: { raw: { width: number; height: number; channels: 4 } },
) => Sharp;

const OUT = 'web/public/favicons';
const MANIFEST = 'app/data/favicon-local.json';
const SIZE = 192;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

type Catalog = Record<string, { icon: string | null; title: string | null }>;
type Sources = Record<string, { index?: { urls?: Array<{ url: string }> } }>;
type Manifest = Record<
  string,
  {
    source: string;
    fetchedAt: string;
    curated?: boolean;
    sourceWidth?: number;
    sourceHeight?: number;
    transparent?: boolean;
    revision?: string;
    dark?: 'invert' | 'outline';
    note?: string;
  }
>;
type Icon = { png: Buffer; sourceWidth: number; sourceHeight: number; transparent: boolean };

const catalog = JSON.parse(await readFile('app/data/favicon-catalog.json', 'utf8')) as Catalog;
const sources = JSON.parse(await readFile('app/data/crawl-sources.json', 'utf8')) as Sources;
const newsSources = JSON.parse(await readFile('app/data/news-source-catalog.json', 'utf8')) as {
  sources: Array<{ media: string; websiteUrl: string | null }>;
};
const manifest: Manifest = await readFile(MANIFEST, 'utf8')
  .then((s) => JSON.parse(s) as Manifest)
  .catch(() => ({}));

async function get(url: string, accept = '*/*'): Promise<{ type: string; body: Buffer; url: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return { type: res.headers.get('content-type') ?? '', body: Buffer.from(await res.arrayBuffer()), url: res.url };
  } catch {
    return null;
  }
}

// ICO: pick the largest entry; PNG entries go to sharp as-is, BMP entries
// (32/24/8/4/1-bit, bottom-up, with a 1-bit transparency mask) become RGBA.
function icoToImage(buf: Buffer): Buffer | { raw: Buffer; width: number; height: number } | null {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const n = buf.readUInt16LE(4);
  const entries = Array.from({ length: n }, (_, i) => {
    const o = 6 + i * 16;
    return { w: buf[o] || 256, size: buf.readUInt32LE(o + 8), offset: buf.readUInt32LE(o + 12) };
  }).sort((a, b) => b.w - a.w);
  for (const e of entries) {
    const data = buf.subarray(e.offset, e.offset + e.size);
    if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return data;
    const header = data.readUInt32LE(0);
    const width = data.readInt32LE(4);
    const height = data.readInt32LE(8) / 2;
    const bpp = data.readUInt16LE(14);
    if (![1, 4, 8, 24, 32].includes(bpp) || width <= 0 || height <= 0) continue;
    const colors = bpp <= 8 ? data.readUInt32LE(32) || 1 << bpp : 0;
    const palette = data.subarray(header, header + colors * 4);
    const pixels = data.subarray(header + colors * 4);
    const stride = Math.ceil((width * bpp) / 32) * 4;
    const mask = pixels.subarray(stride * height);
    const maskStride = Math.ceil(width / 32) * 4;
    const raw = Buffer.alloc(width * height * 4);
    let anyAlpha = false;
    for (let y = 0; y < height; y++) {
      const row = (height - 1 - y) * stride;
      for (let x = 0; x < width; x++) {
        const d = (y * width + x) * 4;
        let b: number,
          g: number,
          r: number,
          a = 255;
        if (bpp === 32 || bpp === 24) {
          const s = row + x * (bpp / 8);
          [b, g, r] = [pixels[s], pixels[s + 1], pixels[s + 2]];
          if (bpp === 32) {
            a = pixels[s + 3];
            if (a) anyAlpha = true;
          }
        } else {
          const bit = x * bpp;
          const idx = (pixels[row + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1);
          [b, g, r] = [palette[idx * 4], palette[idx * 4 + 1], palette[idx * 4 + 2]];
        }
        raw.set([r, g, b, a], d);
      }
    }
    // The AND mask marks transparent pixels; 32-bit icons usually carry alpha instead.
    if (bpp !== 32 || !anyAlpha)
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const m = mask[(height - 1 - y) * maskStride + (x >> 3)];
          if (m !== undefined && (m >> (7 - (x & 7))) & 1) raw[(y * width + x) * 4 + 3] = 0;
          else if (bpp === 32) raw[(y * width + x) * 4 + 3] = 255;
        }
    return { raw, width, height };
  }
  return null;
}

async function toPng(body: Buffer): Promise<Icon | null> {
  try {
    const ico = body.length > 6 && body.readUInt16LE(0) === 0 && body.readUInt16LE(2) === 1 ? icoToImage(body) : null;
    const input =
      ico && !Buffer.isBuffer(ico) ? sharp(ico.raw, { raw: { width: ico.width, height: ico.height, channels: 4 } }) : sharp(ico ?? body);
    const meta = await input.metadata();
    if (!meta.width || !meta.height || meta.width < 16) return null;
    const stats = await input.stats();
    const png = await input
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return { png, sourceWidth: meta.width, sourceHeight: meta.height, transparent: !stats.isOpaque };
  } catch {
    return null;
  }
}

/** <link rel="icon|apple-touch-icon"> candidates from the home page, largest first. */
async function declaredIcons(origin: string): Promise<string[]> {
  const page = await get(origin, 'text/html');
  if (!page?.type.includes('html')) return [];
  const html = page.body.toString('utf8').slice(0, 300_000);
  const out: Array<{ href: string; size: number }> = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel=["']?([^"'>]+)/i.exec(tag)?.[1].toLowerCase() ?? '';
    if (!/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) continue;
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!href || href.startsWith('data:')) continue;
    const size = Number(/\bsizes=["']?(\d+)/i.exec(tag)?.[1] ?? (rel.includes('apple') ? 180 : 32));
    try {
      out.push({ href: new URL(href.replaceAll('&amp;', '&'), page.url).href, size });
    } catch {}
  }
  // Prefer icons large enough for the graph on high-density displays.
  const score = (s: number) => (s >= SIZE ? 1000 - Math.abs(s - SIZE) : s);
  return out.sort((a, b) => score(b.size) - score(a.size)).map((o) => o.href);
}

// Outlets whose crawl index lives on another site (rss.app feeds, China
// Times syndication pages, APIs) or whose catalog icon host moved.
const HOME: Record<string, string> = {
  reuters: 'https://www.reuters.com',
  afp: 'https://www.afp.com',
  ap: 'https://apnews.com',
  cnn: 'https://www.cnn.com',
  nhk: 'https://www3.nhk.or.jp',
  kyodo: 'https://english.kyodonews.net',
  yonhap: 'https://en.yna.co.kr',
  xinhua: 'https://english.news.cn',
  dw: 'https://www.dw.com',
  nikkei: 'https://asia.nikkei.com',
  '1111': 'https://www.1111.com.tw',
  asiatatler: 'https://www.tatlerasia.com',
  babyou: 'https://babyou.nownews.com',
  cheers: 'https://www.cheers.com.tw',
  eld: 'https://everylittled.com',
  elle: 'https://www.elle.com/tw',
  hbr: 'https://www.hbrtaiwan.com',
  healthnews: 'https://www.healthnews.com.tw',
  hypesphere: 'https://www.hypesphere.com',
  kocpc: 'https://www.kocpc.com.tw',
  newsmarket: 'https://www.newsmarket.com.tw',
  ngm: 'https://www.natgeomedia.com',
  people: 'https://www.peoplenews.tw',
  rti: 'https://www.rti.org.tw',
  viewpointtaiwan: 'https://www.viewpointtaiwan.com',
  vogue: 'https://www.vogue.com.tw',
  wyc: 'https://dq.yam.com',
};
const AGGREGATORS = /(^|\.)(rss\.app|chinatimes\.com|google\.com|feedburner\.com)$/;

function origins(media: string): string[] {
  if (HOME[media]) {
    const host = new URL(HOME[media]).hostname;
    return [HOME[media], `https://${host}`].filter((v, i, a) => a.indexOf(v) === i);
  }
  const website = newsSources.sources.find((source) => source.media === media)?.websiteUrl;
  if (website) return [...new Set([website, new URL(website).origin])];
  const own = (u: string) => {
    try {
      const h = new URL(u).hostname;
      return !AGGREGATORS.test(h) || ['chinatimes', 'want', 'ctwant'].includes(media);
    } catch {
      return false;
    }
  };
  const urls = [...(sources[media]?.index?.urls ?? []).map((u) => u.url), catalog[media]?.icon ?? ''].filter(own);
  const set = new Set<string>();
  for (const u of urls) {
    try {
      const { hostname } = new URL(u);
      const base = hostname.replace(/^(www|news|m|api|static|cdn|img)\./, '');
      set.add(`https://${hostname}`);
      set.add(`https://www.${base}`);
    } catch {}
  }
  return [...set].slice(0, 4);
}

async function fetchIcon(media: string): Promise<(Icon & { source: string }) | null> {
  // This publisher exposes the generic Blogger favicon, not its own mark.
  // Keep its name fallback until a publisher-specific source is reviewed.
  if (media === 'ccsn0405' && !manifest[media]?.curated) return null;
  // A reviewed mark must not silently regress to a tiny favicon, a generic
  // profile picture, or another brand after a redirect. Keep the local copy
  // if its pinned source fails or starts returning a lower-resolution image.
  const pinned = manifest[media];
  if (pinned?.curated) {
    const response = await get(pinned.source, 'image/*,*/*');
    const icon = response && !response.type.includes('html') ? await toPng(response.body) : null;
    if (!icon || icon.sourceWidth < (pinned.sourceWidth ?? 16) || icon.sourceHeight < (pinned.sourceHeight ?? 16)) return null;
    return { ...icon, source: pinned.source };
  }
  const homes = origins(media);
  const candidates: string[] = [];
  for (const home of homes.slice(0, 2)) candidates.push(...(await declaredIcons(home)));
  if (catalog[media]?.icon) candidates.push(catalog[media].icon.replace(/^http:\/\//, 'https://'));
  candidates.push(...homes.map((h) => new URL('/favicon.ico', h).href));
  for (const url of [...new Set(candidates)]) {
    const r = await get(url, 'image/*,*/*');
    if (!r || r.type.includes('html')) continue;
    const icon = await toPng(r.body);
    if (icon) return { ...icon, source: url };
  }
  // Last resort: Google's favicon cache for the site's domain.
  for (const home of homes) {
    const url = `https://www.google.com/s2/favicons?domain=${new URL(home).hostname}&sz=${SIZE}`;
    const r = await get(url);
    if (!r) continue;
    // Unknown domains get a 16px globe upscaled; skip anything that small.
    const meta = await sharp(r.body)
      .metadata()
      .catch(() => null);
    if (!meta?.width || meta.width < 32) continue;
    const icon = await toPng(r.body);
    if (icon) return { ...icon, source: url };
  }
  return null;
}

const args = process.argv.slice(2);
const all = args.includes('--all');
const only = args.filter((a) => !a.startsWith('--'));
const exists = (m: string) =>
  stat(`${OUT}/${m}.png`).then(
    () => true,
    () => false,
  );
const todo: string[] = [];
// Every catalogued outlet plus crawled outlets the old catalog never listed.
for (const m of [...Object.keys(catalog), ...Object.keys(sources), ...Object.keys(HOME)])
  if ((only.length ? only.includes(m) : all || !(await exists(m))) && !todo.includes(m)) todo.push(m);

const failed: string[] = [];
await mkdir(OUT, { recursive: true });
for (let i = 0; i < todo.length; i += 12) {
  await Promise.all(
    todo.slice(i, i + 12).map(async (m) => {
      const r = await fetchIcon(m);
      if (!r) {
        failed.push(m);
        console.log(`✗ ${m}`);
        return;
      }
      await writeFile(`${OUT}/${m}.png`, r.png);
      manifest[m] = {
        ...manifest[m],
        source: r.source,
        fetchedAt: new Date().toISOString().slice(0, 10),
        sourceWidth: r.sourceWidth,
        sourceHeight: r.sourceHeight,
        transparent: r.transparent,
        revision: createHash('sha256').update(r.png).digest('hex').slice(0, 12),
      };
      console.log(`✓ ${m.padEnd(16)} ${r.source}`);
    }),
  );
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${todo.length - failed.length}/${todo.length} stored${failed.length ? `; no icon: ${failed.join(', ')}` : ''}`);

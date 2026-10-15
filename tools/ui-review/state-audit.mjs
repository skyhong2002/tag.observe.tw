// Anonymous production state audit: measurements for every route plus screenshots
// of empty / error / interaction states. No login, no writes, no third-party hosts.
// usage: node state-audit.mjs <routes.json> <outDir> [--states-only|--metrics-only]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [routesFile, outDir, mode = ''] = process.argv.slice(2);
const origin = 'https://tag.observe.tw';
const routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
const root = path.resolve(outDir);
fs.mkdirSync(root, { mode: 0o700 }); // exclusive
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const save = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2), { mode: 0o600 });

// Empty / missing data: real routes with identifiers that do not exist.
const EMPTY = [
  { id: 'E01', path: '/tag/這個詞不存在測試XQ/' },
  { id: 'E02', path: '/media/not-a-media-xq/' },
  { id: 'E03', path: '/journalist/不存在的記者XQ/' },
  { id: 'E04', path: '/article/999999999/' },
  { id: 'E05', path: '/group/999999/' },
  { id: 'E06', path: '/eve/999999999/' },
  { id: 'E07', path: '/article/?q=zzqxxnotfoundzz' },
  { id: 'E08', path: '/byline/person:不存在XQ/' },
];
// Client-side API failure: every /api/v1 request from the browser answers 503.
const ERROR = [
  { id: 'X01', path: '/' },
  { id: 'X02', path: '/liveboard/' },
  { id: 'X03', path: '/similarity/' },
  { id: 'X04', path: '/tag/柯文哲/' },
  { id: 'X05', path: '/media/traffic/' },
  { id: 'X06', path: '/ranking/' },
];
// Interactions: click the first control matching the selector that is not already current.
const INTERACT = [
  { id: 'I01', path: '/', selector: 'nav[aria-label*="期間"] a:not([aria-current]), [role="tab"]:not([aria-selected="true"])' },
  { id: 'I02', path: '/ranking/', selector: 'th button, th a' },
  { id: 'I03', path: '/media/', selector: '[role="tab"]:not([aria-selected="true"]), button[aria-pressed="false"]' },
  { id: 'I04', path: '/tag/柯文哲/', selector: 'nav[aria-label*="期間"] a:not([aria-current]), button[aria-pressed="false"]' },
  { id: 'I05', path: '/article/', selector: 'nav a:not([aria-current]), button[aria-pressed="false"]' },
  { id: 'I06', path: '/journalist/方承業/', selector: 'nav[aria-label="期間"] a:not([aria-current])' },
  { id: 'I07', path: '/topic/', selector: 'summary' },
  { id: 'I08', path: '/liveboard/setting/', selector: 'input[type="checkbox"], input[type="radio"]:not(:checked)' },
];

// Smallest text, low contrast and overflow, measured in the page.
function measure() {
  // Computed colours come back as lab()/oklch(); let the canvas convert them to sRGB.
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0.5) return c;
    }
    return document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches ? [9, 9, 11] : [255, 255, 255];
  };
  const small = [];
  const low = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !n.textContent.trim()) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (s.visibility === 'hidden' || s.display === 'none' || r.width === 0 || r.height === 0 || Number(s.opacity) < 0.1) continue;
    if (el.closest('[aria-hidden="true"], svg, script, style, noscript')) continue;
    const size = parseFloat(s.fontSize);
    const fg = parse(s.color);
    const L1 = lum(fg), L2 = lum(bgOf(el));
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const text = n.textContent.trim().slice(0, 40);
    if (size < 12) small.push({ size, text });
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) low.push({ size, ratio: Math.round(ratio * 100) / 100, color: s.color, text });
  }
  return {
    height: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    smallTextCount: small.length,
    minFont: small.reduce((m, x) => Math.min(m, x.size), 99),
    tinyText: small.filter((x) => x.size < 11).slice(0, 8),
    lowContrastCount: low.length,
    lowContrast: low.slice(0, 10),
  };
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/home/deck/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  headless: true,
  args: ['--disable-background-networking', '--disable-quic'],
});
const metrics = [], states = [];
async function open(width, theme, failApi = false) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 800 }, isMobile: width === 390, hasTouch: width === 390,
    colorScheme: theme, extraHTTPHeaders: { DNT: '1' }, serviceWorkers: 'block',
  });
  // Only same-origin GET/HEAD leave the browser; Google and every other host are aborted.
  await context.route('**/*', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method())) return route.abort('blockedbyclient');
    if (failApi && url.pathname.startsWith('/api/v1/'))
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"audit: simulated outage"}' });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [], failed = [];
  // Aborted third-party requests (the analytics guard above) are expected noise.
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('ERR_BLOCKED_BY_CLIENT') && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('response', (r) => r.status() >= 400 && new URL(r.url()).origin === origin && failed.push(`${r.status()} ${new URL(r.url()).pathname}`));
  return { context, page, errors, failed };
}
async function settle(page) {
  await page.waitForTimeout(3000);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, 30000); y += 900) { await page.evaluate((n) => scrollTo(0, n), y); await page.waitForTimeout(150); }
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
}
async function shot(page, name) {
  const file = path.join(root, name + '.png');
  await page.screenshot({ path: file, timeout: 120000 }); fs.chmodSync(file, 0o600);
  const full = path.join(root, name + '-full.png');
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: full, fullPage: true, timeout: 120000, ...(height > 12000 && { clip: { x: 0, y: 0, width: page.viewportSize().width, height: 12000 } }) });
  fs.chmodSync(full, 0o600);
  return [{ path: file, sha256: sha(file) }, { path: full, sha256: sha(full) }];
}

try {
  if (mode !== '--states-only') {
    for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
      for (const route of routes) {
        const { context, page, errors, failed } = await open(width, theme);
        try {
          const res = await page.goto(origin + route.path, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await settle(page);
          metrics.push({ ...route, width, theme, status: res?.status(), url: page.url(), ...(await page.evaluate(measure)), consoleErrors: errors, failedResponses: failed });
        } catch (e) {
          metrics.push({ ...route, width, theme, error: String(e.message).slice(0, 200) });
        } finally { await context.close(); }
      }
      save('metrics.json', metrics);
    }
  }
  if (mode !== '--metrics-only') {
    const cases = [...EMPTY.map((c) => ({ ...c, kind: 'empty' })), ...ERROR.map((c) => ({ ...c, kind: 'api-error' })), ...INTERACT.map((c) => ({ ...c, kind: 'interaction' }))];
    for (const width of [1280, 390]) for (const theme of ['light', 'dark']) for (const c of cases) {
      const { context, page, errors, failed } = await open(width, theme, c.kind === 'api-error');
      const row = { id: c.id, kind: c.kind, path: c.path, width, theme };
      try {
        const res = await page.goto(origin + c.path, { waitUntil: 'domcontentloaded', timeout: 90000 });
        row.status = res?.status();
        await settle(page);
        if (c.kind === 'interaction') {
          const target = page.locator(c.selector).first();
          row.control = (await target.count()) ? (await target.evaluate((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 40))) : null;
          if (row.control !== null) {
            const before = page.url();
            await target.scrollIntoViewIfNeeded(); await target.click({ timeout: 10000 });
            await page.waitForTimeout(3500);
            row.navigated = page.url() !== before;
          }
        }
        row.url = page.url();
        row.measure = await page.evaluate(measure);
        row.shots = await shot(page, `${c.id}-${width}-${theme}`);
      } catch (e) {
        row.error = String(e.message).slice(0, 200);
      } finally {
        row.consoleErrors = errors; row.failedResponses = failed;
        await context.close();
      }
      states.push(row); save('states.json', states);
    }
  }
} finally {
  await browser.close();
  save('summary.json', { endedUtc: new Date().toISOString(), metrics: metrics.length, states: states.length, toolSha256: sha(new URL(import.meta.url)) });
}

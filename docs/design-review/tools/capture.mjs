// Photograph every state in states.mjs at both sizes against one checkout.
//   node capture.mjs site WEB_DIR OUT_DIR [id-filter]
//   node capture.mjs references OUT_DIR
// Needs fixture-api.mjs on :18560/:18561 and web.sh (SNAPSHOT_T0 set). Run
// `gate.sh capture` first. One browser; it pauses whenever load1 goes over
// GATE_LOAD_STOP and resumes at GATE_LOAD_OK or below (same defaults as gate.sh).
// Playwright: PLAYWRIGHT_MODULE, default ~/.cache/tag-hc/pw (npm i playwright@1.63.0
// there, then npx playwright install chromium). Only loopback, plus image files for article
// thumbnails and logos, leaves the browser; GA/GTM and every other request are aborted.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { cpus, homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ORDER, REFERENCES, SIZES, STATES } from './states.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? join(homedir(), '.cache/tag-hc/pw/node_modules/playwright/index.mjs'));
const tools = dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://127.0.0.1:18561';
const API = 'http://127.0.0.1:18560';
const T0 = Date.parse(process.env.SNAPSHOT_T0 ?? '');
const startedAt = Date.now();
const [mode, ...rest] = process.argv.slice(2);

const CORES = cpus().length;
const LOAD_STOP = Number(process.env.GATE_LOAD_STOP ?? (CORES >= 16 ? 12 : CORES));
const LOAD_OK = Number(process.env.GATE_LOAD_OK ?? (CORES >= 16 ? 10 : CORES * 0.75));
const load1 = () => Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
async function hostCheck() {
  if (load1() <= LOAD_STOP) return;
  console.log(`[pause] load1 ${load1()} > ${LOAD_STOP}`);
  while (load1() > LOAD_OK) await new Promise((r) => setTimeout(r, 20000));
  console.log(`[resume] load1 ${load1()}`);
}

const browser = await chromium.launch({ args: ['--disable-quic', '--disable-gpu', '--disable-dev-shm-usage'] });

async function newContext(size, { theme = 'light', locale = 'zh-TW', allowAll = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.deviceScaleFactor,
    isMobile: !!size.isMobile,
    hasTouch: !!size.hasTouch,
    colorScheme: theme,
    locale,
    timezoneId: 'Asia/Taipei',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    extraHTTPHeaders: { DNT: '1' },
  });
  await context.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    if (/googletagmanager|google-analytics|doubleclick|analytics\.google/.test(url)) return route.abort();
    if (allowAll || /^https?:\/\/127\.0\.0\.1[:/]/.test(url) || request.resourceType() === 'image') return route.continue();
    return route.abort();
  });
  return context;
}

async function settle(page, maxHeight) {
  // A client-side redirect or router replace can swap the document mid-walk; wait and walk the new one.
  for (let attempt = 0; ; attempt++) {
    try {
      return await walk(page, maxHeight);
    } catch (error) {
      if (attempt >= 2 || !/context was destroyed|navigation/i.test(error.message)) throw error;
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
}

async function walk(page, maxHeight) {
  const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), maxHeight + 900);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() =>
    Promise.all([...document.images].filter((img) => !img.complete).map((img) => new Promise((done) => { img.onload = img.onerror = done; setTimeout(done, 4000); }))),
  );
  await page.waitForTimeout(700);
}

async function shoot(page, file, size, { viewportOnly } = {}) {
  if (viewportOnly) return page.screenshot({ path: file });
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  const height = Math.max(size.height, Math.min(full, size.maxHeight));
  return page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: size.width, height } });
}

const fixture = (params) => fetch(`${API}/__fixture?${new URLSearchParams(params)}`).then((r) => r.json());

if (mode === 'site') {
  const [webDir, out, filter] = rest;
  mkdirSync(out, { recursive: true });
  if (!Number.isFinite(T0)) throw Error('SNAPSHOT_T0 is required');
  const states = STATES.filter((s) => !filter || new RegExp(filter).test(s.id));
  for (const data of DATA_ORDER) {
    const group = states.filter((s) => (s.data ?? 'normal') === data);
    if (!group.length) continue;
    // A fresh server and an empty fetch cache for every data mode.
    await fixture({ data: 'normal', session: 'out' });
    execFileSync(join(tools, 'web.sh'), ['start', webDir], { stdio: 'inherit' });
    await fixture({ data });
    for (const [sizeName, size] of Object.entries(SIZES)) {
      for (const state of group) {
        const file = `${out}/${state.id}_${sizeName}.png`;
        if (!process.env.RESHOOT && existsSync(file)) continue; // resume: keep shots already taken
        await hostCheck();
        await fixture({ session: state.session ?? 'out' });
        const context = await newContext(size, { theme: state.theme ?? 'light' });
        await context.addInitScript((theme) => localStorage.setItem('theme', theme), state.theme ?? 'light');
        const page = await context.newPage();
        await page.clock.install({ time: T0 + (Date.now() - startedAt) });
        const url = FRONT + state.path;
        let status = null;
        if (state.warm) {
          // ISR pages answer the first request from the build; ask once, give revalidation time.
          await fetch(url).then((r) => r.text()).catch(() => {});
          await new Promise((r) => setTimeout(r, 4000));
        }
        if (data === 'loading') {
          page.goto(url).catch(() => {});
          await page.waitForTimeout(3000);
        } else {
          const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch((e) => ({ status: () => `ERR ${e.message.split('\n')[0]}` }));
          status = response?.status?.();
          await page.waitForTimeout(600);
          for (const selector of state.click ?? []) {
            await page.locator(selector).first().click({ timeout: 5000 }).catch((e) => console.warn(state.id, 'click failed', selector, e.message.split('\n')[0]));
            await page.waitForTimeout(400);
          }
          await settle(page, size.maxHeight);
        }
        await shoot(page, file, size, state);
        console.log(JSON.stringify({ file, status, load1: load1() }));
        await context.close();
      }
    }
  }
  await fixture({ data: 'normal', session: 'out' });
  const misses = await fetch(`${API}/__fixture/misses`).then((r) => r.json());
  if (misses.length) console.log('snapshot misses:', misses);
} else if (mode === 'references') {
  const [out, filter] = rest;
  mkdirSync(out, { recursive: true });
  for (const [sizeName, size] of Object.entries(SIZES)) {
    for (const ref of REFERENCES.filter((r) => !filter || r.id.includes(filter))) {
      await hostCheck();
      const context = await newContext(size, { locale: ref.locale ?? 'en-US', allowAll: true });
      const page = await context.newPage();
      await page.goto(ref.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(7000);
      for (const name of ['Reject All', 'Reject all', 'Accept All', 'Accept all', 'Accept', 'Got it', '全部拒絕', '拒絕全部']) {
        const button = page.getByRole('button', { name, exact: true });
        if (await button.count().catch(() => 0)) { await button.first().click({ timeout: 2000 }).catch(() => {}); break; }
      }
      await settle(page, size.maxHeight);
      const file = `${out}/${ref.id}_${sizeName}.png`;
      await shoot(page, file, size, {});
      console.log(file);
      await context.close();
    }
  }
}
await browser.close();

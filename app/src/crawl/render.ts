import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'playwright';
import { type FetchResult, fetchText, isPublicAddress } from './fetch.ts';

// Headless rendering for outlets whose articles only appear after scripts run
// (generated crawl rules with render: true). Every page first goes through
// fetchText, which applies the public-address pin, redirects and size limit;
// the browser then renders the same page. Images, media and fonts are
// skipped, every subrequest host is checked public, and the main frame may
// not navigate to another site. Chromium runs in its own systemd scope
// (render-scope.sh) so its memory stays off the worker's budget.

const require = createRequire(import.meta.url);
const scopeWrapper = fileURLToPath(new URL('./render-scope.sh', import.meta.url));
const PAGE_MS = 20000;
const SETTLE_MS = 4000;
const IDLE_CLOSE_MS = 60000;
const MAX_BYTES = 8 * 1024 * 1024;

/** Playwright's headless shell for the installed playwright-core (or TAG_RENDER_CHROME). */
function headlessShell(): string | null {
  if (process.env.TAG_RENDER_CHROME) return existsSync(process.env.TAG_RENDER_CHROME) ? process.env.TAG_RENDER_CHROME : null;
  try {
    const core = dirname(require.resolve('playwright-core/package.json'));
    const browsers = JSON.parse(readFileSync(join(core, 'browsers.json'), 'utf8')).browsers;
    const revision = browsers.find((b: { name: string }) => b.name === 'chromium-headless-shell')?.revision;
    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache/ms-playwright');
    const path = join(cache, `chromium_headless_shell-${revision}`, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    return revision && existsSync(path) ? path : null;
  } catch {
    return null;
  }
}
let available: boolean | null = null;
let scoped = false;
/** Rendering is optional: without the browser, render rules cannot validate and pages are read raw. */
export function renderAvailable() {
  if (available === null) {
    available = process.env.TAG_RENDER !== '0' && !!headlessShell();
    scoped =
      available &&
      spawnSync('systemd-run', ['--user', '--scope', '--quiet', '--collect', '--', 'true'], { stdio: 'ignore', timeout: 5000 }).status ===
        0;
  }
  return available;
}

let browser: Promise<Browser> | null = null;
let idle: NodeJS.Timeout | null = null;
let queue: Promise<unknown> = Promise.resolve();
function launch() {
  browser ??= import('playwright').then(({ chromium }) =>
    chromium
      .launch({
        executablePath: scoped ? scopeWrapper : (headlessShell() as string),
        env: { ...process.env, TAG_RENDER_CHROME: headlessShell() as string },
        headless: true,
        chromiumSandbox: true,
        timeout: 15000,
      })
      .then((b) => {
        b.on('disconnected', () => {
          browser = null;
        });
        return b;
      }),
  );
  browser.catch(() => {
    browser = null;
  });
  return browser;
}
export async function closeRenderer() {
  if (idle) clearTimeout(idle);
  const open = browser;
  browser = null;
  await (await open?.catch(() => null))?.close().catch(() => {});
}

const hosts = new Map<string, boolean>();
async function publicHost(hostname: string) {
  const known = hosts.get(hostname);
  if (known !== undefined) return known;
  let ok = false;
  try {
    const addresses = await lookup(hostname, { all: true });
    ok = addresses.length > 0 && addresses.every((a) => isPublicAddress(a.address));
  } catch {
    ok = false;
  }
  if (hosts.size > 2000) hosts.clear();
  hosts.set(hostname, ok);
  return ok;
}
const siteOf = (host: string) => host.toLowerCase().replace(/^www\./, '');

/** Renders one page fetchText already returned; renders run one at a time. */
function renderVetted(url: string, userAgent?: string): Promise<{ url: string; html: string }> {
  const run = queue.then(async () => {
    if (idle) clearTimeout(idle);
    const b = await launch();
    const context = await b.newContext({ userAgent, serviceWorkers: 'block', acceptDownloads: false });
    const site = siteOf(new URL(url).hostname);
    try {
      const page = await context.newPage();
      await context.route('**/*', async (route) => {
        const request = route.request();
        if (['image', 'media', 'font'].includes(request.resourceType())) return route.abort();
        let target: URL;
        try {
          target = new URL(request.url());
        } catch {
          return route.abort();
        }
        if (target.protocol === 'data:' || target.protocol === 'blob:') return route.continue();
        if (!/^https?:$/.test(target.protocol) || !(await publicHost(target.hostname.replace(/^\[|\]$/g, ''))))
          return route.abort('blockedbyclient');
        if (request.isNavigationRequest() && request.frame() === page.mainFrame() && siteOf(target.hostname) !== site)
          return route.abort('blockedbyclient');
        return route.continue();
      });
      await page.goto(url, { waitUntil: 'load', timeout: PAGE_MS });
      await page.waitForLoadState('networkidle', { timeout: SETTLE_MS }).catch(() => {});
      const html = await page.content();
      if (Buffer.byteLength(html) > MAX_BYTES) throw Error('rendered page too large');
      return { url: page.url() || url, html };
    } finally {
      await context.close().catch(() => {});
      idle = setTimeout(() => void closeRenderer(), IDLE_CLOSE_MS);
      idle.unref();
    }
  });
  queue = run.catch(() => {});
  return run;
}

const XML = /^\s*(?:<\?xml|<(?:rss|feed|urlset|sitemapindex|rdf:RDF)\b)/;
/** A fetch for rendering sources: the vetted raw fetch, then the same HTML page rendered. Feeds and errors stay raw. */
export function renderingFetch(fetch: typeof fetchText = fetchText): typeof fetchText {
  return async (url, options = {}): Promise<FetchResult> => {
    const raw = await fetch(url, options);
    if (raw.status >= 400 || XML.test(raw.body.slice(0, 500)) || !renderAvailable()) return raw;
    const started = performance.now();
    const page = await renderVetted(raw.url || url, options.userAgent);
    return { ...raw, url: page.url, body: page.html, ms: raw.ms + Math.round(performance.now() - started) };
  };
}

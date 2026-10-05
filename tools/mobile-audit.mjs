import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const vitals = await readFile('web/node_modules/web-vitals/dist/web-vitals.iife.js', 'utf8');
const base = process.argv[2] ?? 'https://tag.observe.tw';
const name = process.argv[3] ?? 'before';
const results = [];
for (const path of process.env.AUDIT_PATHS
  ? JSON.parse(process.env.AUDIT_PATHS)
  : ['/', '/ranking/', '/eve/897/', '/tag/%E8%94%A1%E8%8B%B1%E6%96%87/']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  // Synthetic audits must not become production analytics traffic.
  await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript({
    content:
      vitals +
      ';window.__vitals={}; for(const f of [webVitals.onLCP,webVitals.onCLS,webVitals.onINP])f(m=>window.__vitals[m.name]={value:m.value,rating:m.rating},{reportAllChanges:true});window.__lcp=[];new PerformanceObserver(l=>window.__lcp.push(...l.getEntries().map(e=>({time:e.startTime,url:e.url,tag:e.element?.tagName,text:e.element?.textContent?.slice(0,80)})))).observe({type:"largest-contentful-paint",buffered:true});',
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
    connectionType: 'cellular4g',
  });
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(8000);
  const initial = await page.evaluate(() => ({
    vitals: window.__vitals,
    lcp: window.__lcp.at(-1),
    resources: performance
      .getEntriesByType('resource')
      .filter((e) => ['script', 'img'].includes(e.initiatorType))
      .map((e) => ({ url: e.name, bytes: e.transferSize, duration: e.duration })),
    nav: performance
      .getEntriesByType('navigation')
      .map((e) => ({ ttfb: e.responseStart, dom: e.domContentLoadedEventEnd, bytes: e.transferSize })),
    canvases: document.querySelectorAll('canvas').length,
  }));
  await page.getByRole('button', { name: '切換淺色／深色模式' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '切換淺色／深色模式' }).click();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(1500);
  const final = await page.evaluate(() => ({
    vitals: window.__vitals,
    canvases: document.querySelectorAll('canvas').length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  const result = { path, initial, final, errors };
  results.push(result);
  console.log(
    JSON.stringify({
      path,
      initial: initial.vitals,
      final: final.vitals,
      lcp: initial.lcp,
      canvases: [initial.canvases, final.canvases],
      jsBytes: initial.resources.filter((r) => r.url.includes('.js')).reduce((n, r) => n + r.bytes, 0),
      errors,
    }),
  );
  await context.close();
}
await writeFile('/tmp/tag-mobile-' + name + '.json', JSON.stringify(results, null, 2));
await browser.close();

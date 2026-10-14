// Small, anonymous production screenshot batch. No build, DB, login, or fixture.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [inputFile, outputDir] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const root = path.resolve(outputDir);
const origin = input.origin ?? 'https://tag.observe.tw';
if (!['https://tag.observe.tw', 'http://127.0.0.1:18334'].includes(origin)) throw Error('Unreviewed origin');
const candidate = origin !== 'https://tag.observe.tw';
const google = (host) => /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com|googleadservices\.com|doubleclick\.net)$/.test(host);
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2), { mode: 0o600 });
const requests = [], transport = [], shots = [], pages = [], sockets = new Set();
let context, completed = false, runError;
if (!input.webSha || !input.apiSha || !input.buildId || !Array.isArray(input.routes)) throw Error('Missing version/routes');
for (const row of input.routes) {
  if (!/^\d{3}$/.test(row.id) || new URL(row.path, origin).origin !== origin || !row.path.startsWith('/') || row.path.startsWith('//')) throw Error('Invalid route');
}
fs.mkdirSync(root, { mode: 0o700 }); // exclusive; never overwrite a previous batch
write('input.json', input);

// This proxy exists BEFORE Chromium: every external host, including Google,
// is denied at transport level. TLS is preserved for the actual public host.
const proxy = http.createServer((req, res) => {
  // Candidate transport uses the same prelaunch barrier, with one fixed
  // loopback frontdoor. It never grants arbitrary upstreams or credentials.
  if (candidate) {
    let url; try { url = new URL(req.url); } catch { /* deny below */ }
    if (url?.origin === origin && !url.username && !url.password && ['GET', 'HEAD'].includes(req.method)) {
      transport.push({ utc: new Date().toISOString(), event: 'admitted-candidate-http', method: req.method });
      const headers = { ...req.headers, host: '127.0.0.1:18334', dnt: '1' };
      for (const name of Object.keys(headers)) if (/cookie|authorization|token|api[-_]key|proxy-/i.test(name)) delete headers[name];
      const up = http.request(url, { method: req.method, headers }, (incoming) => {
        const failed = () => {
          transport.push({ utc: new Date().toISOString(), event: 'candidate-response-failed' });
          incoming.destroy(); up.destroy(); res.destroy();
        };
        incoming.on('error', failed); incoming.on('aborted', failed);
        try {
          const out = { ...incoming.headers }; delete out['set-cookie'];
          res.writeHead(incoming.statusCode, out); incoming.pipe(res);
        } catch { failed(); }
      });
      sockets.add(up); up.on('close', () => sockets.delete(up));
      up.setTimeout(120000, () => up.destroy());
      up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      res.on('close', () => up.destroy()); req.resume(); up.end(); return;
    }
  }
  transport.push({ utc: new Date().toISOString(), event: 'denied-http', method: req.method });
  req.resume(); res.writeHead(403); res.end();
});
proxy.on('connect', (req, client, head) => {
  const admitted = !candidate && req.url === 'tag.observe.tw:443';
  transport.push({ utc: new Date().toISOString(), event: admitted ? 'admitted-connect' : 'denied-connect', target: req.url });
  if (!admitted) { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const up = net.connect({ host: 'tag.observe.tw', port: 443 }, () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) up.write(head);
    client.pipe(up); up.pipe(client);
  });
  sockets.add(up); sockets.add(client);
  for (const socket of [up, client]) {
    socket.setTimeout(120000, () => socket.destroy());
    socket.on('close', () => { sockets.delete(socket); up.destroy(); client.destroy(); });
    socket.on('error', () => { up.destroy(); client.destroy(); });
  }
});
proxy.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
await new Promise((ok, no) => { proxy.once('error', no); proxy.listen(0, '127.0.0.1', ok); });
const proxyUrl = 'http://127.0.0.1:' + proxy.address().port;
write('started.json', { pid: process.pid, proxy: proxyUrl, utc: new Date().toISOString(), toolSha256: sha(new URL(import.meta.url)) });

try {
  for (const width of [1280, 390]) {
    const profile = path.join(root, 'profile-' + width);
    fs.mkdirSync(path.join(profile, 'Default'), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), '{"enable_do_not_track":true}', { mode: 0o600 });
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/home/deck/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
      headless: true, viewport: { width, height: width === 390 ? 844 : 800 },
      isMobile: width === 390, hasTouch: width === 390, extraHTTPHeaders: { DNT: '1' }, serviceWorkers: 'block',
      proxy: { server: proxyUrl }, recordHar: { path: path.join(root, `network-${width}.har`), content: 'omit' },
      args: ['--proxy-bypass-list=<-loopback>', '--disable-background-networking', '--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--disk-cache-size=1', '--disable-gpu-shader-disk-cache'],
    });
    // Registered before any page/navigation, complements the prelaunch proxy.
    await context.route('**/*', (route) => {
      const req = route.request();
      return new URL(req.url()).origin === origin && ['GET', 'HEAD'].includes(req.method()) ? route.continue() : route.abort('blockedbyclient');
    });
    context.on('request', (req) => requests.push({ utc: new Date().toISOString(), width, url: req.url(), method: req.method(), dnt: req.headers().dnt ?? null, google: google(new URL(req.url()).hostname) }));
    for (const route of input.routes) {
      const page = await context.newPage();
      try {
        await page.emulateMedia({ colorScheme: 'light' });
        const response = await page.goto(origin + route.path, { waitUntil: 'domcontentloaded', timeout: 120000 });
        if (response.status() !== (route.expectedStatus ?? 200)) throw Error('Unexpected route status ' + route.id + ': ' + response.status());
        await page.waitForTimeout(Math.max(1500, Math.min(30000, Number(input.settleMs) || 1500)));
        const html = await page.content();
        if (!html.includes(input.buildId)) throw Error('Different BUILD_ID on ' + route.id);
        // Scroll in measured steps to load images, then return to the first fold.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 650) { await page.evaluate((n) => scrollTo(0, n), y); await page.waitForTimeout(90); }
        await page.waitForTimeout(1000); await page.evaluate(() => scrollTo(0, 0));
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme }); await page.waitForTimeout(250);
          const state = await page.evaluate(() => ({ dnt: navigator.doNotTrack, gpc: navigator.globalPrivacyControl ?? null, webdriver: navigator.webdriver,
            theme: document.documentElement.dataset.theme ?? null, width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight, title: document.title,
            headings: [...document.querySelectorAll('h1,h2')].map((h) => h.textContent),
            googleScripts: [...document.scripts].filter((s) => /google-analytics|googletagmanager/.test(s.src)).length,
          }));
          if (state.dnt !== '1' || state.googleScripts) throw Error('Privacy state mismatch');
          pages.push({ id: route.id, path: route.path, url: page.url(), width, theme, status: response.status(), utc: new Date().toISOString(), ...state });
          for (const kind of ['viewport', 'full']) {
            const filename = `${route.id}-${width}-${theme}-${kind}.png`, file = path.join(root, filename);
            await page.screenshot({ path: file, fullPage: kind === 'full' }); fs.chmodSync(file, 0o600);
            shots.push({ id: route.id, url: page.url(), width, viewportHeight: width === 390 ? 844 : 800, theme, kind, path: file, sha256: sha(file), utc: new Date().toISOString() });
          }
        }
      } finally { await page.close(); }
    }
    await context.close(); context = null;
  }
  completed = true;
} catch (error) {
  runError = error;
} finally {
  const cleanupErrors = [];
  if (context) try { await context.close(); } catch { cleanupErrors.push('context-close'); }
  for (const socket of sockets) try { socket.destroy(); } catch { cleanupErrors.push('socket-close'); }
  try { await new Promise((ok, no) => proxy.close((error) => error ? no(error) : ok())); } catch { cleanupErrors.push('proxy-close'); }
  completed = completed && cleanupErrors.length === 0;
  write('requests.json', requests); write('transport.json', transport);
  write('manifest.json', { ...input, surface: candidate ? 'candidate-loopback-anonymous' : 'production-public-HTTPS', candidate, tool: 'Playwright, native DNT profile, prelaunch host-only transport proxy', completed,
    shots, pages, googleRequests: requests.filter((r) => r.google).length, googleOutgoing: transport.filter((r) => r.event === 'admitted-connect' && r.target !== 'tag.observe.tw:443').length,
    transportClosed: !cleanupErrors.includes('proxy-close'), cleanupErrors, endedUtc: new Date().toISOString(),
    limitations: `Anonymous ${candidate ? 'loopback candidate' : 'actual production'} states only. Google counts are browser HAR/request and proxy host-admission evidence, not TLS packet inspection. No auth account, GA receipt or complete dynamic-state coverage claimed.` });
  console.log(JSON.stringify({ completed, shots: shots.length, pages: pages.length, googleRequests: requests.filter((r) => r.google).length, googleOutgoing: 0 }));
}
if (runError) throw runError;
if (!completed) throw Error('Capture cleanup failed');

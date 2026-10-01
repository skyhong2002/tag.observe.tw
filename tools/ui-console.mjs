import { chromium } from 'playwright';

const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
const p = await b.newPage();
p.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) console.log(m.type(), m.text().slice(0, 400));
});
p.on('pageerror', (e) => console.log('pageerror', (e.stack ?? String(e)).slice(0, 1200)));
p.on('response', (r) => {
  if (r.status() >= 400) console.log('http', r.status(), r.url());
});
await p.goto(process.argv[2] ?? 'http://127.0.0.1:18132/', { waitUntil: 'networkidle' });
await b.close();

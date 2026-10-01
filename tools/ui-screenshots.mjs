import { chromium } from 'playwright';

const base = process.env.UI_BASE ?? 'http://127.0.0.1:18132';
const pages = [
  ['/', 'home'],
  ['/tag/%E5%B7%9D%E6%99%AE/', 'tag'],
  ['/event/', 'event'],
  ['/topic/', 'topic'],
];
const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
for (const [name, vp] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const p = await b.newPage({ viewport: vp });
  for (const [path, file] of pages) {
    await p.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await p.screenshot({ path: `artifacts/ui/${file}-${name}.png` });
  }
  await p.close();
}
await b.close();
console.log('ok');

// Exercise a candidate release's installed dependencies before changing systemd:
// the gateway must start without a database, serve health/metrics locally,
// redirect legacy URLs, 410 the legacy API, and never serve source files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await realpath(process.argv[2]);
// The graph bundles the icon manifest at build time. The standalone server
// must ship the matching PNGs, not just a healthy gateway and an older UI.
const icons = JSON.parse(await readFile(join(directory, 'app/data/favicon-local.json'), 'utf8'));
assert.ok(Object.keys(icons).length > 0, 'Media icon manifest must not be empty');
await Promise.all(
  Object.entries(icons).map(async ([media, entry]) => {
    assert.match(media, /^[a-z0-9_-]+$/);
    const png = await readFile(join(directory, 'web/.next/standalone/web/public/favicons', `${media}.png`));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${media}: invalid PNG`);
    if (entry.revision) {
      assert.equal(createHash('sha256').update(png).digest('hex').slice(0, 12), entry.revision, `${media}: stale icon in standalone build`);
    }
  }),
);
console.log(`Candidate media assets passed: ${Object.keys(icons).length} packaged icons verified.`);
const { buildApp } = await import(pathToFileURL(join(directory, 'app/src/app.js')));
const app = await buildApp({ uiOrigin: 'http://127.0.0.1:1' });
try {
  const health = await app.inject('/_migration/health');
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, 'ok');
  assert.equal((await app.inject('/metrics')).statusCode, 200);
  assert.equal((await app.inject({ url: '/metrics', headers: { 'cf-connecting-ip': '203.0.113.1' } })).statusCode, 404);
  const r = await app.inject('/tag/abc/news/');
  assert.equal(r.statusCode, 301);
  assert.equal(r.headers.location, '/tag/abc/');
  assert.equal((await app.inject('/api/tag.php')).statusCode, 410);
  // UI deliberately unavailable: a source path must not be read from disk.
  const src = await app.inject('/app/src/server.js');
  assert.equal(src.statusCode, 503);
  assert.equal(src.body, 'UI temporarily unavailable\n');
} finally {
  await app.close();
}
console.log('Candidate smoke passed: gateway starts, legacy URLs redirect, legacy API is gone, sources are not served.');

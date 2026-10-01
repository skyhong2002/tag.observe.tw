// Exercise a candidate release's installed dependencies before changing systemd:
// the gateway must start without a database, serve health/metrics locally,
// redirect legacy URLs, 410 the legacy API, and never serve source files.
import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await realpath(process.argv[2]);
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

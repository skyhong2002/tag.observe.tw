const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createCandidateCaptureProxy } = require('./candidate-capture-proxy.cjs');

function request(proxy, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(proxy, { path: target, ...options }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('connect', (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode });
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode });
    });
    req.on('error', reject);
    req.end();
  });
}

test('single-origin proxy forwards only GET/HEAD and leaves redirects to the browser', async (t) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, method: req.method, headers: req.headers });
    if (req.url === '/redirect') {
      res.writeHead(302, { location: 'https://www.google-analytics.com/' });
      res.end();
    } else res.end('candidate');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const logs = [];
  const proxy = await createCandidateCaptureProxy(origin, { log: (entry) => logs.push(entry) });
  t.after(() => proxy.close());
  const result = await request(proxy.address, `${origin}/ok?secret=hidden`, {
    headers: {
      host: 'wrong.example',
      'proxy-authorization': 'secret',
      connection: 'x-secret',
      'x-secret': 'hidden',
      cookie: 'private=secret',
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body, 'candidate');
  assert.equal(seen[0].headers.host, new URL(origin).host);
  assert.equal(seen[0].headers['proxy-authorization'], undefined);
  assert.equal(seen[0].headers['x-secret'], undefined);
  assert.equal((await request(proxy.address, `${origin}/ok`, { method: 'HEAD' })).body, '');
  const redirected = await request(proxy.address, `${origin}/redirect`);
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.location, 'https://www.google-analytics.com/');
  const count = seen.length;
  for (const target of [
    'https://www.google-analytics.com/',
    'http://www.googletagmanager.com/',
    origin.replace('127.0.0.1', '127.1'),
    origin.replace('http://', 'http://user:pass@'),
    '/relative',
  ]) {
    assert.equal((await request(proxy.address, target)).status, 403);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'CONNECT']) {
    assert.equal((await request(proxy.address, `${origin}/ok`, { method })).status, 403);
  }
  assert.equal((await request(proxy.address, `${origin}/ok`, { headers: { connection: 'upgrade', upgrade: 'websocket' } })).status, 403);
  assert.equal(seen.length, count);
  assert.equal(JSON.stringify(logs).includes('secret'), false);
  assert.equal(JSON.stringify(logs).includes('google'), false);
});

test('candidate configuration rejects credentials, non-HTTP, paths and host spelling variants', async () => {
  for (const origin of [
    'https://127.0.0.1:1',
    'http://user@127.0.0.1:1',
    'http://127.0.0.1:1/path',
    'http://127.0.0.1:1/',
    'http://127.1:1',
    'http://127.0.0.1:1?x=1',
  ]) {
    await assert.rejects(createCandidateCaptureProxy(origin));
  }
});

test('logger failure closes the gate before forwarding and cleanup is idempotent', async (t) => {
  let requests = 0;
  const candidate = http.createServer((req, res) => {
    requests++;
    res.end('must not reach');
  });
  await new Promise((resolve) => candidate.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => candidate.close(resolve)));
  const origin = `http://127.0.0.1:${candidate.address().port}`;
  for (const method of ['GET', 'CONNECT']) {
    const events = [];
    const proxy = await createCandidateCaptureProxy(origin, {
      log(entry) {
        events.push(entry.event);
        throw new Error('audit unavailable');
      },
    });
    t.after(() => proxy.close());
    await assert.rejects(request(proxy.address, `${origin}/private`, { method }));
    assert.equal(proxy.failed, true);
    assert.deepEqual(events, [method === 'GET' ? 'admitted' : 'denied']);
    await assert.rejects(request(proxy.address, `${origin}/again`));
    assert.equal(events.length, 1);
    assert.equal(requests, 0);
    await Promise.all([proxy.close(), proxy.close()]);
    assert.equal(proxy.closed, true);
    await proxy.close();
  }
});

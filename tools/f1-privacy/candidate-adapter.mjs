import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CANDIDATE } from './barrier.mjs';

const credentialNames = ['cookie', 'authorization', 'x-service-token', 'x-api-key'];
function environment(bytes) {
  return Object.fromEntries(
    String(bytes)
      .split('\0')
      .filter(Boolean)
      .map((entry) => {
        const at = entry.indexOf('=');
        return [entry.slice(0, at), entry.slice(at + 1)];
      }),
  );
}
export function validateConfig(c) {
  assert.equal(c.app, CANDIDATE.app);
  assert.equal(c.buildId, CANDIDATE.buildId);
  assert.equal(c.database, 'tag_f1_semantic_test');
  assert.deepEqual(c.actors, [701, 702, 703]);
  assert.match(c.releaseRoot, /^\/[a-zA-Z0-9_./-]+$/);
  assert.ok(!c.releaseRoot.includes('..'));
  for (const key of ['gatewayOrigin', 'nextOrigin']) {
    const u = new URL(c[key]);
    assert.equal(u.protocol, 'http:');
    assert.equal(u.hostname, '127.0.0.1');
    assert.equal(u.pathname, '/');
    assert.equal(u.search + u.hash + u.username + u.password, '');
    assert.ok(Number(u.port) > 1024 && ![18130, 18131, 18132, 18134, 18306].includes(Number(u.port)));
    assert.equal(c[key], u.origin);
  }
  assert.notEqual(c.gatewayOrigin, c.nextOrigin);
  for (const key of ['apiPid', 'nextPid']) assert.ok(Number.isSafeInteger(c[key]) && c[key] > 1);
  assert.ok(c.surfaces.length > 0 && c.surfaces.length <= 8);
  for (const s of c.surfaces) {
    assert.ok(['json', 'html', 'rsc'].includes(s.kind));
    assert.ok(
      s.path === '/' ||
        /^\/tag\/[A-Za-z0-9%_-]+\/$/.test(s.path) ||
        /^\/api\/v1\/tags\/[A-Za-z0-9%_-]+\/(relations|visual|person)$/.test(s.path),
    );
    assert.ok(Array.isArray(s.present) && s.present.length > 0);
    assert.ok(Array.isArray(s.absent) && s.absent.length > 0);
    for (const n of [...s.present, ...s.absent]) assert.ok(typeof n === 'string' && n.length > 0 && n.length <= 200);
  }
  return c;
}
/** Read-only adapter. fs/proc and fetch are provided by the approved bootstrap. */
export function candidateAdapter(config, io) {
  const c = validateConfig(config);
  async function identity() {
    const releaseRoot = await io.realpath(c.releaseRoot);
    assert.equal(releaseRoot, c.releaseRoot);
    const apiCwd = await io.realpath(`/proc/${c.apiPid}/cwd`);
    const nextCwd = await io.realpath(`/proc/${c.nextPid}/cwd`);
    assert.equal(apiCwd, releaseRoot);
    assert.equal(nextCwd, `${releaseRoot}/web/.next/standalone/web`);
    assert.equal((await io.readFile(`${releaseRoot}/COMMIT`)).trim(), CANDIDATE.app);
    for (const path of ['web/.next/BUILD_ID', 'web/.next/standalone/web/.next/BUILD_ID'])
      assert.equal((await io.readFile(`${releaseRoot}/${path}`)).trim(), CANDIDATE.buildId);
    const api = environment(await io.readFile(`/proc/${c.apiPid}/environ`));
    const next = environment(await io.readFile(`/proc/${c.nextPid}/environ`));
    const db = new URL(api.TAG_DB_URL);
    assert.equal(db.protocol, 'mysql:');
    assert.equal(db.hostname, '127.0.0.1');
    assert.equal(db.port, '18306');
    assert.equal(db.pathname, '/tag_f1_semantic_test');
    assert.equal(api.PORT, new URL(c.gatewayOrigin).port);
    assert.equal(api.UI_ORIGIN, c.nextOrigin);
    assert.equal(next.PORT, new URL(c.nextOrigin).port);
    assert.equal(next.TAG_API_ORIGIN, c.gatewayOrigin);
    return {
      ...CANDIDATE,
      releaseRoot,
      apiPid: c.apiPid,
      nextPid: c.nextPid,
      database: c.database,
      actorsRequested: c.actors,
      actorsExistenceVerified: false,
      isolation: 'proc-environment-only; DB fixture ownership verification required',
      barrierPassed: false,
    };
  }
  async function read(surface, credentials = {}) {
    const headers = { accept: surface.kind === 'json' ? 'application/json' : 'text/html', ...credentials };
    if (surface.kind === 'rsc') headers.rsc = '1';
    const response = await io.fetch(c.gatewayOrigin + surface.path, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    const type = response.headers.get('content-type') ?? '';
    assert.match(type, surface.kind === 'json' ? /application\/json/ : surface.kind === 'rsc' ? /text\/x-component/ : /text\/html/);
    const declared = Number(response.headers.get('content-length') ?? 0);
    assert.ok(declared <= 2_000_000, 'response budget');
    // Stream-bound before full allocation, including chunked responses.
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        assert.ok(size <= 2_000_000, 'response budget');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const body = Buffer.concat(chunks).toString('utf8');
    if (surface.kind === 'json') JSON.parse(body);
    for (const needle of surface.present) assert.ok(body.includes(needle), 'expected fixture absent');
    for (const needle of surface.absent) assert.ok(!body.includes(needle), 'private fixture leaked');
    const cacheControl = response.headers.get('cache-control') ?? '';
    if (Object.keys(credentials).length) assert.match(cacheControl, /private.*no-store/);
    return {
      path: surface.path,
      kind: surface.kind,
      status: response.status,
      contentType: type,
      cacheControl,
      bytes: size,
      sha256: createHash('sha256').update(body).digest('hex'),
      credentialHeader: Object.keys(credentials)[0] ?? null,
      emptyCredential: Object.values(credentials)[0] === '',
      fixturePresent: true,
      privateCanariesAbsent: true,
    };
  }
  return {
    identity,
    read,
    async runReadOnly() {
      const before = await identity();
      const responses = [];
      for (const s of c.surfaces) {
        responses.push(await read(s));
        for (const name of credentialNames)
          for (const value of ['f1-private-fixture-invalid', '']) responses.push(await read(s, { [name]: value }));
        responses.push(await read(s));
      }
      const after = await identity();
      assert.deepEqual(after, before);
      return {
        scope: 'read-only-canary-and-header-check',
        identity: before,
        responses,
        barrierPassed: false,
        actorsVerified: false,
        deploymentGatePassed: false,
      };
    },
    armSqlResultBarrier() {
      throw Error('Existing APP677 process exposes no SQL-result hook; read-only adapter cannot supply B0');
    },
  };
}

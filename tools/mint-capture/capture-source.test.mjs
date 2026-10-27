import assert from 'node:assert/strict';
import test from 'node:test';
import { sameOwnedProcess, stopProfile } from './browser-owner.mjs';
import { admitRequest, shots, validRoute } from './capture-policy.mjs';
import { batchPaths, deadlineCheck, superviseConcurrent } from './controller.mjs';
import { validateCounts } from './global-counts.mjs';
import { validateGlobalObservation } from './runtime-adapter.mjs';
import { watchOwnedBrowser } from './watchdog.mjs';

test('canonical public route catalogue only; all mutations/foreign hosts blocked', () => {
  for (const p of ['/', '/login/', '/tag/%E8%B2%93/']) assert.equal(validRoute(p), true);
  for (const p of ['//evil/', '/../', '/%2e%2e/', '/%2f/', '/admin/?q=x', '/a\\b/']) assert.equal(validRoute(p), false);
  assert.equal(admitRequest('http://100.85.214.25:18196/tag/cat/', 'GET'), true);
  for (const [u, m] of [
    ['https://www.google-analytics.com/g/collect', 'GET'],
    ['http://100.85.214.25:18196/', 'POST'],
    ['http://100.85.214.25:18196.evil/', 'GET'],
  ])
    assert.equal(admitRequest(u, m), false);
  assert.equal(shots({ paths: ['/', '/login/'] }).length, 8);
});
test('three-host counts preserve remote clocks and expire cumulative local chain', () => {
  const o = (machineId, time) => ({ machineId, observedAtMs: time, load1: 0, buildPids: [], browserRootPids: [] });
  const r = {
    smRaw: JSON.stringify(o('302c2528bd464ad0953cf5fa743b6171', -3600000)),
    ytRaw: JSON.stringify(o('35ead342bacc44dea3633ccd2cc3f309', 3600000)),
    ytStatus: 0,
    ytStartedAtMs: 100,
    ytEndedAtMs: 110,
  };
  const p = validateCounts(r, {
    startedAtMs: 0,
    finishedAtMs: 10000,
    mint: o('f80413057e6d4a179e248e5f8c08cac6', 100),
    sessionId: 'batch-001',
    controlOpsSha: 'a'.repeat(40),
  });
  assert.equal(p.hosts[1].remoteObservedAtMs, -3600000);
  validateGlobalObservation(p, { now: 15000, sessionId: 'batch-001', controlOpsSha: 'a'.repeat(40) });
  assert.throws(() => validateGlobalObservation(p, { now: 15001, sessionId: 'batch-001', controlOpsSha: 'a'.repeat(40) }));
  assert.throws(() =>
    validateCounts({ ...r, ytStatus: 255 }, { startedAtMs: 0, finishedAtMs: 100, mint: o('f80413057e6d4a179e248e5f8c08cac6', 0) }),
  );
});
test('async candidate started precedes capture; all errors stop own controller and never accept', async () => {
  for (const failed of ['start', 'ready', 'capture', 'ended', 'hash', 'gate']) {
    const events = [];
    const fail = (name) => async () => {
      events.push(name);
      if (name === failed) throw Error(name);
      return {};
    };
    await assert.rejects(
      superviseConcurrent({
        startCandidate: fail('start'),
        waitStarted: fail('ready'),
        capture: fail('capture'),
        waitEnded: fail('ended'),
        verifyUnchanged: fail('hash'),
        finalGate: fail('gate'),
        writeAcceptance: fail('write'),
        stopCandidate: fail('stop'),
      }),
    );
    assert.ok(!events.includes('write'));
    if (failed !== 'start') assert.equal(events.at(-1), 'stop');
  }
  const events = [];
  const f = (n) => async () => {
    events.push(n);
    return {};
  };
  await superviseConcurrent({
    startCandidate: f('start'),
    waitStarted: f('ready'),
    capture: f('capture'),
    waitEnded: f('ended'),
    verifyUnchanged: f('hash'),
    finalGate: f('gate'),
    writeAcceptance: f('write'),
    stopCandidate: f('stop'),
  });
  assert.deepEqual(events, ['start', 'ready', 'capture', 'ended', 'hash', 'gate', 'write', 'stop']);
});
test('deadline/session namespace fail closed', () => {
  assert.throws(() => batchPaths('batch-000'));
  assert.throws(() => batchPaths('../x'));
  assert.equal(batchPaths('batch-001').job, '/var/lib/observe-worker/tag/candidate-sm-c70425b0-batch-001');
  assert.throws(() => deadlineCheck(100, null, 100));
});
test('watchdog stale pause and launch-failure profile both invoke own cleanup', async () => {
  for (const decision of ['pause', 'run']) {
    let stopped = 0;
    const io = {
      lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => false, uid: process.getuid(), mode: 0o600, size: 100 }),
      readFileSync: () => JSON.stringify({ captureParentPid: 1, profile: '/private/profile', decision, observedAtMs: 0 }),
    };
    await assert.rejects(
      watchOwnedBrowser({
        profile: '/private/profile',
        leasePath: '/private/lease',
        deadlineMs: 20000,
        parentPid: 1,
        assertKernel: () => {},
        record: () => {},
        io,
        stop: async () => {
          stopped++;
        },
        now: () => 11000,
        sleep: async () => {},
      }),
    );
    assert.equal(stopped, 1);
  }
});
import * as fs from 'node:fs';
import { redactHar, redactHeaders } from './evidence.mjs';
import { selectBatch } from './ledger-plan.mjs';

test('evidence removes cookie/auth values but keeps original URL and DNT', () => {
  const h = redactHeaders({ Cookie: 'secret', Authorization: 'Bearer key', DNT: '1' });
  assert.equal(h.Cookie, '[redacted]');
  assert.equal(h.Authorization, '[redacted]');
  assert.equal(h.DNT, '1');
  const har = {
    log: {
      entries: [
        {
          request: {
            url: 'http://100.85.214.25:18196/login/',
            headers: [{ name: 'cookie', value: 'secret' }],
            cookies: [{ name: 'session', value: 'secret' }],
            postData: { text: 'secret' },
          },
        },
      ],
    },
  };
  const r = redactHar(har).log.entries[0].request;
  assert.equal(r.url, 'http://100.85.214.25:18196/login/');
  assert.equal(r.cookies[0].value, '[redacted]');
  assert.deepEqual(r.postData, { redacted: true });
});
test('real route catalogue selects 53 anonymous routes and refuses deferred admin/reader rows', () => {
  const c = JSON.parse(fs.readFileSync(new URL('../../docs/ui-review/mint-anonymous-capture-plan.json', import.meta.url)));
  const all = c.batches.flatMap((b) => selectBatch(c, b.sessionId).routes);
  assert.equal(all.length, 53);
  const forged = structuredClone(c);
  forged.batches[0].paths[0] = '/admin/';
  forged.batches[0].ledgerIds[0] = '014';
  assert.throws(() => selectBatch(forged, 'batch-001'));
});
test('Chromium cleanup signals exact own group and children, never unrelated Chrome or reused PID', async () => {
  const uid = process.getuid(),
    profile = '/new/profile';
  const state = new Map([
    [12, { pid: 12, ppid: 1, group: 12, start: '123', args: ['/chrome', '--user-data-dir=' + profile] }],
    [13, { pid: 13, ppid: 12, group: 12, start: '124', args: ['/chrome', '--type=renderer'] }],
    [99, { pid: 99, ppid: 1, group: 99, start: '999', args: ['/chrome', '--user-data-dir=/other'] }],
  ]);
  const io = {
    readdirSync: () => [...state.keys()].map(String),
    statSync: () => ({ uid }),
    readFileSync: (p) => {
      const m = p.match(/^\/proc\/(\d+)\/(stat|cmdline)$/),
        r = state.get(Number(m[1]));
      if (!r) throw Object.assign(Error('gone'), { code: 'ENOENT' });
      if (m[2] === 'cmdline') return Buffer.from(r.args.join('\0') + '\0');
      const fields = ['S', String(r.ppid), String(r.group), ...Array(16).fill('0'), r.start];
      return r.pid + ' (chrome) ' + fields.join(' ');
    },
  };
  const signals = [];
  await stopProfile(profile, {
    io,
    uid,
    sleep: async () => {},
    kill: (pid, sig) => {
      signals.push([pid, sig]);
      if (sig === 'SIGTERM' && pid === -12) state.delete(12);
      if (sig === 'SIGKILL' && pid === 13) state.delete(13);
    },
  });
  assert.ok(signals.some(([pid]) => pid === 13));
  assert.ok(!signals.some(([pid]) => Math.abs(pid) === 99));
  const record = { pid: 99, startTicks: 'old', processGroup: 99, profile: '/other' };
  assert.equal(sameOwnedProcess(record, { io, uid }), false);
});

import { bytesIn } from './capture-driver.mjs';

test('profile singleton links are counted without following; evidence links rejected', () => {
  const entry = (name, type) => ({
    name,
    isDirectory: () => type === 'dir',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'link',
  });
  let externalRead = false;
  const io = {
    readdirSync: (p) => (p === '/job' ? [entry('profile', 'dir'), entry('shot.png', 'file')] : [entry('SingletonSocket', 'link')]),
    lstatSync: (p) => {
      if (p.includes('Singleton')) externalRead = true;
      return { size: 5 };
    },
    readlinkSync: () => '/tmp/chromium-private/socket',
  };
  assert.ok(bytesIn('/job', io) > 5);
  assert.equal(externalRead, false);
  assert.throws(() => bytesIn('/job', { ...io, readdirSync: () => [entry('shot.png', 'link')] }));
});
test('full-page progressive loading has bounded scroll and lazy/theme evidence', async () => {
  const { progressiveScroll } = await import('./evidence.mjs');
  let n = 0;
  const page = {
    evaluate: async (f) => {
      const code = String(f);
      if (code.includes('top:scrollY')) return { top: n++ * 500, height: 1200, viewport: 600 };
      if (code.includes('images:'))
        return {
          footer: { present: true },
          images: [{ complete: true, naturalWidth: 20 }],
          skeletons: 0,
          fonts: { status: 'loaded' },
          theme: { mediaDark: true },
          height: 1200,
        };
    },
    waitForTimeout: async () => {},
  };
  const r = await progressiveScroll(page);
  assert.equal(r.loaded, true);
  assert.equal(r.theme.mediaDark, true);
  assert.ok(r.steps <= 24);
});

import { diagnosedTask, errorRecord } from './diagnostic.mjs';

test('private diagnostics preserve original invalid-plan/import/launch/probe cause without dumping inputs', async () => {
  for (const phase of ['invalidplan', 'ERR_MODULE_NOT_FOUND', 'launch', 'globalprobe']) {
    let saved;
    const e = Object.assign(Error('actual ' + phase + ' cause'), { name: phase });
    await assert.rejects(
      diagnosedTask(
        async () => {
          throw e;
        },
        {
          path: '/private/error.json',
          metadata: { inputSha256: 'a'.repeat(64), planSha256: 'b'.repeat(64) },
          write: (_p, error, meta) => {
            saved = errorRecord(error, meta);
          },
        },
      ),
    );
    assert.equal(saved.message, 'actual ' + phase + ' cause');
    assert.ok(saved.stack.includes(phase));
    assert.equal(saved.inputSha256, 'a'.repeat(64));
    assert.equal(saved.deployEligible, false);
    assert.equal(saved.env, undefined);
    assert.equal(saved.input, undefined);
  }
});

import { playwrightTree } from './tool-proof.mjs';

test('framework provenance covers both full packages, detects dependency changes and byte caps', () => {
  const root = '/home/sky/observe-worker/browser-tools/node_modules',
    pkg = Buffer.from('{"version":"1.63.0"}');
  let body = Buffer.from('trusted launch code');
  const io = {
    realpathSync: (p) => p,
    readFileSync: (p) => (p.endsWith('/package.json') ? pkg : body),
    readdirSync: () => ['package.json', 'launch.js'],
    lstatSync: (p) => ({
      uid: process.getuid(),
      mode: 0o644,
      isSymbolicLink: () => false,
      isDirectory: () => false,
      isFile: () => true,
      size: p.endsWith('package.json') ? pkg.length : body.length,
    }),
  };
  const first = playwrightTree(root, { io });
  assert.equal(first.entries.length, 4);
  body = Buffer.from('modified');
  assert.notEqual(playwrightTree(root, { io }).sha256, first.sha256);
  assert.throws(() => playwrightTree(root, { io, maxBytes: 1 }));
  assert.throws(() => playwrightTree(root, { io: { ...io, lstatSync: (p) => ({ ...io.lstatSync(p), isSymbolicLink: () => true }) } }));
});
test('candidate API/HTML5xx is saved before own-browser stop; 404 remains scoped pending', async () => {
  const { candidateResponse } = await import('./evidence.mjs');
  for (const path of ['/', '/api/status/']) {
    const events = [];
    await candidateResponse(
      { url: () => 'http://100.85.214.25:18196' + path, status: () => 503 },
      { origin: 'http://100.85.214.25:18196', record: (e) => events.push(e), stop: async () => events.push('stop') },
    );
    assert.equal(events[0].status, 503);
    assert.equal(events[1], 'stop');
  }
  let stopped = 0;
  await candidateResponse(
    { url: () => 'http://100.85.214.25:18196/tag/missing/', status: () => 404 },
    { origin: 'http://100.85.214.25:18196', record: () => {}, stop: async () => stopped++ },
  );
  assert.equal(stopped, 0);
});
test('proxy refuses a foreign origin before any listener exists', async () => {
  const { createCandidateCaptureProxy } = await import('./candidate-capture-proxy.cjs');
  await assert.rejects(createCandidateCaptureProxy('http://www.google-analytics.com'));
  await assert.rejects(createCandidateCaptureProxy('http://127.0.0.1:18196'));
});
test('preparation uses real observed tool facts and never creates an admitted plan', async () => {
  const { prepareBatch } = await import('./planner.mjs');
  const bytes = fs.readFileSync(new URL('../../docs/ui-review/mint-anonymous-capture-plan.json', import.meta.url));
  const p = prepareBatch(bytes, 'batch-001');
  assert.equal(p.reviewed, false);
  assert.equal(p.executionPermission, false);
  assert.equal(p.controlOpsSha, null);
  assert.equal(p.sessionExpiresAtMs, null);
  assert.equal(p.capture.playwrightTreeSha256, 'f524d41953b19c8dc26f1c3a668db6e6fc33b6f2579baa2c855068ea927e0215');
});
test('SM homepage envelope retains original offset clock and uses cumulative Mint freshness only', async () => {
  const { normalizeSmEnvelope } = await import('./sm-probe.mjs');
  const receipt = {
    schema: 'mint-f1-sm-transport-v1',
    reviewed: true,
    reviewReceiptId: 'review',
    slotReceiptId: 'slot',
    globalBuildSlot: true,
    smMachineId: '302c2528bd464ad0953cf5fa743b6171',
    mintMachineId: 'f80413057e6d4a179e248e5f8c08cac6',
    expiresAt: new Date(100000).toISOString(),
    host: '100.85.214.25',
    user: 'deck',
    knownHostsPath: '/private/known_hosts',
    knownHostsSha256: 'a'.repeat(64),
    port: 22,
  };
  for (const offset of [-3600000, -4, 4, 3600000]) {
    const raw = {
      observedHost: 'SM',
      machineId: receipt.smMachineId,
      measuredFromMachineId: receipt.smMachineId,
      startedAtMs: 100 + offset,
      finishedAtMs: 200 + offset,
      localSmBuildCount: 0,
      load1: 1,
      homeAvailableBytes: 50 * 1024 ** 3,
      sites: ['https://tag.observe.tw/', 'https://weblog.tw/', 'https://youtube.observe.tw/'].map((url) => ({
        url,
        status: 200,
        exitCode: 0,
        total: 0.5,
        ttfb: 0.1,
      })),
    };
    const sample = normalizeSmEnvelope(raw, receipt, { startedAtMs: 100, finishedAtMs: 250, now: 300 });
    assert.equal(sample.remoteTiming.finishedAtMs, 200 + offset);
    assert.equal(sample.ageMs, 200);
    assert.throws(() => normalizeSmEnvelope(raw, receipt, { startedAtMs: 100, finishedAtMs: 250, now: 30101 }));
  }
});

import { gateSnapshot } from './gate-cache.mjs';

test('slow SM homepage sampling does not fake-renew clocks or expire healthy independent count/API leases', () => {
  const sm = { startedAtMs: 0 },
    counts = { startedAtMs: 12000, hosts: [{ load1: 1 }, { load1: 1 }, { load1: 1 }] };
  const state = { sm, counts };
  const r = gateSnapshot(state, { now: 14000 });
  assert.equal(r.sm.startedAtMs, 0);
  assert.equal(r.counts.startedAtMs, 12000);
  gateSnapshot(state, { now: 27000 });
  assert.throws(() => gateSnapshot(state, { now: 27001 }));
  assert.throws(() => gateSnapshot({ ...state, countsError: Error('SSH failed') }, { now: 14000 }));
  assert.throws(() => gateSnapshot({ ...state, counts: { ...counts, hosts: [{ load1: 12.01 }] } }, { now: 14000 }));
});
test('candidate cannot start below40GiB and YT high load also pauses; normal running reserve30', async () => {
  const { candidateResources } = await import('./gate-cache.mjs');
  const counts = { hosts: ['Mint', 'SM', 'YT'].map((host) => ({ host, load1: 1, buildCount: 0, browserRoots: 0 })) },
    mint = { mintLoad1: 1, mintAvailableBytes: 40 * 1024 ** 3 };
  candidateResources(mint, counts, { starting: true });
  assert.throws(() => candidateResources({ ...mint, mintAvailableBytes: 40 * 1024 ** 3 - 1 }, counts, { starting: true }));
  candidateResources({ ...mint, mintAvailableBytes: 30 * 1024 ** 3 }, counts);
  counts.hosts[2].load1 = 12.01;
  assert.throws(() => candidateResources(mint, counts));
});

test('retry plan keeps catalogue batch identity while every controller namespace/config is exclusive suffix', async () => {
  const { prepareBatch } = await import('./planner.mjs');
  const { validatePlan, validateSMPaths } = await import('./controller.mjs');
  const { validatedAttemptSuffix } = await import('./capture-policy.mjs');
  const catalogue = fs.readFileSync(new URL('../../docs/ui-review/mint-anonymous-capture-plan.json', import.meta.url)),
    control = 'a'.repeat(40);
  const base = prepareBatch(catalogue, 'batch-001', { controlOpsSha: control }),
    retry = prepareBatch(catalogue, 'batch-001', { controlOpsSha: control, attemptSuffix: '-r2' });
  assert.deepEqual(retry.routes, base.routes);
  assert.equal(retry.sessionId, base.sessionId);
  assert.equal(retry.reviewed, false);
  assert.equal(retry.executionPermission, false);
  assert.ok(retry.smFrontdoorConfigPath.endsWith('frontdoor-config-batch-001-r2.json'));
  for (const key of Object.keys(batchPaths('batch-001')))
    assert.notEqual(batchPaths('batch-001', '-r2')[key], batchPaths('batch-001')[key]);
  const at = 100000,
    plan = {
      ...retry,
      reviewed: true,
      executionPermission: true,
      globalSlotAcknowledged: true,
      sessionExpiresAtMs: at + 900000,
      captureExpiresAtMs: at + 540000,
      smDriverPins: Object.fromEntries(Object.keys(retry.smDriverPins).map((p) => [p, 'a'.repeat(64)])),
    };
  assert.equal(validatePlan(plan, at), plan);
  validateSMPaths(plan, control);
  assert.throws(() => validateSMPaths({ ...plan, smFrontdoorConfigPath: base.smFrontdoorConfigPath }, control));
  for (const bad of ['-r0', '-r1', '-r02', '-r2/', '../x', '-r1000', null, 7]) {
    assert.throws(() => validatedAttemptSuffix(bad));
    assert.throws(() => batchPaths('batch-001', bad));
    assert.throws(() => prepareBatch(catalogue, 'batch-001', { attemptSuffix: bad }));
  }
  assert.equal(validatedAttemptSuffix(), '');
});

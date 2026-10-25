import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  classifyProbeFailure,
  digest,
  mintRpcReceipt,
  sessionPaths,
  smJob,
  sourcePins,
  sourceRoot,
  verifyInput,
  verifyMintObservation,
} from './candidate-contract.mjs';
import {
  candidatePlan,
  candidateReceiptBinding,
  candidateTiming,
  checkExactPorts,
  forwardingArgs,
  listenerOwned,
  outerGuardedInvocation,
  ports,
  validateSample,
  verifyEffectiveForwarding,
  verifyOwnerSessionReceipt,
  verifyReadiness,
} from './candidate-core.mjs';

const now = 100000;
const input = () => ({
  schema: 'sm-isolated-candidate-v1',
  sessionId: 'batch-001',
  controlOpsSha: 'c'.repeat(40),
  sourcePins: Object.fromEntries(Object.entries(sourcePins).map(([n, s]) => [new URL(n, new URL('./', import.meta.url)).pathname, s])),
  reviewed: true,
  appSha: '677a0c793eeda0c4d850c81ac574c95508d08e0a',
  opsSha: 'c70425b007bdac9fdbef62b935811ee0d7f30d18',
  expiresAtMs: now + 60000,
  mintLockPid: 123,
  mintLockDev: '2049',
  mintLockInode: '999',
  mintPidStartTicks: '1234',
  mintLockCmdlineSha256: 'a'.repeat(64),
  mintAdmissionPath: '/var/lib/observe-worker/tag/private/sm-candidate-c70425b0-batch-001.json',
  mintAdmissionSha256: 'b'.repeat(64),
  mintControlLeasePath: '/var/lib/observe-worker/tag/candidate-sm-c70425b0-batch-001/lease.json',
  sshConfigSha256: 'c'.repeat(64),
  sshKnownHostsSha256: 'd'.repeat(64),
  frontdoorConfigPath: sourceRoot + '/frontdoor-config-batch-001.json',
  frontdoorConfigSha256: 'e'.repeat(64),
  nativeReceiptPath:
    '/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/native-smoke-job-r2/native-evidence/worker-result.json',
  nativeReceiptSha256: 'f'.repeat(64),
  sshEffectiveHostName: '100.108.108.109',
  sshEffectiveUser: 'sky',
  isolationReceiptId: 'existing-reviewed-fixture',
  driverPins: Object.fromEntries(
    ['candidate-parent.mjs', 'candidate-worker.mjs', 'candidate-contract.mjs', 'candidate-core.mjs'].map((n) => [
      sourceRoot + '/' + n,
      'a'.repeat(64),
    ]),
  ),
});
const config = () => ({
  bindIp: '100.85.214.25',
  port: 18196,
  nextOrigin: 'http://127.0.0.1:18195',
  apiOrigin: 'http://127.0.0.1:18131',
  actor: 'anonymous',
  allowMutations: false,
  expiresAt: now + 60000,
});
const effective = () =>
  [
    'hostname 100.108.108.109',
    'user sky',
    'batchmode yes',
    'stricthostkeychecking true',
    'exitonforwardfailure yes',
    'clearallforwardings no',
    'controlmaster false',
    'controlpersist 0',
    'forwardagent no',
    'forwardx11 no',
    'permitlocalcommand no',
    'forkafterauthentication no',
    'sessiontype none',
    'requesttty false',
    'localforward 127.0.0.1:18131 [127.0.0.1]:18131',
  ].join('\n');
test('new scope/external lease/15min/current native+fixture source required, old native admission rejected', () => {
  verifyInput(input(), now);
  for (const patch of [
    { schema: 'sm-guarded-native-v1' },
    { reviewed: false },
    { expiresAtMs: now + 900001 },
    { mintLockPid: null },
    { mintControlLeasePath: '/var/lib/observe-worker/tag/native-sm-smoke-job-c70425b0-r2/lease.json' },
    { isolationReceiptId: '' },
    { frontdoorConfigPath: '/tmp/arbitrary.json' },
  ])
    assert.throws(() => verifyInput({ ...input(), ...patch }, now));
});
test('exact -L retained/no inherited forward or multiplex accepted by effective -G', () => {
  verifyEffectiveForwarding(effective(), input());
  assert.ok(forwardingArgs().includes('ClearAllForwardings=no'));
  assert.ok(forwardingArgs().includes('ExitOnForwardFailure=yes'));
  for (const extra of [
    '\nlocalforward 127.0.0.1:19000 [127.0.0.1]:19000',
    '\nremoteforward 19000 localhost:19000',
    '\ndynamicforward 1080',
  ])
    assert.throws(() => verifyEffectiveForwarding(effective() + extra, input()));
  for (const change of [
    ['clearallforwardings no', 'clearallforwardings yes'],
    ['controlmaster false', 'controlmaster auto'],
    ['hostname 100.108.108.109', 'hostname foreign'],
    ['localforward 127.0.0.1', 'localforward 0.0.0.0'],
  ])
    assert.throws(() => verifyEffectiveForwarding(effective().replace(...change), input()));
});
test('isolated Next/forwarder/frontdoor plan never inherits production or auth environment', () => {
  const plan = candidatePlan(input(), config());
  assert.deepEqual(
    plan.map((p) => p.name),
    ['tunnel', 'next', 'frontdoor'],
  );
  assert.equal(plan[1].env.TAG_API_ORIGIN, 'http://127.0.0.1:18131');
  assert.equal(plan[1].env.HOSTNAME, '127.0.0.1');
  assert.equal(plan[1].env.PORT, '18195');
  assert.ok(plan[1].args[0].endsWith('/runtime/web/.next/standalone/web/server.js'));
  assert.equal(plan[1].env.DATABASE_URL, undefined);
  assert.ok(!JSON.stringify(plan).includes('batchSecret'));
  assert.throws(() => candidatePlan(input(), { ...config(), apiOrigin: 'https://tag.observe.tw' }));
  assert.throws(() => candidatePlan(input(), { ...config(), allowMutations: true }));
  assert.throws(() => candidatePlan(input(), { ...config(), bindIp: '127.0.0.1' }));
});
test('ready proof rejects production/unknown source or replacement fixture identity', () => {
  const body = {
    machineId: 'f80413057e6d4a179e248e5f8c08cac6',
    appSha: input().appSha,
    scope: 'mint-f1-isolated',
    databaseScope: 'isolated',
    productionDatabase: false,
    isolationReceiptId: input().isolationReceiptId,
  };
  verifyReadiness(200, body, input());
  for (const patch of [
    { productionDatabase: true },
    { appSha: 'other' },
    { databaseScope: 'production' },
    { machineId: 'SM' },
    { isolationReceiptId: 'other' },
  ])
    assert.throws(() => verifyReadiness(200, { ...body, ...patch }, input()));
  assert.throws(() => verifyReadiness(503, body, input()));
});
test('mock port checks use exact SM endpoint, reject collision without adopting/stopping legacy service', async () => {
  const seen = [];
  const create = () => {
    const server = new EventEmitter();
    server.listen = (port, host, cb) => {
      seen.push({ port, host });
      cb();
    };
    server.close = (cb) => cb();
    return server;
  };
  await checkExactPorts({ create });
  assert.deepEqual(seen, ports);
  const collision = () => {
    const server = new EventEmitter();
    server.listen = () => server.emit('error', Object.assign(Error('occupied'), { code: 'EADDRINUSE' }));
    return server;
  };
  await assert.rejects(checkExactPorts({ create: collision }), /occupied/);
});
test('kernel listener proof distinguishes loopback old18196, wildcard and own exact Tailscale socket', () => {
  const tcp = (address, inode) => ` 0: ${address}:4714 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1000 0 ${inode}`;
  const endpoint = { host: '100.85.214.25', port: 18196, pid: 123, uid: 1000 };
  assert.equal(listenerOwned(tcp('0100007F', 215996810), ['socket:[215996810]'], endpoint), false);
  assert.equal(listenerOwned(tcp('00000000', 1), ['socket:[1]'], endpoint), false);
  assert.equal(listenerOwned(tcp('19D65564', 2), ['socket:[2]'], endpoint), true);
  assert.equal(listenerOwned(tcp('19D65564', 2), ['socket:[1]'], endpoint), false);
});
test('frozen helper hashes and source group/env/immutable constraints are explicit, no actual execution', () => {
  for (const [name, pin] of Object.entries(sourcePins)) assert.equal(digest(readFileSync(sourceRoot + '/' + name)), pin);
  const worker = readFileSync(sourceRoot + '/candidate-worker.mjs', 'utf8'),
    parent = readFileSync(sourceRoot + '/candidate-parent.mjs', 'utf8');
  assert.ok(worker.includes('verifyRuntime(input)'));
  assert.ok(worker.includes('await checkExactPorts()'));
  assert.ok(worker.includes('await forwardedReadiness(input)'));
  assert.ok(parent.includes('await guardedBuild'));
  assert.ok(parent.includes('estimatedUsageGiB:0.05'));
  assert.ok(!worker.includes('process.env'));
  assert.ok(!worker.includes('detached:true'));
  assert.ok(!worker.includes('rsync'));
});
test('actual candidate lease uses cumulative freshness and pause/fatal distinction, not old native scope', () => {
  const raw = {
    observedHost: 'Mint',
    machineId: 'f80413057e6d4a179e248e5f8c08cac6',
    pid: 123,
    dev: '2049',
    inode: '999',
    startTicks: '1234',
    cmdlineSha256: 'a'.repeat(64),
    admissionSha256: 'b'.repeat(64),
    finishedAtMs: now + 4,
    controllerLeaseBound: true,
    controllerLeaseSchema: 'tag-isolated-candidate-lease-v1',
    controllerLeaseSha256: 'c'.repeat(64),
    mintControlLeasePath: input().mintControlLeasePath,
    admissionExpiresAtMs: input().expiresAtMs,
    admissionBinding: {
      driverSha256: 'd'.repeat(64),
      inputSha256: 'e'.repeat(64),
      planSha256: 'f'.repeat(64),
      lockPid: 123,
      opsSha: input().opsSha,
      controlOpsSha: input().controlOpsSha,
      sessionId: input().sessionId,
    },
    controllerLeaseBinding: {
      driverSha256: 'd'.repeat(64),
      inputSha256: 'e'.repeat(64),
      planSha256: 'f'.repeat(64),
      lockPid: 123,
      opsSha: input().opsSha,
      controlOpsSha: input().controlOpsSha,
      sessionId: input().sessionId,
    },
    observedAtMs: now - 96,
    controllerLeaseAgeMs: 100,
    decision: 'run',
    apiReady: true,
    load1: 5,
    diskMeasurementPath: '/var/lib/observe-worker',
    volumeAvailableBytes: 45 * 1024 ** 3,
    localBuildCount: 0,
    lockHeld: true,
  };
  const reply = (delta) => {
    const body = { ...raw, ...delta };
    return {
      ...body,
      transport: mintRpcReceipt({ stdout: JSON.stringify(body), stderr: '', status: 0 }, input(), {
        startedAtMs: now - 20,
        endedAtMs: now,
        caller: 'parent',
      }),
    };
  };
  assert.equal(verifyMintObservation(reply({}), input(), now), true);
  for (const delta of [{ apiReady: false }, { decision: 'pause' }, { observedAtMs: now - 30001, controllerLeaseAgeMs: 30005 }]) {
    let error;
    try {
      verifyMintObservation(reply(delta), input(), now);
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    assert.equal(classifyProbeFailure(error), 'pause');
  }
  let error;
  try {
    verifyMintObservation(reply({ controllerLeaseSchema: 'tag-native-repair-lease-v1' }), input(), now);
  } catch (e) {
    error = e;
  }
  assert.equal(classifyProbeFailure(error), 'fatal');
});

test('planned stop reserves120s for cleanup/hash/gates; expiry remains hard, no expired successful verdict', () => {
  const timing = candidateTiming(now + 900000, now);
  assert.equal(timing.plannedStopAtMs, now + 780000);
  assert.equal(timing.hardDeadlineMs, now + 900000);
  assert.equal(timing.cleanupReserveMs, 120000);
  assert.throws(() => candidateTiming(now + 179999, now));
  candidateTiming(now + 180000, now);
  assert.throws(() => verifyInput({ ...input(), expiresAtMs: now }, now));
  const outer = outerGuardedInvocation(['worker', 'input']);
  assert.deepEqual(outer, {
    bin: '/usr/bin/ionice',
    args: ['-c', '3', '/usr/bin/nice', '-n', '19', '/home/deck/.local/bin/node', 'worker', 'input'],
  });
  const next = candidatePlan(input(), config())[1];
  assert.equal(next.env.UV_THREADPOOL_SIZE, '2');
  assert.equal(next.env.VIPS_CONCURRENCY, '1');
});

test('candidate final receipt rejects replay from another input/driver/artifact and false scope', () => {
  const inputSha = 'b'.repeat(64),
    receipt = {
      ...candidateReceiptBinding(input(), inputSha),
      status: 'owner-session-ended',
      scope: 'SM isolated candidate supervision ended; no Mint capture or UI review',
      timing: { cleanupReserveMs: 120000 },
      deployEligible: false,
      manifestPublished: false,
      uiReview: 'not reviewed',
      originalRuntimeUnchanged: true,
    };
  verifyOwnerSessionReceipt(receipt, input(), inputSha);
  for (const patch of [
    { inputSha256: 'c'.repeat(64) },
    { driverPins: {} },
    { driverPins: { ...receipt.driverPins, [sourceRoot + '/candidate-worker.mjs']: 'c'.repeat(64) } },
    { pins: { ...receipt.pins, inventory: 'c'.repeat(64) } },
    { status: 'ui-pass' },
    { scope: 'UI pass' },
    { uiReview: 'passed' },
    { deployEligible: true },
    { manifestPublished: true },
    { timing: { cleanupReserveMs: 0 } },
  ])
    assert.throws(() => verifyOwnerSessionReceipt({ ...receipt, ...patch }, input(), inputSha));
  assert.throws(() => verifyOwnerSessionReceipt(receipt, input(), 'c'.repeat(64)));
  const worker = readFileSync(sourceRoot + '/candidate-worker.mjs', 'utf8');
  for (const name of ['candidate-started.json', 'candidate-stopped.json']) {
    const start = worker.indexOf("'" + name + "'");
    assert.ok(worker.slice(start, start + 400).includes('inputSha256:inputSha'));
  }
});

test('SM raw bytes/status precede JSON and service rejection, including stderr', async () => {
  const { saveSmProbeReply, validateSmProbe } = await import('./candidate-contract.mjs');
  const base = {
    machineId: '302c2528bd464ad0953cf5fa743b6171',
    observedHost: 'SM',
    measuredFromMachineId: '302c2528bd464ad0953cf5fa743b6171',
    dnt: '1',
    finishedAtMs: now,
    localSmBuildCount: 0,
    load1: 1,
    homeAvailableBytes: 50 * 1024 ** 3,
    sites: [
      ['https://tag.observe.tw/', 2],
      ['https://blog.observe.tw/', 6.17],
      ['https://youtube.observe.tw/', 2],
    ].map(([url]) => ({ url, exitCode: 0, status: 200, total: 1 })),
  };
  const fixtures = [
    { ...base, sites: base.sites.map((r, i) => (i ? r : { ...r, status: 503 })) },
    { ...base, sites: base.sites.map((r, i) => (i ? r : { ...r, exitCode: 56 })) },
    { ...base, sites: base.sites.map((r, i) => (i ? r : { ...r, total: 2.001 })) },
    '{invalid-json',
  ];
  for (const value of fixtures) {
    const raw = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
    let saved;
    const record = saveSmProbeReply(
      { stdout: raw, stderr: Buffer.from('original curl diagnostic'), status: 0 },
      { startedAtMs: now - 1, endedAtMs: now, sourceSha256: 'a'.repeat(64), inputSha256: 'b'.repeat(64) },
      (r) => {
        saved = r;
      },
    );
    assert.equal(Buffer.from(saved.stdoutBase64, 'base64').compare(raw), 0);
    assert.equal(saved.stdoutSha256, digest(raw));
    assert.equal(saved.stderrSha256, digest('original curl diagnostic'));
    assert.equal(record.status, 0);
    assert.throws(() => {
      assert.ok(saved);
      validateSmProbe(JSON.parse(raw), validateSample, { now });
    });
  }
  let saved;
  saveSmProbeReply(
    { stdout: Buffer.from('partial'), stderr: Buffer.from('timeout'), status: null, signal: 'SIGTERM' },
    { startedAtMs: now - 1, endedAtMs: now, sourceSha256: 'a'.repeat(64), inputSha256: 'b'.repeat(64) },
    (r) => {
      saved = r;
    },
  );
  assert.equal(saved.signal, 'SIGTERM');
  assert.throws(() =>
    saveSmProbeReply(
      { stdout: Buffer.alloc(65537) },
      { startedAtMs: 0, endedAtMs: 1, sourceSha256: 'a'.repeat(64), inputSha256: 'b'.repeat(64) },
      () => {},
    ),
  );
  const parent = readFileSync(new URL('./candidate-parent.mjs', import.meta.url), 'utf8');
  assert.ok(parent.indexOf('saveSmProbeReply(reply') < parent.indexOf('const probe=async'));
  assert.ok(parent.includes('encoding:null,timeout:40000'));
  assert.ok(parent.includes('parent-sm-probe-raw.jsonl'));
});

test('planned shutdown precedes slow/failed checkpoint and failed stop prevents checkpoint', async () => {
  const { stopBeforeCheckpoint } = await import('./candidate-core.mjs');
  const events = [];
  let release;
  const pending = stopBeforeCheckpoint(
    async () => {
      events.push('stopped');
    },
    async (phase) => {
      events.push(phase);
      await new Promise((done) => {
        release = done;
      });
      throw Error('slow failed probe');
    },
  );
  await new Promise((done) => setImmediate(done));
  assert.deepEqual(events, ['stopped', 'planned-stop']);
  release();
  await assert.rejects(pending, /slow failed probe/);
  let called = false;
  await assert.rejects(
    stopBeforeCheckpoint(
      async () => {
        throw Error('shutdown unconfirmed');
      },
      () => {
        called = true;
      },
    ),
    /shutdown unconfirmed/,
  );
  assert.equal(called, false);
  const worker = readFileSync(new URL('./candidate-worker.mjs', import.meta.url), 'utf8');
  assert.ok(worker.includes('await stopBeforeCheckpoint(stop,checkpoint)'));
  assert.ok(worker.includes('finally{await stop();verifyRuntime'));
  for (const event of ['shutdown-start', 'own-term-requested', 'own-exit', 'own-exits-confirmed'])
    assert.ok((worker + readFileSync(new URL('./candidate-core.mjs', import.meta.url), 'utf8')).includes(event));
  assert.ok(worker.includes("'own-shutdown.jsonl'"));
});

test('first child identity/signal failure never abandons remaining own children; no final checkpoint', async () => {
  const { stopOwnChildren, stopBeforeCheckpoint } = await import('./candidate-core.mjs');
  for (const reason of ['Own process identity changed', 'permission read/kill error']) {
    const children = [1, 2, 3].map((pid) => ({ pid, ownStartTicks: String(pid), exitCode: null, signalCode: null }));
    const signals = [],
      records = [];
    let checkpoint = false;
    const stop = () =>
      stopOwnChildren(children, {
        killOwn: (child, signal) => {
          if (child.pid === 1) throw Error(reason);
          signals.push([child.pid, signal]);
          return 'sent';
        },
        wait: async () => {
          for (const child of children.slice(1)) child.signalCode = 'SIGTERM';
        },
        record: (r) => records.push(r),
      });
    await assert.rejects(
      stopBeforeCheckpoint(stop, () => {
        checkpoint = true;
      }),
      (error) => error instanceof AggregateError && error.errors.some((e) => e.message === reason),
    );
    assert.deepEqual(signals, [
      [2, 'SIGTERM'],
      [3, 'SIGTERM'],
    ]);
    assert.equal(checkpoint, false);
    assert.equal(children[1].signalCode, 'SIGTERM');
    assert.equal(children[2].signalCode, 'SIGTERM');
    assert.ok(records.some((r) => r.event === 'own-signal-error' && r.pid === 1));
    assert.equal(records.at(-1).event, 'own-exits-unconfirmed');
  }
});
test('strict session derives all namespaces; helper pins/controlOPS cannot downgrade or cross-bind', () => {
  const q = input();
  assert.equal(smJob(q), '/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/candidate-batch-001');
  for (const sessionId of ['batch-000', 'batch-1000', 'batch-01', '../batch-001', 'batch-001/evil', 'oldjob1'])
    assert.throws(() => sessionPaths(sessionId));
  for (const patch of [
    { sessionId: 'batch-002' },
    { controlOpsSha: '' },
    { sourcePins: {} },
    { sourcePins: { ...q.sourcePins, '/tmp/untrusted.js': 'a'.repeat(64) } },
    { frontdoorConfigPath: sourceRoot + '/frontdoor-config-batch-002.json' },
    { mintControlLeasePath: '/var/lib/observe-worker/tag/candidate-sm-job-c70425b0-1/lease.json' },
  ])
    assert.throws(() => verifyInput({ ...q, ...patch }, now));
  const q2 = { ...q, sessionId: 'batch-002', ...sessionPaths('batch-002') };
  delete q2.smJob;
  verifyInput(q2, now);
  const receipt = {
    ...candidateReceiptBinding(q, 'a'.repeat(64)),
    status: 'owner-session-ended',
    scope: 'SM isolated candidate supervision ended; no Mint capture or UI review',
    timing: { cleanupReserveMs: 120000 },
    deployEligible: false,
    manifestPublished: false,
    uiReview: 'not reviewed',
    originalRuntimeUnchanged: true,
  };
  assert.throws(() => verifyOwnerSessionReceipt({ ...receipt, sessionId: 'batch-002' }, q, 'a'.repeat(64)));
  assert.throws(() => verifyOwnerSessionReceipt({ ...receipt, controlOpsSha: 'b'.repeat(40) }, q, 'a'.repeat(64)));
});

test('anonymous-only batch rejects fixture-auth actor despite valid secret', () => {
  for (const actor of ['reader', 'other', 'admin'])
    assert.throws(() => candidatePlan(input(), { ...config(), actor, batchSecret: 'a'.repeat(64) }));
});

test('actual isolated Git rejects forged control SHA, dirty source and incorrect blobs', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'tag-control-git-test-'));
  const folder = join(repo, 'tools/mint-sm-candidate');
  mkdirSync(folder, { recursive: true });
  const original = join(sourceRoot, '../..');
  const names = ['candidate-parent.mjs', 'candidate-worker.mjs', 'candidate-contract.mjs', 'candidate-core.mjs'];
  for (const name of names) copyFileSync(join(sourceRoot, name), join(folder, name));
  for (const name of Object.keys(sourcePins)) {
    const target = join(folder, name);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(sourceRoot, name), target);
  }
  const git = (args) =>
    execFileSync('/usr/bin/git', args, {
      cwd: repo,
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', LANG: 'C' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  git(['init', '-q']);
  git(['add', '.']);
  git(['-c', 'user.name=Isolated test', '-c', 'user.email=test@fixture.test', 'commit', '-qm', 'isolated source']);
  const sha = git(['rev-parse', 'HEAD']).trim();
  const module = await import(pathToFileURL(join(folder, 'candidate-contract.mjs')).href);
  const body = {
    controlOpsSha: sha,
    driverPins: Object.fromEntries(names.map((n) => [join(folder, n), digest(readFileSync(join(folder, n)))])),
    sourcePins: Object.fromEntries(Object.entries(sourcePins).map(([n, s]) => [join(folder, n), s])),
  };
  assert.equal(module.verifyControlSource(body), true);
  assert.throws(() => module.verifyControlSource({ ...body, controlOpsSha: 'f'.repeat(40) }), /Clean exact control/);
  const first = join(folder, names[0]);
  assert.throws(
    () => module.verifyControlSource({ ...body, driverPins: { ...body.driverPins, [first]: '0'.repeat(64) } }),
    /blob\/source mismatch/,
  );
  writeFileSync(first, readFileSync(first).toString() + '\n// dirty source\n');
  assert.throws(() => module.verifyControlSource(body), /Clean exact control/);
  copyFileSync(join(sourceRoot, names[0]), first);
  // Private generated configs are not source; tracked bytes and blobs remain exact.
  writeFileSync(join(folder, 'frontdoor-config-batch-001.json'), '{}\n', { mode: 0o600 });
  assert.equal(module.verifyControlSource(body), true);
  assert.throws(
    () =>
      module.verifyControlSource({ ...body, driverPins: { ...body.driverPins, [join(original, 'outside-control-root')]: '0'.repeat(64) } }),
    /blob\/source mismatch/,
  );
  // Keep this small isolated test repository; never remove a retained worktree.
});

test('early owner stop is exact, fresh and bound to own input/session/control source', async () => {
  const { validateOwnerStop } = await import('./candidate-contract.mjs');
  const body = input(),
    sha = 'a'.repeat(64);
  const request = {
    schema: 'sm-isolated-owner-stop-v1',
    inputSha256: sha,
    sessionId: body.sessionId,
    controlOpsSha: body.controlOpsSha,
    requestedAtMs: now,
  };
  assert.equal(validateOwnerStop(request, body, sha, now + 5000), true);
  for (const patch of [
    { schema: 'other' },
    { sessionId: 'batch-002' },
    { inputSha256: 'b'.repeat(64) },
    { controlOpsSha: 'd'.repeat(40) },
    { requestedAtMs: now + 1 },
    { requestedAtMs: now - 120001 },
    { arbitrary: true },
  ])
    assert.throws(() => validateOwnerStop({ ...request, ...patch }, body, sha, now));
  const worker = readFileSync(sourceRoot + '/candidate-worker.mjs', 'utf8');
  assert.ok(worker.indexOf("if(ownerStopRequested(job,input,inputSha))break;checkpoint('candidate-heartbeat')") >= 0);
});

test('actual parent arms capped900s elapsed timer with a single wall sample, despite postvalidation backward jumps', async () => {
  const { armCandidateTimer, candidateTimerExpired, candidateMaximumElapsedMs } = await import('./candidate-core.mjs');
  for (const wallAtArm of [now, now - 3600000, now - 9e12, now + 1000000]) {
    let reads = 0,
      mono = 100,
      timerDelay,
      callback,
      fired = false;
    const state = armCandidateTimer(now + 900000, () => (fired = true), {
      wallNow: () => {
        reads++;
        return reads === 1 ? wallAtArm : wallAtArm - 9e15;
      },
      monotonicNow: () => mono,
      setTimer: (fn, delay) => {
        callback = fn;
        timerDelay = delay;
        return 'mocktimer';
      },
    });
    assert.equal(reads, 1);
    assert.equal(candidateMaximumElapsedMs, 900000);
    assert.ok(timerDelay >= 1 && timerDelay <= 900000);
    mono = state.deadlineMonoMs - 1;
    assert.equal(candidateTimerExpired(state, { monotonicNow: () => mono }), false);
    mono++;
    assert.equal(candidateTimerExpired(state, { monotonicNow: () => mono }), true);
    callback();
    assert.equal(fired, true);
    assert.throws(() => candidateTimerExpired({ ...state, deadlineMonoMs: state.armedMonoMs + 900001 }, { monotonicNow: () => mono }));
  }
  const parent = readFileSync(sourceRoot + '/candidate-parent.mjs', 'utf8');
  assert.ok(parent.includes('const deadlineTimer=armCandidateTimer(input.expiresAtMs,'));
  assert.ok(parent.indexOf('const deadlineTimer=armCandidateTimer') < parent.indexOf('try{code=await guardedBuild'));
  assert.ok(parent.includes('candidateTimerExpired(elapsedDeadline)'));
  assert.ok(parent.includes('clearTimeout(deadlineTimer.timer)'));
  assert.ok(!parent.includes('20*60*1000'));
  assert.ok(!parent.includes('taskDeadlineMs-Date.now()'));
});

test('optional retry suffix derives exclusive SM/Mint namespaces without changing session or adopting old outputs', () => {
  const original = sessionPaths('batch-001'),
    retry = sessionPaths('batch-001', '-r2');
  for (const [key, path] of Object.entries(original)) {
    const changed = retry[key];
    assert.notEqual(changed, path);
    assert.ok(changed.includes('batch-001-r2'));
  }
  const body = input(),
    paths = sessionPaths(body.sessionId, '-r2');
  assert.doesNotThrow(() =>
    verifyInput(
      {
        ...body,
        attemptSuffix: '-r2',
        mintAdmissionPath: paths.mintAdmissionPath,
        mintControlLeasePath: paths.mintControlLeasePath,
        frontdoorConfigPath: paths.frontdoorConfigPath,
      },
      now,
    ),
  );
  assert.throws(() => verifyInput({ ...body, attemptSuffix: '-r2' }, now));
  for (const bad of ['-r0', '-r1', '-r02', '-r2/../x', '../', '-r1000', null, 7]) assert.throws(() => sessionPaths('batch-001', bad));
  const receipt = candidateReceiptBinding({ ...body, attemptSuffix: '-r2' }, 'a'.repeat(64));
  assert.equal(receipt.sessionId, 'batch-001');
  assert.equal(receipt.attemptSuffix, '-r2');
});

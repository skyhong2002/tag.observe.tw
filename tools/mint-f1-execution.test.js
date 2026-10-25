import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { guardedBuild } from './guard-next-build.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import {
  acquireGlobalLock,
  assertGlobalLock,
  combineGates,
  executeCandidate,
  globalLockPath,
  loggedStageCommand,
  readPrivateInput,
  safeEnvironment,
  stage,
  verifyIsolatedApi,
  verifySource,
} from './mint-f1-execution.js';

const mint = () => ({
  machineId: 'mint-id',
  hostname: 'mint',
  platform: 'linux',
  arch: 'x64',
  cpuCount: 4,
  nodeVersion: '24.15.0',
  nodeModulesAbi: '137',
  libc: 'glibc-2.41',
  nodePath: '/opt/node/bin/node',
  npmPath: '/opt/node/lib/npm-cli.js',
  npmVersion: '11.1.0',
});
function input() {
  const expiresAt = new Date(Date.now() + 60000).toISOString();
  return {
    appSha: initialAppSha,
    opsSha: 'a'.repeat(40),
    repo: resolve(new URL('..', import.meta.url).pathname),
    candidate: '/candidate/new',
    estimateGiB: 5,
    hostReceipt: {
      nativePolicy: {
        schema: 'mint-f1-native-policy-v1',
        reviewed: true,
        buildAllowed: true,
        strategy: 'elf-requirements-and-sm-target-smoke',
        reviewReceiptId: 'mock-native-policy',
        maxGlibcRequired: '2.39',
      },
      schema: 'mint-f1-host-v1',
      reviewed: true,
      mintReady: true,
      globalBuildSlot: true,
      reviewReceiptId: 'review',
      slotReceiptId: 'slot',
      executionReviewed: true,
      executionReviewReceiptId: 'execution-review',
      globalLockPath,
      expiresAt,
      smMachineId: 'sm-id',
      mint: mint(),
      noninteractivePath: '/opt/node/bin:/usr/bin:/bin',
      api: {
        origin: 'http://127.0.0.1:18131',
        isolatedDatabase: true,
        productionDatabase: false,
        machineId: 'mint-id',
        isolationReceiptId: 'api-review',
      },
      smAbi: { platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.41' },
    },
    smReceipt: {
      schema: 'mint-f1-sm-transport-v1',
      reviewed: true,
      reviewReceiptId: 'review',
      slotReceiptId: 'slot',
      globalBuildSlot: true,
      expiresAt,
      host: 'sm.example',
      user: 'gate',
      port: 22,
      smMachineId: 'sm-id',
      mintMachineId: 'mint-id',
      knownHostsPath: '/private/known_hosts',
      knownHostsSha256: 'a'.repeat(64),
    },
  };
}
const host = (i) => ({ verified: true, snapshot: mint(), apiOrigin: i.hostReceipt.api.origin, receipt: i.hostReceipt });
const sample = () => ({
  observedHost: 'SM',
  machineId: 'sm-id',
  measuredFromMachineId: 'sm-id',
  startedAtMs: Date.now() - 100,
  finishedAtMs: Date.now() - 10,
  ageMs: 100,
  load1: 2,
  homeAvailableBytes: 45 * 1024 ** 3,
  localSmBuildCount: 0,
  sites: ['https://tag.observe.tw/', 'https://blog.observe.tw/', 'https://youtube.observe.tw/'].map((url) => ({
    url,
    exitCode: 0,
    status: 200,
    total: 0.2,
    ttfb: 0.1,
  })),
});
const local = () => ({ mintLoad1: 2, mintAvailableBytes: 45 * 1024 ** 3, localMintBuildCount: 0 });
test('failed compiler stdout and stderr survive in a private append-only stage log', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'tag-stage-log-'));
  const log = resolve(dir, 'stage.log');
  loggedStageCommand(process.execPath, ['-e', "process.stdout.write('first-stage\\n')"], dir, { PATH: '/usr/bin:/bin' }, log);
  assert.throws(
    () =>
      loggedStageCommand(
        process.execPath,
        ['-e', "process.stdout.write('compile-start\\n');process.stderr.write('compiler-diagnostic\\n');process.exit(7)"],
        dir,
        { PATH: '/usr/bin:/bin' },
        log,
      ),
    /failed \(7\); see private stage log/,
  );
  const text = readFileSync(log, 'utf8');
  assert.match(text, /first-stage\n/);
  assert.match(text, /compile-start\n/);
  assert.match(text, /compiler-diagnostic\n/);
  assert.equal(statSync(log).mode & 0o777, 0o600);
});
test('stage spawn failure closes its own log and avoids echoing sensitive child errors', () => {
  const closed = [];
  assert.throws(
    () =>
      loggedStageCommand(
        '/node',
        [],
        '/candidate',
        {},
        '/candidate/log',
        (_bin, _args, options) => {
          assert.deepEqual(options.stdio, ['ignore', 91, 91]);
          return { error: new Error('sensitive-error'), status: null };
        },
        { openSync: () => 91, closeSync: (fd) => closed.push(fd) },
      ),
    (error) => /spawn error/.test(error.message) && !error.message.includes('sensitive-error'),
  );
  assert.deepEqual(closed, [91]);
});
test('private input and safe child environment never inherit credentials', () => {
  const i = input();
  const env = safeEnvironment(host(i), i.candidate);
  assert.equal(env.TAG_API_ORIGIN, i.hostReceipt.api.origin);
  assert.equal(env.GOOGLE_API_KEY, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  const io = { lstatSync: () => ({ isFile: () => true, uid: 1000, mode: 0o100600 }), readFileSync: () => JSON.stringify(i) };
  assert.equal(readPrivateInput('/private/input', io, 1000).appSha, initialAppSha);
  for (const stat of [
    { isFile: () => false, uid: 1000, mode: 0o120600 },
    { isFile: () => true, uid: 1001, mode: 0o100600 },
    { isFile: () => true, uid: 1000, mode: 0o100644 },
  ])
    assert.throws(() => readPrivateInput('/private/input', { ...io, lstatSync: () => stat }, 1000));
});
test('isolated HOME never sits inside Next workspace, including trailing-slash inputs', () => {
  const i = input();
  for (const candidate of [i.candidate, i.candidate + '/']) {
    const env = safeEnvironment(host(i), candidate);
    const homeFromWorkspace = relative(resolve(candidate), env.HOME);
    assert.ok(homeFromWorkspace.startsWith('../') || isAbsolute(homeFromWorkspace));
    assert.equal(env.HOME, resolve(i.candidate) + '.home');
    assert.notEqual(env.HOME, process.env.HOME);
  }
});
test('exact source fresh fetch, ancestry, clean checkout and OPS blob checks are explicit', () => {
  const i = input();
  const calls = [];
  const run = (bin, args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return i.opsSha + '\n';
    if (args[0] === 'show') return args[1].endsWith('next.config.ts') ? 'cpus: 2, staticGenerationMaxConcurrency: 1,' : 'module';
    return '';
  };
  assert.equal(
    verifySource(i, run, () => 'module'),
    true,
  );
  assert.deepEqual(calls[0], ['fetch', 'origin']);
  assert.ok(calls.some((args) => args.includes('--untracked-files=all')));
  assert.ok(calls.some((args) => args[0] === 'merge-base' && args[2] === 'origin/main' && args[3] === initialAppSha));
  assert.throws(
    () =>
      verifySource(
        i,
        (bin, args) => (args[0] === 'status' ? '?? unexpected\n' : run(bin, args)),
        () => 'module',
      ),
    /clean/,
  );
  assert.throws(() => verifySource(i, run, () => 'changed'), /blob/);
});
test('isolated API readiness must match host, source, receipt and database scope', async () => {
  const i = input();
  const data = {
    machineId: 'mint-id',
    appSha: initialAppSha,
    scope: 'mint-f1-isolated',
    databaseScope: 'isolated',
    productionDatabase: false,
    isolationReceiptId: 'api-review',
  };
  const fetchApi = async (url, opts) => {
    assert.equal(url.pathname, '/internal/mint-f1-readiness');
    assert.equal(opts.redirect, 'error');
    return new Response(JSON.stringify(data));
  };
  assert.equal(await verifyIsolatedApi(i, host(i), fetchApi), true);
  data.databaseScope = 'production';
  await assert.rejects(verifyIsolatedApi(i, host(i), fetchApi), /mismatch/);
});
test('SM and separate Mint gates reject either host failure without replacing SM fields', () => {
  const i = input();
  const options = { starting: true, estimatedUsageGiB: 5 };
  assert.equal(combineGates(sample(), local(), i, options), 'run');
  for (const change of [{ mintLoad1: 13 }, { localMintBuildCount: 1 }, { mintAvailableBytes: 31 * 1024 ** 3 }])
    assert.equal(combineGates(sample(), { ...local(), ...change }, i, options), 'pause');
  const slow = sample();
  slow.sites[1].total = 6.18;
  assert.equal(combineGates(slow, local(), i, options), 'pause');
  assert.equal(combineGates({ ...sample(), machineId: 'mint-id' }, local(), i, options), 'pause');
});
test('mock execution holds common lock through guard and artifact and preserves safe spawn env', async () => {
  const i = input();
  const events = [];
  let released = false;
  const result = await executeCandidate(i, {
    verifyHost: async () => host(i),
    verifyApi: async () => true,
    verifySource: () => true,
    sourceReceipt: () => ({ appSha: initialAppSha }),
    acquireLock: async () => {
      events.push('lock');
      return {
        pid: 123,
        alive: () => true,
        release: async () => {
          released = true;
          events.push('release');
        },
      };
    },
    io: {
      mkdirSync: (p) => {
        events.push('mkdir');
      },
      appendFileSync: () => {},
      writeFileSync: () => {},
    },
    assertLock: () => true,
    probeSM: async () => sample(),
    mintSample: () => local(),
    spawnBuild: (bin, args, opts) => {
      assert.equal(opts.env.GOOGLE_API_KEY, undefined);
      assert.equal(opts.env.TAG_API_ORIGIN, i.hostReceipt.api.origin);
      return {};
    },
    guard: async (options) => {
      assert.equal(released, false);
      events.push('guard');
      assert.equal((await options.probe()).probeError, undefined);
      options.spawnBuild('ionice', ['-c', '3'], { env: { GOOGLE_API_KEY: 'mock' } });
      return 0;
    },
    elfProof: () => ({ status: 'inspected', mock: true }),
    artifactFactory: (root, identity) => {
      assert.equal(released, false);
      assert.equal(root, i.candidate + '.runtime');
      assert.equal(identity.opsSha, i.opsSha);
      events.push('artifact');
      return { status: 'prepared' };
    },
  });
  assert.equal(result.status, 'prepared');
  assert.deepEqual(
    events.filter((e) => e !== 'mkdir'),
    ['lock', 'guard', 'artifact', 'release'],
  );
});
test('failures retain candidate, release lock and never mark artifact prepared', async () => {
  const i = input();
  let released = 0;
  let artifacts = 0;
  const dependencies = {
    verifyHost: async () => host(i),
    verifyApi: async () => true,
    verifySource: () => true,
    sourceReceipt: () => ({}),
    acquireLock: async () => ({ pid: 123, alive: () => true, release: async () => released++ }),
    io: { mkdirSync: () => {}, appendFileSync: () => {}, writeFileSync: () => {} },
    assertLock: () => true,
    guard: async () => 1,
    elfProof: () => ({ status: 'inspected', mock: true }),
    artifactFactory: () => artifacts++,
  };
  await assert.rejects(executeCandidate(i, dependencies), /retained/);
  assert.equal(released, 1);
  assert.equal(artifacts, 0);
  const notReady = input();
  notReady.hostReceipt.mintReady = false;
  await assert.rejects(executeCandidate(notReady, dependencies));
  assert.equal(released, 1);
});
test('runStage callback discards its inherited env and records only safe stage context', async () => {
  const i = input();
  const calls = [];
  await stage(
    i,
    {
      verifyHost: async () => host(i),
      verifyApi: async () => true,
      assertLock: () => true,
      readPrivateInput: () => i,
      verifySource: () => true,
      deriveRuntime: () => ({ status: 'mock derived' }),
      stageRecord: (e) => assert.equal(e.appSha, initialAppSha),
      appendLog: () => {},
      runStage: (options, sha, run) =>
        run('npm', ['ci'], '/candidate/new', '/candidate/new/log', { GOOGLE_API_KEY: 'mock', TAG_API_ORIGIN: 'http://production' }),
      runCommand: (bin, args, cwd, env) => {
        assert.equal(env.GOOGLE_API_KEY, undefined);
        assert.equal(env.TAG_API_ORIGIN, i.hostReceipt.api.origin);
        calls.push(bin);
        return '';
      },
    },
    123,
    '/private/input.json',
  );
  assert.equal(calls.length, 2); // Stage plus explicit native-loader smoke check.
});

test('actual lock adapter uses common flock and retains holder until release (mock)', async () => {
  const i = input();
  let calls = 0;
  const lock = await acquireGlobalLock(
    i,
    (bin, args, opts) => {
      calls++;
      assert.equal(bin, '/usr/bin/flock');
      assert.deepEqual(args.slice(0, 4), ['-n', '-F', '--', globalLockPath]);
      assert.equal(opts.env.DATABASE_URL, undefined);
      const child = new EventEmitter();
      child.pid = 123;
      child.stdout = new EventEmitter();
      child.stdin = { end: () => queueMicrotask(() => child.emit('close', 0)) };
      child.kill = () => child.emit('close', 1);
      queueMicrotask(() => child.stdout.emit('data', Buffer.from('LOCKED\n')));
      return child;
    },
    { lstatSync: () => ({ isFile: () => true, dev: 0, ino: 1234 }), readFileSync: () => '1: FLOCK ADVISORY WRITE 123 00:00:1234 0 EOF' },
  );
  assert.equal(lock.alive(), true);
  await lock.release();
  assert.equal(lock.alive(), false);
  assert.equal(calls, 1);
  i.hostReceipt.globalLockPath = '/private/tag-only.lock';
  await assert.rejects(
    acquireGlobalLock(i, () => {
      calls++;
    }),
    /common/,
  );
  assert.equal(calls, 1);
});
test('receipt/input credentials are rejected before any adapter or child sees them', async () => {
  for (const alter of [
    (i) => {
      i.GOOGLE_API_KEY = 'not-real';
    },
    (i) => {
      i.hostReceipt.api.password = 'not-real';
    },
    (i) => {
      i.smReceipt.privateKey = 'not-real';
    },
  ]) {
    const i = input();
    alter(i);
    let calls = 0;
    await assert.rejects(
      executeCandidate(i, {
        verifyHost: async () => {
          calls++;
        },
      }),
      /credentials/,
    );
    assert.equal(calls, 0);
  }
});

test('stage cannot bypass host-wide lock and kernel proof rejects unrelated inode', async () => {
  await assert.rejects(
    stage(input(), {
      verifyHost: async () => {
        throw new Error('host must not be called');
      },
    }),
    /Stage private receipt path/,
  );
  const io = {
    lstatSync: () => ({ isFile: () => true, dev: 0, ino: 1234 }),
    readFileSync: () => '1: FLOCK ADVISORY WRITE 123 00:00:9999 0 EOF',
  };
  assert.throws(() => assertGlobalLock(123, io), /kernel-confirmed/);
  assert.throws(() => assertGlobalLock(0, io), /Held global/);
});

test('stage rechecks private current receipt, exact source and independent review', async () => {
  const i = input();
  let runs = 0;
  let sources = 0;
  const deps = {
    readPrivateInput: () => i,
    assertLock: () => true,
    verifyHost: async () => host(i),
    verifyApi: async () => true,
    verifySource: () => {
      sources++;
      throw new Error('OPS source mismatch');
    },
    runStage: () => {
      runs++;
    },
  };
  await assert.rejects(stage(i, deps, 123, '/private/input'), /source mismatch/);
  assert.equal(sources, 1);
  assert.equal(runs, 0);
  i.hostReceipt.executionReviewed = false;
  await assert.rejects(stage(i, deps, 123, '/private/input'), /review/);
  assert.equal(sources, 1);
  i.hostReceipt.executionReviewed = true;
  i.hostReceipt.expiresAt = new Date(Date.now() - 1).toISOString();
  await assert.rejects(stage(i, deps, 123, '/private/input'));
  assert.equal(runs, 0);
  const different = input();
  await assert.rejects(
    stage(different, { ...deps, readPrivateInput: () => ({ ...different, appSha: 'b'.repeat(40) }) }, 123, '/private/input'),
    /mismatch/,
  );
});
test('readiness oversize stream is cancelled without unbounded text fallback', async () => {
  let reads = 0;
  let cancelled = false;
  let released = false;
  const i = input();
  const response = {
    ok: true,
    text: () => {
      throw new Error('unbounded text forbidden');
    },
    body: {
      getReader: () => ({
        read: async () => {
          reads++;
          return { done: false, value: new Uint8Array(5000) };
        },
        cancel: async () => {
          cancelled = true;
        },
        releaseLock: () => {
          released = true;
        },
      }),
    },
  };
  await assert.rejects(
    verifyIsolatedApi(i, host(i), async () => response),
    /Oversized/,
  );
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
  assert.equal(released, true);
  await assert.rejects(
    verifyIsolatedApi(i, host(i), async () => ({ ok: true, text: async () => '{}' })),
    /Bounded/,
  );
});
test('live holder with replaced lock inode is fatal and never produces artifact', async () => {
  const i = input();
  let aborted = 0;
  let artifacts = 0;
  let released = 0;
  let probes = 0;
  await assert.rejects(
    executeCandidate(i, {
      verifyHost: async () => host(i),
      verifyApi: async () => true,
      verifySource: () => true,
      sourceReceipt: () => ({}),
      acquireLock: async () => ({
        pid: 123,
        alive: () => true,
        release: async () => {
          released++;
        },
      }),
      io: { mkdirSync: () => {}, appendFileSync: () => {}, writeFileSync: () => {} },
      assertLock: () => {
        throw new Error('inode replaced');
      },
      abortGuard: () => {
        aborted++;
      },
      probeSM: async () => {
        probes++;
        return sample();
      },
      elfProof: () => ({ status: 'inspected', mock: true }),
      artifactFactory: () => {
        artifacts++;
      },
      guard: async (options) => {
        const result = await options.probe();
        assert.match(result.probeError, /Fatal/);
        return 0;
      },
    }),
    /Fatal global lock loss/,
  );
  assert.equal(aborted, 1);
  assert.equal(artifacts, 0);
  assert.equal(probes, 0);
  assert.equal(released, 1);
});

test('holder release deadline escalates only own holder then reaps (mock timers)', async () => {
  const callbacks = [];
  const delays = [];
  const signals = [];
  let child;
  const lock = await acquireGlobalLock(
    input(),
    () => {
      child = new EventEmitter();
      child.pid = 123;
      child.stdout = new EventEmitter();
      child.stdin = { end: () => {} };
      child.kill = (signal) => {
        signals.push(signal);
        if (signal === 'SIGKILL') queueMicrotask(() => child.emit('close', null));
      };
      queueMicrotask(() => child.stdout.emit('data', Buffer.from('LOCKED\n')));
      return child;
    },
    { lstatSync: () => ({ isFile: () => true, dev: 0, ino: 1234 }), readFileSync: () => '1: FLOCK ADVISORY WRITE 123 00:00:1234 0 EOF' },
    {
      setTimeout: (callback, delay) => {
        callbacks.push(callback);
        delays.push(delay);
        return callbacks.length;
      },
      clearTimeout: () => {},
    },
  );
  const releasing = lock.release();
  assert.deepEqual(delays, [5000]);
  callbacks[0]();
  callbacks[1]();
  await releasing;
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(lock.alive(), false);
  assert.deepEqual(delays, [5000, 1000, 1000]);
});

test('lock replacement during artifact hashing fails before final artifact writer', async () => {
  const i = input();
  const writes = [];
  const audits = [];
  let asserts = 0;
  let released = false;
  await assert.rejects(
    executeCandidate(i, {
      verifyHost: async () => host(i),
      verifyApi: async () => true,
      verifySource: () => true,
      sourceReceipt: () => ({}),
      acquireLock: async () => ({
        pid: 123,
        alive: () => true,
        release: async () => {
          released = true;
        },
      }),
      io: { mkdirSync: () => {}, appendFileSync: (p, data) => audits.push(data), writeFileSync: (p) => writes.push(p) },
      assertLock: () => {
        if (++asserts === 2) throw new Error('inode changed');
      },
      guard: async () => 0,
      elfProof: () => ({ status: 'inspected', mock: true }),
      artifactFactory: () => ({ status: 'prepared' }),
    }),
    /without final artifact/,
  );
  assert.equal(released, true);
  assert.equal(
    writes.some((p) => p.endsWith('mint-artifact.json')),
    false,
  );
  assert.ok(audits.some((text) => text.includes('fatal-post-artifact-lock-loss')));
});

test('fresh post-hash service gate must pass before final writer', async () => {
  const i = input();
  const writes = [];
  await assert.rejects(
    executeCandidate(i, {
      verifyHost: async () => host(i),
      verifyApi: async () => true,
      verifySource: () => true,
      sourceReceipt: () => ({}),
      acquireLock: async () => ({ pid: 123, alive: () => true, release: async () => {} }),
      io: { mkdirSync: () => {}, appendFileSync: () => {}, writeFileSync: (p) => writes.push(p) },
      assertLock: () => true,
      guard: async () => 0,
      elfProof: () => ({ status: 'inspected', mock: true }),
      artifactFactory: () => ({ status: 'prepared' }),
      probeSM: async () => ({ probeError: 'unavailable', sites: [] }),
      mintSample: () => local(),
    }),
    /Fresh final/,
  );
  assert.equal(
    writes.some((p) => p.endsWith('mint-artifact.json')),
    false,
  );
});
test('fatal kernel lock loss makes existing guard exit and reap only mocked candidate group', async () => {
  const i = input();
  const signals = [];
  let checks = 0;
  let artifacts = 0;
  let released = false;
  const child = new EventEmitter();
  child.pid = 43210;
  await assert.rejects(
    executeCandidate(i, {
      verifyHost: async () => host(i),
      verifyApi: async () => true,
      verifySource: () => true,
      sourceReceipt: () => ({}),
      acquireLock: async () => ({
        pid: 123,
        alive: () => true,
        release: async () => {
          released = true;
        },
      }),
      io: { mkdirSync: () => {}, appendFileSync: () => {}, writeFileSync: () => {} },
      assertLock: () => {
        if (++checks > 1) throw new Error('lock replaced');
      },
      probeSM: async () => sample(),
      mintSample: () => local(),
      spawnBuild: () => child,
      elfProof: () => ({ status: 'inspected', mock: true }),
      artifactFactory: () => {
        artifacts++;
      },
      guard: (options) =>
        guardedBuild({
          ...options,
          intervalMs: 1,
          killGroup: (pid, signal) => {
            signals.push([pid, signal]);
            if (signal === 'SIGTERM') queueMicrotask(() => child.emit('close', 143));
          },
        }),
    }),
    /Fatal global lock loss/,
  );
  assert.equal(artifacts, 0);
  assert.equal(released, true);
  assert.deepEqual(signals, [
    [-43210, 'SIGCONT'],
    [-43210, 'SIGTERM'],
    [-43210, 'SIGKILL'],
  ]);
});

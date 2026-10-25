import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  baselineMeasurement,
  buildDecision,
  GiB,
  guardedBuild,
  probeServices,
  siteBaselinesSeconds,
  siteBudgetsSeconds,
  sites,
} from './guard-next-build.js';
import { curlStdoutFixture, homepageSiteFixture } from './test-fixtures/homepage-probe.mjs';

const sample = (overrides = {}) => ({
  load1: 5,
  homeAvailableBytes: 50 * GiB,
  sites: sites.map((url) => homepageSiteFixture(url)),
  ...overrides,
});

test('load, disk and time boundaries; resume requires healthy probes, load <10, disk >=40 GiB', () => {
  for (const [load1, decision] of [
    [12, 'run'],
    [12.01, 'pause'],
  ])
    assert.equal(buildDecision(sample({ load1 }), false), decision);
  for (const [disk, decision] of [
    [30, 'run'],
    [29.99, 'pause'],
  ])
    assert.equal(buildDecision(sample({ homeAvailableBytes: disk * GiB }), false), decision);
  for (const [load1, disk, decision] of [
    [10, 40, 'wait'],
    [9.99, 39.99, 'wait'],
    [9.99, 40, 'run'],
  ]) {
    assert.equal(buildDecision(sample({ load1, homeAvailableBytes: disk * GiB }), true), decision);
  }
  for (const url of sites) {
    const budget = url === 'https://blog.observe.tw/' ? 6.17 : 2;
    assert.equal(siteBudgetsSeconds[url], budget);
    for (const [patch, decision] of [
      [{ total: budget }, 'run'],
      [{ total: budget + 0.001 }, 'pause'],
      [{ status: 500 }, 'pause'],
      [{ exitCode: 28 }, 'pause'],
    ]) {
      const s = sample(),
        i = s.sites.findIndex((r) => r.url === url);
      s.sites[i] = homepageSiteFixture(url, [patch.total ?? 0.5, patch.total ?? 0.5, patch.total ?? 0.5], {
        patches: [patch, patch, patch],
      });
      assert.equal(buildDecision(s, false), decision);
    }
  }
});

test('missing and malformed probe fields fail closed', () => {
  for (const s of [
    undefined,
    {},
    sample({ sites: [] }),
    sample({ load1: NaN }),
    sample({ homeAvailableBytes: undefined }),
    sample({ probeError: 'failed' }),
  ]) {
    assert.equal(buildDecision(s, false), 'pause');
  }
  for (const field of ['url', 'status', 'ttfb', 'total', 'exitCode']) {
    const s = sample();
    delete s.sites[2][field];
    assert.equal(buildDecision(s, false), 'pause');
  }
  const s = sample();
  s.sites[2] = { ...s.sites[0] };
  assert.equal(buildDecision(s, false), 'pause');
});

test('start needs >=40 GiB and estimated usage must leave >=30 GiB', () => {
  for (const [disk, estimate, expected] of [
    [39.99, 1, 'pause'],
    [40, 10, 'run'],
    [40, 10.01, 'pause'],
    [50, 20, 'run'],
    [50, 0, 'pause'],
    [50, undefined, 'pause'],
  ]) {
    assert.equal(
      buildDecision(sample({ homeAvailableBytes: disk * GiB }), false, { starting: true, estimatedUsageGiB: estimate }),
      expected,
    );
  }
});

test('service and /home probes are mocked, and collect curl total for all three sites', async () => {
  const calls = [];
  const s = await probeServices({
    executeProbe: async (command, args) => {
      calls.push({ command, args });
      return { stdout: curlStdoutFixture({ total: 0.2 }) };
    },
    diskProbe: async (path) => {
      assert.equal(path, '/home');
      return { bavail: 40, bsize: GiB };
    },
    loadProbe: () => [3],
  });
  assert.equal(s.homeAvailableBytes, 40 * GiB);
  assert.equal(calls.length, 9);
  for (const url of sites) assert.equal(calls.filter((c) => c.args.at(-1) === url).length, 3);
  for (const { args } of calls) {
    assert.ok(args.includes('DNT: 1'));
    assert.ok(args.includes('Accept: text/html'));
  }
  assert.equal(buildDecision(s, false), 'run');
  await assert.rejects(
    probeServices({
      executeProbe: async () => ({ stdout: curlStdoutFixture({ total: 0.2 }) }),
      diskProbe: async () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/,
  );
});

test('mock child uses dedicated low priority group; STOP/CONT and cleanup never target another group', async () => {
  const child = new EventEmitter();
  child.pid = 43210;
  const signals = [];
  const records = [];
  let tick = 0;
  let spawned = 0;
  const code = await guardedBuild({
    command: 'node',
    args: ['next', 'build'],
    cwd: '/mock',
    estimatedUsageGiB: 5,
    intervalMs: 0,
    record: (entry) => records.push(entry),
    spawnBuild: (command, args, options) => {
      spawned++;
      assert.equal(command, 'ionice');
      assert.deepEqual(args, ['-c', '3', 'nice', '-n', '19', 'node', 'next', 'build']);
      assert.equal(options.detached, true);
      return child;
    },
    killGroup: (pid, signal) => {
      assert.equal(pid, -child.pid);
      signals.push(signal);
    },
    probe: async () => {
      tick++;
      if (tick === 1) return sample({ homeAvailableBytes: 39 * GiB });
      if (tick === 3) return sample({ load1: 13 });
      if (tick === 4) return sample({ homeAvailableBytes: 39 * GiB });
      if (tick === 6) {
        child.emit('close', 0, null);
      }
      return sample();
    },
  });
  assert.equal(code, 0);
  assert.equal(spawned, 1);
  assert.deepEqual(signals, ['SIGSTOP', 'SIGCONT', 'SIGKILL']);
  assert.equal(records[0].decision, 'pause');
  assert.ok(records.some((entry) => entry.decision === 'wait'));
});

test('probe exceptions pause and spawn errors still reclaim the mocked group', async () => {
  const child = new EventEmitter();
  child.pid = 43211;
  const signals = [];
  let tick = 0;
  const code = await guardedBuild({
    command: 'node',
    args: [],
    estimatedUsageGiB: 1,
    intervalMs: 0,
    record: () => {},
    killGroup: (pid, signal) => signals.push([pid, signal]),
    spawnBuild: () => {
      queueMicrotask(() => child.emit('error', new Error('spawn failed')));
      return child;
    },
    probe: async () => {
      if (++tick === 1) throw new Error('probe failed');
      return sample();
    },
  });
  assert.equal(code, 1);
  assert.deepEqual(signals, [[-child.pid, 'SIGKILL']]);
});

test('interruption continues a stopped group before TERM and always cleans it up', async () => {
  const child = new EventEmitter();
  child.pid = 43212;
  const signals = [];
  let tick = 0;
  const code = await guardedBuild({
    command: 'node',
    args: [],
    estimatedUsageGiB: 1,
    intervalMs: 0,
    record: () => {},
    spawnBuild: () => child,
    killGroup: (pid, signal) => {
      assert.equal(pid, -child.pid);
      signals.push(signal);
      if (signal === 'SIGTERM') queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
    },
    probe: async () => {
      if (++tick === 2) return sample({ load1: 13 });
      if (tick === 3) process.emit('SIGINT');
      return sample();
    },
  });
  assert.equal(code, 130);
  assert.deepEqual(signals, ['SIGSTOP', 'SIGCONT', 'SIGTERM', 'SIGKILL']);
});

test('STOP and CONT cover a worker descendant; low-priority job exits cleanly', { timeout: 10000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tag-build-guard-'));
  const pulse = join(directory, 'pulse');
  const observations = [];
  let stage = 0;
  let frozen;
  const worker = `const fs=require('node:fs');setInterval(()=>fs.appendFileSync(${JSON.stringify(pulse)},'x'),10)`;
  const parent = `const {spawn}=require('node:child_process');const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(join(directory, 'nice'))},String(require('node:os').getPriority()));const p=spawn(process.execPath,['-e',${JSON.stringify(worker)}]);setTimeout(()=>{p.kill();process.exit(0)},1500)`;
  try {
    const code = await guardedBuild({
      estimatedUsageGiB: 1,
      command: process.execPath,
      args: ['-e', parent],
      cwd: directory,
      intervalMs: 75,
      record: (entry) => observations.push(entry),
      probe: async () => {
        if (stage === 0) {
          stage++;
          return sample();
        }
        if (stage === 1) {
          for (let i = 0; i < 100 && !existsSync(pulse); i++) await delay(10);
          assert.ok(existsSync(pulse), 'child worker started');
          stage++;
          return sample({ load1: 13 });
        }
        if (stage === 2) {
          frozen = readFileSync(pulse).length;
          stage++;
          return sample({ load1: 12 });
        }
        if (stage === 3) {
          assert.equal(readFileSync(pulse).length, frozen, 'descendant stays stopped while load is 12');
          stage++;
          return sample({ load1: 9 });
        }
        if (stage === 4) {
          assert.ok(readFileSync(pulse).length > frozen, 'descendant resumes below 10');
          stage++;
          return sample();
        }
        return sample();
      },
    });
    assert.equal(code, 0);
    assert.equal(readFileSync(join(directory, 'nice'), 'utf8'), '19');
    assert.deepEqual(
      observations.filter((e) => e.event === 'signal').map((e) => e.signal),
      ['SIGSTOP', 'SIGCONT'],
    );
    assert.equal(stage, 5);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a successful leader exit cannot leave a worker running without the guard', { timeout: 10000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tag-build-orphan-'));
  const pidPath = join(directory, 'worker-pid');
  let group;
  try {
    const worker = "process.on('SIGTERM',()=>{});setInterval(()=>{},20)";
    const parent = `const p=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(worker)}],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(pidPath)},String(p.pid));setTimeout(()=>process.exit(0),150)`;
    const code = await guardedBuild({
      estimatedUsageGiB: 1,
      command: process.execPath,
      args: ['-e', parent],
      cwd: directory,
      intervalMs: 50,
      probe: async () => sample(),
      record: (entry) => {
        if (entry.event === 'started') group = entry.processGroup;
      },
    });
    assert.equal(code, 0);
    const pid = Number(readFileSync(pidPath, 'utf8'));
    await delay(50);
    // Linux can briefly retain a killed orphan as a zombie before PID 1 reaps it.
    if (existsSync(`/proc/${pid}/stat`)) assert.match(readFileSync(`/proc/${pid}/stat`, 'utf8'), /\) Z /);
  } finally {
    try {
      if (group) process.kill(-group, 'SIGKILL');
    } catch {
      /* no remaining group */
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test('blog may take up to 6.17 seconds while tag and YouTube retain two seconds', () => {
  for (const url of sites) {
    const s = sample(),
      i = s.sites.findIndex((r) => r.url === url);
    s.sites[i] = homepageSiteFixture(url, [3, 3, 3]);
    assert.equal(buildDecision(s, false), url === 'https://blog.observe.tw/' ? 'run' : 'pause');
  }
});

test('approved baseline receipt is pinned and computes exact relative limits without rebasing', () => {
  assert.deepEqual(siteBaselinesSeconds, {
    'https://tag.observe.tw/': 0.256,
    'https://blog.observe.tw/': 3.085,
    'https://youtube.observe.tw/': 0.289,
  });
  assert.deepEqual(siteBudgetsSeconds, {
    'https://tag.observe.tw/': 2,
    'https://blog.observe.tw/': 6.17,
    'https://youtube.observe.tw/': 2,
  });
  assert.equal(baselineMeasurement.startedUTC, '2026-10-13T05:47:30Z');
  assert.equal(baselineMeasurement.finishedUTC, '2026-10-13T05:48:30Z');
  assert.match(baselineMeasurement.method, /Five homepage HTML/);
  assert.match(baselineMeasurement.sourceReceiptSha256, /^[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(siteBudgetsSeconds));
});

test('build guard uses median while any HTTP/curl error pauses the group', () => {
  const s = sample(),
    i = s.sites.findIndex((r) => r.url.includes('blog'));
  s.sites[i] = homepageSiteFixture(s.sites[i].url, [3, 8, 3]);
  assert.equal(buildDecision(s, false), 'run');
  s.sites[i] = homepageSiteFixture(s.sites[i].url, [3, 8, 9]);
  assert.equal(buildDecision(s, false), 'pause');
  for (const patch of [{ status: 500 }, { status: 301 }, { status: 404 }, { exitCode: 28 }]) {
    s.sites[i] = homepageSiteFixture(s.sites[i].url, [3, 3, 3], { patches: [{}, patch] });
    assert.equal(buildDecision(s, false), 'pause');
  }
});

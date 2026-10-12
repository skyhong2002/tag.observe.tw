import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { buildDecision, guardedBuild } from './guard-next-build.js';

const sample = (load1, status = 200, exitCode = 0) => ({ load1, sites: [{ status, exitCode }] });
test('pause on service failure/load >16; resume only below 10 with healthy probes', () => {
  assert.equal(buildDecision(sample(16), false), 'run');
  assert.equal(buildDecision(sample(16.01), false), 'pause');
  assert.equal(buildDecision(sample(5, 500), false), 'pause');
  assert.equal(buildDecision(sample(5, 503), false), 'pause');
  assert.equal(buildDecision(sample(5, 103, 28), false), 'pause');
  assert.equal(buildDecision(sample(10), true), 'wait');
  assert.equal(buildDecision(sample(9.99), true), 'run');
  assert.equal(buildDecision(sample(9, 500), true), 'pause');
  assert.equal(buildDecision({ ...sample(5), probeError: 'failed' }, false), 'pause');
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
      command: process.execPath,
      args: ['-e', parent],
      cwd: directory,
      intervalMs: 75,
      record: (entry) => observations.push(entry),
      probe: async () => {
        if (stage === 0) {
          stage++;
          return sample(5);
        }
        if (stage === 1) {
          for (let i = 0; i < 100 && !existsSync(pulse); i++) await delay(10);
          assert.ok(existsSync(pulse), 'child worker started');
          stage++;
          return sample(17);
        }
        if (stage === 2) {
          frozen = readFileSync(pulse).length;
          stage++;
          return sample(12);
        }
        if (stage === 3) {
          assert.equal(readFileSync(pulse).length, frozen, 'descendant stays stopped while load is 12');
          stage++;
          return sample(9);
        }
        if (stage === 4) {
          assert.ok(readFileSync(pulse).length > frozen, 'descendant resumes below 10');
          stage++;
          return sample(5);
        }
        return sample(5);
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
      command: process.execPath,
      args: ['-e', parent],
      cwd: directory,
      intervalMs: 50,
      probe: async () => sample(5),
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

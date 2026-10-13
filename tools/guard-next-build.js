// Keep builds subordinate to the public services on this shared Linux host.
import { execFile, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
export const sites = ['https://tag.observe.tw/', 'https://blog.observe.tw/', 'https://youtube.observe.tw/'];
export const GiB = 1024 ** 3;

export function buildDecision(sample, paused, { starting = false, estimatedUsageGiB } = {}) {
  const unavailable = !sample || sample.probeError || !Array.isArray(sample.sites)
    || sample.sites.length !== sites.length || sites.some((url) => {
      const site = sample.sites.find((entry) => entry?.url === url);
      return !site || site.exitCode !== 0 || !Number.isInteger(site.status)
        || site.status < 200 || site.status >= 400 || !Number.isFinite(site.total)
        || site.total < 0 || site.total > 2 || !Number.isFinite(site.ttfb) || site.ttfb < 0;
    });
  if (unavailable || !Number.isFinite(sample.load1) || sample.load1 < 0
    || sample.load1 > 12 || !Number.isFinite(sample.homeAvailableBytes)
    || sample.homeAvailableBytes < 30 * GiB) return 'pause';
  if (starting && (!Number.isFinite(estimatedUsageGiB) || estimatedUsageGiB <= 0
    || sample.homeAvailableBytes < 40 * GiB
    || sample.homeAvailableBytes - estimatedUsageGiB * GiB < 30 * GiB)) return 'pause';
  // Resume only with all three healthy services, load <10 and /home >=40 GiB.
  if (paused && (sample.load1 >= 10 || sample.homeAvailableBytes < 40 * GiB)) return 'wait';
  return 'run';
}

export async function probeServices({ executeProbe = execute, diskProbe = statfs, loadProbe = loadavg } = {}) {
  const startedAt = new Date().toISOString();
  const responses = await Promise.all(
    sites.map(async (url) => {
      let stdout;
      let exitCode = 0;
      try {
        ({ stdout } = await executeProbe(
          'curl',
          ['-sS', '--max-time', '10', '-o', '/dev/null', '-w', '%{http_code} %{time_starttransfer} %{time_total}', url],
          { timeout: 12000 },
        ));
      } catch (error) {
        stdout = error.stdout ?? '';
        exitCode = typeof error.code === 'number' ? error.code : 1;
      }
      const [status, ttfb, total] = stdout.trim().split(/\s+/).map(Number);
      return {
        url,
        status: status || 0,
        ttfb: Number.isFinite(ttfb) ? ttfb : null,
        total: Number.isFinite(total) ? total : null,
        exitCode,
      };
    }),
  );
  const disk = await diskProbe('/home');
  const homeAvailableBytes = Number(disk.bavail) * Number(disk.bsize);
  return { startedAt, finishedAt: new Date().toISOString(), load1: loadProbe()[0], homeAvailableBytes, sites: responses };
}

export async function guardedBuild({ command, args, cwd, record, probe = probeServices, intervalMs = 30000, estimatedUsageGiB, spawnBuild = spawn, killGroup = process.kill.bind(process) }) {
  let child;
  let result;
  let paused = false;
  let interrupted = false;
  let forceTimer;
  let wake;
  const completed = new Promise((done) => {
    wake = done;
  });
  const signalGroup = (signal) => {
    if (!child || result) return;
    try {
      killGroup(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    record({ event: 'signal', signal, processGroup: child.pid });
  };
  const interrupt = (signal) => {
    if (interrupted) return;
    interrupted = true;
    try {
      // A stopped process cannot handle TERM until continued.
      signalGroup('SIGCONT');
      signalGroup('SIGTERM');
      record({ event: 'interrupted', signal });
    } catch {
      // Even a failed audit write must not strand the build after interruption.
      try {
        if (child?.pid) killGroup(-child.pid, 'SIGKILL');
      } catch {
        /* already exited */
      }
    }
    if (child && !result) forceTimer = setTimeout(() => signalGroup('SIGKILL'), 10000);
    else wake();
  };
  const onInt = () => interrupt('SIGINT');
  const onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  try {
    while (!result && !interrupted) {
      const tick = Date.now();
      let sample;
      try {
        sample = await probe();
      } catch (error) {
        sample = { load1: loadavg()[0], sites: [], probeError: String(error.message) };
      }
      if (result || interrupted) break;
      const decision = buildDecision(sample, paused, { starting: !child, estimatedUsageGiB });
      record({ event: 'probe', ...sample, paused, decision });
      if (decision === 'pause') {
        if (!paused) signalGroup('SIGSTOP');
        paused = true;
      } else if (decision === 'run') {
        if (!child) {
          child = spawnBuild('ionice', ['-c', '3', 'nice', '-n', '19', command, ...args], {
            cwd,
            detached: true,
            stdio: 'inherit',
            env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
          });
          child.once('error', (error) => {
            result = { code: 1, error: error.message };
            wake();
          });
          child.once('close', (code, signal) => {
            result = { code: code ?? 1, signal };
            wake();
          });
          record({ event: 'started', processGroup: child.pid, nice: 19, ioClass: 'idle' });
        } else if (paused) signalGroup('SIGCONT');
        paused = false;
      }
      let timer;
      await Promise.race([
        completed,
        new Promise((done) => {
          timer = setTimeout(done, Math.max(0, intervalMs - (Date.now() - tick)));
        }),
      ]);
      clearTimeout(timer);
    }
    if (interrupted && child && !result) await completed;
    const exitCode = interrupted ? 130 : (result?.code ?? 1);
    record({ event: 'finished', ...result, exitCode });
    return exitCode;
  } finally {
    clearTimeout(forceTimer);
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
    // A leader may exit before its workers. Always reap the dedicated group,
    // even after a successful leader exit; never leave unmonitored descendants.
    if (child?.pid) {
      try {
        killGroup(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') {
          // biome-ignore lint/correctness/noUnsafeFinally: Failed worker cleanup must fail even a successful leader exit.
          throw error;
        }
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [webDirectory, logPath, estimate] = process.argv.slice(2);
  const estimatedUsageGiB = Number(estimate);
  if (!webDirectory || !logPath || !Number.isFinite(estimatedUsageGiB) || estimatedUsageGiB <= 0) throw new Error('Usage: node tools/guard-next-build.js WEB_DIRECTORY PRIVATE_LOG_JSONL ESTIMATED_USAGE_GIB (positive number)');
  mkdirSync(dirname(resolve(logPath)), { recursive: true, mode: 0o700 });
  const record = (entry) => appendFileSync(logPath, `${JSON.stringify({ utc: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 });
  record({ event: 'configuration', webDirectory: resolve(webDirectory), intervalMs: 30000, stopLoadAbove: 12, resumeLoadBelow: 10, startAvailableGiB: 40, stopAvailableBelowGiB: 30, resumeAvailableGiB: 40, maxTotalSeconds: 2, estimatedUsageGiB, sites });
  process.exitCode = await guardedBuild({
    command: process.execPath,
    args: [resolve(webDirectory, 'node_modules/next/dist/bin/next'), 'build'],
    cwd: resolve(webDirectory),
    record,
    estimatedUsageGiB,
  });
}

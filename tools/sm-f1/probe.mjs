// SM-local observation only. No SSH, lock acquisition, service or browser launch.
import * as fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadavg } from 'node:os';
import baseline from '../shared-host-baseline.cjs';
const execute = promisify(execFile);
export const GiB = 1024 ** 3;
export function processIdentity(pid) {
  const p = '/proc/' + pid, text = fs.readFileSync(p + '/stat', 'utf8');
  const f = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
  return { pid: Number(pid), startTicks: f[19], state: f[0], ppid:Number(f[1]), uid: fs.statSync(p).uid,
    args: fs.readFileSync(p + '/cmdline').toString().split('\0').filter(Boolean) };
}
export function localCounts() {
  let browsers = 0, builds = 0;
  for (const pid of fs.readdirSync('/proc').filter(x => /^\d+$/.test(x))) {
    try {
      const r = processIdentity(pid);
      if (['Z', 'X'].includes(r.state)) continue;
      const bin = r.args[0]?.split('/').at(-1);
      if (/^(chrome|chromium|chromium-browser|headless_shell|chrome-headless-shell)$/.test(bin) && !r.args.some(a => a.startsWith('--type='))) browsers++;
      if ((r.args.some(a => /(?:^|\/)(?:next|next\.js)$/.test(a)) && r.args.includes('build')) ||
          (['docker', 'buildctl', 'buildx'].includes(bin) && r.args.some(a => ['build', 'bake'].includes(a)))) builds++;
    } catch (e) { if (!['ENOENT', 'ESRCH'].includes(e.code)) throw e; }
  }
  return { localBrowserRoots: browsers, localBuildRoots: builds };
}
export function localResources() {
  const d = fs.statfsSync('/home');
  const available = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'));
  return { resourceObservedAtMs: Date.now(), load1: loadavg()[0], availableBytes: Number(d.bavail)*Number(d.bsize),
    memoryAvailableBytes: available ? Number(available[1])*1024 : null, ...localCounts() };
}
export async function observeSM(record = () => {}) {
  const startedAtMs = Date.now();
  const sites = await Promise.all(Object.keys(baseline.siteBudgetsSeconds).map(async url => {
    let status = 0, result;
    try {
      result = await execute('/usr/bin/curl', ['-sS', '-H', 'DNT: 1', '-H', 'Accept: text/html', '--max-time', '10',
        '-o', '/dev/null', '-w', '%{http_code} %{time_starttransfer} %{time_total}', url], { timeout: 12000, maxBuffer: 4096, env:{PATH:'/usr/bin:/bin',LANG:'C'} });
    } catch (e) { status = typeof e.code === 'number' ? e.code : 1; result = e; }
    // Preserve the original transport, including failures, before parsing.
    record({ type: 'curl-raw', utc: new Date().toISOString(), url, exitCode: status,
      stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') });
    const [http, ttfb, total] = String(result.stdout ?? '').trim().split(/\s+/).map(Number);
    return { url, status: http || 0, ttfb: Number.isFinite(ttfb) ? ttfb : null,
      total: Number.isFinite(total) ? total : null, exitCode: status };
  }));
  const sample = { startedAtMs, finishedAtMs: Date.now(), sites, ...localResources(), measuredOn: 'SM', baselineMeasurement: baseline.baselineMeasurement,
    remoteSlotScope: 'Global remote build/browser admission remains babysit coordinated; this is local /proc only.' };
  record({ type: 'sm-gate', ...sample });
  return sample;
}
export function requireGate(s, { starting = false, additionalBuilds = 0, additionalBrowsers = 0, now = Date.now() } = {}) {
  if (!s || !Number.isFinite(s.finishedAtMs) || now - s.finishedAtMs < 0 || now - s.finishedAtMs > 30000 || !Number.isFinite(s.startedAtMs) || s.startedAtMs>s.finishedAtMs || now-s.startedAtMs>30000 ||
      !Number.isFinite(s.resourceObservedAtMs) || now-s.resourceObservedAtMs<0 || now-s.resourceObservedAtMs>5000 ||
      !Number.isFinite(s.load1) || s.load1 > 12 || s.load1 < 0 ||
      !Number.isFinite(s.availableBytes) || s.availableBytes < (starting ? 40 : 30) * GiB ||
      !Number.isFinite(s.memoryAvailableBytes) || s.memoryAvailableBytes < (starting ? 1.5 : 1) * GiB ||
      !Number.isInteger(additionalBuilds) || additionalBuilds < 0 ||
      !Number.isInteger(additionalBrowsers) || additionalBrowsers < 0 ||
      !Number.isInteger(s.localBuildRoots) || s.localBuildRoots < 0 || s.localBuildRoots + additionalBuilds > 1 ||
      !Number.isInteger(s.localBrowserRoots) || s.localBrowserRoots < 0 || s.localBrowserRoots + additionalBrowsers > (starting ? 1 : 2))
    throw Error('SM resources or coordinated global slots do not permit capture');
  for (const [url, cap] of Object.entries(baseline.siteBudgetsSeconds)) {
    const rows = s.sites?.filter(x => x.url === url);
    if (rows?.length !== 1 || rows[0].status !== 200 || rows[0].exitCode !== 0 ||
        !Number.isFinite(rows[0].total) || rows[0].total < 0 || rows[0].total > cap)
      throw Error('SM homepage health gate rejected');
  }
}

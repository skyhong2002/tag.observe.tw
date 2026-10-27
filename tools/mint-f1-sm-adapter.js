// Only an explicitly configured, reviewed SM read-only transport is allowed.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { buildDecision } from './guard-next-build.js';
import baseline from './shared-host-baseline.cjs';

const execute = promisify(execFile);
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
// Fixed script; no operator-supplied code, DB requests, credentials or shell interpolation.
export const remoteScript = `import json,os,time,subprocess
from pathlib import Path
urls=('https://tag.observe.tw/','https://weblog.tw/','https://youtube.observe.tw/')
started=int(time.time()*1000)
rows=[]
for url in urls:
 try:
  p=subprocess.run(['curl','-sS','-H','DNT: 1','-H','Accept: text/html','--max-time','10','-o','/dev/null','-w','%{http_code} %{time_starttransfer} %{time_total}',url],capture_output=True,text=True,timeout=12)
  fields=p.stdout.strip().split()
  rows.append(dict(url=url,exitCode=p.returncode,status=int(fields[0]),ttfb=float(fields[1]),total=float(fields[2])))
 except Exception:
  rows.append(dict(url=url,exitCode=1,status=0,ttfb=None,total=None))
disk=os.statvfs('/home')
builds=0
for entry in Path('/proc').iterdir():
 if not entry.name.isdigit(): continue
 try:
  args=(entry/'cmdline').read_bytes().decode().split('\\0')
  names=[os.path.basename(a) for a in args]
  if (any(n in ('next','next.js') for n in names) and 'build' in args) or (any(n in ('docker','buildctl','buildkitd') for n in names) and any(a in ('build','buildx','buildkitd') for a in args)): builds+=1
 except (FileNotFoundError,ProcessLookupError): pass
print(json.dumps(dict(observedHost='SM',machineId=Path('/etc/machine-id').read_text().strip(),measuredFromMachineId=Path('/etc/machine-id').read_text().strip(),startedAtMs=started,finishedAtMs=int(time.time()*1000),load1=os.getloadavg()[0],homeAvailableBytes=disk.f_bavail*disk.f_frsize,localSmBuildCount=builds,sites=rows)))`;
const quotedScript = `'${remoteScript.replaceAll("'", "'\\''")}'`;
export function transportArgs(receipt, now = Date.now()) {
  if (
    !receipt ||
    receipt.schema !== 'mint-f1-sm-transport-v1' ||
    receipt.reviewed !== true ||
    !nonempty(receipt.reviewReceiptId) ||
    !nonempty(receipt.slotReceiptId) ||
    receipt.globalBuildSlot !== true ||
    !nonempty(receipt.smMachineId) ||
    !nonempty(receipt.mintMachineId) ||
    receipt.smMachineId === receipt.mintMachineId ||
    !Number.isFinite(Date.parse(receipt.expiresAt)) ||
    Date.parse(receipt.expiresAt) <= now ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(receipt.host || '') ||
    !/^[a-z_][a-z0-9_-]*$/.test(receipt.user || '') ||
    !isAbsolute(receipt.knownHostsPath || '') ||
    /[%$\s\x00-\x1f\x7f]/.test(receipt.knownHostsPath) ||
    !nonempty(receipt.knownHostsSha256) ||
    !/^[a-f0-9]{64}$/.test(receipt.knownHostsSha256) ||
    !Number.isInteger(receipt.port) ||
    receipt.port < 1 ||
    receipt.port > 65535
  )
    throw new Error('Reviewed SM host/known-hosts/slot transport receipt required');
  return [
    '-F',
    '/dev/null',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    `UserKnownHostsFile=${receipt.knownHostsPath}`,
    '-o',
    'GlobalKnownHostsFile=/dev/null',
    '-o',
    'ConnectTimeout=5',
    '-o',
    'ConnectionAttempts=1',
    '-o',
    'ProxyCommand=none',
    '-o',
    'ClearAllForwardings=yes',
    '-o',
    'RequestTTY=no',
    '-p',
    String(receipt.port),
    `${receipt.user}@${receipt.host}`,
    `python3 -c ${quotedScript}`,
  ];
}
export function validateSample(raw, receipt, now = Date.now(), validateTransport = transportArgs) {
  validateTransport(receipt, now);
  const sample = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (
    !sample ||
    sample.observedHost !== 'SM' ||
    sample.machineId !== receipt.smMachineId ||
    sample.measuredFromMachineId !== receipt.smMachineId ||
    !Number.isFinite(sample.startedAtMs) ||
    !Number.isFinite(sample.finishedAtMs) ||
    sample.startedAtMs > sample.finishedAtMs ||
    sample.finishedAtMs > now ||
    now - sample.startedAtMs > 30000 ||
    !Number.isInteger(sample.localSmBuildCount) ||
    sample.localSmBuildCount !== 0 ||
    !Number.isFinite(sample.load1) ||
    sample.load1 < 0 ||
    !Number.isFinite(sample.homeAvailableBytes) ||
    sample.homeAvailableBytes < 0 ||
    !Array.isArray(sample.sites) ||
    sample.sites.length !== 3 ||
    sample.sites.some((s) => !s || !Object.hasOwn(baseline.siteBudgetsSeconds, s.url)) ||
    new Set(sample.sites.map((s) => s.url)).size !== 3
  )
    throw new Error('Unavailable/stale/substituted SM metrics or concurrent build');
  for (const s of sample.sites)
    if (
      !Number.isInteger(s.exitCode) ||
      !Number.isInteger(s.status) ||
      !Number.isFinite(s.total) ||
      s.total < 0 ||
      !Number.isFinite(s.ttfb) ||
      s.ttfb < 0
    )
      throw new Error('Invalid SM homepage measurement');
  return { ...sample, ageMs: now - sample.startedAtMs };
}
export function verifyKnownHosts(path, expectedHash, io = { lstatSync, readFileSync }, uid = process.getuid()) {
  const metadata = io.lstatSync(path);
  if (!metadata.isFile() || metadata.uid !== uid || metadata.mode & 0o077) return false;
  return createHash('sha256').update(io.readFileSync(path)).digest('hex') === expectedHash;
}
export async function probeSM({ receipt, executeCommand = execute, checkKnownHosts = verifyKnownHosts, now = () => Date.now() }) {
  try {
    const args = transportArgs(receipt, now());
    // Require a private owner-only regular known-hosts file pinned by reviewed SHA256.
    if (typeof checkKnownHosts !== 'function' || (await checkKnownHosts(receipt.knownHostsPath, receipt.knownHostsSha256)) !== true)
      throw new Error('Pinned known-hosts verifier required');
    const { stdout } = await executeCommand('/usr/bin/ssh', args, {
      timeout: 40000,
      maxBuffer: 65536,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    return validateSample(stdout, receipt, now());
  } catch (error) {
    return { observedHost: 'SM', sites: [], probeError: error.message };
  }
}
export function smGate(sample, receipt, options = {}, now = Date.now()) {
  try {
    sample = validateSample(sample, receipt, now);
  } catch {
    return 'pause';
  }
  if (
    !sample ||
    sample.probeError ||
    sample.localSmBuildCount !== 0 ||
    !nonempty(sample.machineId) ||
    sample.machineId !== sample.measuredFromMachineId ||
    !Number.isFinite(sample.ageMs) ||
    sample.ageMs < 0 ||
    sample.ageMs > 30000
  )
    return 'pause';
  return buildDecision(sample, options.paused === true, options);
}

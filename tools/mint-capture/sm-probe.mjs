// Preserve actual SM timestamps; only the explicit local RPC envelope drives Mint freshness.
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import { promisify } from 'node:util';
import { transportArgs, validateSample } from '../mint-f1-sm-adapter.js';
import { hash } from './capture-policy.mjs';

const execute = promisify(execFile);
export function normalizeSmEnvelope(raw, receipt, { startedAtMs, finishedAtMs, now = finishedAtMs } = {}) {
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(finishedAtMs) ||
    finishedAtMs - startedAtMs < 0 ||
    now - startedAtMs > 30000 ||
    now - finishedAtMs < 0 ||
    !Number.isFinite(raw.startedAtMs) ||
    !Number.isFinite(raw.finishedAtMs) ||
    raw.finishedAtMs - raw.startedAtMs < 0 ||
    raw.finishedAtMs - raw.startedAtMs > 30000
  )
    throw Error('Bounded actual SM/local RPC durations required');
  return validateSample(
    {
      ...raw,
      remoteTiming: { startedAtMs: raw.startedAtMs, finishedAtMs: raw.finishedAtMs },
      freshnessScope: 'mint-local-readonly-ssh-envelope',
      startedAtMs,
      finishedAtMs,
    },
    receipt,
    now,
  );
}
export async function actualSmProbe({ receipt, executeCommand = execute, rawPath, signal, now = Date.now }) {
  const s = fs.lstatSync(receipt.knownHostsPath);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.uid !== process.getuid() ||
    s.mode & 0o077 ||
    hash(fs.readFileSync(receipt.knownHostsPath)) !== receipt.knownHostsSha256
  )
    throw Error('Strict SM known-hosts proof');
  const startedAtMs = now();
  let r, error;
  try {
    r = await executeCommand('/usr/bin/ssh', transportArgs(receipt), {
      encoding: null,
      signal,
      timeout: 40000,
      maxBuffer: 65536,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
  } catch (e) {
    error = e;
    r = e;
  }
  const finishedAtMs = now();
  fs.writeFileSync(
    rawPath,
    JSON.stringify({
      startedAtMs,
      finishedAtMs,
      status: error ? (typeof error.code === 'number' ? error.code : null) : 0,
      signal: r.signal || null,
      errorCode: error?.code || null,
      stdoutBase64: Buffer.from(r.stdout || '').toString('base64'),
      stderrBase64: Buffer.from(r.stderr || '').toString('base64'),
    }) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  if (error) throw error;
  return normalizeSmEnvelope(JSON.parse(r.stdout), receipt, { startedAtMs, finishedAtMs, now: finishedAtMs });
}

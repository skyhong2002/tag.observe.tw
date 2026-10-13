import { validateNativePolicy } from './native-elf-proof.js';
// Read-only Mint checks. No build, provisioning, API request or .env reads.
import { readFileSync, realpathSync, statSync, statfsSync, existsSync } from 'node:fs';
import { hostname, platform, arch, cpus } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
export function validateReceipt(receipt, now = Date.now()) {
  if (!receipt || receipt.schema !== 'mint-f1-host-v1' || receipt.reviewed !== true
    || receipt.mintReady !== true || receipt.globalBuildSlot !== true
    || !text(receipt.reviewReceiptId) || !text(receipt.slotReceiptId)
    || !Number.isFinite(Date.parse(receipt.expiresAt)) || Date.parse(receipt.expiresAt) <= now
    || !text(receipt.smMachineId) || !text(receipt.mint?.machineId)
    || receipt.smMachineId === receipt.mint.machineId || receipt.mint.hostname === 'skyhong-SM'
    || !isAbsolute(receipt.mint.npmPath || '') || !isAbsolute(receipt.mint.nodePath || '')
    || !text(receipt.noninteractivePath) || receipt.noninteractivePath.split(delimiter).some(p => !isAbsolute(p))
    || receipt.api?.isolatedDatabase !== true || receipt.api?.productionDatabase !== false
    || receipt.api?.machineId !== receipt.mint.machineId || !text(receipt.api?.isolationReceiptId)) throw new Error('Reviewed, current Mint-ready/identity/API/slot receipt required');
  const url = new URL(receipt.api.origin);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || !url.port
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Mint isolated loopback API required');
  return receipt;
}
export function validateHostSnapshot(snapshot, receipt, estimateGiB, now = Date.now()) {
  validateReceipt(receipt, now);
  const expected = receipt.mint;
  for (const key of ['machineId', 'hostname', 'platform', 'arch', 'nodeVersion', 'nodeModulesAbi', 'libc', 'nodePath', 'npmPath', 'npmVersion']) {
    if (!text(expected[key]) || snapshot[key] !== expected[key]) throw new Error(`Mint live identity mismatch: ${key}`);
  }
  if (snapshot.platform !== 'linux' || !['x64', 'arm64'].includes(snapshot.arch) || !/^24\./.test(snapshot.nodeVersion)
    || snapshot.hostname === 'skyhong-SM' || snapshot.machineId === receipt.smMachineId
    || !/^glibc-\d+\.\d+$/.test(snapshot.libc)
    || !Number.isInteger(snapshot.cpuCount) || snapshot.cpuCount < 2 || snapshot.cpuCount !== expected.cpuCount
    || !Number.isFinite(estimateGiB) || estimateGiB <= 0
    || !Number.isFinite(snapshot.candidateAvailableBytes)
    || snapshot.candidateAvailableBytes / 1024 ** 3 - estimateGiB < 30) throw new Error('Mint platform/CPU or separate candidate disk estimate failed');
  const sm = receipt.smAbi;
  if (!sm || sm.platform !== 'linux' || sm.arch !== snapshot.arch
    || sm.nodeModulesAbi !== snapshot.nodeModulesAbi) throw new Error('SM deployment native ABI mismatch');
  validateNativePolicy(receipt.nativePolicy, snapshot, sm);
  return { verified: true, host: 'Mint', snapshot, apiOrigin: receipt.api.origin, receiptId: receipt.reviewReceiptId, slotReceiptId: receipt.slotReceiptId };
}
export async function verifyHost({ receipt, candidateParent, estimateGiB, executeCommand = execute,
  io = { readFileSync, realpathSync, statSync, statfsSync, existsSync }, runtime = process,
  system = { hostname, platform, arch, cpus }, now = Date.now() }) {
  validateReceipt(receipt, now); // No command before authorized, reviewed readiness.
  if (!isAbsolute(candidateParent || '')) throw new Error('Absolute existing candidate parent required');
  const nodeCandidate = receipt.noninteractivePath.split(delimiter).map(p => join(p, 'node')).find(p => io.existsSync(p));
  const npmCandidate = receipt.noninteractivePath.split(delimiter).map(p => join(p, 'npm')).find(p => io.existsSync(p));
  if (!nodeCandidate || io.realpathSync(nodeCandidate) !== receipt.mint.nodePath
    || !npmCandidate || io.realpathSync(npmCandidate) !== receipt.mint.npmPath
    || io.realpathSync(runtime.execPath) !== receipt.mint.nodePath) throw new Error('Noninteractive npm/Node PATH mismatch');
  if (!io.statSync(candidateParent).isDirectory()) throw new Error('Candidate parent must be a directory');
  const disk = io.statfsSync(candidateParent);
  const report = runtime.report.getReport();
  const snapshot = {
    machineId: io.readFileSync('/etc/machine-id', 'utf8').trim(), hostname: system.hostname(),
    platform: system.platform(), arch: system.arch(), cpuCount: system.cpus().length,
    nodeVersion: runtime.versions.node, nodeModulesAbi: runtime.versions.modules,
    libc: report.header.glibcVersionRuntime ? `glibc-${report.header.glibcVersionRuntime}` : 'unknown',
    nodePath: io.realpathSync(runtime.execPath), npmPath: io.realpathSync(npmCandidate),
    npmVersion: receipt.mint.npmVersion, candidateAvailableBytes: Number(disk.bavail) * Number(disk.bsize),
  };
  // Validate actual host before even invoking read-only npm --version.
  validateHostSnapshot(snapshot, receipt, estimateGiB, now);
  const result = await executeCommand(snapshot.npmPath, ['--version'], { timeout: 5000, maxBuffer: 1024,
    env: { PATH: receipt.noninteractivePath, HOME: '/nonexistent', NPM_CONFIG_UPDATE_NOTIFIER: 'false' } });
  snapshot.npmVersion = result.stdout.trim();
  return validateHostSnapshot(snapshot, receipt, estimateGiB, now);
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateHostSnapshot, verifyHost } from './mint-f1-host-adapter.js';
import { transportArgs, validateSample, probeSM, smGate, remoteScript, verifyKnownHosts } from './mint-f1-sm-adapter.js';
const now = 1700000000000;
const mint = () => ({ machineId: 'mint-id', hostname: 'mint', platform: 'linux', arch: 'x64', cpuCount: 4, nodeVersion: '24.1.0', nodeModulesAbi: '137', libc: 'glibc-2.39', nodePath: '/opt/node/bin/node', npmPath: '/opt/node/lib/npm-cli.js', npmVersion: '11.1.0', candidateAvailableBytes: 45 * 1024 ** 3 });
const hostReceipt = () => ({ nativePolicy: { schema: 'mint-f1-native-policy-v1', reviewed: true, buildAllowed: true, strategy: 'elf-requirements-and-sm-target-smoke', reviewReceiptId: 'mock-native-policy', maxGlibcRequired: '2.39' }, schema: 'mint-f1-host-v1', reviewed: true, mintReady: true, globalBuildSlot: true, reviewReceiptId: 'review', slotReceiptId: 'slot', expiresAt: new Date(now + 60000).toISOString(), smMachineId: 'sm-id', mint: mint(), noninteractivePath: '/opt/node/bin:/usr/bin:/bin', api: { origin: 'http://127.0.0.1:18131', isolatedDatabase: true, productionDatabase: false, machineId: 'mint-id', isolationReceiptId: 'api-review' }, smAbi: { platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.39' } });
const transport = () => ({ schema: 'mint-f1-sm-transport-v1', reviewed: true, reviewReceiptId: 'review', slotReceiptId: 'slot', globalBuildSlot: true, expiresAt: new Date(now + 60000).toISOString(), host: 'sm.example', user: 'gate', port: 22, smMachineId: 'sm-id', mintMachineId: 'mint-id', knownHostsPath: '/private/known_hosts', knownHostsSha256: 'a'.repeat(64) });
const sample = () => ({ observedHost: 'SM', machineId: 'sm-id', measuredFromMachineId: 'sm-id', startedAtMs: now - 100, finishedAtMs: now - 10, load1: 2, homeAvailableBytes: 45 * 1024 ** 3, localSmBuildCount: 0, sites: ['https://tag.observe.tw/', 'https://blog.observe.tw/', 'https://youtube.observe.tw/'].map(url => ({ url, exitCode: 0, status: 200, total: 0.2, ttfb: 0.1 })) });
test('Mint live identity, readiness and separate disk estimate fail closed', () => {
  assert.equal(validateHostSnapshot(mint(), hostReceipt(), 5, now).verified, true);
  for (const change of [{ machineId: 'sm-id' }, { platform: 'darwin' }, { nodeVersion: '22.0.0' }, { libc: 'glibc-2.40' }, { npmPath: '/usr/bin/npm' }, { candidateAvailableBytes: 31 * 1024 ** 3 }]) assert.throws(() => validateHostSnapshot({ ...mint(), ...change }, hostReceipt(), 5, now));
  for (const change of [{ mintReady: false }, { reviewed: 'yes' }, { globalBuildSlot: false }, { expiresAt: new Date(now).toISOString() }]) assert.throws(() => validateHostSnapshot(mint(), { ...hostReceipt(), ...change }, 5, now));
  const receipt = hostReceipt(); receipt.api.productionDatabase = true; assert.throws(() => validateHostSnapshot(mint(), receipt, 5, now));
});
test('mock Mint host reads only identity and resolves noninteractive npm, without credentials', async () => {
  let calls = 0;
  const io = { existsSync: p => ['/opt/node/bin/npm', '/opt/node/bin/node'].includes(p), realpathSync: p => p.endsWith('/npm') ? mint().npmPath : p,
    statSync: () => ({ isDirectory: () => true }), statfsSync: () => ({ bavail: 45, bsize: 1024 ** 3 }),
    readFileSync: p => { assert.equal(p, '/etc/machine-id'); return 'mint-id\n'; } };
  const runtime = { execPath: mint().nodePath, versions: { node: mint().nodeVersion, modules: '137' }, report: { getReport: () => ({ header: { glibcVersionRuntime: '2.39' } }) } };
  const system = { hostname: () => 'mint', platform: () => 'linux', arch: () => 'x64', cpus: () => [1, 2, 3, 4] };
  const executeCommand = async (bin, args, opts) => { calls++; assert.equal(bin, mint().npmPath); assert.deepEqual(args, ['--version']); assert.equal(opts.env.PATH, hostReceipt().noninteractivePath); assert.equal(opts.env.DATABASE_URL, undefined); return { stdout: '11.1.0\n' }; };
  assert.equal((await verifyHost({ receipt: hostReceipt(), candidateParent: '/candidate', estimateGiB: 5, io, runtime, system, executeCommand, now })).verified, true);
  assert.equal(calls, 1);
  await assert.rejects(verifyHost({ receipt: { ...hostReceipt(), mintReady: false }, executeCommand, now })); assert.equal(calls, 1);
});
test('SM command is fixed, read-only, strict known-hosts, bounded and free of user code', () => {
  const args = transportArgs(transport(), now); assert.ok(args.includes('BatchMode=yes')); assert.ok(args.includes('StrictHostKeyChecking=yes'));
  assert.ok(args.includes('ProxyCommand=none')); assert.equal(args.at(-2), 'gate@sm.example');
  assert.ok(remoteScript.includes("'DNT: 1'")); assert.ok(remoteScript.includes("os.statvfs('/home')"));
  for (const change of [{ host: 'sm;evil' }, { user: '-evil' }, { reviewed: 'yes' }, { knownHostsPath: 'relative' }, { globalBuildSlot: false }]) assert.throws(() => transportArgs({ ...transport(), ...change }, now));
});
test('SM mock transport requires verifier and never substitutes Mint metrics', async () => {
  let calls = 0;
  const executeCommand = async (bin, args, opts) => { calls++; assert.equal(bin, '/usr/bin/ssh'); assert.equal(opts.timeout, 40000); assert.deepEqual(Object.keys(opts.env), ['PATH', 'LANG']); return { stdout: JSON.stringify(sample()) }; };
  const config = { receipt: transport(), executeCommand, now: () => now };
  assert.ok((await probeSM({ ...config, checkKnownHosts: async () => false })).probeError); assert.equal(calls, 0);
  const result = await probeSM({ ...config, checkKnownHosts: async (p, sha) => p === '/private/known_hosts' && sha === 'a'.repeat(64) });
  assert.equal(calls, 1); assert.equal(result.machineId, 'sm-id');
  assert.equal(smGate(result, transport(), { starting: true, estimatedUsageGiB: 5 }, now), 'run');
  for (const change of [{ observedHost: 'Mint' }, { machineId: 'mint-id' }, { measuredFromMachineId: undefined }, { localSmBuildCount: 1 }, { startedAtMs: now - 30001 }, { finishedAtMs: now + 1 }]) {
    assert.throws(() => validateSample({ ...sample(), ...change }, transport(), now));
    assert.equal(smGate({ ...sample(), ...change }, transport(), {}, now), 'pause');
  }
  assert.equal(smGate(sample(), undefined, {}, now), 'pause');
  const slow = sample(); slow.sites[1].total = 6.18; assert.equal(smGate(slow, transport(), {}, now), 'pause');
  const low = sample(); low.homeAvailableBytes = 39 * 1024 ** 3; assert.equal(smGate(low, transport(), { starting: true, estimatedUsageGiB: 5 }, now), 'pause');
  assert.ok((await probeSM({ ...config, checkKnownHosts: async () => true, executeCommand: async () => { throw new Error('unavailable'); } })).probeError);
});

test('known-hosts pin rejects non-private files, links, owner and checksum mismatch', () => {
  const data = 'reviewed known host'; const hash = createHash('sha256').update(data).digest('hex');
  const fixture = (uid, mode, regular = true) => ({ lstatSync: () => ({ uid, mode, isFile: () => regular }), readFileSync: () => data });
  assert.equal(verifyKnownHosts('/private/pin', hash, fixture(1000, 0o100600), 1000), true);
  for (const io of [fixture(1001, 0o100600), fixture(1000, 0o100644), fixture(1000, 0o120600, false)]) assert.equal(verifyKnownHosts('/private/pin', hash, io, 1000), false);
  assert.equal(verifyKnownHosts('/private/pin', 'b'.repeat(64), fixture(1000, 0o100600), 1000), false);
});

test('known-host paths forbid SSH expansion and unknown libc never establishes ABI', () => {
  for (const knownHostsPath of ['/private/%h', '/private/$HOST', '/private/known hosts', '/private/pin\n']) assert.throws(() => transportArgs({ ...transport(), knownHostsPath }, now));
  const receipt = hostReceipt(); receipt.mint.libc = 'unknown'; receipt.smAbi.libc = 'unknown';
  assert.throws(() => validateHostSnapshot({ ...mint(), libc: 'unknown' }, receipt, 5, now));
  assert.equal(sample().localSmBuildCount, 0); assert.equal(sample().globalBuildCount, undefined);
});

test('npm shebang cannot use a different first Node from noninteractive PATH', async () => {
 const receipt = hostReceipt(); receipt.noninteractivePath = '/rogue/bin:/opt/node/bin:/usr/bin';
 let commands = 0;
 await assert.rejects(verifyHost({ receipt, candidateParent: '/candidate', estimateGiB: 5, now,
  runtime: { execPath: receipt.mint.nodePath },
  io: { existsSync: p => ['/rogue/bin/node', '/opt/node/bin/node', '/opt/node/bin/npm'].includes(p), realpathSync: p => p.endsWith('/npm') ? receipt.mint.npmPath : p },
  executeCommand: async () => { commands++; return { stdout: '11.1.0' }; }
 }), /Noninteractive/);
 assert.equal(commands, 0);
});
test('pre-build cross-glibc policy is required and does not claim final native verification', () => {
 const receipt = hostReceipt(); receipt.smAbi.libc = 'glibc-2.41';
 const result = validateHostSnapshot(mint(), receipt, 5, now); assert.equal(result.verified, true); assert.equal(result.nativeAbiVerified, undefined);
 delete receipt.nativePolicy; assert.throws(() => validateHostSnapshot(mint(), receipt, 5, now), /policy/);
});

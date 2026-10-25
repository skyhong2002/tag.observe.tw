import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  collectElfProof,
  nativeEligibility,
  parseDynamic,
  parseReadelf,
  runTargetNativeSmoke,
  validateNativePolicy,
  verifyElfProof,
} from './native-elf-proof.js';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const policy = () => ({
  schema: 'mint-f1-native-policy-v1',
  reviewed: true,
  buildAllowed: true,
  strategy: 'elf-requirements-and-sm-target-smoke',
  reviewReceiptId: 'mock-reviewed-policy',
  maxGlibcRequired: '2.39',
});
const header = 'Class: ELF64\nMachine: Advanced Micro Devices X86-64\n';
const versions = 'Version needs section .gnu.version_r:\nName: GLIBC_2.17\nName: GLIBC_2.39\n';
function fixture() {
  const bytes = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from('mock native')]);
  const files = [
    { path: 'node_modules/pkg/addon.node', type: 'file', binaryKind: 'elf', sha256: hash(bytes) },
    { path: 'node_modules/pkg/lib.so', type: 'file', binaryKind: 'elf', sha256: hash(bytes) },
  ];
  const manifest = {
    platform: 'linux',
    arch: 'x64',
    nodeModulesAbi: '137',
    libc: 'glibc-2.39',
    nativePolicy: policy(),
    files,
    inventorySha256: hash(JSON.stringify(files)),
    smAbi: { platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.41' },
    nativeTargetRuntime: { machineId: 'sm-id', platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.41' },
  };
  const io = {
    readFileSync: (path, encoding) => (path === '/etc/machine-id' ? 'sm-id\n' : bytes),
    realpathSync: (path) => path,
    lstatSync: () => ({ isFile: () => true }),
  };
  const run = (bin, args) => {
    assert.equal(bin, '/usr/bin/readelf');
    assert.equal(args[1], '--');
    return args[0] === '--file-header'
      ? header
      : args[0] === '--dynamic'
        ? 'Dynamic section:\n(NEEDED) Shared library: [libc.so.6]\n(SONAME) Library soname: [libpkg.so]\n(RUNPATH) Library runpath: [$ORIGIN]'
        : versions;
  };
  const runtime = {
    execPath: '/target/node',
    platform: 'linux',
    arch: 'x64',
    versions: { node: '24.15.0', modules: '137' },
    report: { getReport: () => ({ header: { glibcVersionRuntime: '2.41' } }) },
  };
  return { manifest, io, run, runtime };
}
test('reviewed policy allows Mint2.39 to SM2.41 build without claiming native proof', () => {
  const f = fixture();
  assert.equal(validateNativePolicy(policy(), f.manifest, f.manifest.smAbi).buildAllowed, true);
  for (const delta of [{ reviewed: false }, { maxGlibcRequired: '2.41' }, { strategy: 'trust-libc-string' }])
    assert.throws(() => validateNativePolicy({ ...policy(), ...delta }, f.manifest, f.manifest.smAbi));
  assert.throws(() => validateNativePolicy(policy(), f.manifest, { ...f.manifest.smAbi, nodeModulesAbi: '115' }));
});
test('actual ELF requirement inventory is complete, architecture checked and capped', () => {
  const f = fixture();
  const proof = collectElfProof('/artifact', f.manifest, f.run, f.io);
  assert.equal(proof.entries.length, 2);
  assert.equal(verifyElfProof(f.manifest, proof), true);
  assert.deepEqual(proof.entries[0].requirements, ['2.17', '2.39']);
  for (const bad of ['Version needs section x\nName: GLIBC_2.40', 'Version needs section x\nName: GLIBC_PRIVATE', ''])
    assert.throws(() => parseReadelf(header, bad, 'x64'));
  assert.throws(() => parseReadelf('Class: ELF64\nMachine: AArch64', versions, 'x64'));
  assert.throws(() => verifyElfProof(f.manifest, { ...proof, entries: proof.entries.slice(1) }));
  assert.throws(() => collectElfProof('/artifact', { ...f.manifest, files: [] }, f.run, f.io));
  assert.throws(() => collectElfProof('/artifact', f.manifest, f.run, { ...f.io, readFileSync: () => Buffer.from('changed') }));
});
test('SM-local loader report is produced only after real-operation adapter succeeds and matches full hash/runtime', () => {
  const f = fixture();
  const proof = collectElfProof('/artifact', f.manifest, f.run, f.io);
  let calls = 0;
  const smoke = runTargetNativeSmoke('/artifact', f.manifest, proof, {
    io: f.io,
    runtime: f.runtime,
    receiptId: 'mock-smoke-run',
    run: (bin, args, options) => {
      calls++;
      assert.equal(bin, '/target/node');
      assert.equal(options.env.DATABASE_URL, undefined);
      assert.ok(args[1].includes("require('sharp')"));
      assert.ok(args[1].includes("require('onnxruntime-node')"));
      assert.equal(JSON.parse(args[2]).length, 1);
      return 'NATIVE_LOADED';
    },
  });
  assert.equal(calls, 1);
  assert.equal(smoke.loadedNativeFiles.length, 1);
  assert.equal(nativeEligibility(f.manifest, proof, smoke).nativeEligible, true);
  assert.equal(nativeEligibility(f.manifest, proof, smoke).deployEligible, false);
  for (const delta of [
    { executed: false },
    { status: 'failed' },
    { artifactInventorySha256: '0'.repeat(64) },
    { loadedNativeFiles: [] },
    { runtime: { ...smoke.runtime, machineId: 'mint-id' } },
  ])
    assert.throws(() => nativeEligibility(f.manifest, proof, { ...smoke, ...delta }));
  assert.throws(() =>
    runTargetNativeSmoke('/artifact', f.manifest, proof, { io: f.io, runtime: f.runtime, receiptId: 'mock', run: () => 'not-loaded' }),
  );
  assert.throws(() =>
    runTargetNativeSmoke('/artifact', f.manifest, proof, {
      io: f.io,
      runtime: { ...f.runtime, arch: 'arm64' },
      receiptId: 'mock',
      run: () => {
        throw new Error('must not run');
      },
    }),
  );
});

test('dynamic dependency inventory captures needed/soname and rejects external RPATH', () => {
  const good = parseDynamic(
    'Dynamic section:\n(NEEDED) Shared library: [libstdc++.so.6]\n(SONAME) Library soname: [libaddon.so]\n(RPATH) Library rpath: [$ORIGIN/../lib]\n(RUNPATH) Library runpath: [/artifact/internal]',
    '/artifact',
    'pkg/addon.node',
  );
  assert.deepEqual(good.needed, ['libstdc++.so.6']);
  assert.equal(good.soname, 'libaddon.so');
  assert.deepEqual(good.rpath, ['$ORIGIN/../lib']);
  assert.match(good.dependenciesAvailable, /not availability proof/);
  for (const path of ['/usr/local/lib', '$ORIGIN/../../../outside', 'relative/lib', '$HOME/lib'])
    assert.throws(() => parseDynamic(`Dynamic section:\n(RUNPATH) Library runpath: [${path}]`, '/artifact', 'pkg/addon.node'));
  assert.throws(() => parseDynamic('', '/artifact', 'pkg/addon.node'));
});

test('complete GLIBC tokens cannot hide suffixes; DT_RELR preserves explicit 2.36 requirement', () => {
  assert.throws(() => parseReadelf(header, 'Version needs section x\nName: GLIBC_2.39_FAKE', 'x64'), /complete/);
  const parsed = parseReadelf(header, 'Version needs section x\nName: GLIBC_ABI_DT_RELR', 'x64');
  assert.deepEqual(parsed.glibcTokens, ['GLIBC_ABI_DT_RELR']);
  assert.deepEqual(parsed.requirements, ['2.36']);
  assert.throws(() => parseReadelf(header, 'Version needs section x\nName: GLIBC_ABI_DT_RELR_FAKE', 'x64'));
});

// Linux native compatibility evidence. No build, SSH, deployment or smoke runs.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const version = (text) => (/^\d+\.\d+(?:\.\d+)?$/.test(text || '') ? text.split('.').map(Number) : null);
export function compareVersions(a, b) {
  const left = version(a),
    right = version(b);
  if (!left || !right) throw new Error('Numeric GLIBC versions required');
  for (let i = 0; i < 3; i++) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}
export function validateNativePolicy(policy, mint, target) {
  if (
    !policy ||
    policy.schema !== 'mint-f1-native-policy-v1' ||
    policy.reviewed !== true ||
    policy.buildAllowed !== true ||
    policy.strategy !== 'elf-requirements-and-sm-target-smoke' ||
    typeof policy.reviewReceiptId !== 'string' ||
    !policy.reviewReceiptId.trim() ||
    policy.maxGlibcRequired !== '2.39' ||
    mint?.platform !== 'linux' ||
    target?.platform !== 'linux' ||
    !['x64', 'arm64'].includes(mint.arch) ||
    target.arch !== mint.arch ||
    !/^\d+$/.test(mint.nodeModulesAbi || '') ||
    target.nodeModulesAbi !== mint.nodeModulesAbi ||
    !/^glibc-\d+\.\d+$/.test(mint.libc || '') ||
    !/^glibc-\d+\.\d+$/.test(target.libc || '') ||
    compareVersions('2.39', mint.libc.slice(6)) > 0 ||
    compareVersions('2.39', target.libc.slice(6)) > 0
  )
    throw new Error('Reviewed pending native ELF/target-smoke policy and matching Linux architecture/Node ABI required');
  return policy; // Build authorization only; never proof of native compatibility.
}
function glibcRequirements(tokens) {
  return [
    ...new Set(
      tokens.map((token) => {
        if (token === 'GLIBC_ABI_DT_RELR') return '2.36'; // glibc 2.36 NEWS: https://sourceware.org/pipermail/glibc-cvs/2022q2/078146.html
        const match = /^GLIBC_(\d+\.\d+(?:\.\d+)?)$/.exec(token);
        if (!match) throw new Error('Unrecognized complete GLIBC requirement token');
        return match[1];
      }),
    ),
  ].sort(compareVersions);
}
export function parseReadelf(header, versions, arch, limit = '2.39') {
  if (!/Class:\s+ELF64/.test(header) || !(arch === 'x64' ? /Machine:\s+Advanced Micro Devices X86-64/ : /Machine:\s+AArch64/).test(header))
    throw new Error('ELF architecture mismatch');
  if (!/Version (?:symbols|needs|definition) section|No version information found in this file\./.test(versions))
    throw new Error('Missing readelf version evidence');
  // Only version NEEDS are requirements; definitions cannot raise/lower proof.
  const needs = versions
    .split(/Version needs section/)
    .slice(1)
    .join('Version needs section')
    .split(/Version definition section/)[0];
  const glibcTokens = [...new Set([...needs.matchAll(/Name:\s+(GLIBC_[^\s]+)/g)].map((m) => m[1]))];
  const requirements = glibcRequirements(glibcTokens);
  if (requirements.some((v) => compareVersions(v, limit) > 0)) throw new Error('ELF GLIBC requirement exceeds reviewed 2.39 ceiling');
  return { glibcTokens, requirements, maxRequired: requirements.at(-1) || null };
}
export function parseDynamic(dynamic, root, filePath) {
  if (!/Dynamic section|There is no dynamic section in this file\./.test(dynamic)) throw new Error('Missing dynamic dependency evidence');
  const needed = [...dynamic.matchAll(/\(NEEDED\)[^[]*\[([^\]]*)\]/g)].map((m) => m[1]);
  const sonames = [...dynamic.matchAll(/\(SONAME\)[^[]*\[([^\]]*)\]/g)].map((m) => m[1]);
  if (needed.some((name) => !name || /[/\\\s\x00-\x1f]/.test(name)) || sonames.length > 1)
    throw new Error('Unsafe dynamic library dependency');
  const inside = (path) => {
    const rel = relative(resolve(root), path);
    return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel);
  };
  const paths = (kind) =>
    [...dynamic.matchAll(new RegExp(`\\(${kind}\\)[^\\[]*\\[([^\\]]+)\\]`, 'g'))]
      .flatMap((m) => m[1].split(':'))
      .map((value) => {
        if (value.replace(/^\$ORIGIN|^\$\{ORIGIN\}/, '').includes('$')) throw new Error('Unknown dynamic loader token');
        let resolved;
        if (/^\$ORIGIN(?:\/|$)|^\$\{ORIGIN\}(?:\/|$)/.test(value))
          resolved = resolve(root, dirname(filePath), value.replace(/^\$ORIGIN|^\$\{ORIGIN\}/, '.'));
        else if (isAbsolute(value)) resolved = resolve(value);
        else throw new Error('Unreviewable relative/token dynamic search path');
        if (!inside(resolved)) throw new Error('Dynamic search path escapes artifact');
        return value;
      });
  return {
    needed,
    soname: sonames[0] || null,
    rpath: paths('RPATH'),
    runpath: paths('RUNPATH'),
    dependenciesAvailable: 'requires actual SM target loader; static inventory is not availability proof',
  };
}
export function collectElfProof(
  root,
  manifest,
  run = (bin, args) => {
    const result = spawnSync(bin, args, {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 2 * 1024 ** 2,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    if (result.error || result.status !== 0) throw new Error('Read-only ELF inspection failed');
    return result.stdout;
  },
  io = { readFileSync },
) {
  validateNativePolicy(manifest.nativePolicy, manifest, manifest.smAbi);
  if (manifest.files.some((f) => f.binaryKind === 'node-non-elf')) throw new Error('Non-ELF .node artifact forbidden');
  const elfFiles = manifest.files.filter((f) => f.type === 'file' && f.binaryKind === 'elf');
  if (!elfFiles.length || !elfFiles.some((f) => f.path.endsWith('.node')))
    throw new Error('Complete nonempty native ELF inventory required');
  const entries = elfFiles.map((file) => {
    if (hash(io.readFileSync(join(root, file.path))) !== file.sha256) throw new Error('ELF inventory file changed');
    const header = run('/usr/bin/readelf', ['--file-header', '--', join(root, file.path)]);
    const versions = run('/usr/bin/readelf', ['--version-info', '--', join(root, file.path)]);
    const dynamic = run('/usr/bin/readelf', ['--dynamic', '--', join(root, file.path)]);
    if (hash(io.readFileSync(join(root, file.path))) !== file.sha256) throw new Error('ELF changed during inspection');
    return {
      path: file.path,
      sha256: file.sha256,
      ...parseReadelf(header, versions, manifest.arch),
      dynamic: parseDynamic(dynamic, root, file.path),
      rawReadelfSha256: hash(JSON.stringify({ header, versions, dynamic })),
    };
  });
  return {
    schema: 'mint-f1-elf-proof-v1',
    status: 'inspected',
    artifactInventorySha256: manifest.inventorySha256,
    arch: manifest.arch,
    nodeModulesAbi: manifest.nodeModulesAbi,
    ceiling: '2.39',
    entries,
  };
}
export function verifyElfProof(manifest, proof) {
  validateNativePolicy(manifest.nativePolicy, manifest, manifest.smAbi);
  if (manifest.inventorySha256 !== hash(JSON.stringify(manifest.files))) throw new Error('Artifact inventory digest mismatch');
  const expected = manifest.files.filter((f) => f.type === 'file' && f.binaryKind === 'elf');
  if (
    !proof ||
    proof.schema !== 'mint-f1-elf-proof-v1' ||
    proof.status !== 'inspected' ||
    proof.ceiling !== '2.39' ||
    proof.artifactInventorySha256 !== manifest.inventorySha256 ||
    proof.arch !== manifest.arch ||
    proof.nodeModulesAbi !== manifest.nodeModulesAbi ||
    !expected.length ||
    !expected.some((f) => f.path.endsWith('.node')) ||
    manifest.files.some((f) => f.binaryKind === 'node-non-elf') ||
    !Array.isArray(proof.entries) ||
    proof.entries.length !== expected.length ||
    new Set(proof.entries.map((e) => e.path)).size !== expected.length
  )
    throw new Error('Incomplete/unbound native ELF proof');
  for (const file of expected) {
    const entry = proof.entries.find((e) => e.path === file.path);
    if (
      !entry ||
      !/^[a-f0-9]{64}$/.test(entry.rawReadelfSha256 || '') ||
      !entry.dynamic ||
      !Array.isArray(entry.glibcTokens) ||
      JSON.stringify(glibcRequirements(entry.glibcTokens)) !== JSON.stringify(entry.requirements) ||
      !Array.isArray(entry.dynamic.needed) ||
      !Array.isArray(entry.dynamic.rpath) ||
      !Array.isArray(entry.dynamic.runpath) ||
      entry.sha256 !== file.sha256 ||
      !Array.isArray(entry.requirements) ||
      entry.requirements.some((v) => compareVersions(v, '2.39') > 0) ||
      (entry.maxRequired !== [...entry.requirements].sort(compareVersions).at(-1) &&
        !(entry.maxRequired === null && entry.requirements.length === 0))
    )
      throw new Error('Invalid ELF requirement evidence');
  }
  return true;
}
export function nativeEligibility(manifest, elfProof, smokeProof) {
  verifyElfProof(manifest, elfProof);
  const target = manifest.nativeTargetRuntime;
  if (
    !smokeProof ||
    smokeProof.schema !== 'mint-f1-sm-native-smoke-v1' ||
    smokeProof.executed !== true ||
    smokeProof.status !== 'passed' ||
    smokeProof.scope !== 'isolated-sm-target-native-loader' ||
    smokeProof.artifactInventorySha256 !== manifest.inventorySha256 ||
    smokeProof.elfProofSha256 !== hash(JSON.stringify(elfProof)) ||
    !target ||
    !target.machineId ||
    ['machineId', 'platform', 'arch', 'nodeModulesAbi', 'libc'].some((key) => smokeProof.runtime?.[key] !== target[key]) ||
    typeof smokeProof.receiptId !== 'string' ||
    !smokeProof.receiptId.trim() ||
    !Array.isArray(smokeProof.loadedModules) ||
    !['sharp', 'onnxruntime-node'].every((m) => smokeProof.loadedModules.includes(m))
  )
    throw new Error('Actual SM isolated target smoke bound to artifact and runtime required');
  const addons = manifest.files.filter((f) => f.type === 'file' && f.path.endsWith('.node'));
  if (
    !Array.isArray(smokeProof.loadedNativeFiles) ||
    smokeProof.loadedNativeFiles.length !== addons.length ||
    addons.some((f) => !smokeProof.loadedNativeFiles.some((e) => e.path === f.path && e.sha256 === f.sha256))
  )
    throw new Error('Complete actual .node load evidence required');
  return { nativeEligible: true, uiReview: 'pending independent review', deployEligible: false };
}

// Explicit SM-local operation only. The agent never invokes this during source
// preparation. The single authorized run owner must call it on isolated SM data.
export function runTargetNativeSmoke(
  root,
  manifest,
  elfProof,
  {
    io = { readFileSync, realpathSync, lstatSync },
    runtime = process,
    run = (bin, args, options) => {
      const result = spawnSync('/usr/bin/ionice', ['-c', '3', 'nice', '-n', '19', bin, ...args], options);
      if (result.error || result.status !== 0) throw new Error('Isolated SM native loader failed');
      return result.stdout;
    },
    receiptId,
  } = {},
) {
  verifyElfProof(manifest, elfProof);
  const report = runtime.report.getReport();
  const target = {
    machineId: io.readFileSync('/etc/machine-id', 'utf8').trim(),
    platform: runtime.platform,
    arch: runtime.arch,
    nodeModulesAbi: runtime.versions.modules,
    libc: `glibc-${report.header.glibcVersionRuntime}`,
  };
  if (
    !/^24\./.test(runtime.versions.node) ||
    ['machineId', 'platform', 'arch', 'nodeModulesAbi', 'libc'].some((key) => target[key] !== manifest.nativeTargetRuntime?.[key]) ||
    typeof receiptId !== 'string' ||
    !receiptId.trim()
  )
    throw new Error('Actual SM runtime and native smoke receipt required');
  const canonicalRoot = io.realpathSync(root);
  const verifyFiles = () => {
    for (const file of manifest.files.filter((f) => f.type === 'file')) {
      const path = join(root, file.path);
      const rel = relative(canonicalRoot, io.realpathSync(path));
      if (
        rel === '..' ||
        rel.startsWith('../') ||
        isAbsolute(rel) ||
        !io.lstatSync(path).isFile() ||
        hash(io.readFileSync(path)) !== file.sha256
      )
        throw new Error('SM smoke artifact checksum/path mismatch');
    }
  };
  verifyFiles();
  const addons = manifest.files.filter((f) => f.type === 'file' && f.path.endsWith('.node'));
  const script =
    "const path=require('node:path');for(const file of JSON.parse(process.argv[1]))require(path.resolve(file));require('sharp');require('onnxruntime-node');process.stdout.write('NATIVE_LOADED');";
  const output = run(runtime.execPath, ['-e', script, JSON.stringify(addons.map((f) => f.path))], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 1024,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', NODE_ENV: 'production' },
  });
  if (String(output) !== 'NATIVE_LOADED') throw new Error('No completed native load evidence');
  verifyFiles();
  return {
    schema: 'mint-f1-sm-native-smoke-v1',
    status: 'passed',
    executed: true,
    scope: 'isolated-sm-target-native-loader',
    artifactInventorySha256: manifest.inventorySha256,
    elfProofSha256: hash(JSON.stringify(elfProof)),
    runtime: target,
    receiptId,
    loadedModules: ['sharp', 'onnxruntime-node'],
    loadedNativeFiles: addons.map((f) => ({ path: f.path, sha256: f.sha256 })),
  };
}

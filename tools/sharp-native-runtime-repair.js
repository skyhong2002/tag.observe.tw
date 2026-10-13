// Source-reviewed, opt-in derivation only. No CLI, network, build, or smoke.
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { inventory, createArtifactManifest } from './mint-f1-artifact.js';
import { collectElfProof, verifyElfProof } from './native-elf-proof.js';
export const preSha = 'cf896cc1b7f3ae9c3e8eb3d7b2b198b8de2824ff7d0681d684bab5a825def335';
export const repairedRpath = '$ORIGIN/../../sharp-libvips-linux-x64/lib';
export const bindingPaths = Object.freeze(['node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node', 'web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node', 'web/.next/standalone/web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node']);
export const originalRpath = Object.freeze(['$ORIGIN/../../sharp-libvips-linux-x64/lib', '$ORIGIN/../../../sharp-libvips-linux-x64/1.3.4/lib', '$ORIGIN/../../node_modules/@img/sharp-libvips-linux-x64/lib', '$ORIGIN/../../../node_modules/@img/sharp-libvips-linux-x64/lib', '$ORIGIN/../../../../../@img-sharp-libvips-linux-x64-npm-1.3.4-28ab0da74d/node_modules/@img/sharp-libvips-linux-x64/lib']);
const pinnedBindings = bindingPaths, pinnedRpath = originalRpath;
export const buildId = 'PmjYScQDDoJKBr43SLkhd';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, path) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
const execute = (bin, args) => { const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 ** 2, env: { PATH: '/usr/bin:/bin', LANG: 'C' } }); if (r.error || r.status !== 0) throw new Error('Native inspection/patch command failed'); return r.stdout; };
export function assertOnlyRpathChanged(before, after) {
  if (before.tag !== 'RPATH' || after.tag !== 'RPATH' || before.runpath || after.runpath || after.rpath !== repairedRpath) throw new Error('Unexpected loader tag or repaired RPATH');
  for (const key of ['arch', 'needed', 'soname', 'versions', 'symbols', 'textDigest']) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`Non-RPATH ELF change: ${key}`);
}
export function snapshotElf(path, run = execute) {
  const header = run('/usr/bin/readelf', ['--file-header', '--', path]);
  const dynamic = run('/usr/bin/readelf', ['--dynamic', '--', path]);
  const versions = run('/usr/bin/readelf', ['--version-info', '--', path]);
  const symbols = run('/usr/bin/readelf', ['--dyn-syms', '--wide', '--', path]);
  const text = run('/usr/bin/readelf', ['--hex-dump=.text', '--wide', '--', path]);
  const rpaths = [...dynamic.matchAll(/\(RPATH\)[^\[]*\[([^\]]*)\]/g)];
  const runpaths = [...dynamic.matchAll(/\(RUNPATH\)[^\[]*\[([^\]]*)\]/g)];
  if (rpaths.length !== 1 || runpaths.length) throw new Error('Exactly one DT_RPATH and no RUNPATH required');
  if (!/Class:\s+ELF64/.test(header) || !/Machine:\s+Advanced Micro Devices X86-64/.test(header)) throw new Error('Unexpected Sharp architecture');
  // Ignore section addresses/offsets, preserve all version tuples and symbol fields.
  if (!/Version (?:symbols|needs|definition) section|No version information found in this file\./.test(versions)) throw new Error('Missing full version evidence');
  const versionRows = versions.replace(/(Addr:|Offset:)\s*0x[\da-f]+/gi, '$1<relocated>').split('\n');
  const symbolRows = symbols.split('\n').filter(l => /^\s*\d+:/.test(l)).map(l => l.trim().split(/\s+/).slice(1));
  const textBytes = text.split('\n').filter(line => /^\s*0x[\da-f]+\s/i.test(line)).map(line => line.replace(/^\s*0x[\da-f]+\s+/i, '').split(/\s{2,}/)[0].trim()).map(row => { if (!/^[\da-f]{2,8}(?: [\da-f]{2,8}){0,3}$/i.test(row)) throw new Error('Unparseable text bytes'); return row.replace(/ /g, ''); }).join('');
  if (!symbolRows.length || !textBytes) throw new Error('Missing native symbols/text evidence');
  return { arch: header.split('\n').filter(line => /^\s*(?:Class|Data|Version|OS\/ABI|ABI Version|Type|Machine|Flags):/.test(line)), needed: [...dynamic.matchAll(/\(NEEDED\)[^\[]*\[([^\]]*)\]/g)].map(m => m[1]), soname: [...dynamic.matchAll(/\(SONAME\)[^\[]*\[([^\]]*)\]/g)].map(m => m[1]), versions: versionRows, symbols: symbolRows, textDigest: hash(textBytes), tag: 'RPATH', runpath: null, rpath: rpaths[0][1], rawReadelfSha256: hash(JSON.stringify({ header, dynamic, versions, symbols, text })) };
}
export function validateRepairPlan({ source, destination, bindingPaths: paths = bindingPaths, originalRpath: pathsRpath = originalRpath, originalInventorySha256 }) {
  source = resolve(source); destination = resolve(destination);
  const bindingPaths = paths, originalRpath = pathsRpath;
  if (destination !== source.replace(/\.runtime$/, '.native-runtime') || !source.endsWith('.runtime') || dirname(source) !== dirname(destination)) throw new Error('Exclusive same-parent .native-runtime required');
  if (!/^[a-f0-9]{64}$/.test(originalInventorySha256 || '') || !Array.isArray(bindingPaths) || bindingPaths.length !== 3 || new Set(bindingPaths).size !== 3 || !Array.isArray(originalRpath) || originalRpath.length !== 5) throw new Error('Pinned paths/RPATH/inventory required');
  if (JSON.stringify(paths) !== JSON.stringify(pinnedBindings) || JSON.stringify(pathsRpath) !== JSON.stringify(pinnedRpath)) throw new Error('Unknown reviewed Sharp paths/RPATH');
  // Exact constants are supplied by reviewed owner policy, never discovered from
  // arbitrary artifact input. Reject wrong layout, version, and duplicate roots.
  const prefixes = ['node_modules/', 'web/node_modules/', 'web/.next/standalone/web/node_modules/'];
  bindingPaths.forEach((path, index) => { if (!path.startsWith(prefixes[index]) || !/sharp-linux-x64(?:\/lib)?\/sharp-linux-x64-0\.35\.5\.node$/.test(path) || path.split('/').includes('..')) throw new Error('Unknown Sharp binding layout'); });
  return { source, destination, bindingPaths, originalRpath, originalInventorySha256 };
}
function syncCallback(fn, ...args) {
  const result = fn(...args);
  if (result && typeof result.then === 'function') {
    // Avoid an unhandled rejection while rejecting async guard implementations.
    Promise.resolve(result).catch(() => {});
    throw new Error('Synchronous verifier required; thenable callback rejected');
  }
  return result;
}
export function repairSharpRuntime(input, dependencies = {}) {
  const digest = dependencies.hash || hash;
  const io = dependencies.io || fs; const run = dependencies.run || execute;
  const scan = dependencies.inventory || ((root) => inventory(root, io));
  const snapshot = dependencies.snapshot || ((path) => snapshotElf(path, run));
  const gate = phase => { if (!dependencies.assertLock || !dependencies.currentGuard || !dependencies.assertKernel || !dependencies.verifyOriginal) throw new Error('Explicit lock/kernel/current guard/Git provenance verifiers required'); syncCallback(dependencies.assertLock, phase); syncCallback(dependencies.assertKernel, phase); syncCallback(dependencies.currentGuard, { phase, estimatedAdditionalGiB: 4 }); };
  const plan = validateRepairPlan(input); if (input.identity?.appSha !== initialAppSha) throw new Error('Pinned APP identity required'); gate('preflight'); syncCallback(dependencies.verifyOriginal, plan.source, input.identity);
  if (!io.lstatSync(plan.source).isDirectory() || io.lstatSync(plan.source).isSymbolicLink() || io.realpathSync(plan.source) !== plan.source || io.realpathSync(dirname(plan.source)) !== dirname(plan.source)) throw new Error('Canonical original runtime required');
  const original = scan(plan.source); if (digest(JSON.stringify(original)) !== plan.originalInventorySha256) throw new Error('Original inventory mismatch');
  const oldManifest = JSON.parse(io.readFileSync(join(plan.source, 'manifest.json'), 'utf8'));
  if (oldManifest.buildId !== buildId || oldManifest.commit !== input.identity.appSha) throw new Error('Pinned build/source identity required');
  for (const path of plan.bindingPaths) { const entry = original.find(e => e.path === path); if (entry?.type !== 'file' || entry.sha256 !== preSha) throw new Error('Unknown binding path/hash'); }
  const tool = dependencies.providePatchelf?.();
  if (!tool || !isAbsolute(tool.path || '') || tool.version !== '0.18.0' || !/^[a-f0-9]{64}$/.test(tool.sha256 || '') || !tool.provenance || !dependencies.verifyToolProof) throw new Error('Trusted portable tool proof required');
  syncCallback(dependencies.verifyToolProof, tool.provenance); if (digest(io.readFileSync(tool.path)) !== tool.sha256 || run(tool.path, ['--version']).trim() !== 'patchelf 0.18.0') throw new Error('Tool bytes/version mismatch');
  gate('exclusive-create'); io.mkdirSync(plan.destination, { mode: 0o700 });
  // Never clean on error: partial new tree stays available for diagnosis.
  for (const entry of original) {
    gate('copy'); const from = join(plan.source, entry.path), to = join(plan.destination, entry.path);
    if (entry.type === 'directory') io.mkdirSync(to, { mode: entry.mode });
    else if (entry.type === 'file') { if (digest(io.readFileSync(from)) !== entry.sha256) throw new Error('Original changed during copy'); io.copyFileSync(from, to, 1); io.chmodSync(to, entry.mode); if (digest(io.readFileSync(to)) !== entry.sha256) throw new Error('Copied bytes differ'); }
    else if (entry.type === 'symlink') { if (io.readlinkSync(from) !== entry.target) throw new Error('Original symlink changed'); io.symlinkSync(entry.target, to); }
    else throw new Error('Unknown inventory entry type');
  }
  const repairs = [];
  for (const path of plan.bindingPaths) {
    gate('inspect-before'); const full = join(plan.destination, path); const before = snapshot(full);
    if (before.tag !== 'RPATH' || before.runpath || before.rpath !== plan.originalRpath.join(':')) throw new Error('Unknown exact original RPATH/tag');
    const libdir = resolve(dirname(full), '../../sharp-libvips-linux-x64/lib');
    if (!inside(plan.destination, libdir) || !inside(plan.destination, io.realpathSync(libdir)) || !io.lstatSync(io.realpathSync(libdir)).isDirectory()) throw new Error('Escaping/missing internal libvips directory');
    const requiredLibrary = join(libdir, 'libvips-cpp.so.8.18.7');
    if (!inside(plan.destination, io.realpathSync(requiredLibrary)) || !io.lstatSync(io.realpathSync(requiredLibrary)).isFile()) throw new Error('Required libvips library missing/escaping');
    for (const name of io.readdirSync(libdir)) { const library = join(libdir, name); if (!inside(plan.destination, io.realpathSync(library))) throw new Error('Escaping internal library/symlink'); }
    gate('patch'); if (digest(io.readFileSync(full)) !== preSha || digest(io.readFileSync(tool.path)) !== tool.sha256) throw new Error('Binding/tool changed before patch');
    run(tool.path, ['--force-rpath', '--set-rpath', repairedRpath, full]);
    gate('inspect-after'); const after = snapshot(full); assertOnlyRpathChanged(before, after);
    const postSha256 = digest(io.readFileSync(full));
    if (postSha256 === preSha) throw new Error('Patch must change binding checksum');
    repairs.push({ path, preSha256: preSha, postSha256, before, after });
  }
  gate('rewrite-root-manifest');
  const manifest = { ...oldManifest, standaloneWeb: join(plan.destination, 'web/.next/standalone/web'), appSource: join(plan.destination, 'app/src'), appData: join(plan.destination, 'app/data'), nativeStatus: 'pending-new-target-smoke', deployEligible: false, ui: 'not reviewed' };
  io.writeFileSync(join(plan.destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  const receipt = { schema: 'sharp-native-rpath-repair-v1', originalRoot: plan.source, newRoot: plan.destination, originalInventorySha256: plan.originalInventorySha256, tool, repairs, buildId, status: 'pending-native-target-smoke', deployEligible: false };
  io.writeFileSync(join(plan.destination, 'sharp-native-repair.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  gate('verify-diff'); const derived = scan(plan.destination); const allowed = new Set([...plan.bindingPaths, 'manifest.json', 'sharp-native-repair.json']);
  const remaining = files => files.filter(e => !allowed.has(e.path));
  if (JSON.stringify(remaining(original)) !== JSON.stringify(remaining(derived))) throw new Error('Unexpected derived tree change');
  if (JSON.stringify(scan(plan.source)) !== JSON.stringify(original)) throw new Error('Original tree changed');
  gate('new-inventory-elf');
  const artifact = (dependencies.createManifest || ((root, identity) => createArtifactManifest(root, identity, io)))(plan.destination, input.identity);
  const elf = (dependencies.collectElfProof || ((root, artifact) => collectElfProof(root, artifact, run, io)))(plan.destination, artifact);
  (dependencies.verifyElfProof || verifyElfProof)(artifact, elf);
  gate('return-pending'); syncCallback(dependencies.verifyOriginal, plan.source, input.identity); if (JSON.stringify(scan(plan.source)) !== JSON.stringify(original)) throw new Error('Original changed during ELF verification');
  // Long final source hashes may outlive a lease: gate again afterwards.
  gate('prepared-return');
  // Only the parent controller may publish after worker completion, fresh
  // probes, input/source checksum binding and full validation. No final write.
  // No smoke or deployment eligibility: new inventory invalidates old smoke.
  return { root: plan.destination, receipt, artifact, elf, manifestPublished: false, deployEligible: false, nativeStatus: 'pending-new-target-smoke', ui: 'not reviewed' };
}

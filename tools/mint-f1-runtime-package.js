// Derive a new Linux runtime artifact; never remove/overwrite the build tree.
import { lstatSync, readdirSync, readFileSync, realpathSync, readlinkSync, mkdirSync, copyFileSync, chmodSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { appLockfilePins } from './mint-f1-artifact.js';
export const onnxVersion = '1.30.0';
const vendor = 'node_modules/onnxruntime-node/bin/napi-v6';
const supportedLayout = ['darwin/arm64', 'linux/arm64', 'linux/x64', 'win32/arm64', 'win32/x64'];
const ioDefault = { lstatSync, readdirSync, readFileSync, realpathSync, readlinkSync, mkdirSync, copyFileSync, chmodSync, symlinkSync, writeFileSync };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function excluded(path) {
  if (['.home', '.npm-cache'].some(p => path === p || path.startsWith(p + '/'))) return 'build-work-cache-not-runtime';
  if (path === 'manifest.json') return 'legacy-absolute-working-tree-manifest-replaced';
  if (path === 'mint-guard.jsonl') return 'mutable-build-guard-audit-retained-in-original-tree';
  if (path === 'mint-execution-input.json') return 'private-build-control-input-not-runtime';
  for (const tuple of supportedLayout.filter(t => t !== 'linux/x64')) if (path === `${vendor}/${tuple}` || path.startsWith(`${vendor}/${tuple}/`)) return `onnx-${onnxVersion}-foreign-platform-architecture:${tuple}`;
  return null;
}
export function planRuntimePackage(source, destination, io = ioDefault) {
  source = resolve(source); destination = resolve(destination);
  if (source === destination || dirname(source) !== dirname(destination)) throw new Error('New runtime must be an exclusive sibling of build tree');
  if (!io.lstatSync(source).isDirectory() || io.lstatSync(source).isSymbolicLink?.()) throw new Error('Real build directory required');
  if (io.realpathSync(dirname(source)) !== io.realpathSync(dirname(destination))) throw new Error('Runtime parent identity mismatch');
  const appSha = io.readFileSync(join(source, 'COMMIT'), 'utf8').trim();
  const buildId = io.readFileSync(join(source, 'web/.next/BUILD_ID'), 'utf8').trim();
  if (appSha !== initialAppSha || !/^[a-zA-Z0-9_-]{1,200}$/.test(buildId)) throw new Error('Pinned APP and BUILD_ID required');
  for (const [path, hash] of Object.entries(appLockfilePins)) if (digest(io.readFileSync(join(source, path))) !== hash) throw new Error('Pinned runtime lockfile differs');
  const lock = JSON.parse(io.readFileSync(join(source, 'package-lock.json'), 'utf8'));
  const pkg = JSON.parse(io.readFileSync(join(source, 'node_modules/onnxruntime-node/package.json'), 'utf8'));
  if (lock.packages?.['node_modules/onnxruntime-node']?.version !== onnxVersion || pkg.name !== 'onnxruntime-node' || pkg.version !== onnxVersion) throw new Error('Only exact pinned ONNX package permitted');
  if (io.readdirSync(join(source, 'node_modules/onnxruntime-node/bin')).sort().join(',') !== 'napi-v6') throw new Error('Unknown ONNX native ABI layout');
  const tuples = [];
  for (const platform of io.readdirSync(join(source, vendor)).sort()) {
    if (!['darwin', 'linux', 'win32'].includes(platform)) throw new Error('Unknown ONNX platform');
    for (const architecture of io.readdirSync(join(source, vendor, platform)).sort()) tuples.push(`${platform}/${architecture}`);
  }
  if (tuples.sort().join(',') !== supportedLayout.join(',')) throw new Error('Unknown ONNX platform/architecture layout');
  const entries = []; const root = io.realpathSync(source);
  const walk = (prefix = '') => {
    for (const name of io.readdirSync(join(source, prefix)).sort()) {
      if (!name || ['.', '..'].includes(name) || /[\\/\x00-\x1f\x7f]/.test(name) || /^\.env(?:\.|$)/.test(name)) throw new Error('Unsafe filename or environment file in working tree');
      const path = prefix ? `${prefix}/${name}` : name; const full = join(source, path); const stat = io.lstatSync(full); const reason = excluded(path);
      if (stat.isSymbolicLink()) {
        const target = io.readlinkSync(full); const canonical = io.realpathSync(full); const rel = relative(root, canonical);
        if (!target || isAbsolute(target) || rel === '..' || rel.startsWith('../') || isAbsolute(rel) || !io.lstatSync(canonical).isFile()) throw new Error('Unsafe runtime symlink');
        const resolvedPath = relative(root, canonical);
        if (!reason && excluded(resolvedPath)) throw new Error('Retained runtime link targets excluded data');
        entries.push({ path, type: 'symlink', target, sha256: digest(target), resolvedPath, reason });
      } else if (stat.isDirectory()) { entries.push({ path, type: 'directory', mode: stat.mode & 0o777, reason }); walk(path); }
      else if (stat.isFile()) entries.push({ path, type: 'file', mode: stat.mode & 0o777, size: stat.size, sha256: digest(io.readFileSync(full)), reason });
      else throw new Error('Unsupported runtime filesystem entry');
    }
  };
  walk();
  // Sorted DFS visits every parent before its children. Reverse traversal hashes
  // descendants first; each direct edge contributes once, without subtree scans.
  const childrenByDirectory = new Map();
  for (const entry of entries) {
    const parent = dirname(entry.path);
    if (!childrenByDirectory.has(parent)) childrenByDirectory.set(parent, []);
    childrenByDirectory.get(parent).push(entry);
  }
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.type === 'directory') entry.sha256 = digest(JSON.stringify((childrenByDirectory.get(entry.path) || []).map(child => ({
      name: child.path.slice(entry.path.length + 1), type: child.type, sha256: child.sha256, target: child.target
    }))));
  }
  if (!entries.some(e => e.type === 'file' && e.path.startsWith(`${vendor}/linux/x64/`) && e.path.endsWith('.node'))) throw new Error('Selected Linux/x64 binding missing');
  return { source, destination, appSha, buildId, onnxVersion, selectedNativeLayout: 'napi-v6/linux/x64', sourceInventorySha256: digest(JSON.stringify(entries)), entries };
}
export function deriveRuntimePackage(source, destination, { apiOrigin, assertLock = () => { throw new Error('Held common lock verifier required'); } } = {}, io = ioDefault) {
  assertLock();
  const api = new URL(apiOrigin);
  if (api.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(api.hostname) || !api.port || api.username || api.password || api.pathname !== '/' || api.search || api.hash) throw new Error('Verified isolated Mint API required');
  const plan = planRuntimePackage(source, destination, io);
  const originManifest = JSON.parse(io.readFileSync(join(plan.source, 'manifest.json'), 'utf8'));
  if (originManifest.commit !== plan.appSha || originManifest.buildId !== plan.buildId || originManifest.apiOrigin !== apiOrigin) throw new Error('Original candidate manifest identity mismatch');
  io.mkdirSync(plan.destination, { mode: 0o700 }); // No recursive root, overwrite or removal.
  for (const entry of plan.entries.filter(e => !e.reason)) {
    assertLock(); const from = join(plan.source, entry.path), to = join(plan.destination, entry.path);
    if (entry.type === 'directory') io.mkdirSync(to, { mode: entry.mode });
    else if (entry.type === 'file') {
      if (digest(io.readFileSync(from)) !== entry.sha256) throw new Error('Working file changed after selection');
      io.copyFileSync(from, to, 1); io.chmodSync(to, entry.mode);
      if (digest(io.readFileSync(to)) !== entry.sha256) throw new Error('Runtime copy checksum mismatch');
    } else { if (io.readlinkSync(from) !== entry.target) throw new Error('Runtime link changed'); io.symlinkSync(entry.target, to); }
  }
  const standaloneRoots = ['web/.next/standalone', 'web/.next/standalone/web'].filter(p => plan.entries.some(e => !e.reason && e.path === `${p}/server.js`));
  if (standaloneRoots.length !== 1) throw new Error('Exactly one derived standalone server required');
  const receipt = { schema: 'mint-f1-runtime-selection-v1', appSha: plan.appSha, buildId: plan.buildId,
    originalWorkingTree: plan.source, runtimeRoot: plan.destination, originalInventorySha256: plan.sourceInventorySha256,
    pinnedOnnxVersion: onnxVersion, selectedNativeLayout: plan.selectedNativeLayout,
    excluded: plan.entries.filter(e => e.reason), nativeStatus: 'pending ELF and actual isolated SM target smoke' };
  io.writeFileSync(join(plan.destination, 'mint-runtime-selection.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  io.writeFileSync(join(plan.destination, 'manifest.json'), JSON.stringify({ status: 'prepared', ui: 'not reviewed', nativeStatus: 'pending-native-target-smoke', deployEligible: false,
    commit: plan.appSha, buildId: plan.buildId, standaloneWeb: join(plan.destination, standaloneRoots[0]), appSource: join(plan.destination, 'app/src'), appData: join(plan.destination, 'app/data'), apiOrigin,
    originProvenance: { originalWorkingTree: plan.source, originalManifestSha256: digest(io.readFileSync(join(plan.source, 'manifest.json'))) } }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  assertLock(); return receipt;
}

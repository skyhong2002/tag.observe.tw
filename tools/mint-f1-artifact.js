// Offline artifact identity/integrity only. Does not run builds or deploy.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, writeFileSync, readlinkSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, relative as pathRelative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { initialAppSha } from './mint-f1-candidate-plan.js';
const defaultIo = { lstatSync, readdirSync, readFileSync, writeFileSync, readlinkSync, realpathSync };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestName = 'mint-artifact.json';
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const appLockfilePins = Object.freeze({ 'package-lock.json': 'dcbdcc3df6d0fbb2517d12dcf59df5f07ab862c3b3c34b926c0d6a08f43e73c0', 'web/package-lock.json': '820cba8fbd5d4ac2b8251dcfce8e3bfa35368c7b8e144796b2d4c136b50167fa' });
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function inventory(root, io = defaultIo) {
  const entries = [];
  if (!io.lstatSync(root).isDirectory()) throw new Error('Candidate root must be a real directory');
  const walk = (relative = '') => {
    for (const name of io.readdirSync(join(root, relative)).sort()) {
      if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Unsafe artifact filename');
      const path = relative ? `${relative}/${name}` : name;
      if (path === manifestName) {
        const metadata = io.lstatSync(join(root, path));
        if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Manifest must be a regular non-symlink file');
        continue;
      }
      if (/^\.env(?:\.|$)/.test(name)) throw new Error('Environment files forbidden in candidate');
      const full = join(root, path); const stat = io.lstatSync(full);
      if (stat.isSymbolicLink()) {
        if (!io.readlinkSync || !io.realpathSync) throw new Error(`Unverifiable artifact symlink: ${path}`);
        const target = io.readlinkSync(full);
        if (!target || isAbsolute(target) || /[\x00-\x1f\x7f]/.test(target)) throw new Error(`Unsafe artifact symlink: ${path}`);
        const inside = candidate => { const rel = pathRelative(resolve(root), candidate); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
        if (!inside(resolve(root, dirname(path), target))) throw new Error(`Escaping artifact symlink: ${path}`);
        let canonical;
        try { canonical = io.realpathSync(full); } catch { throw new Error(`Cyclic or dangling artifact symlink: ${path}`); }
        const canonicalRoot = io.realpathSync(root);
        const canonicalRelative = pathRelative(canonicalRoot, canonical);
        if (canonicalRelative === '..' || canonicalRelative.startsWith('../') || isAbsolute(canonicalRelative)) throw new Error(`External artifact symlink: ${path}`);
        const finalStat = io.lstatSync(canonical);
        if (!finalStat.isFile()) throw new Error(`Directory/cyclic or unsupported artifact symlink target: ${path}`);
        entries.push({ path, type: 'symlink', target, resolvedPath: canonicalRelative, targetType: finalStat.isFile() ? 'file' : 'directory', sha256: digest(target), targetSha256: finalStat.isFile() ? digest(io.readFileSync(canonical)) : null });
        continue;
      }
      if (stat.isDirectory()) { entries.push({ path, type: 'directory', mode: stat.mode & 0o777 }); walk(path); }
      else if (stat.isFile()) { const bytes = io.readFileSync(full); entries.push({ path, type: 'file', mode: stat.mode & 0o777, size: bytes.length, sha256: digest(bytes) }); }
      else throw new Error(`Unsupported artifact file: ${path}`);
    }
  };
  walk(); return entries;
}
function validateIdentity(identity) {
  if (!identity || identity.appSha !== initialAppSha || !isSha(identity.opsSha)
    || identity.platform !== 'linux' || !['x64', 'arm64'].includes(identity.arch)
    || !/^24\./.test(identity.nodeVersion || '') || !/^\d+$/.test(identity.nodeModulesAbi || '')
    || !/^glibc-\d+\.\d+$/.test(identity.libc || '') || !identity.smAbi
    || identity.smAbi.platform !== 'linux' || identity.smAbi.arch !== identity.arch
    || identity.smAbi.nodeModulesAbi !== identity.nodeModulesAbi || identity.smAbi.libc !== identity.libc
    || identity.nativeAbiVerified !== true || !nonempty(identity.nativeAbiReceiptId)
    || identity.sourceVerified !== true || !nonempty(identity.sourceReceiptId)
    || !sha256(identity.expectedSourceArchiveSha256) || !identity.expectedLockfiles
    || JSON.stringify(identity.expectedLockfiles) !== JSON.stringify(appLockfilePins)
    || !identity.expectedSourceFiles || typeof identity.expectedSourceFiles !== 'object'
    || !Object.keys(identity.expectedSourceFiles).length) throw new Error('Verified exact source and compatible Linux native ABI identities required');
}
export function createArtifactManifest(root, identity, io = defaultIo) {
  validateIdentity(identity);
  const files = inventory(root, io); const map = new Map(files.map(f => [f.path, f]));
  const file = path => { const found = map.get(path); if (!found || found.type !== 'file') throw new Error(`Missing artifact file: ${path}`); return found; };
  const directory = path => { if (map.get(path)?.type !== 'directory') throw new Error(`Missing artifact directory: ${path}`); };
  for (const path of ['node_modules', 'app/src', 'app/data', 'web/public', 'web/.next/static']) directory(path);
  for (const prefix of ['app/src/', 'app/data/', 'web/.next/static/']) if (!files.some(f => f.type === 'file' && f.path.startsWith(prefix))) throw new Error(`Empty required artifact tree: ${prefix}`);
  for (const path of ['package.json', 'node_modules/.package-lock.json', 'app/src/server.js', 'app/src/worker.ts']) file(path);
  for (const [path, checksum] of Object.entries(identity.expectedSourceFiles)) {
    if (!sha256(checksum) || path.startsWith('/') || path.split('/').includes('..') || file(path).sha256 !== checksum) throw new Error(`Pinned source entry differs: ${path}`);
  }
  for (const entry of files.filter(f => f.type === 'file' && /^(app\/src\/|app\/data\/)/.test(f.path))) {
    if (!Object.hasOwn(identity.expectedSourceFiles, entry.path)) throw new Error(`Unexpected application source: ${entry.path}`);
  }
  for (const path of ['package.json', 'package-lock.json', 'web/package-lock.json', 'app/src/server.js', 'app/src/worker.ts']) {
    if (!Object.hasOwn(identity.expectedSourceFiles, path)) throw new Error(`Incomplete trusted source receipt: ${path}`);
  }
  const pkg = JSON.parse(io.readFileSync(join(root, 'package.json'), 'utf8'));
  if (!pkg.dependencies || typeof pkg.dependencies !== 'object' || !Object.keys(pkg.dependencies).length) throw new Error('Root runtime dependency contract missing');
  for (const dependency of Object.keys(pkg.dependencies)) {
    if (!/^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(dependency) || dependency === '..') throw new Error('Unsafe runtime dependency');
    file(`node_modules/${dependency}/package.json`);
  }
  const servers = ['web/.next/standalone/server.js', 'web/.next/standalone/web/server.js'].filter(p => map.has(p));
  if (servers.length !== 1) throw new Error('Exactly one standalone server required');
  file(servers[0]); const standalone = servers[0].slice(0, -'/server.js'.length);
  file(`${standalone}/package.json`); file(`${standalone}/.next/BUILD_ID`);
  const nextPackages = [...new Set([`${standalone}/node_modules/next/package.json`, 'web/.next/standalone/node_modules/next/package.json'])];
  if (!nextPackages.some(path => map.get(path)?.type === 'file')) throw new Error('Missing traced standalone Next runtime');
  directory(`${standalone}/.next/static`); directory(`${standalone}/public`);
  const compareCopies = (from, to) => {
    const source = files.filter(f => f.path.startsWith(`${from}/`)).map(f => ({ ...f, path: f.path.slice(from.length) }));
    const copy = files.filter(f => f.path.startsWith(`${to}/`)).map(f => ({ ...f, path: f.path.slice(to.length) }));
    if (JSON.stringify(source) !== JSON.stringify(copy)) throw new Error(`Standalone copy differs: ${from}`);
  };
  compareCopies('web/.next/static', `${standalone}/.next/static`); compareCopies('web/public', `${standalone}/public`);
  file('COMMIT'); const commit = io.readFileSync(join(root, 'COMMIT'), 'utf8').trim();
  if (commit !== identity.appSha) throw new Error('COMMIT differs from pinned APP_SHA');
  file('web/.next/BUILD_ID'); const buildId = io.readFileSync(join(root, 'web/.next/BUILD_ID'), 'utf8').trim();
  if (io.readFileSync(join(root, standalone, '.next/BUILD_ID'), 'utf8').trim() !== buildId) throw new Error('Standalone BUILD_ID differs');
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(buildId)) throw new Error('Invalid BUILD_ID');
  const lockfiles = Object.fromEntries(['package-lock.json', 'web/package-lock.json'].map(p => [p, file(p).sha256]));
  const sourceArchiveSha256 = file('source.tar').sha256;
  if (sourceArchiveSha256 !== identity.expectedSourceArchiveSha256
    || JSON.stringify(lockfiles) !== JSON.stringify(identity.expectedLockfiles)) throw new Error('Pinned source archive/lockfile checksum mismatch');
  return { schema: 'mint-f1-artifact-v1', status: 'prepared', review: 'pending independent candidate UI review', deployment: 'not deployed',
    appSha: identity.appSha, opsSha: identity.opsSha, platform: identity.platform, arch: identity.arch,
    nodeVersion: identity.nodeVersion, nodeModulesAbi: identity.nodeModulesAbi, libc: identity.libc, smAbi: identity.smAbi,
    nativeAbiReceiptId: identity.nativeAbiReceiptId, sourceReceiptId: identity.sourceReceiptId, buildId, standalone, lockfiles, sourceArchiveSha256, inventorySha256: digest(JSON.stringify(files)), files };
}
export function writeArtifactManifest(root, identity, io = defaultIo) {
  const manifest = createArtifactManifest(resolve(root), identity, io);
  io.writeFileSync(join(resolve(root), manifestName), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return manifest;
}
export function verifyArtifact(root, expectedIdentity, io = defaultIo) {
  const metadata = io.lstatSync(join(root, manifestName));
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Manifest must be a regular non-symlink file');
  const expected = JSON.parse(io.readFileSync(join(root, manifestName), 'utf8'));
  const actual = createArtifactManifest(root, expectedIdentity, io);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Artifact identity/inventory/checksum mismatch');
  return actual; // Integrity/ABI success is never candidate UI or deployment approval.
}

// Receipt is derived from exact Git objects, never inferred from candidate files.
// Execution must independently pin/retain this receipt before install/build.
export function sourceReceiptFromGit(repo, run = (bin, args, options) => {
  const result = spawnSync(bin, args, options);
  if (result.error || result.status !== 0) throw new Error('Exact source Git read failed');
  return result.stdout;
}) {
  const opts = { cwd: repo, maxBuffer: 512 * 1024 ** 2, env: { PATH: '/usr/bin:/bin', LANG: 'C' } };
  const paths = ['app/src', 'app/data', 'tools/vocabulary-export.ts', 'package.json', 'package-lock.json', 'web'];
  const listing = run('git', ['ls-tree', '-r', '-z', initialAppSha, '--', ...paths], opts).toString();
  const expectedSourceFiles = {};
  for (const row of listing.split('\0').filter(Boolean)) {
    const match = row.match(/^(100644|100755) blob [a-f0-9]{40}\t(.+)$/);
    if (!match || match[2].split('/').some(part => /^\.env(?:\.|$)/.test(part))) throw new Error('Unreviewed exact source entry');
    expectedSourceFiles[match[2]] = digest(run('git', ['show', `${initialAppSha}:${match[2]}`], opts));
  }
  for (const [path, checksum] of Object.entries(appLockfilePins)) if (expectedSourceFiles[path] !== checksum) throw new Error('Pinned APP lockfile differs');
  return { appSha: initialAppSha, expectedLockfiles: { ...appLockfilePins }, expectedSourceFiles,
    expectedSourceArchiveSha256: digest(run('git', ['archive', '--format=tar', initialAppSha, ...paths], opts)) };
}

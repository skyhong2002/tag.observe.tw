import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
const rootLock = readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8');
const webLock = readFileSync(new URL('../web/package-lock.json', import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
import { createArtifactManifest, writeArtifactManifest, verifyArtifact, sourceReceiptFromGit } from './mint-f1-artifact.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
const identity = () => ({ nativeTargetRuntime: { machineId: 'sm-id', platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.39' }, nativePolicy: { schema: 'mint-f1-native-policy-v1', reviewed: true, buildAllowed: true, strategy: 'elf-requirements-and-sm-target-smoke', reviewReceiptId: 'mock-native-policy', maxGlibcRequired: '2.39' }, appSha: initialAppSha, opsSha: 'a'.repeat(40), platform: 'linux', arch: 'x64', nodeVersion: '24.1.0', nodeModulesAbi: '137', libc: 'glibc-2.39', smAbi: { platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.39' }, nativeAbiVerified: true, nativeAbiReceiptId: 'native-review', sourceVerified: true, sourceReceiptId: 'source-review', expectedSourceArchiveSha256: sha('mock archive'), expectedLockfiles: { 'package-lock.json': sha(rootLock), 'web/package-lock.json': sha(webLock) }, expectedSourceFiles: { 'app/src/server.js': sha('server'), 'app/src/worker.ts': sha('worker'), 'app/data/vocab.json': sha('{}'), 'package.json': sha('{"dependencies":{"fastify":"1"}}'), 'package-lock.json': sha(rootLock), 'web/package-lock.json': sha(webLock) } });
function fixture() {
  const files = new Map(Object.entries({ 'COMMIT': initialAppSha + '\n', 'source.tar': 'mock archive', 'package-lock.json': rootLock, 'web/package-lock.json': webLock, 'package.json': '{"dependencies":{"fastify":"1"}}', 'node_modules/.package-lock.json': '{}', 'node_modules/fastify/package.json': '{}', 'app/src/worker.ts': 'worker', 'web/.next/standalone/package.json': '{}', 'web/.next/standalone/.next/BUILD_ID': 'candidate-1', 'web/.next/standalone/node_modules/next/package.json': '{}', 'web/.next/BUILD_ID': 'candidate-1', 'app/src/server.js': 'server', 'app/data/vocab.json': '{}', 'web/.next/static/a.js': 'static', 'web/public/logo.png': 'public', 'web/.next/standalone/server.js': 'server', 'web/.next/standalone/.next/static/a.js': 'static', 'web/.next/standalone/public/logo.png': 'public' }));
  const types = new Map(); const path = p => p.replace(/^\/candidate\/?/, '');
  const dirs = () => { const result = new Set(['']); for (const p of files.keys()) { const parts = p.split('/'); parts.pop(); while (parts.length) { result.add(parts.join('/')); parts.pop(); } } return result; };
  const io = { lstatSync(p) { const key = path(p); const dir = dirs().has(key); const type = types.get(key); if (!dir && !files.has(key)) throw new Error('missing ' + key); return { mode: dir ? 0o40700 : 0o100600, isDirectory: () => dir, isFile: () => !dir && type !== 'link', isSymbolicLink: () => type === 'link' }; },
    readdirSync(p) { const key = path(p); const prefix = key ? key + '/' : ''; return [...new Set([...files.keys()].filter(f => f.startsWith(prefix)).map(f => f.slice(prefix.length).split('/')[0]))]; },
    readFileSync(p, encoding) { const data = files.get(path(p)); if (data === undefined) throw new Error('missing'); return encoding ? data : Buffer.from(data); },
    writeFileSync(p, data, opts) { assert.equal(opts.flag, 'wx'); if (files.has(path(p))) throw new Error('exists'); files.set(path(p), data); } };
  return { files, types, io };
}
test('full identity, lockfile, source archive and artifact inventory survive round trip', () => {
  const f = fixture(); const manifest = writeArtifactManifest('/candidate', identity(), f.io);
  assert.equal(manifest.appSha, initialAppSha); assert.equal(manifest.buildId, 'candidate-1'); assert.equal(manifest.deployment, 'not deployed'); assert.match(manifest.review, /pending/);
  assert.equal(manifest.sourceArchiveSha256.length, 64); assert.equal(Object.keys(manifest.lockfiles).length, 2);
  assert.deepEqual(verifyArtifact('/candidate', identity(), f.io), manifest);
  assert.throws(() => writeArtifactManifest('/candidate', identity(), f.io), /exists/);
});
test('reject incomplete static/public/appdata, incompatible ABI and wrong source', () => {
  for (const name of ['app/data/vocab.json', 'web/.next/static/a.js', 'web/.next/standalone/public/logo.png', 'package-lock.json']) { const f = fixture(); f.files.delete(name); assert.throws(() => createArtifactManifest('/candidate', identity(), f.io)); }
  for (const delta of [{ platform: 'darwin' }, { libc: 'unknown' }, { nodeModulesAbi: '115' }, { appSha: 'b'.repeat(40) }]) assert.throws(() => createArtifactManifest('/candidate', { ...identity(), ...delta }, fixture().io));
  const f = fixture(); f.files.set('COMMIT', 'b'.repeat(40)); assert.throws(() => createArtifactManifest('/candidate', identity(), f.io));
});
test('reject symlinks, environment secrets, tampering, unexpected files and wrong OPS', () => {
  const link = fixture(); link.types.set('app/src/server.js', 'link'); assert.throws(() => createArtifactManifest('/candidate', identity(), link.io), /symlink/);
  const secret = fixture(); secret.files.set('web/.env.production', 'not real secret'); assert.throws(() => createArtifactManifest('/candidate', identity(), secret.io), /Environment/);
  for (const change of [f => f.files.set('app/src/server.js', 'changed'), f => f.files.set('unexpected.txt', 'extra'), f => f.files.set('source.tar', 'corrupted')]) { const f = fixture(); writeArtifactManifest('/candidate', identity(), f.io); change(f); assert.throws(() => verifyArtifact('/candidate', identity(), f.io), /mismatch|differs/); }
  const f = fixture(); writeArtifactManifest('/candidate', identity(), f.io); assert.throws(() => verifyArtifact('/candidate', { ...identity(), opsSha: 'b'.repeat(40) }, f.io), /mismatch/);
});

test('caller cannot promote integrity into UI or deployment approval', () => {
 const manifest = createArtifactManifest('/candidate', { ...identity(), review: 'approved', deployment: 'deployed', schema: 'spoofed' }, fixture().io);
 assert.equal(manifest.schema, 'mint-f1-artifact-v1'); assert.match(manifest.review, /pending/); assert.equal(manifest.deployment, 'not deployed');
});

test('bootstrap source omissions and changes fail before a manifest exists', () => {
 for (const name of ['app/src/worker.ts', 'app/src/server.js', 'node_modules/.package-lock.json', 'node_modules/fastify/package.json', 'web/.next/standalone/node_modules/next/package.json']) {
  const f = fixture(); f.files.delete(name); assert.throws(() => createArtifactManifest('/candidate', identity(), f.io));
 }
 const f = fixture(); f.files.set('app/src/server.js', 'tampered'); assert.throws(() => createArtifactManifest('/candidate', identity(), f.io), /Pinned source/);
 const extra = fixture(); extra.files.set('app/data/unknown.json', '{}'); assert.throws(() => createArtifactManifest('/candidate', identity(), extra.io), /Unexpected application/);
});

test('source receipt derives pinned Git objects rather than candidate content', () => {
 const blobs = { 'package-lock.json': rootLock, 'web/package-lock.json': webLock, 'app/src/server.js': 'server' };
 const calls = [];
 const receipt = sourceReceiptFromGit('/source', (bin, args, options) => {
  calls.push(args); assert.equal(bin, 'git'); assert.equal(options.cwd, '/source');
  if (args[0] === 'ls-tree') return Buffer.from(Object.keys(blobs).map(p => `100644 blob ${'a'.repeat(40)}\t${p}\0`).join(''));
  if (args[0] === 'show') { assert.ok(args[1].startsWith(initialAppSha + ':')); return Buffer.from(blobs[args[1].slice(41)]); }
  assert.equal(args[0], 'archive'); assert.equal(args[2], initialAppSha); return Buffer.from('mock archive');
 });
 assert.equal(receipt.expectedSourceArchiveSha256, sha('mock archive')); assert.equal(receipt.expectedSourceFiles['app/src/server.js'], sha('server'));
 assert.ok(calls.some(args => args[0] === 'archive'));
 assert.throws(() => sourceReceiptFromGit('/source', (bin, args) => args[0] === 'ls-tree' ? Buffer.from(`120000 blob ${'a'.repeat(40)}\tunsafe\0`) : Buffer.from('')), /Unreviewed/);
});

test('safe relative npm links are inventoried; absolute, escaping and cycles fail', () => {
 const build = (target, canonical) => {
  const f = fixture(); const link = 'node_modules/.bin/tool'; f.files.set(link, 'link'); f.files.set('node_modules/fastify/tool.js', 'tool'); f.types.set(link, 'link');
  f.io.readlinkSync = () => target;
  f.io.realpathSync = p => { if (p === '/candidate') return '/candidate'; if (canonical === 'cycle') throw new Error('ELOOP'); return canonical || resolve(dirname(p), target); };
  return f;
 };
 const safe = build('../fastify/tool.js'); const result = createArtifactManifest('/candidate', identity(), safe.io);
 const link = result.files.find(f => f.path === 'node_modules/.bin/tool'); assert.equal(link.type, 'symlink'); assert.equal(link.targetSha256, sha('tool'));
 for (const f of [build('/outside/tool'), build('../../../outside/tool'), build('../fastify/tool.js', '/outside/tool'), build('../fastify/tool.js', 'cycle'), build('../..', '/candidate')]) assert.throws(() => createArtifactManifest('/candidate', identity(), f.io), /symlink/);
});
test('nested standalone may resolve Next in traced parent node_modules', () => {
 const f = fixture();
 for (const [path, value] of [...f.files]) if (path.startsWith('web/.next/standalone/') && !path.startsWith('web/.next/standalone/node_modules/')) { f.files.delete(path); f.files.set(path.replace('web/.next/standalone/', 'web/.next/standalone/web/'), value); }
 const manifest = createArtifactManifest('/candidate', identity(), f.io); assert.equal(manifest.standalone, 'web/.next/standalone/web');
});

test('manifest exception never follows an external manifest symlink', () => {
 const f = fixture(); writeArtifactManifest('/candidate', identity(), f.io); f.types.set('mint-artifact.json', 'link');
 assert.throws(() => verifyArtifact('/candidate', identity(), f.io), /regular non-symlink/);
 assert.throws(() => createArtifactManifest('/candidate', identity(), f.io), /regular non-symlink/);
});
test('cross-glibc artifact remains pending actual target smoke despite caller verification claims', () => {
 const i = identity(); i.smAbi.libc = 'glibc-2.41'; i.nativeTargetRuntime.libc = 'glibc-2.41'; i.nativeAbiVerified = true;
 const manifest = createArtifactManifest('/candidate', i, fixture().io);
 assert.equal(manifest.nativeStatus, 'pending-native-target-smoke'); assert.equal(manifest.nativeAbiVerified, false); assert.equal(manifest.deployEligible, false);
 delete i.nativePolicy; assert.throws(() => createArtifactManifest('/candidate', i, fixture().io), /policy/);
});

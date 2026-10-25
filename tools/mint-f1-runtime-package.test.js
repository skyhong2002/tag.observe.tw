import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { deriveRuntimePackage, planRuntimePackage } from './mint-f1-runtime-package.js';

function fixture() {
  const files = new Map(
    Object.entries({
      '/work/COMMIT': initialAppSha,
      '/work/web/.next/BUILD_ID': 'mock-build',
      '/work/package-lock.json': readFileSync(new URL('../package-lock.json', import.meta.url)),
      '/work/web/package-lock.json': readFileSync(new URL('../web/package-lock.json', import.meta.url)),
      '/work/node_modules/onnxruntime-node/package.json': '{"name":"onnxruntime-node","version":"1.30.0"}',
      '/work/web/.next/standalone/web/server.js': 'server',
      '/work/app/src/server.js': 'source',
      '/work/app/data/a.json': '{}',
      '/work/.npm-cache/raw': 'foreign cached ELF',
      '/work/.home/a': 'work home',
      '/work/mint-guard.jsonl': 'audit',
      '/work/manifest.json': JSON.stringify({ commit: initialAppSha, buildId: 'mock-build', apiOrigin: 'http://127.0.0.1:7123' }),
    }),
  );
  for (const tuple of ['darwin/arm64', 'linux/arm64', 'linux/x64', 'win32/arm64', 'win32/x64'])
    files.set('/work/node_modules/onnxruntime-node/bin/napi-v6/' + tuple + '/binding.node', 'mock-' + tuple);
  const dirs = new Set(['/', '/work']);
  const links = new Map();
  const refresh = () => {
    for (const p of [...files.keys(), ...links.keys()]) {
      let d = dirname(p);
      while (!dirs.has(d)) {
        dirs.add(d);
        d = dirname(d);
      }
    }
  };
  refresh();
  const io = {
    lstatSync(p) {
      refresh();
      if (!dirs.has(p) && !files.has(p) && !links.has(p)) throw Error('missing');
      return {
        mode: 0o700,
        size: Buffer.byteLength(files.get(p) || ''),
        isDirectory: () => dirs.has(p),
        isSymbolicLink: () => links.has(p),
        isFile: () => files.has(p),
      };
    },
    realpathSync(p) {
      if (links.has(p)) return resolve(dirname(p), links.get(p));
      return p;
    },
    readdirSync(p) {
      refresh();
      const prefix = p === '/' ? '/' : p + '/';
      return [
        ...new Set(
          [...files.keys(), ...dirs, ...links.keys()]
            .filter((k) => k.startsWith(prefix))
            .map((k) => k.slice(prefix.length).split('/')[0])
            .filter(Boolean),
        ),
      ];
    },
    readFileSync(p, encoding) {
      if (!files.has(p)) throw Error('missing');
      const bytes = Buffer.from(files.get(p));
      return encoding ? bytes.toString() : bytes;
    },
    readlinkSync: (p) => links.get(p),
    mkdirSync(p) {
      if (dirs.has(p) || files.has(p)) throw Error('exists');
      if (!dirs.has(dirname(p))) throw Error('missing parent');
      dirs.add(p);
    },
    copyFileSync(a, b, flag) {
      assert.equal(flag, 1);
      if (files.has(b)) throw Error('exists');
      files.set(b, Buffer.from(files.get(a)));
    },
    chmodSync() {},
    symlinkSync(t, p) {
      if (links.has(p)) throw Error('exists');
      links.set(p, t);
    },
    writeFileSync(p, b, opts) {
      assert.equal(opts.flag, 'wx');
      if (files.has(p)) throw Error('exists');
      files.set(p, b);
    },
  };
  return { files, links, dirs, io };
}
test('exclusive sibling retains original tree and records every foreign/cache exclusion', () => {
  const f = fixture();
  const before = new Map(f.files);
  let checks = 0;
  f.links.set('/work/node_modules/onnxruntime-node/binding.node', 'bin/napi-v6/linux/x64/binding.node');
  const receipt = deriveRuntimePackage(
    '/work',
    '/work.runtime',
    {
      apiOrigin: 'http://127.0.0.1:7123',
      assertLock() {
        checks++;
      },
    },
    f.io,
  );
  assert.ok(checks > 5);
  for (const [p, b] of before) assert.deepEqual(f.files.get(p), b);
  assert.equal(receipt.excluded.filter((e) => e.type === 'file' && e.reason.startsWith('onnx-')).length, 4);
  assert.ok(receipt.excluded.every((e) => e.sha256?.length === 64));
  assert.ok(f.files.has('/work.runtime/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/binding.node'));
  assert.ok(!f.files.has('/work.runtime/.npm-cache/raw'));
  assert.equal(f.links.get('/work.runtime/node_modules/onnxruntime-node/binding.node'), 'bin/napi-v6/linux/x64/binding.node');
  const m = JSON.parse(f.files.get('/work.runtime/manifest.json'));
  assert.equal(m.standaloneWeb, '/work.runtime/web/.next/standalone/web');
  assert.equal(m.deployEligible, false);
  assert.throws(
    () => deriveRuntimePackage('/work', '/work.runtime', { apiOrigin: 'http://127.0.0.1:7123', assertLock() {} }, f.io),
    /exists/,
  );
});
test('unknown vendor layout, changed locks, unsafe links and environment files fail closed', () => {
  for (const mutate of [
    (f) => f.files.set('/work/node_modules/onnxruntime-node/bin/napi-v3/x.node', 'unknown'),
    (f) => f.files.set('/work/node_modules/onnxruntime-node/bin/napi-v6/linux/riscv64/x.node', 'unknown'),
    (f) => f.files.set('/work/package-lock.json', '{}'),
    (f) => f.links.set('/work/escape', '/outside'),
    (f) => f.links.set('/work/link', '.npm-cache/raw'),
    (f) => f.files.set('/work/.env', 'forbidden'),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => planRuntimePackage('/work', '/work.runtime', f.io));
    assert.equal(f.dirs.has('/work.runtime'), false);
  }
});
test('copy failure and missing lock authority cannot publish a runtime receipt', () => {
  const f = fixture();
  assert.throws(() => deriveRuntimePackage('/work', '/work.runtime', { apiOrigin: 'http://127.0.0.1:7123' }, f.io), /lock/);
  const g = fixture();
  g.io.copyFileSync = () => {
    throw Error('copy failed');
  };
  assert.throws(
    () => deriveRuntimePackage('/work', '/work.runtime', { apiOrigin: 'http://127.0.0.1:7123', assertLock() {} }, g.io),
    /copy failed/,
  );
  assert.ok(!g.files.has('/work.runtime/mint-runtime-selection.json'));
  assert.ok(g.files.has('/work/COMMIT'));
});
test('excluded directories use stable direct-child Merkle hashes with nested change propagation', () => {
  const f = fixture();
  f.files.set('/work/.npm-cache/deep/nested/raw', 'original bytes');
  const plan = () => planRuntimePackage('/work', '/work.runtime', f.io);
  const first = plan(),
    second = plan();
  assert.deepEqual(first, second);
  const entry = (p, path) => p.entries.find((e) => e.path === path);
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  const leaf = entry(first, '.npm-cache/deep/nested/raw');
  assert.equal(entry(first, '.npm-cache/deep/nested').sha256, sha(JSON.stringify([{ name: 'raw', type: 'file', sha256: leaf.sha256 }])));
  f.files.set('/work/.npm-cache/deep/nested/raw', 'changed bytes');
  const changed = plan();
  for (const path of ['.npm-cache/deep/nested/raw', '.npm-cache/deep/nested', '.npm-cache/deep', '.npm-cache']) {
    assert.notEqual(entry(first, path).sha256, entry(changed, path).sha256);
    assert.equal(entry(changed, path).reason, 'build-work-cache-not-runtime');
  }
  assert.equal(entry(first, '.home').sha256, entry(changed, '.home').sha256);
  assert.notEqual(first.sourceInventorySha256, changed.sourceInventorySha256);
  // Enumeration order cannot alter deterministic sorted-DFS child digests.
  const readdir = f.io.readdirSync;
  f.io.readdirSync = (p) => readdir(p).reverse();
  assert.deepEqual(plan(), changed);
});

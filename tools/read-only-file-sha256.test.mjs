import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import test from 'node:test';
import { readOnlyFileSha256 } from './read-only-file-sha256.mjs';

const digest = (b) => createHash('sha256').update(b).digest('hex');
function fixture(data = Buffer.from('abcdef'), kind = 'ok') {
  let offset = 0,
    closed = 0,
    lstats = 0,
    realpaths = 0,
    fstats = 0;
  const metadata = {
    dev: 1n,
    ino: 2n,
    mode: 33188n,
    size: BigInt(data.length),
    mtimeNs: 3n,
    ctimeNs: 4n,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
  const io = {
    lstatSync: () => ({ ...metadata, ino: kind === 'mapping' && ++lstats > 1 ? 9n : 2n }),
    realpathSync: () => (kind === 'path' && ++realpaths > 1 ? '/other' : '/canonical'),
    statSync: () => metadata,
    openSync: (p, flags) => {
      assert.equal(flags, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      return 7;
    },
    fstatSync: () => ({ ...metadata, ctimeNs: kind === 'metadata' && ++fstats > 1 ? 9n : 4n }),
    readSync: (fd, b, o, n) => {
      if (kind === 'read') throw Error('primary read');
      if (kind === 'short') return 0;
      const size = Math.min(n, data.length - offset);
      data.copy(b, o, offset, offset + size);
      offset += size;
      return size;
    },
    closeSync: () => {
      closed++;
      if (kind === 'close' || kind === 'read-close') throw Error('close');
    },
  };
  if (kind === 'read-close')
    io.readSync = () => {
      throw Error('primary read');
    };
  return { io, closed: () => closed };
}
test('incremental chunks and empty files match exact SHA without write', () => {
  for (const bytes of [Buffer.from('abcdef'), Buffer.alloc(0)]) {
    const f = fixture(bytes);
    assert.equal(readOnlyFileSha256('/alias', { io: f.io, bufferBytes: 2 }), digest(bytes));
    assert.equal(f.closed(), 1);
  }
});
test('read, short EOF, fd metadata and path/mapping changes fail and close own fd', () => {
  for (const kind of ['read', 'short', 'metadata', 'path', 'mapping', 'close']) {
    const f = fixture(undefined, kind);
    assert.throws(() => readOnlyFileSha256('/alias', { io: f.io, bufferBytes: 2 }));
    assert.equal(f.closed(), 1);
  }
});
test('close error preserves original primary', () => {
  const f = fixture(undefined, 'read-close');
  assert.throws(
    () => readOnlyFileSha256('/alias', { io: f.io }),
    (e) => e.cause?.message === 'primary read' && e.errors.length === 2,
  );
  assert.equal(f.closed(), 1);
});
test('bounded buffer/canonical path and regular FD required', () => {
  assert.throws(() => readOnlyFileSha256('relative'));
  assert.throws(() => readOnlyFileSha256('/file', { bufferBytes: 1024 * 1024 + 1 }));
  const f = fixture();
  f.io.fstatSync = () => ({ isFile: () => false });
  assert.throws(() => readOnlyFileSha256('/file', { io: f.io }));
  assert.equal(f.closed(), 1);
});
test('small existing source file matches legacy whole-buffer digest', () => {
  const path = new URL('./read-only-file-sha256.mjs', import.meta.url).pathname;
  assert.equal(readOnlyFileSha256(path, { bufferBytes: 17 }), digest(fs.readFileSync(path)));
});
test('growth after declared size and regular-file replacement are rejected', () => {
  const f = fixture();
  const read = f.io.readSync;
  let count = 0;
  f.io.readSync = (...args) => {
    const n = read(...args);
    return n === 0 && ++count === 1 ? 1 : n;
  };
  assert.throws(() => readOnlyFileSha256('/alias', { io: f.io }));
  assert.equal(f.closed(), 1);
  const g = fixture();
  let calls = 0;
  g.io.statSync = () => ({ dev: 1n, ino: ++calls > 1 ? 99n : 2n, mode: 33188n, size: 6n, mtimeNs: 3n, ctimeNs: 4n, isFile: () => true });
  assert.throws(() => readOnlyFileSha256('/alias', { io: g.io }));
  assert.equal(g.closed(), 1);
});

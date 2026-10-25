import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { resolve } from 'node:path';

const fields = ['dev', 'ino', 'mode', 'size', 'mtimeNs', 'ctimeNs'];
const same = (a, b) => fields.every((k) => a[k] === b[k]);
/** Read-only fixed-memory digest. Caller must separately pin the returned hash. */
export function readOnlyFileSha256(path, { io = fs, bufferBytes = 65536 } = {}) {
  if (
    typeof path !== 'string' ||
    resolve(path) !== path ||
    !Number.isSafeInteger(bufferBytes) ||
    bufferBytes < 1 ||
    bufferBytes > 1024 * 1024
  )
    throw Error('Canonical absolute path and bounded buffer required');
  let fd, primary, value;
  const stat = (p) => io.statSync(p, { bigint: true }),
    lstat = (p) => io.lstatSync(p, { bigint: true });
  try {
    const mapping = lstat(path),
      canonical = io.realpathSync(path);
    if (resolve(canonical) !== canonical || (!mapping.isFile() && !mapping.isSymbolicLink())) throw Error('Regular file mapping required');
    const original = stat(canonical);
    if (!original.isFile() || original.size < 0n) throw Error('Regular file required');
    fd = io.openSync(canonical, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const opened = io.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || !same(original, opened)) throw Error('File changed before open');
    const hash = createHash('sha256'),
      buffer = Buffer.alloc(bufferBytes);
    let offset = 0n;
    while (offset < opened.size) {
      const length = Number(opened.size - offset > BigInt(buffer.length) ? BigInt(buffer.length) : opened.size - offset),
        n = io.readSync(fd, buffer, 0, length, null);
      if (!Number.isInteger(n) || n < 1 || n > length) throw Error('Short EOF or invalid read');
      hash.update(buffer.subarray(0, n));
      offset += BigInt(n);
    }
    if (io.readSync(fd, buffer, 0, 1, null) !== 0) throw Error('File grew during read');
    const final = io.fstatSync(fd, { bigint: true });
    if (
      !final.isFile() ||
      !same(opened, final) ||
      io.realpathSync(path) !== canonical ||
      !same(mapping, lstat(path)) ||
      !same(opened, stat(canonical))
    )
      throw Error('File or path changed during digest');
    value = hash.digest('hex');
  } catch (error) {
    primary = error;
  } finally {
    if (fd !== undefined)
      try {
        io.closeSync(fd);
      } catch (error) {
        primary = primary ? new AggregateError([primary, error], 'Read failure and descriptor close failure', { cause: primary }) : error;
      }
  }
  if (primary) throw primary;
  return value;
}

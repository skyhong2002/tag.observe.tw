import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { RankingBasis } from '../jobs/ranking-basis.ts';
import { entryLine, type PoolEntry, PoolUnavailable } from './core.ts';

export interface PoolManifest {
  snapshotId: string;
  schemaVersion: string;
  policyVersion: string;
  available: true;
  incompleteReason: null;
  window: { since: string; until: string; basis: 'published_at'; timezone: 'UTC' };
  category: string;
  order: 'score';
  gate: string;
  computedAt: string;
  asOf: string;
  expiresAt: string;
  basis: RankingBasis;
  upstreamVocabularyId: null;
  noiseFilterVersion: string;
  qualification: { gate: string; distinctArticles: true; minTwiceMedia: number; minMedia: number; minArticlesAtOneMedia: number };
  sourceCoverage: {
    kind: string;
    collectionCoverageFrom: string;
    sourceArticleCount: number;
    firstPublishedAt: string | null;
    lastPublishedAt: string | null;
    candidateTotal: number;
    elapsedMs: number;
  };
  eligibleTotal: number;
  truncated: false;
  defaultPageSize: number;
  totalPages: number;
  pageChecksums: string[];
  checksum: { algorithm: 'sha256'; serialization: string; value: string };
}
export const fingerprint = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const STORE_CAP = 512 * 1024 ** 2,
  PAGE_CAP = 16 * 1024 ** 2,
  EXPANDED_CAP = 64 * 1024 ** 2;
function directory(file: string) {
  if (!fs.lstatSync(file).isDirectory() || fs.lstatSync(file).isSymbolicLink()) throw new PoolUnavailable('snapshot-store-invalid');
}
function readSafe(file: string, cap: number): Buffer {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > cap) throw new PoolUnavailable('snapshot-store-invalid');
    // Read at most the observed size plus one byte; a concurrent append cannot
    // make readFileSync consume an unbounded file after the first fstat.
    const buffer = Buffer.allocUnsafe(stat.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const n = fs.readSync(fd, buffer, count, buffer.length - count, count);
      if (!n) break;
      count += n;
    }
    const after = fs.fstatSync(fd),
      named = fs.lstatSync(file);
    if (
      count !== stat.size ||
      after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs ||
      named.isSymbolicLink() ||
      named.dev !== stat.dev ||
      named.ino !== stat.ino
    )
      throw new PoolUnavailable('snapshot-store-invalid');
    return buffer.subarray(0, count);
  } finally {
    fs.closeSync(fd);
  }
}
export class PoolStore {
  root: string;
  now: () => number;
  constructor(root: string, now = Date.now) {
    this.root = root;
    this.now = now;
  }
  dir(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('invalid snapshot id');
    return path.join(this.root, id);
  }
  get(id: string): PoolManifest {
    const dir = this.dir(id);
    directory(this.root);
    directory(dir);
    const manifest = JSON.parse(readSafe(path.join(dir, 'manifest.json'), 1024 ** 2).toString()) as PoolManifest;
    const { snapshotId, ...content } = manifest;
    if (snapshotId !== id || fingerprint(content) !== id || manifest.schemaVersion !== 'ranking-pool-1')
      throw Error('invalid snapshot metadata');
    return manifest;
  }
  cached(key: string): PoolManifest | null {
    try {
      if (!/^[a-f0-9]{64}$/.test(key)) return null;
      directory(this.root);
      const saved = JSON.parse(readSafe(path.join(this.root, 'query-' + key + '.json'), 4096).toString());
      if (this.now() - saved.at > 600_000) return null;
      const m = this.get(saved.id);
      const boundKey = fingerprint({
        query: { category: m.category, since: m.window.since, until: m.window.until, gate: m.gate, order: m.order },
        basis: m.basis,
        noiseFilterVersion: m.noiseFilterVersion,
        policy: m.policyVersion,
      });
      return key === boundKey && Date.parse(m.expiresAt) > this.now() ? m : null;
    } catch {
      return null;
    }
  }
  publish(
    key: string,
    metadata: Omit<
      PoolManifest,
      'snapshotId' | 'eligibleTotal' | 'defaultPageSize' | 'totalPages' | 'checksum' | 'truncated' | 'pageChecksums'
    >,
    entries: PoolEntry[],
  ): PoolManifest {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new PoolUnavailable('snapshot-store-invalid');
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    directory(this.root);
    // Bounded initial cache. Expiry rejects reads; no unrelated or existing file
    // is deleted to recover capacity. Operators can retain/audit old generations.
    let bytes = 0;
    for (const item of fs.readdirSync(this.root, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new PoolUnavailable('snapshot-store-invalid');
      const p = path.join(this.root, item.name);
      if (item.isDirectory()) {
        for (const f of fs.readdirSync(p)) {
          const stat = fs.lstatSync(path.join(p, f));
          if (!stat.isFile() || stat.isSymbolicLink()) throw new PoolUnavailable('snapshot-store-invalid');
          bytes += stat.size;
        }
      } else {
        if (!item.isFile()) throw new PoolUnavailable('snapshot-store-invalid');
        bytes += fs.lstatSync(p).size;
      }
    }
    if (bytes > STORE_CAP) throw new PoolUnavailable('snapshot-store-cap');
    const checksum = createHash('sha256');
    for (const entry of entries) checksum.update(entryLine(entry));
    const parts: Buffer[] = [];
    for (let offset = 0; offset < entries.length; offset += 500) {
      const body = JSON.stringify(entries.slice(offset, offset + 500));
      if (Buffer.byteLength(body) > EXPANDED_CAP) throw new PoolUnavailable('snapshot-store-cap');
      parts.push(gzipSync(body));
    }
    const content = {
      ...metadata,
      pageChecksums: parts.map((p) => createHash('sha256').update(p).digest('hex')),
      truncated: false as const,
      eligibleTotal: entries.length,
      defaultPageSize: 500,
      totalPages: Math.ceil(entries.length / 500),
      checksum: { algorithm: 'sha256' as const, serialization: 'canonical-entry-jsonl-v1', value: checksum.digest('hex') },
    };
    const manifest = { snapshotId: fingerprint(content), ...content };
    const manifestBody = JSON.stringify(manifest) + '\n';
    const indexBody = JSON.stringify({ id: manifest.snapshotId, at: this.now() }) + '\n';
    if (
      Buffer.byteLength(manifestBody) > 1024 ** 2 ||
      parts.some((p) => p.length > PAGE_CAP) ||
      bytes + parts.reduce((n, p) => n + p.length, 0) + Buffer.byteLength(manifestBody) + Buffer.byteLength(indexBody) > STORE_CAP
    )
      throw new PoolUnavailable('snapshot-store-cap');
    const stage = path.join(this.root, 'staging-' + randomUUID());
    fs.mkdirSync(stage, { mode: 0o700 });
    let added = 0;
    for (let offset = 0; offset < entries.length; offset += 500) {
      const body = parts[offset / 500];
      added += body.length;
      if (bytes + added > STORE_CAP) throw new PoolUnavailable('snapshot-store-cap');
      fs.writeFileSync(path.join(stage, 'page-' + offset / 500 + '.json.gz'), body, { flag: 'wx', mode: 0o600 });
    }
    fs.writeFileSync(path.join(stage, 'manifest.json'), manifestBody, { flag: 'wx', mode: 0o600 });
    const target = this.dir(manifest.snapshotId);
    if (fs.existsSync(target)) {
      const prior = this.get(manifest.snapshotId);
      if (fingerprint(prior) !== fingerprint(manifest)) throw new PoolUnavailable('snapshot-publication-conflict');
    } else fs.renameSync(stage, target);
    const index = path.join(this.root, 'query-' + key + '.pending-' + randomUUID());
    fs.writeFileSync(index, indexBody, { flag: 'wx', mode: 0o600 });
    fs.renameSync(index, path.join(this.root, 'query-' + key + '.json'));
    return manifest;
  }
  page(m: PoolManifest, offset: number, limit: number) {
    const entries: PoolEntry[] = [];
    for (let p = Math.floor(offset / 500); entries.length < limit && p < m.totalPages; p++) {
      directory(this.root);
      directory(this.dir(m.snapshotId));
      const bytes = readSafe(path.join(this.dir(m.snapshotId), 'page-' + p + '.json.gz'), PAGE_CAP);
      if (createHash('sha256').update(bytes).digest('hex') !== m.pageChecksums[p]) throw Error('snapshot page integrity failed');
      const rows = JSON.parse(gunzipSync(bytes, { maxOutputLength: EXPANDED_CAP }).toString()) as PoolEntry[];
      if (!Array.isArray(rows) || rows.length > 500) throw Error('invalid snapshot page');
      const start = p === Math.floor(offset / 500) ? offset % 500 : 0;
      entries.push(...rows.slice(start, start + limit - entries.length));
    }
    return entries;
  }
}

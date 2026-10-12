import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import { TAG_NOISE_RULE_VERSION, type TagNoiseReason, tagNoiseReasons } from '../tag-noise.ts';

const noEqualTags = new Set(noEqual.tags);
export const NOISE_POLICY_VERSION = createHash('sha256')
  .update(JSON.stringify({ tagNoise: TAG_NOISE_RULE_VERSION, noEqual: noEqual.tags }))
  .digest('hex');

export const PAGE_SIZE = 500;
export const MAX_TERMS = 10_000_000;
export const MAX_MANIFEST_BYTES = 16_000_000;
export const ORIGIN = 'https://tag.observe.tw';
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface RecentCounts {
  recentArticleCount?: number;
  recentArticleCounts?: { '30': number; '90': number; '180': number };
  recentCountsAsOf?: string;
}
export interface Term extends RecentCounts {
  id: string;
  label: string;
  articleCount: number;
  firstPublishedAt: string;
  lastPublishedAt: string;
  origin: 'article-tags-mixed';
  journalistAssigned: null;
  noise: boolean;
  noiseReasons: TagNoiseReason[];
  noEqual: boolean;
}
export interface SourceTerm extends RecentCounts {
  tag: string;
  articleCount: number;
  firstPublishedAt: string;
  lastPublishedAt: string;
}
export type Change =
  | { action: 'upsert'; term: Term; active?: boolean }
  | { action: 'absent-from-index'; id: string; label: string; active?: boolean };
export interface Manifest {
  schemaVersion: 1;
  id: string;
  previousId: string | null;
  generatedAt: string;
  source: typeof ORIGIN;
  attribution: '新文易數 tag.observe.tw';
  coverage: 'all-current-indexed-article-tags';
  provenance: 'mixed-native-edited-and-rule-derived; per-term assignment unknown';
  identity: 'sha256-exact-utf8-label';
  total: number;
  pageSize: number;
  pages: string[];
  totalPages?: number;
  largePages?: string[];
  sha256: string;
  changeCount: number;
  changePages: string[];
  noisePolicyVersion: string;
  active?: {
    total: number;
    totalPages?: number;
    largePages?: string[];
    fileBytes?: number;
    pages: string[];
    sha256: string;
    days: 30 | 180;
    minArticleCount?: number;
    minRecentArticleCount?: 3;
    policy?: 'recent-article-count';
    minLength: 2;
    excludeNoise: true;
  };
  tiers?: VocabularyTiers;
  statistics?: {
    noise: number;
    noEqual: number;
    recent180: number;
    articleCountAtLeast: Record<string, number>;
    articleCountAndRecent: Record<string, number>;
    eligibleAtThreshold: Record<string, number>;
    fileBytes: number;
    fullFileBytes?: number;
    activeFileBytes?: number;
    changeFileBytes?: number;
  };
  sourceConsistency?: string;
  sourceAsOf?: Record<string, unknown>;
}
export interface DeltaGeneration {
  schemaVersion: 1;
  kind: 'delta';
  id: string;
  previousId: string;
  baseSnapshotId: string;
  generatedAt: string;
  source: typeof ORIGIN;
  total: number;
  pageSize: number;
  changeCount: number;
  changePages: string[];
  noisePolicyVersion: string;
  sourceAsOf?: Record<string, unknown>;
}
export type Generation = Manifest | DeltaGeneration;
export class SnapshotError extends Error {
  code: 'unavailable' | 'not-found' | 'invalid' | 'busy' | 'resnapshot-required';
  constructor(code: SnapshotError['code']) {
    super(code);
    this.code = code;
  }
}
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
async function durableWrite(path: string, data: string | Uint8Array) {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(data);
    await file.sync();
  } finally {
    await file.close();
  }
}
async function syncDirectory(path: string) {
  const directory = await open(path, 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
const strictIso = (value: string) =>
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function vocabularyTerm(row: SourceTerm): Term {
  if (
    typeof row.tag !== 'string' ||
    /[\uD800-\uDFFF]/u.test(row.tag) ||
    [...row.tag].length > 60 ||
    !Number.isSafeInteger(row.articleCount) ||
    row.articleCount < 1 ||
    !strictIso(row.firstPublishedAt) ||
    !strictIso(row.lastPublishedAt) ||
    Date.parse(row.firstPublishedAt) > Date.parse(row.lastPublishedAt)
  )
    throw new SnapshotError('invalid');
  const counts = row.recentArticleCounts;
  if (
    counts &&
    (!strictIso(row.recentCountsAsOf ?? '') ||
      ![counts['30'], counts['90'], counts['180']].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      counts['30'] > counts['90'] ||
      counts['90'] > counts['180'] ||
      counts['180'] > row.articleCount ||
      row.recentArticleCount !== counts['180'])
  )
    throw new SnapshotError('invalid');
  if (!counts && (row.recentArticleCount !== undefined || row.recentCountsAsOf !== undefined)) throw new SnapshotError('invalid');
  return {
    ...(counts ? { recentArticleCount: counts['180'], recentArticleCounts: counts, recentCountsAsOf: row.recentCountsAsOf } : {}),
    id: digest(row.tag),
    label: row.tag,
    articleCount: row.articleCount,
    firstPublishedAt: row.firstPublishedAt,
    lastPublishedAt: row.lastPublishedAt,
    origin: 'article-tags-mixed',
    journalistAssigned: null,
    noise: tagNoiseReasons(row.tag).length > 0,
    noiseReasons: tagNoiseReasons(row.tag),
    noEqual: noEqualTags.has(row.tag.trim()),
  };
}

export const isActive = (entry: Term, _now?: Date) =>
  !entry.noise && [...entry.label].length >= 2 && (entry.recentArticleCounts?.['30'] ?? 0) >= 3;
export interface VocabularyTiers {
  excludeNoise: true;
  minLength: 2;
  measuredTerms: number;
  missingRecentCounts: number;
  articleCountAtLeast: Record<string, number>;
  recentArticleCountAtLeast: Record<string, Record<string, number>>;
  intersections: Record<string, Record<string, Record<string, number>>>;
}
export function newVocabularyTiers(): VocabularyTiers {
  const totals = () => Object.fromEntries([3, 5, 10, 20].map((n) => [n, 0]));
  return {
    excludeNoise: true,
    minLength: 2,
    measuredTerms: 0,
    missingRecentCounts: 0,
    articleCountAtLeast: totals(),
    recentArticleCountAtLeast: Object.fromEntries([30, 90, 180].map((d) => [d, Object.fromEntries([2, 3, 5].map((n) => [n, 0]))])),
    intersections: Object.fromEntries([30, 90, 180].map((d) => [d, Object.fromEntries([2, 3, 5].map((n) => [n, totals()]))])),
  };
}
export function countVocabularyTier(tiers: VocabularyTiers, entry: Term) {
  if (entry.noise || [...entry.label].length < 2) return;
  tiers.measuredTerms++;
  for (const n of Object.keys(tiers.articleCountAtLeast)) if (entry.articleCount >= +n) tiers.articleCountAtLeast[n]++;
  if (!entry.recentArticleCounts) {
    tiers.missingRecentCounts++;
    return;
  }
  for (const days of ['30', '90', '180'] as const)
    for (const n of ['2', '3', '5']) {
      if (entry.recentArticleCounts[days] < +n) continue;
      tiers.recentArticleCountAtLeast[days][n]++;
      for (const total of Object.keys(tiers.articleCountAtLeast)) if (entry.articleCount >= +total) tiers.intersections[days][n][total]++;
    }
}
function publicChange(c: Change, now = new Date()): Change {
  if (c.action === 'upsert') {
    const term = vocabularyTerm({
      ...c.term,
      tag: c.term.label,
      articleCount: c.term.articleCount,
      firstPublishedAt: c.term.firstPublishedAt,
      lastPublishedAt: c.term.lastPublishedAt,
    });
    return { action: 'upsert', term, active: isActive(term, now) };
  }
  if (c.action !== 'absent-from-index' || typeof c.label !== 'string' || c.id !== digest(c.label) || [...c.label].length > 60)
    throw new SnapshotError('invalid');
  return { action: 'absent-from-index', id: c.id, label: c.label, active: false };
}

export class VocabularySnapshots {
  private readonly directory: string;
  constructor(directory: string) {
    this.directory = directory;
  }
  private async json(path: string, maxBytes = 2_000_000): Promise<unknown> {
    try {
      if ((await stat(path)).size > maxBytes) throw new SnapshotError('invalid');
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          const compressed = await readFile(path + '.gz');
          if (compressed.length > maxBytes) throw new SnapshotError('invalid');
          const data = gunzipSync(compressed, { maxOutputLength: maxBytes });
          return JSON.parse(data.toString('utf8'));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new SnapshotError('not-found');
          if (e instanceof SnapshotError) throw e;
          throw new SnapshotError('unavailable');
        }
      }
      if (error instanceof SnapshotError) throw error;
      throw new SnapshotError('unavailable');
    }
  }
  async current(): Promise<Manifest> {
    const pointer = await this.pointer();
    try {
      return await this.manifest(pointer.id);
    } catch (error) {
      if (error instanceof SnapshotError && error.code === 'not-found') throw new SnapshotError('unavailable');
      throw error;
    }
  }
  async manifest(id: string): Promise<Manifest> {
    if (typeof id !== 'string' || !ID.test(id)) throw new SnapshotError('invalid');
    const result = (await this.json(join(this.directory, id, 'manifest.json'), MAX_MANIFEST_BYTES)) as Manifest;
    if (
      !result ||
      result.id !== id ||
      result.schemaVersion !== 1 ||
      !Array.isArray(result.pages) ||
      !Array.isArray(result.changePages) ||
      result.source !== ORIGIN ||
      result.coverage !== 'all-current-indexed-article-tags' ||
      result.identity !== 'sha256-exact-utf8-label' ||
      !(result.previousId === null || (typeof result.previousId === 'string' && ID.test(result.previousId))) ||
      typeof result.generatedAt !== 'string' ||
      !strictIso(result.generatedAt) ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.total > MAX_TERMS ||
      result.pageSize !== PAGE_SIZE ||
      result.pages.length !== Math.ceil(result.total / PAGE_SIZE) ||
      result.pages.some((hash) => typeof hash !== 'string' || !SHA.test(hash)) ||
      typeof result.sha256 !== 'string' ||
      !SHA.test(result.sha256) ||
      !Number.isSafeInteger(result.changeCount) ||
      result.changeCount < 0 ||
      result.changeCount > MAX_TERMS * 2 ||
      result.changePages.length !== Math.ceil(result.changeCount / PAGE_SIZE) ||
      result.changePages.some((hash) => typeof hash !== 'string' || !SHA.test(hash))
    )
      throw new SnapshotError('invalid');
    if (result.active) {
      const a = result.active;
      if (
        !Number.isSafeInteger(a.total) ||
        a.total < 0 ||
        a.total > result.total ||
        !Array.isArray(a.pages) ||
        a.pages.length !== Math.ceil(a.total / PAGE_SIZE) ||
        a.pages.some((h) => typeof h !== 'string' || !SHA.test(h)) ||
        !SHA.test(a.sha256) ||
        (a.policy === 'recent-article-count' ? a.days !== 30 : a.days !== 180) ||
        (a.policy === 'recent-article-count' ? a.minRecentArticleCount !== 3 : a.minArticleCount !== 3) ||
        a.minLength !== 2 ||
        a.excludeNoise !== true
      )
        throw new SnapshotError('invalid');
    }
    for (const c of [result, result.active])
      if (c) {
        if (c.totalPages !== undefined && c.totalPages !== c.pages.length) throw new SnapshotError('invalid');
        if (
          c.largePages &&
          (!Array.isArray(c.largePages) || c.largePages.length !== Math.ceil(c.total / 5000) || c.largePages.some((h) => !SHA.test(h)))
        )
          throw new SnapshotError('invalid');
      }
    return result;
  }
  async page(id: string, cursor = '0', kind: 'terms' | 'changes' | 'active' = 'terms', compact = false, limit = PAGE_SIZE) {
    if (typeof cursor !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(cursor) || ![500, 5000].includes(limit))
      throw new SnapshotError('invalid');
    const manifest = await this.manifest(id);
    const catalog = kind === 'active' ? manifest.active : manifest;
    const small = kind === 'changes' ? manifest.changePages : catalog?.pages;
    const checksums = limit === 500 ? small : catalog?.largePages;
    if (!small || !checksums) throw new SnapshotError('not-found');
    const total = kind === 'changes' ? manifest.changeCount : catalog!.total,
      index = Number(cursor);
    if (index >= checksums.length && !(index === 0 && checksums.length === 0)) throw new SnapshotError('invalid');
    const entries: Array<Term | Change> = [];
    for (let i = index * (limit / 500); i < Math.min(small.length, (index + 1) * (limit / 500)); i++) {
      const part = await this.json(join(this.directory, id, `${kind}-${i}.json`));
      if (!Array.isArray(part) || digest(encode(part)) !== small[i]) throw new SnapshotError('unavailable');
      entries.push(...part);
    }
    if (entries.length !== Math.min(limit, Math.max(0, total - index * limit))) throw new SnapshotError('invalid');
    const sha256 = digest(encode(entries));
    if (checksums.length && sha256 !== checksums[index]) throw new SnapshotError('unavailable');
    return {
      snapshot: compact
        ? {
            id: manifest.id,
            generatedAt: manifest.generatedAt,
            total: manifest.total,
            pageSize: manifest.pageSize,
            sha256: manifest.sha256,
          }
        : manifest,
      ...(kind === 'active'
        ? { subset: compact ? { total: manifest.active!.total, sha256: manifest.active!.sha256 } : manifest.active }
        : {}),
      ...(limit !== 500 ? { limit } : {}),
      entries,
      cursor,
      nextCursor: index + 1 < checksums.length ? String(index + 1) : null,
      sha256,
    };
  }
  private async pointer(): Promise<{ id: string; headId?: string }> {
    return (await this.json(join(this.directory, 'current.json'))) as { id: string; headId?: string };
  }
  private async generation(id: string): Promise<Generation> {
    if (!ID.test(id)) throw new SnapshotError('invalid');
    try {
      return await this.manifest(id);
    } catch (e) {
      if (!(e instanceof SnapshotError && e.code === 'not-found')) throw e;
    }
    const g = (await this.json(join(this.directory, id, 'generation.json'), MAX_MANIFEST_BYTES)) as DeltaGeneration;
    if (
      g.kind !== 'delta' ||
      g.schemaVersion !== 1 ||
      g.id !== id ||
      !ID.test(g.previousId) ||
      !ID.test(g.baseSnapshotId) ||
      !strictIso(g.generatedAt) ||
      g.source !== ORIGIN ||
      g.pageSize !== PAGE_SIZE ||
      !Number.isSafeInteger(g.total) ||
      g.total < 0 ||
      g.total > MAX_TERMS ||
      !Number.isSafeInteger(g.changeCount) ||
      g.changeCount < 0 ||
      g.changeCount > MAX_TERMS * 2 ||
      !Array.isArray(g.changePages) ||
      g.changePages.length !== Math.ceil(g.changeCount / PAGE_SIZE) ||
      g.changePages.some((h) => !SHA.test(h))
    )
      throw new SnapshotError('invalid');
    return g;
  }
  async changes(after: string, target?: string, cursor = '0') {
    if (typeof cursor !== 'string' || typeof after !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(cursor) || !ID.test(after))
      throw new SnapshotError('invalid');
    const pointer = target ? null : await this.pointer();
    let result: Generation;
    try {
      result = await this.generation(target ?? pointer!.headId ?? pointer!.id);
    } catch (e) {
      if (e instanceof SnapshotError && e.code === 'not-found') throw new SnapshotError('resnapshot-required');
      throw e;
    }
    const chain: Generation[] = [];
    let g: Generation = result;
    while (g.id !== after) {
      if (chain.length >= 600 || !g.previousId) throw new SnapshotError('resnapshot-required');
      chain.unshift(g);
      if (g.previousId === after) break;
      try {
        g = await this.generation(g.previousId);
      } catch (e) {
        if (e instanceof SnapshotError && e.code === 'not-found') throw new SnapshotError('resnapshot-required');
        throw e;
      }
    }
    const pages = chain.flatMap((g) => g.changePages.map((hash, index) => ({ g, hash, index })));
    const n = Number(cursor);
    if (n >= pages.length && !(n === 0 && pages.length === 0)) throw new SnapshotError('invalid');
    const page = pages[n];
    const entries = page ? await this.json(join(this.directory, page.g.id, `changes-${page.index}.json`)) : [];
    const sha256 = digest(encode(entries));
    if (
      !Array.isArray(entries) ||
      (page && (sha256 !== page.hash || entries.length !== Math.min(PAGE_SIZE, page.g.changeCount - page.index * PAGE_SIZE)))
    )
      throw new SnapshotError('unavailable');
    return { snapshot: result, entries: entries as Change[], cursor, nextCursor: n + 1 < pages.length ? String(n + 1) : null, sha256 };
  }
  private async acquire() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(join(this.directory, 'publisher-lock.sqlite'));
    try {
      db.exec('BEGIN IMMEDIATE');
    } catch {
      db.close();
      throw new SnapshotError('busy');
    }
    return () => {
      db.exec('ROLLBACK');
      db.close();
    };
  }
  private async setPointer(id: string, headId: string) {
    const path = join(this.directory, `.current-${randomUUID()}.json`);
    await durableWrite(path, encode({ id, headId }));
    await rename(path, join(this.directory, 'current.json'));
    await syncDirectory(this.directory);
  }
  async publishDelta(
    changes: Iterable<Change> | AsyncIterable<Change>,
    total: number,
    now = new Date(),
    sourceAsOf?: Record<string, unknown>,
  ): Promise<Generation> {
    const release = await this.acquire(),
      id = randomUUID(),
      staging = join(this.directory, `.staging-${id}`);
    try {
      if (!Number.isSafeInteger(total) || total < 0 || total > MAX_TERMS) throw new SnapshotError('invalid');
      const p = await this.pointer(),
        previous = await this.generation(p.headId ?? p.id);
      await mkdir(staging, { mode: 0o700 });
      const hashes: string[] = [];
      let buffer: Change[] = [],
        count = 0;
      const flush = async () => {
        if (!buffer.length) return;
        const data = encode(buffer);
        if (Buffer.byteLength(data) > 2_000_000) throw new SnapshotError('invalid');
        await durableWrite(join(staging, `changes-${hashes.length}.json.gz`), gzipSync(data, { level: 1 }));
        hashes.push(digest(data));
        buffer = [];
      };
      for await (const c of changes) {
        buffer.push(publicChange(c, now));
        count++;
        if (count > MAX_TERMS * 2) throw new SnapshotError('invalid');
        if (buffer.length === PAGE_SIZE) await flush();
      }
      await flush();
      if (!count) return previous;
      const g: DeltaGeneration = {
        schemaVersion: 1,
        kind: 'delta',
        id,
        previousId: previous.id,
        baseSnapshotId: p.id,
        generatedAt: now.toISOString(),
        source: ORIGIN,
        total,
        pageSize: PAGE_SIZE,
        changeCount: count,
        changePages: hashes,
        noisePolicyVersion: NOISE_POLICY_VERSION,
        sourceAsOf,
      };
      if (Buffer.byteLength(encode(g)) > MAX_MANIFEST_BYTES) throw new SnapshotError('invalid');
      await durableWrite(join(staging, 'generation.json'), encode(g));
      await syncDirectory(staging);
      await rename(staging, join(this.directory, id));
      await syncDirectory(this.directory);
      await this.setPointer(p.id, id);
      return g;
    } finally {
      await rm(staging, { recursive: true, force: true });
      release();
    }
  }
  /** Keep three complete bases and every subsequent delta; pinned older chains expire with 409. */
  async prune() {
    const release = await this.acquire();
    try {
      const p = await this.pointer();
      let g = await this.generation(p.headId ?? p.id),
        full = 0;
      const keep = new Set<string>([p.id]);
      for (let n = 0; n < 600; n++) {
        keep.add(g.id);
        if (!('kind' in g) && ++full === 3) break;
        if (!g.previousId) break;
        try {
          g = await this.generation(g.previousId);
        } catch (e) {
          if (e instanceof SnapshotError && e.code === 'not-found') break;
          throw e;
        }
      }
      for (const name of await readdir(this.directory))
        if (ID.test(name) && !keep.has(name)) await rm(join(this.directory, name), { recursive: true, force: true });
    } finally {
      release();
    }
  }
  async publish(load: () => Promise<SourceTerm[]>, now = new Date()): Promise<Manifest> {
    async function* sorted() {
      const rows = await load();
      rows.sort((a, b) => Buffer.compare(Buffer.from(a.tag), Buffer.from(b.tag)));
      yield* rows;
    }
    return this.publishStream(sorted(), now);
  }
  async *entries(manifest: Manifest): AsyncGenerator<Term> {
    for (let index = 0; index < manifest.pages.length; index++) {
      const entries = (await this.json(join(this.directory, manifest.id, `terms-${index}.json`))) as Term[];
      if (!Array.isArray(entries) || digest(encode(entries)) !== manifest.pages[index]) throw new SnapshotError('unavailable');
      for (const entry of entries) yield entry;
    }
  }
  /** Sorted producer stream plus merge-diff against the preceding immutable
   * version. Memory holds at most three 500-entry pages and the hash catalog. */
  async publishStream(
    rows: Iterable<SourceTerm> | AsyncIterable<SourceTerm>,
    now = new Date(),
    options?: { changes: Iterable<Change> | AsyncIterable<Change>; sourceAsOf?: Record<string, unknown>; resetChain?: boolean },
  ): Promise<Manifest> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const release = await this.acquire();
    const id = randomUUID(),
      staging = join(this.directory, `.staging-${id}`);
    try {
      let previous: Manifest | null = null;
      try {
        previous = await this.current();
      } catch (error) {
        if (!(error instanceof SnapshotError && error.code === 'not-found')) throw error;
      }
      if (options?.resetChain) previous = null;
      await mkdir(staging, { mode: 0o700 });
      let fileBytes = 0;
      const writer = (name: string) => {
        let buffer: unknown[] = [];
        const hashes: string[] = [];
        const full = createHash('sha256');
        let count = 0,
          bytes = 0;
        const largeHashes: string[] = [];
        let large = createHash('sha256');
        const finishLarge = () => {
          large.update(']\n');
          largeHashes.push(large.digest('hex'));
          large = createHash('sha256');
        };
        const flush = async () => {
          if (!buffer.length) return;
          const data = encode(buffer);
          if (Buffer.byteLength(data) > 2_000_000) throw new SnapshotError('invalid');
          hashes.push(digest(data));
          const compressed = gzipSync(data, { level: 1 });
          await durableWrite(join(staging, `${name}-${hashes.length - 1}.json.gz`), compressed);
          fileBytes += compressed.length;
          bytes += compressed.length;
          buffer = [];
        };
        return {
          hashes,
          largeHashes,
          get bytes() {
            return bytes;
          },
          get count() {
            return count;
          },
          full,
          flush,
          finish: async () => {
            await flush();
            if (count % 5000) finishLarge();
          },
          add: async (entry: unknown) => {
            large.update(count % 5000 === 0 ? '[' : ',');
            large.update(JSON.stringify(entry));
            count++;
            if (count % 5000 === 0) finishLarge();
            full.update(encode(entry));
            buffer.push(entry);
            if (buffer.length === PAGE_SIZE) await flush();
          },
        };
      };
      const terms = writer('terms'),
        changes = writer('changes'),
        active = writer('active');
      const old = previous && !options ? this.entries(previous) : null;
      let prior = await old?.next();
      let last: Buffer | null = null;
      const stats = {
        noise: 0,
        noEqual: 0,
        recent180: 0,
        articleCountAtLeast: { '2': 0, '3': 0, '5': 0 },
        articleCountAndRecent: { '2': 0, '3': 0, '5': 0 },
        eligibleAtThreshold: { '2': 0, '3': 0, '5': 0 },
        fileBytes: 0,
        fullFileBytes: 0,
        activeFileBytes: 0,
        changeFileBytes: 0,
      };
      const tiers = newVocabularyTiers();
      const recentSince = now.getTime() - 180 * 86400_000;
      for await (const row of rows) {
        const entry = vocabularyTerm(row),
          key = Buffer.from(entry.label);
        if (terms.count >= MAX_TERMS || (last && Buffer.compare(last, key) >= 0)) throw new SnapshotError('invalid');
        last = key;
        while (prior && !prior.done && Buffer.compare(Buffer.from(prior.value.label), key) < 0) {
          await changes.add({ action: 'absent-from-index', id: prior.value.id, label: prior.value.label, active: false });
          prior = await old!.next();
        }
        if (prior && !prior.done && prior.value.label === entry.label) {
          if (encode(prior.value) !== encode(entry)) await changes.add({ action: 'upsert', term: entry, active: isActive(entry, now) });
          prior = await old!.next();
        } else if (!options) await changes.add({ action: 'upsert', term: entry, active: isActive(entry, now) });
        await terms.add(entry);
        countVocabularyTier(tiers, entry);
        const recent = Date.parse(entry.lastPublishedAt) >= recentSince,
          eligible = !entry.noise && [...entry.label].length >= 2;
        if (entry.noise) stats.noise++;
        if (entry.noEqual) stats.noEqual++;
        if (recent) stats.recent180++;
        for (const threshold of ['2', '3', '5'] as const) {
          if (entry.articleCount >= Number(threshold)) stats.articleCountAtLeast[threshold]++;
          if (entry.articleCount >= Number(threshold) && recent) stats.articleCountAndRecent[threshold]++;
          if (eligible && (entry.articleCount >= Number(threshold) || recent)) stats.eligibleAtThreshold[threshold]++;
        }
        if (isActive(entry)) await active.add(entry);
      }
      while (prior && !prior.done) {
        await changes.add({ action: 'absent-from-index', id: prior.value.id, label: prior.value.label, active: false });
        prior = await old!.next();
      }
      if (options) for await (const c of options.changes) await changes.add(publicChange(c, now));
      await terms.finish();
      await changes.finish();
      await active.finish();
      stats.fileBytes = fileBytes;
      stats.fullFileBytes = terms.bytes;
      stats.activeFileBytes = active.bytes;
      stats.changeFileBytes = changes.bytes;
      const manifest: Manifest = {
        noisePolicyVersion: NOISE_POLICY_VERSION,
        schemaVersion: 1,
        id,
        previousId: previous ? ((await this.pointer()).headId ?? previous.id) : null,
        generatedAt: now.toISOString(),
        source: ORIGIN,
        attribution: '新文易數 tag.observe.tw',
        coverage: 'all-current-indexed-article-tags',
        provenance: 'mixed-native-edited-and-rule-derived; per-term assignment unknown',
        identity: 'sha256-exact-utf8-label',
        total: terms.count,
        pageSize: PAGE_SIZE,
        pages: terms.hashes,
        totalPages: terms.hashes.length,
        largePages: terms.largeHashes,
        sha256: terms.full.digest('hex'),
        changeCount: changes.count,
        changePages: changes.hashes,
        active: {
          total: active.count,
          pages: active.hashes,
          totalPages: active.hashes.length,
          largePages: active.largeHashes,
          fileBytes: active.bytes,
          sha256: active.full.digest('hex'),
          days: 30,
          minArticleCount: 0,
          minRecentArticleCount: 3,
          policy: 'recent-article-count',
          minLength: 2,
          excludeNoise: true,
        },
        statistics: stats,
        tiers,
        sourceConsistency: 'read-only-watermark-overlap; rolling-key-range-reconciliation-within-7-days',
        sourceAsOf: options?.sourceAsOf,
      };
      if (Buffer.byteLength(encode(manifest)) > MAX_MANIFEST_BYTES) throw new SnapshotError('invalid');
      await durableWrite(join(staging, 'manifest.json'), encode(manifest));
      await syncDirectory(staging);
      await rename(staging, join(this.directory, id));
      await syncDirectory(this.directory);
      await this.setPointer(id, id);
      return manifest;
    } finally {
      try {
        await rm(staging, { recursive: true, force: true });
      } finally {
        release();
      }
    }
  }
}

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import { TAG_NOISE_RULE_VERSION, type TagNoiseReason, tagNoiseReasons } from '../tag-noise.ts';

const noEqualTags = new Set(noEqual.tags);
export const NOISE_POLICY_VERSION = createHash('sha256')
  .update(JSON.stringify({ tagNoise: TAG_NOISE_RULE_VERSION, noEqual: noEqual.tags }))
  .digest('hex');

export const PAGE_SIZE = 500;
export const MAX_TERMS = 250_000;
export const ORIGIN = 'https://tag.observe.tw';
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface Term {
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
export interface SourceTerm {
  tag: string;
  articleCount: number;
  firstPublishedAt: string;
  lastPublishedAt: string;
}
export type Change = { action: 'upsert'; term: Term } | { action: 'absent-from-index'; id: string; label: string };
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
  sha256: string;
  changeCount: number;
  changePages: string[];
  noisePolicyVersion: string;
}
export class SnapshotError extends Error {
  code: 'unavailable' | 'not-found' | 'invalid' | 'busy' | 'resnapshot-required';
  constructor(code: SnapshotError['code']) {
    super(code);
    this.code = code;
  }
}
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
async function durableWrite(path: string, data: string) {
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
    !row.tag.trim() ||
    /[\uD800-\uDFFF]/u.test(row.tag) ||
    [...row.tag].length > 60 ||
    !Number.isSafeInteger(row.articleCount) ||
    row.articleCount < 1 ||
    !strictIso(row.firstPublishedAt) ||
    !strictIso(row.lastPublishedAt) ||
    Date.parse(row.firstPublishedAt) > Date.parse(row.lastPublishedAt)
  )
    throw new SnapshotError('invalid');
  return {
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
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new SnapshotError('not-found');
      if (error instanceof SnapshotError) throw error;
      throw new SnapshotError('unavailable');
    }
  }
  async current(): Promise<Manifest> {
    const pointer = (await this.json(join(this.directory, 'current.json'))) as { id: string };
    try {
      return await this.manifest(pointer.id);
    } catch (error) {
      if (error instanceof SnapshotError && error.code === 'not-found') throw new SnapshotError('unavailable');
      throw error;
    }
  }
  async manifest(id: string): Promise<Manifest> {
    if (typeof id !== 'string' || !ID.test(id)) throw new SnapshotError('invalid');
    const result = (await this.json(join(this.directory, id, 'manifest.json'))) as Manifest;
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
    return result;
  }
  async page(id: string, cursor = '0', kind: 'terms' | 'changes' = 'terms') {
    if (typeof cursor !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(cursor)) throw new SnapshotError('invalid');
    const manifest = await this.manifest(id);
    const checksums = kind === 'terms' ? manifest.pages : manifest.changePages;
    const index = Number(cursor);
    if (index >= checksums.length && !(index === 0 && checksums.length === 0)) throw new SnapshotError('invalid');
    const entries = checksums.length ? ((await this.json(join(this.directory, id, `${kind}-${index}.json`))) as Term[] | Change[]) : [];
    const total = kind === 'terms' ? manifest.total : manifest.changeCount;
    if (!Array.isArray(entries) || entries.length !== Math.min(PAGE_SIZE, Math.max(0, total - index * PAGE_SIZE)))
      throw new SnapshotError('invalid');
    const sha256 = digest(encode(entries));
    if (checksums.length && sha256 !== checksums[index]) throw new SnapshotError('unavailable');
    return { snapshot: manifest, entries, cursor, nextCursor: index + 1 < checksums.length ? String(index + 1) : null, sha256 };
  }
  async changes(after: string, target?: string, cursor = '0') {
    const manifest = target ? await this.manifest(target) : await this.current();
    if (typeof cursor !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(cursor)) throw new SnapshotError('invalid');
    if (typeof after !== 'string' || !ID.test(after)) throw new SnapshotError('invalid');
    if (after === manifest.id && cursor !== '0') throw new SnapshotError('invalid');
    if (after === manifest.id) return { snapshot: manifest, entries: [], cursor: '0', nextCursor: null, sha256: digest(encode([])) };
    if (after !== manifest.previousId) throw new SnapshotError('resnapshot-required');
    return this.page(manifest.id, cursor, 'changes');
  }
  async publish(load: () => Promise<SourceTerm[]>, now = new Date()): Promise<Manifest> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    let lock: Awaited<ReturnType<typeof open>>;
    try {
      lock = await open(join(this.directory, '.publish.lock'), 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new SnapshotError('busy');
      throw new SnapshotError('unavailable');
    }
    const id = randomUUID();
    const staging = join(this.directory, `.staging-${id}`);
    try {
      await lock.writeFile(encode({ pid: process.pid, hostname: hostname(), startedAt: now.toISOString(), id }));
      await lock.sync();
      let previous: Manifest | null = null;
      try {
        previous = await this.current();
      } catch (error) {
        if (!(error instanceof SnapshotError && error.code === 'not-found')) throw error;
      }
      const rows = await load();
      if (rows.length > MAX_TERMS) throw new SnapshotError('invalid');
      const terms = rows.map(vocabularyTerm).sort((a, b) => Buffer.compare(Buffer.from(a.label), Buffer.from(b.label)));
      if (new Set(terms.map((t) => t.id)).size !== terms.length) throw new SnapshotError('invalid');
      const old = new Map<string, Term>();
      if (previous)
        for (let index = 0; index < previous.pages.length; index++) {
          for (const entry of (await this.page(previous.id, String(index))).entries as Term[]) old.set(entry.id, entry);
        }
      const changes: Change[] = [];
      for (const entry of terms) {
        if (encode(old.get(entry.id)) !== encode(entry)) changes.push({ action: 'upsert', term: entry });
        old.delete(entry.id);
      }
      for (const entry of old.values()) changes.push({ action: 'absent-from-index', id: entry.id, label: entry.label });
      await mkdir(staging, { mode: 0o700 });
      const writePages = async (entries: unknown[], name: string) => {
        const hashes: string[] = [];
        for (let offset = 0; offset < entries.length; offset += PAGE_SIZE) {
          const data = encode(entries.slice(offset, offset + PAGE_SIZE));
          if (Buffer.byteLength(data) > 2_000_000) throw new SnapshotError('invalid');
          hashes.push(digest(data));
          await durableWrite(join(staging, `${name}-${hashes.length - 1}.json`), data);
        }
        return hashes;
      };
      const manifest: Manifest = {
        noisePolicyVersion: NOISE_POLICY_VERSION,
        schemaVersion: 1,
        id,
        previousId: previous?.id ?? null,
        generatedAt: now.toISOString(),
        source: ORIGIN,
        attribution: '新文易數 tag.observe.tw',
        coverage: 'all-current-indexed-article-tags',
        provenance: 'mixed-native-edited-and-rule-derived; per-term assignment unknown',
        identity: 'sha256-exact-utf8-label',
        total: terms.length,
        pageSize: PAGE_SIZE,
        pages: await writePages(terms, 'terms'),
        sha256: digest(terms.map(encode).join('')),
        changeCount: changes.length,
        changePages: await writePages(changes, 'changes'),
      };
      await durableWrite(join(staging, 'manifest.json'), encode(manifest));
      await syncDirectory(staging);
      await rename(staging, join(this.directory, id));
      await syncDirectory(this.directory);
      const pointer = join(this.directory, `.current-${id}.json`);
      await durableWrite(pointer, encode({ id }));
      await rename(pointer, join(this.directory, 'current.json'));
      await syncDirectory(this.directory);
      return manifest;
    } finally {
      try {
        await rm(staging, { recursive: true, force: true });
      } finally {
        try {
          await lock.close();
        } finally {
          await rm(join(this.directory, '.publish.lock'), { force: true });
        }
      }
    }
  }
}

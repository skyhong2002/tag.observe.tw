import { createHash } from 'node:crypto';
import { mkdir, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import type { Connection } from 'mysql2/promise';
import { VocabularyAggregate } from './aggregate.ts';
import { type Change, type Generation, type SourceTerm, VocabularySnapshots, vocabularyTerm } from './snapshots.ts';
import { type AggregateTerm, aggregateRange, exactTagRows, maxArticleId, newArticleTags, tagKey, upperTag } from './source.ts';

export class VocabularyPaused extends Error {}
const isQueryTimeout = (e: unknown) => (e as { code?: string }).code === 'ER_STATEMENT_TIMEOUT' || (e as { errno?: number }).errno === 1969;
export interface RunOptions {
  directory: string;
  mode?: 'fast' | 'daily' | 'reconcile';
  batchSize?: number;
  restMs?: number;
  maxDurationMs?: number;
  probe?: () => Promise<{ status: number; ttfbMs: number }>;
  log?: (value: unknown) => void;
  signal?: AbortSignal;
}
export async function runVocabulary(db: Connection, options: RunOptions) {
  const { directory } = options;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = new DatabaseSync(join(directory, 'runner-lock.sqlite'));
  lock.exec('CREATE TABLE IF NOT EXISTS lock(id INTEGER PRIMARY KEY)');
  try {
    lock.exec('BEGIN IMMEDIATE');
  } catch {
    lock.close();
    return { status: 'busy' };
  }
  const aggregate = new VocabularyAggregate(join(directory, 'aggregate.sqlite'));
  const started = Date.now();
  let size = options.batchSize ?? 1000;
  const rest = options.restMs ?? 100,
    log = options.log ?? (() => {});
  let lastProbe = 0;
  const metrics = { queries: 0, queryMs: 0, maxQueryMs: 0, rowsRead: 0, newRows: 0, homeSamples: 0, homeTotalMs: 0, homeMaxMs: 0 };
  const guard = async (force = false) => {
    options.signal?.throwIfAborted();
    if (Date.now() - started > (options.maxDurationMs ?? (options.mode === 'fast' ? 180000 : 6 * 3600000)))
      throw new VocabularyPaused('runtime-budget');
    if (force || Date.now() - lastProbe >= 2000) {
      let p: { status: number; ttfbMs: number };
      try {
        p = await (options.probe ?? probeHome)();
      } catch {
        throw new VocabularyPaused('home-probe-failed');
      }
      const disk = await statfs(directory);
      if (disk.bavail * disk.bsize < 4 * 1024 ** 3) throw new VocabularyPaused('disk-reserve');
      lastProbe = Date.now();
      metrics.homeSamples++;
      metrics.homeTotalMs += p.ttfbMs;
      metrics.homeMaxMs = Math.max(metrics.homeMaxMs, p.ttfbMs);
      log({ phase: 'home', ...p });
      if (p.status !== 200 || p.ttfbMs > 1000) throw new VocabularyPaused('home-ttfb');
    }
  };
  const query = async <T>(fn: () => Promise<T>) => {
    await guard();
    const at = Date.now();
    let result: T;
    let ms = 0;
    try {
      result = await fn();
    } finally {
      ms = Date.now() - at;
      metrics.queries++;
      metrics.queryMs += ms;
      metrics.maxQueryMs = Math.max(metrics.maxQueryMs, ms);
      await delay(rest, undefined, { signal: options.signal });
    }
    if (ms > 1000) throw new VocabularyPaused('query-latency');
    return result;
  };
  const workBudget = Math.max(0, (options.maxDurationMs ?? (options.mode === 'fast' ? 180000 : 6 * 3600000)) - 30000);
  const exact = async (tag: string) => {
    try {
      return await query(() => aggregateRange(db, null, tag, true));
    } catch (e) {
      if (!isQueryTimeout(e)) throw e;
    }
    const saved = aggregate.get<{ tag: string; cursor: { at: string; id: string } | null }>('largeGroup');
    let cursor = saved?.tag === tag ? saved.cursor : null;
    if (saved?.tag !== tag) aggregate.beginGroup();
    while (true) {
      const rows = await query(() => exactTagRows(db, tag, cursor));
      if (!rows.length) break;
      const last = rows.at(-1)!;
      cursor = { at: last.published_at, id: String(last.article_id) };
      aggregate.stageGroup(rows, { tag, cursor });
      metrics.rowsRead += rows.length;
    }
    aggregate.set('largeGroup', null);
    return aggregate.groupTerms();
  };
  const sweep = async (key: string, quota: number) => {
    let processed = 0;
    while (processed < quota) {
      if (key !== 'bootstrapCursor' && Date.now() - started >= workBudget) return false;
      const cursor = aggregate.get<{ tag: string; key: string }>(key);
      const upper = await query(() => upperTag(db, cursor?.tag ?? null, size));
      if (upper === undefined) {
        aggregate.replace(cursor?.key ?? null, null, [], { key, value: null });
        aggregate.set('lastFullReconcileAt', new Date().toISOString());
        return true;
      }
      let terms: AggregateTerm[];
      try {
        terms = await query(() => aggregateRange(db, cursor?.tag ?? null, upper!));
        if (size < 2000) size = Math.min(2000, size * 2);
      } catch (e) {
        if (!isQueryTimeout(e)) throw e;
        if (size > 1) {
          size = Math.max(1, Math.floor(size / 2));
          continue;
        }
        terms = await exact(upper);
      }
      const endKey = await query(() => tagKey(db, upper!));
      aggregate.replace(cursor?.key ?? null, endKey, terms, { key, value: { tag: upper, key: endKey } });
      processed += terms.length;
      metrics.rowsRead += terms.length;
      if (processed % 10000 < terms.length) log({ phase: key, terms: aggregate.count(), processed, ...metrics });
    }
    return false;
  };
  try {
    await guard(true);
    if (!aggregate.get('startedAt')) {
      const id = await query(() => maxArticleId(db));
      aggregate.set('startedAt', new Date().toISOString());
      aggregate.set('watermark', id);
      aggregate.set('baseline', id);
    }
    const initial = !aggregate.get('bootstrapComplete');
    const needsFull = !aggregate.get('publishedId');
    if (initial) {
      await sweep('bootstrapCursor', Infinity);
      aggregate.set('bootstrapComplete', true);
      aggregate.db.exec('DELETE FROM changes');
    }
    let target = aggregate.get<string>('targetId');
    if (target === null) {
      target = await query(() => maxArticleId(db));
      aggregate.set('targetId', target);
      aggregate.set('newCursor', null);
    }
    const lower = (
      BigInt(aggregate.get<string>('watermark')!) - 2000n > 0n ? BigInt(aggregate.get<string>('watermark')!) - 2000n : 0n
    ).toString();
    while (true) {
      const rows = await query(() => newArticleTags(db, aggregate.get('newCursor'), lower, target!));
      if (!rows.length) break;
      metrics.newRows += aggregate.observe(rows, aggregate.get<string>('baseline')!);
      metrics.rowsRead += rows.length;
    }
    aggregate.transaction(() => {
      aggregate.set('watermark', target);
      aggregate.set('targetId', null);
      aggregate.set('newCursor', null);
      aggregate.db.prepare('DELETE FROM seen WHERE article_id<?').run(lower);
    });
    while (true) {
      if (!needsFull && Date.now() - started >= workBudget) break;
      const pending = aggregate.db.prepare('SELECT group_key,tag FROM pending ORDER BY priority DESC LIMIT 1').get();
      if (!pending) break;
      const terms = await exact(String(pending.tag));
      aggregate.replaceExact(String(pending.group_key), terms);
    }
    if (!initial && options.mode === 'reconcile') {
      await sweep('reconcileCursor', Math.max(1000, Math.ceil(aggregate.count() / 7)));
    }
    aggregate.queueActiveExpiry(new Date());
    const store = new VocabularySnapshots(directory);
    async function* terms(): AsyncGenerator<SourceTerm> {
      let n = 0;
      for (const t of aggregate.terms()) {
        if (n++ % 500 === 0) await guard();
        yield t;
      }
    }
    async function* changes(): AsyncGenerator<Change> {
      let n = 0;
      for (const row of aggregate.db.prepare('SELECT action,payload FROM changes ORDER BY label COLLATE BINARY').iterate()) {
        if (n++ % 500 === 0) await guard();
        const payload = JSON.parse(String(row.payload));
        yield row.action === 'upsert'
          ? { action: 'upsert', term: vocabularyTerm(payload) }
          : { action: 'absent-from-index', label: payload.label, id: createHash('sha256').update(payload.label).digest('hex') };
      }
    }
    const pendingTags = Number(aggregate.db.prepare('SELECT COUNT(*) n FROM pending').get()!.n);
    const sourceAsOf = {
      pendingTags,
      newArticleWatermark: aggregate.get('watermark'),
      observedAt: new Date().toISOString(),
      bootstrapStartedAt: aggregate.get('startedAt'),
      lastFullReconcileAt: aggregate.get('lastFullReconcileAt'),
      reconciliationLagDays: 7,
      overlapArticleIds: 2000,
    };
    let manifest: Generation;
    if ((options.mode === 'fast' || options.mode === 'reconcile') && !needsFull) {
      manifest = await store.publishDelta(changes(), aggregate.count(), new Date(), sourceAsOf);
    } else {
      manifest = await store.publishStream(terms(), new Date(), { changes: changes(), sourceAsOf });
    }
    const firstObserved = aggregate.get<number>('firstNewTagObservedAt');
    const firstObservedToPublishedMs = firstObserved === null ? null : Date.now() - firstObserved;
    aggregate.db.exec('DELETE FROM changes');
    if (!pendingTags) aggregate.set('firstNewTagObservedAt', null);
    aggregate.set('publishedId', manifest.id);
    await store.prune();
    const result = {
      status: 'published',
      manifest,
      elapsedMs: Date.now() - started,
      firstObservedToPublishedMs,
      pendingTags,
      terms: aggregate.count(),
      startedAt: aggregate.get('startedAt'),
      lastFullReconcileAt: aggregate.get('lastFullReconcileAt'),
      ...metrics,
    };
    log({
      ...result,
      manifest: {
        id: manifest.id,
        generatedAt: manifest.generatedAt,
        total: manifest.total,
        changeCount: manifest.changeCount,
        ...('pages' in manifest
          ? { pages: manifest.pages.length, statistics: manifest.statistics, active: manifest.active?.total }
          : { kind: 'delta' }),
      },
    });
    return result;
  } catch (e) {
    if (e instanceof VocabularyPaused) {
      const result = { status: 'paused', reason: e.message, elapsedMs: Date.now() - started, terms: aggregate.count(), ...metrics };
      log(result);
      return result;
    }
    throw e;
  } finally {
    aggregate.close();
    lock.exec('ROLLBACK');
    lock.close();
  }
}
export async function probeHome() {
  const start = performance.now();
  const response = await fetch('https://tag.observe.tw/', { redirect: 'error', signal: AbortSignal.timeout(1500) });
  const ttfbMs = Math.round(performance.now() - start);
  await response.body?.cancel();
  return { status: response.status, ttfbMs };
}

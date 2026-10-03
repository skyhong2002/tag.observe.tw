// Incremental similarity index (2026-10-04): every article with a usable body
// is compared once with every other outlet's article published within seven
// days, and each pair at Dice ≥ 0.5 is kept permanently in similarity_pairs.
// Pages read the stored pairs instead of sampling the newest bodies per request.
//
// Each run takes the newest bodies not yet indexed, sketches them, and looks
// for candidates among the sketches already stored for the surrounding two
// weeks (similarity/minhash.ts). Candidates are scored exactly against the
// stored bodies. Because an article is only compared with articles indexed
// before it, every pair is scored once, by whichever article arrived later.
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import { and, between, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import type { Pool } from 'mysql2/promise';
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articleCitations, articleSketches, articles, jobRuns, similarityPairs } from '../db/schema.ts';
import { normalizeAttributions } from '../similarity/attribution.ts';
import { compareBodies, PAIR_WINDOW_MS, type PreparedBody, prepareBody } from '../similarity/compute.ts';
import { findCandidates, minhash, type SketchedArticle, shingleHashes, sketchFromBuffer, sketchToBuffer } from '../similarity/minhash.ts';
import { taipeiDay } from '../v1/event-archive.ts';

// "內容" syndication sites republish other outlets wholesale; they stay out of
// outlet-to-outlet statistics.
export const syndicationMedia = new Set(baseline.sources.filter((s) => s.classification === '內容').map((s) => s.media));

const CHUNK = 500;

export async function runSimilarityJob(
  db: Db,
  { now = () => new Date(), log = (_o: object, _m: string) => {}, batch = 2000, maxBatches = 5 } = {},
) {
  // Two runs indexing different batches at once would not see each other's
  // sketches and could miss pairs between them; a second run waits its turn.
  // createDb() builds drizzle on a mysql2/promise pool; the lock needs one fixed connection.
  const lock = await (db as Db & { $client: Pool }).$client.getConnection();
  try {
    const [rows] = await lock.query("SELECT GET_LOCK('similarity-index', 0) AS ok");
    if (Number((rows as Array<{ ok: number }>)[0]?.ok) !== 1) {
      log({}, 'similarity job skipped: another run holds the index lock');
      return { articles: 0, indexed: 0, candidates: 0, pairs: 0, citations: 0, pending: null, skipped: true };
    }
    try {
      return await indexRuns(db, now, log, batch, maxBatches);
    } finally {
      await lock.query("SELECT RELEASE_LOCK('similarity-index')");
    }
  } finally {
    lock.release();
  }
}

async function indexRuns(db: Db, now: () => Date, log: (o: object, m: string) => void, batch: number, maxBatches: number) {
  const started = now();
  const [run] = await db.insert(jobRuns).values({ name: 'similarity', startedAt: started, status: 'running' }).$returningId();
  const total = { articles: 0, indexed: 0, candidates: 0, pairs: 0, citations: 0 };
  try {
    for (let i = 0; i < maxBatches; i++) {
      const result = await indexBatch(db, batch, now);
      for (const key of Object.keys(total) as Array<keyof typeof total>) total[key] += result[key];
      if (result.articles < batch) break;
    }
    const pending = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(articles)
      .where(and(isNull(articles.similarityAt), eq(articles.bodyStatus, 'ok')));
    const detail = { ...total, pending: Number(pending[0]?.n ?? 0) as number | null, skipped: false };
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify(detail) })
      .where(eq(jobRuns.id, run.id));
    log(detail, 'similarity job finished');
    return detail;
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }
}

export async function indexBatch(db: Db, limit: number, now = () => new Date()) {
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      publishedAt: articles.publishedAt,
      body: articles.body,
      attributions: articles.attributions,
    })
    .from(articles)
    .where(and(isNull(articles.similarityAt), eq(articles.bodyStatus, 'ok')))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  const out = { articles: rows.length, indexed: 0, candidates: 0, pairs: 0, citations: 0 };
  if (!rows.length) return out;

  const prepared = new Map<number, PreparedBody>();
  const batch: SketchedArticle[] = [];
  const citations: Array<typeof articleCitations.$inferInsert> = [];
  for (const row of rows) {
    if (syndicationMedia.has(row.media) || !row.body) continue;
    const seen = new Set<string>();
    for (const source of normalizeAttributions(row.attributions ?? [], row.media)) {
      // Unknown outlets are kept by the name the article used, which can be long.
      const key = source.media.slice(0, 255);
      if (source.media === row.media || seen.has(key)) continue;
      seen.add(key);
      citations.push({ articleId: row.id, source: key, media: row.media, publishedAt: row.publishedAt, day: taipeiDay(row.publishedAt) });
    }
    const body = prepareBody(row.body);
    if (!body) continue;
    prepared.set(row.id, body);
    batch.push({ id: row.id, media: row.media, publishedAt: row.publishedAt.getTime(), sketch: minhash(shingleHashes(body.text)) });
  }
  out.indexed = batch.length;
  out.citations = citations.length;

  const pairs: Array<typeof similarityPairs.$inferInsert> = [];
  if (batch.length) {
    const times = batch.map((a) => a.publishedAt);
    const from = new Date(Math.min(...times) - PAIR_WINDOW_MS);
    const to = new Date(Math.max(...times) + PAIR_WINDOW_MS);
    const ids = batch.map((a) => a.id);
    const stored = await db
      .select({
        id: articleSketches.articleId,
        media: articleSketches.media,
        publishedAt: articleSketches.publishedAt,
        sketch: articleSketches.sketch,
      })
      .from(articleSketches)
      .where(
        and(between(articleSketches.publishedAt, from, to), isNotNull(articleSketches.sketch), notInArray(articleSketches.articleId, ids)),
      );
    const indexed: SketchedArticle[] = stored.map((s) => ({
      id: s.id,
      media: s.media,
      publishedAt: s.publishedAt.getTime(),
      sketch: sketchFromBuffer(s.sketch!),
    }));
    await yieldToLoop();
    const candidates = findCandidates(batch, indexed, PAIR_WINDOW_MS);
    out.candidates = candidates.length;

    const missing = [...new Set(candidates.map((c) => c.b.id))].filter((id) => !prepared.has(id));
    for (let i = 0; i < missing.length; i += CHUNK) {
      const bodies = await db
        .select({ id: articles.id, body: articles.body })
        .from(articles)
        .where(and(inArray(articles.id, missing.slice(i, i + CHUNK)), eq(articles.bodyStatus, 'ok')));
      for (const row of bodies) {
        const body = row.body ? prepareBody(row.body) : null;
        if (body) prepared.set(row.id, body);
      }
    }
    const computedAt = now();
    for (const [n, candidate] of candidates.entries()) {
      if (n % 200 === 199) await yieldToLoop();
      const left = prepared.get(candidate.a.id),
        right = prepared.get(candidate.b.id);
      if (!left || !right) continue;
      const match = compareBodies(left, right);
      if (!match) continue;
      const [a, b] = [candidate.a, candidate.b].sort((x, y) => x.id - y.id);
      const last = Math.max(a.publishedAt, b.publishedAt);
      pairs.push({
        aId: a.id,
        bId: b.id,
        aMedia: a.media,
        bMedia: b.media,
        aPublished: new Date(a.publishedAt),
        bPublished: new Date(b.publishedAt),
        firstPublished: new Date(Math.min(a.publishedAt, b.publishedAt)),
        lastPublished: new Date(last),
        day: taipeiDay(new Date(last)),
        score: match.score,
        containment: match.containment,
        shared: match.sharedShingles,
        kind: match.kind,
        evidence: match.evidence,
        computedAt,
      });
    }
    out.pairs = pairs.length;
  }

  // Idempotent writes: a run that stops halfway is simply repeated.
  for (let i = 0; i < batch.length; i += CHUNK)
    await db
      .insert(articleSketches)
      .values(
        batch.slice(i, i + CHUNK).map((a) => ({
          articleId: a.id,
          media: a.media,
          publishedAt: new Date(a.publishedAt),
          chars: prepared.get(a.id)!.text.length,
          sketch: sketchToBuffer(a.sketch),
        })),
      )
      .onDuplicateKeyUpdate({ set: { chars: sql`VALUES(chars)`, sketch: sql`VALUES(sketch)` } });
  for (let i = 0; i < pairs.length; i += CHUNK)
    await db
      .insert(similarityPairs)
      .values(pairs.slice(i, i + CHUNK))
      .onDuplicateKeyUpdate({
        set: {
          score: sql`VALUES(score)`,
          containment: sql`VALUES(containment)`,
          shared: sql`VALUES(shared)`,
          kind: sql`VALUES(kind)`,
          evidence: sql`VALUES(evidence)`,
          computedAt: sql`VALUES(computed_at)`,
        },
      });
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += CHUNK)
    await db.delete(articleCitations).where(inArray(articleCitations.articleId, ids.slice(i, i + CHUNK)));
  for (let i = 0; i < citations.length; i += CHUNK) await db.insert(articleCitations).values(citations.slice(i, i + CHUNK));
  const indexedAt = now();
  for (let i = 0; i < ids.length; i += CHUNK)
    await db
      .update(articles)
      .set({ similarityAt: indexedAt })
      .where(inArray(articles.id, ids.slice(i, i + CHUNK)));
  return out;
}

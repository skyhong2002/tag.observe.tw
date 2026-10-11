// Writing signals (writing/rules.ts) for every article with a body, kept in
// article_writing after the body expires. The incremental run takes the newest
// unanalysed bodies, and bodies analysed by an older rule VERSION, within the
// body retention window; the daily people run learns which role bare poster
// names carry and re-labels rows it can now resolve.
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import type { Pool } from 'mysql2/promise';
import { BODY_RETENTION_MS } from '../article-retention.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags, articleWriting, jobRuns, writingPeople } from '../db/schema.ts';
import { taipeiDay } from '../v1/event-archive.ts';
import { analyzeArticle } from '../writing/analyze.ts';
import { lookupPerson, nameMatcher, type Person, resolveTally, type Tally, tallyMentions } from '../writing/people.ts';
import { nameCandidates, type Role, VERSION } from '../writing/rules.ts';

const CHUNK = 500;
type Log = (o: object, m: string) => void;

async function withLock<T>(db: Db, name: string, skipped: T, run: () => Promise<T>): Promise<T> {
  const lock = await (db as Db & { $client: Pool }).$client.getConnection();
  try {
    const [rows] = await lock.query('SELECT GET_LOCK(?, 0) AS ok', [name]);
    if (Number((rows as Array<{ ok: number }>)[0]?.ok) !== 1) return skipped;
    try {
      return await run();
    } finally {
      await lock.query('SELECT RELEASE_LOCK(?)', [name]);
    }
  } finally {
    lock.release();
  }
}

async function recorded<T extends object>(db: Db, name: string, now: () => Date, log: Log, run: () => Promise<T>): Promise<T> {
  const [row] = await db.insert(jobRuns).values({ name, startedAt: now(), status: 'running' }).$returningId();
  try {
    const detail = await run();
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify(detail) })
      .where(eq(jobRuns.id, row.id));
    log(detail, `${name} job finished`);
    return detail;
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(jobRuns.id, row.id));
    throw error;
  }
}

export async function loadPeople(db: Db): Promise<Map<string, Person>> {
  const rows = await db.select({ name: writingPeople.name, role: writingPeople.role, source: writingPeople.source }).from(writingPeople);
  return new Map(rows.map((r) => [r.name, { role: r.role as Role, source: r.source }]));
}

export async function runWritingJob(
  db: Db,
  { now = () => new Date(), log = (_o: object, _m: string) => {}, batch = 2000, maxBatches = 10 } = {},
) {
  const skipped = { articles: 0, social: 0, pending: null as number | null, skipped: true };
  return withLock(db, 'writing-signals', skipped, () =>
    recorded(db, 'writing', now, log, async () => {
      const people = await loadPeople(db);
      const total = { articles: 0, social: 0 };
      for (let i = 0; i < maxBatches; i++) {
        const result = await analyzeBatch(db, batch, people, now);
        total.articles += result.articles;
        total.social += result.social;
        if (result.articles < batch) break;
      }
      const [left] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(articles)
        .leftJoin(articleWriting, eq(articleWriting.articleId, articles.id))
        .where(unanalysed(now()));
      return { ...total, pending: Number(left?.n ?? 0), skipped: false };
    }),
  );
}

// Bodies not yet analysed, or analysed by an older rule set. The query builder
// keeps datetimes in UTC; raw rows come back as strings Node would read as local time.
const unanalysed = (now: Date) =>
  and(
    eq(articles.bodyStatus, 'ok'),
    gt(articles.publishedAt, new Date(now.getTime() - BODY_RETENTION_MS)),
    or(isNull(articleWriting.articleId), ne(articleWriting.version, VERSION)),
  );

export async function analyzeBatch(db: Db, limit: number, people: Map<string, Person>, now = () => new Date()) {
  const rows = await db
    .select({ id: articles.id, media: articles.media, publishedAt: articles.publishedAt, title: articles.title, body: articles.body })
    .from(articles)
    .leftJoin(articleWriting, eq(articleWriting.articleId, articles.id))
    .where(unanalysed(now()))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  const values: Array<typeof articleWriting.$inferInsert> = [];
  const analyzedAt = now();
  for (const row of rows) {
    const w = analyzeArticle(row.title, row.body ?? '', people);
    values.push({
      articleId: row.id,
      media: row.media,
      publishedAt: row.publishedAt,
      day: taipeiDay(row.publishedAt),
      version: VERSION,
      analyzedAt,
      ...w,
    });
    if (values.length % 200 === 0) await yieldToLoop();
  }
  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(articleWriting)
      .values(values.slice(i, i + CHUNK))
      .onDuplicateKeyUpdate({
        set: {
          version: sql`VALUES(version)`,
          platform: sql`VALUES(platform)`,
          evidence: sql`VALUES(evidence)`,
          poster: sql`VALUES(poster)`,
          role: sql`VALUES(role)`,
          roleSource: sql`VALUES(role_source)`,
          titleTags: sql`VALUES(title_tags)`,
          analyzedAt: sql`VALUES(analyzed_at)`,
        },
      });
  }
  return { articles: rows.length, social: values.filter((v) => v.platform).length };
}

const PEOPLE_BODY_DAYS = 7;
const PEOPLE_NAME_DAYS = 30;

/**
 * Learns roles for unresolved poster names from the last week of bodies, then
 * re-labels article_writing rows that the new entries resolve. Admin entries
 * are never overwritten.
 */
export async function runWritingPeopleJob(db: Db, { now = () => new Date(), log = (_o: object, _m: string) => {} } = {}) {
  const skipped = { names: 0, resolved: 0, relabelled: 0, skipped: true };
  return withLock(db, 'writing-people', skipped, () =>
    recorded(db, 'writing-people', now, log, async () => {
      const since = new Date(now().getTime() - PEOPLE_NAME_DAYS * 86400e3);
      const open = await db
        .select({ articleId: articleWriting.articleId, poster: articleWriting.poster })
        .from(articleWriting)
        .where(and(eq(articleWriting.role, '未知'), isNotNull(articleWriting.poster), gt(articleWriting.publishedAt, since)));
      const runs = [...new Set(open.map((r) => r.poster as string))];
      const matcher = nameMatcher(runs.flatMap(nameCandidates));
      const tally: Tally = new Map();
      if (matcher) {
        const bodySince = new Date(now().getTime() - PEOPLE_BODY_DAYS * 86400e3);
        let after = 0;
        for (;;) {
          const page = await db
            .select({ id: articles.id, body: articles.body })
            .from(articles)
            .where(and(gt(articles.publishedAt, bodySince), gt(articles.id, after), eq(articles.bodyStatus, 'ok')))
            .orderBy(articles.id)
            .limit(5000);
          for (const row of page) if (row.body) tallyMentions(tally, matcher, row.body);
          if (page.length < 5000) break;
          after = page[page.length - 1].id;
          await yieldToLoop();
        }
      }
      const tagRows = tally.size
        ? await db
            .selectDistinct({ tag: articleTags.tag })
            .from(articleTags)
            .where(and(inArray(articleTags.tag, [...tally.keys()].slice(0, 20000)), gt(articleTags.publishedAt, since)))
        : [];
      const resolved = resolveTally(tally, new Set(tagRows.map((r) => r.tag)));
      const people = await loadPeople(db);
      const updatedAt = now();
      const fresh = [...resolved.values()].filter((r) => people.get(r.name)?.source !== 'admin');
      for (let i = 0; i < fresh.length; i += CHUNK) {
        await db
          .insert(writingPeople)
          .values(
            fresh
              .slice(i, i + CHUNK)
              .map((r) => ({ name: r.name, role: r.role, source: 'auto' as const, hits: r.hits, total: r.total, updatedAt })),
          )
          .onDuplicateKeyUpdate({
            set: { role: sql`VALUES(role)`, hits: sql`VALUES(hits)`, total: sql`VALUES(total)`, updatedAt: sql`VALUES(updated_at)` },
          });
      }
      for (const r of fresh) people.set(r.name, { role: r.role, source: 'auto' });
      const relabelled = await relabel(db, open as Array<{ articleId: number; poster: string }>, people);
      return { names: runs.length, resolved: fresh.length, relabelled, skipped: false };
    }),
  );
}

/** Applies person entries to rows still labelled 未知. */
export async function relabel(db: Db, rows: Array<{ articleId: number; poster: string }>, people: Map<string, Person>) {
  const byRole = new Map<string, Map<string, number[]>>();
  for (const row of rows) {
    const found = lookupPerson(row.poster, people);
    if (!found) continue;
    const names = byRole.get(found.person.role) ?? new Map<string, number[]>();
    names.set(found.name, [...(names.get(found.name) ?? []), row.articleId]);
    byRole.set(found.person.role, names);
  }
  let n = 0;
  for (const [role, names] of byRole)
    for (const [name, ids] of names)
      for (let i = 0; i < ids.length; i += CHUNK) {
        await db
          .update(articleWriting)
          .set({ role, poster: name, roleSource: 'people' })
          .where(inArray(articleWriting.articleId, ids.slice(i, i + CHUNK)));
        n += Math.min(CHUNK, ids.length - i);
      }
  return n;
}

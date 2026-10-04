import { and, desc, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, eventSnapshots, events, eventThreads, jobRuns, rankingSnapshots } from '../db/schema.ts';
import { type ArticleRow, clusterEvents, matchThread, threadUpdate } from './events-compute.ts';
import { applyRankingBasis, rankingBasis } from './ranking-basis.ts';
import { BURST_STEPS, computeBurst, type RankingChart } from './ranking-compute.ts';
import { hourStart, RANKING_CATEGORIES } from './ranking-job.ts';

const taipeiHour = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 13).replace('T', ' ') + ':00:00';
const VALID_HOURS = 6;

export interface EventsJobDeps {
  db: Db;
  now?: () => Date;
  log?: (o: object, m: string) => void;
}

/** The clustering inputs for one run: the burst-ranked tags of the fixed media
 *  basis and every tagged article of the last 24 hours. Shared by the job and
 *  by tools/events-compare.ts, which replays clustering offline. */
export async function loadEventInputs(db: Db, now: Date, category = 'news') {
  const spec = RANKING_CATEGORIES[category];
  if (!spec) throw Error('unknown category ' + category);
  // Legacy events.php computes on the "all" media list with weight 14 (type=news
  // is only used for the show_events row); mirror that by using the 'all' chart.
  const [current] = await db
    .select()
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.category, 'all'))
    .orderBy(desc(rankingSnapshots.hourStart))
    .limit(1);
  if (!current) throw Error('no ranking snapshot yet');
  const basis = rankingBasis('all');
  const chart = applyRankingBasis(JSON.parse(current.chart) as RankingChart, basis, current.computedAt);
  if (!chart.available) throw Error('ranking snapshot is not available for the fixed media basis');
  const history = new Map<number, RankingChart | null>();
  for (const [h] of BURST_STEPS) {
    const [row] = await db
      .select({ chart: rankingSnapshots.chart, computedAt: rankingSnapshots.computedAt })
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.category, 'all'), eq(rankingSnapshots.hourStart, new Date(current.hourStart.getTime() - h * 3600e3))))
      .limit(1);
    history.set(h, row ? applyRankingBasis(JSON.parse(row.chart) as RankingChart, basis, row.computedAt) : null);
  }
  const burst = computeBurst(chart, history);
  const since = new Date(now.getTime() - 24 * 3600e3);
  const rows: ArticleRow[] = (
    await db
      .select({
        id: articles.id,
        media: articles.media,
        publishedAt: articles.publishedAt,
        url: articles.url,
        title: articles.title,
        image: articles.image,
        tags: articles.tags,
      })
      .from(articles)
      .where(and(gte(articles.publishedAt, since), sql`JSON_LENGTH(${articles.tags}) > 0`))
  ).filter((r) => spec.media.includes(r.media) || category === 'all');
  return { current, burst, rows };
}

export async function runEventsJob({ db, now = () => new Date(), log = () => {} }: EventsJobDeps, category = 'news') {
  const started = now();
  if (!RANKING_CATEGORIES[category]) throw Error('unknown category ' + category);
  const [run] = await db.insert(jobRuns).values({ name: 'events', startedAt: started, status: 'running' }).$returningId();
  try {
    const t0 = performance.now();
    const { current, burst, rows } = await loadEventInputs(db, started, category);
    const clusters = clusterEvents(burst, rows, (noEqual as { tags: string[] }).tags, { now: started });
    const hour = hourStart(started);
    const hourKey = taipeiHour(hour);
    // Threads active in the last VALID_HOURS hours (events_history.php).
    const active = await db
      .select()
      .from(eventThreads)
      .where(and(eq(eventThreads.category, category), gte(eventThreads.lastTime, new Date(hour.getTime() - VALID_HOURS * 3600e3))))
      .orderBy(eventThreads.id);
    const threadIds: Array<number | null> = [];
    let continued = 0,
      opened = 0;
    for (const ev of clusters) {
      if (ev.major.length < 2) {
        threadIds.push(null);
        continue;
      }
      const th = matchThread(ev.major, active);
      if (th) {
        const u = threadUpdate(th, hourKey, ev.major, ev.tags);
        await db
          .update(eventThreads)
          .set({
            lastTime: hour,
            hours: u.hours,
            allTags: u.allTags,
            majorTags: u.majorTags,
            maxTag: u.maxTag,
            maxScore: Math.round(u.maxScore * 1e6),
            history: u.history,
          })
          .where(eq(eventThreads.id, th.id));
        th.history = u.history;
        th.allTags = u.allTags;
        th.lastTime = hour;
        threadIds.push(th.id);
        continued++;
      } else {
        const u = threadUpdate({ history: {} }, hourKey, ev.major, ev.tags);
        const [{ id }] = await db
          .insert(eventThreads)
          .values({
            category,
            firstTime: hour,
            lastTime: hour,
            hours: 1,
            allTags: ev.major,
            majorTags: u.majorTags,
            maxTag: u.maxTag,
            maxScore: Math.round(u.maxScore * 1e6),
            history: u.history,
            combinedFrom: [],
            combinedTo: [],
          })
          .$returningId();
        active.push({
          ...u,
          id,
          category,
          firstTime: hour,
          lastTime: hour,
          combinedFrom: [],
          combinedTo: [],
          hoursTotal: null,
          equalFirstTime: null,
          equalLastTime: null,
          maxScore: Math.round(u.maxScore * 1e6),
        } as (typeof active)[number]);
        threadIds.push(id);
        opened++;
      }
    }
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: eventSnapshots.id })
        .from(eventSnapshots)
        .where(and(eq(eventSnapshots.category, category), eq(eventSnapshots.hourStart, hour)))
        .limit(1);
      const values = {
        category,
        hourStart: hour,
        computedAt: started,
        rankingSnapshotId: current.id,
        eventCount: clusters.length,
        durationMs: Math.round(performance.now() - t0),
        detail: JSON.stringify({ articles: rows.length, continued, opened }),
      };
      let id: number;
      if (existing.length) {
        id = existing[0].id;
        await tx.update(eventSnapshots).set(values).where(eq(eventSnapshots.id, id));
        await tx.delete(events).where(eq(events.snapshotId, id));
      } else [{ id }] = await tx.insert(eventSnapshots).values(values).$returningId();
      const pick = (r: ArticleRow) => ({ id: r.id, title: r.title, url: r.url, image: r.image, media: r.media });
      for (let i = 0; i < clusters.length; i += 100)
        await tx.insert(events).values(
          clusters.slice(i, i + 100).map((ev, j) => ({
            snapshotId: id,
            rank: ev.rank,
            score: Math.round(ev.score * 1e6),
            tags: ev.tags.slice(0, 60),
            major: ev.major,
            news: ev.news.map(pick),
            majorNews: ev.majorNews.map(pick),
            threadId: threadIds[i + j],
          })),
        );
    });
    await mergeThreads(db, category, started);
    const result = {
      category,
      hour: hour.toISOString(),
      articles: rows.length,
      events: clusters.length,
      continued,
      opened,
      ms: Math.round(performance.now() - t0),
    };
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify(result) })
      .where(eq(jobRuns.id, run.id));
    log(result, 'events job finished');
    return result;
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }
}

// equal3.php: link threads whose major tags overlap (>=3 hits or all) when a
// later thread starts within a day after an earlier one ended; record the
// combined span. Runs over threads ended 7h..3d ago.
export async function mergeThreads(db: Db, category: string, now: Date) {
  const notYet = new Date(now.getTime() - 7 * 3600e3),
    expire = new Date(now.getTime() - 3 * 86400e3);
  const ended = await db
    .select()
    .from(eventThreads)
    .where(and(eq(eventThreads.category, category), sql`${eventThreads.lastTime} < ${notYet}`, gte(eventThreads.lastTime, expire)));
  const all = await db
    .select()
    .from(eventThreads)
    .where(and(eq(eventThreads.category, category), gte(eventThreads.firstTime, expire)));
  let linked = 0;
  for (const a of ended) {
    const inTime = new Date(new Date(a.lastTime.getTime() + 86400e3).setUTCHours(15, 59, 59, 0)); // legacy: date("Y-m-d 23:59:59") Taipei
    for (const b of all) {
      if (b.id === a.id || b.firstTime <= a.firstTime || b.firstTime > inTime || b.lastTime >= notYet) continue;
      const hits = b.majorTags.filter((t) => a.majorTags.includes(t)).length;
      if (hits >= 3 || hits === a.majorTags.length) {
        const from = b.combinedFrom.includes(a.id) ? b.combinedFrom : [...b.combinedFrom, a.id];
        const to = a.combinedTo.includes(b.id) ? a.combinedTo : [...a.combinedTo, b.id];
        const ids = new Set([a.id, b.id, ...from, ...to, ...a.combinedFrom, ...b.combinedTo]);
        const span = await db
          .select({ f: sql<Date>`MIN(${eventThreads.firstTime})`, l: sql<Date>`MAX(${eventThreads.lastTime})` })
          .from(eventThreads)
          .where(
            sql`${eventThreads.id} IN (${sql.join(
              [...ids].map((i) => sql`${i}`),
              sql`, `,
            )})`,
          );
        const f = new Date(span[0].f),
          l = new Date(span[0].l);
        const total = Math.ceil((l.getTime() - f.getTime()) / 3600e3) + 1;
        await db
          .update(eventThreads)
          .set({ combinedFrom: from, hoursTotal: total, equalFirstTime: f, equalLastTime: l })
          .where(eq(eventThreads.id, b.id));
        await db
          .update(eventThreads)
          .set({ combinedTo: to, hoursTotal: total, equalFirstTime: f, equalLastTime: l })
          .where(eq(eventThreads.id, a.id));
        a.combinedTo = to;
        b.combinedFrom = from;
        linked++;
      }
    }
  }
  await db
    .update(eventThreads)
    .set({
      hoursTotal: sql`TIMESTAMPDIFF(HOUR, first_time, last_time) + 1`,
      equalFirstTime: sql`first_time`,
      equalLastTime: sql`last_time`,
    })
    .where(
      and(
        eq(eventThreads.category, category),
        sql`JSON_LENGTH(combined_from)=0 AND JSON_LENGTH(combined_to)=0`,
        gte(eventThreads.lastTime, expire),
      ),
    );
  return linked;
}

export async function latestEvents(db: Db, category = 'news', limit = 30, at?: Date) {
  // `at` browses the archive: the snapshot for that hour, or the last one before it.
  const where = at ? and(eq(eventSnapshots.category, category), lte(eventSnapshots.hourStart, at)) : eq(eventSnapshots.category, category);
  const [snap] = await db.select().from(eventSnapshots).where(where).orderBy(desc(eventSnapshots.hourStart)).limit(1);
  if (!snap) return null;
  const rows = await db.select().from(events).where(eq(events.snapshotId, snap.id)).orderBy(events.rank).limit(limit);
  return { snapshot: snap, events: rows };
}

/** Snapshot hours on the same Taipei day as `hour`, plus its neighbours. */
export async function eventHours(db: Db, category: string, hour: Date) {
  const dayStart = new Date(Math.floor((hour.getTime() + 8 * 3600e3) / 86400e3) * 86400e3 - 8 * 3600e3);
  const dayEnd = new Date(dayStart.getTime() + 86400e3);
  const [day, [prev], [next]] = await Promise.all([
    db
      .select({ h: eventSnapshots.hourStart })
      .from(eventSnapshots)
      .where(and(eq(eventSnapshots.category, category), gte(eventSnapshots.hourStart, dayStart), lt(eventSnapshots.hourStart, dayEnd)))
      .orderBy(eventSnapshots.hourStart),
    db
      .select({ h: eventSnapshots.hourStart })
      .from(eventSnapshots)
      .where(and(eq(eventSnapshots.category, category), lt(eventSnapshots.hourStart, hour)))
      .orderBy(desc(eventSnapshots.hourStart))
      .limit(1),
    db
      .select({ h: eventSnapshots.hourStart })
      .from(eventSnapshots)
      .where(and(eq(eventSnapshots.category, category), gt(eventSnapshots.hourStart, hour)))
      .orderBy(eventSnapshots.hourStart)
      .limit(1),
  ]);
  return { day: day.map((r) => r.h), prev: prev?.h ?? null, next: next?.h ?? null };
}

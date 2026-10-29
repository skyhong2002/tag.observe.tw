import { createHash } from 'node:crypto';
import { type SQL, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import {
  MAX_OBSERVATION_DAYS,
  matchesObservation,
  type Observation,
  type ObservationEvent,
  observationScope,
} from '../observation-scope.ts';

const DAY = 86400000;
const TPE = 8 * 3600000;
const MAX_ARTICLES = 25000;
const MAX_THREADS = 20000;
const MAX_EVENTS = 1000;
const info = catalog as Record<string, { title?: string | null }>;
const dayOf = (date: Date) => new Date(+date + TPE).toISOString().slice(0, 10);
const startOf = (day: string) => new Date(Date.parse(`${day}T00:00:00+08:00`));
const utcDate = (value: Date | string) => (value instanceof Date ? value : new Date(value.replace(' ', 'T') + 'Z'));
const json = <T>(value: T | string): T => (typeof value === 'string' ? (JSON.parse(value) as T) : value);
export type ObservationQuery = { v?: string; anchor?: string; with?: string; from?: string; to?: string; at?: string; seed?: string };
export function observationWindow(q: ObservationQuery, now = new Date()) {
  const today = dayOf(now);
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(+startOf(day)) && dayOf(startOf(day)) === day;
  for (const value of Object.values(q)) if (value !== undefined && typeof value !== 'string') throw Error('參數不可重複');
  const to = q.to ?? today;
  if (!valid(to)) throw Error('日期須為有效的 YYYY-MM-DD');
  const from = q.from ?? dayOf(new Date(+startOf(to) - 179 * DAY));
  const at = q.at ?? to;
  if (![from, to, at].every(valid)) throw Error('日期須為有效的 YYYY-MM-DD');
  if (from > to || at < from || at > to || to > today) throw Error('日期範圍或回看日期錯誤');
  if ((+startOf(to) - +startOf(from)) / DAY >= MAX_OBSERVATION_DAYS) throw Error('查詢最多涵蓋 366 天');
  return { from, to, at, start: startOf(from), end: new Date(Math.min(+startOf(at) + DAY, +now)) };
}
export interface ObservationArticle {
  id: number;
  media: string;
  title: string;
  publishedAt: Date;
  tags: string[];
}
export interface ObservationThread {
  id: number;
  firstTime: Date;
  lastTime: Date;
  majorTags: string[];
  history: Record<string, Record<string, number>>;
}
/** Match an actual hourly snapshot, never a union of unrelated hours' tags. */
export function observationEvents(threads: ObservationThread[], scope: Observation['scope'], from: Date, to: Date): ObservationEvent[] {
  const result: ObservationEvent[] = [];
  for (const thread of threads) {
    const hours = Object.entries(thread.history)
      .filter(([hour, tags]) => {
        const time = Date.parse(hour.replace(' ', 'T') + '+08:00');
        return time >= +from && time < +to && matchesObservation(Object.keys(tags), scope);
      })
      .sort(([a], [b]) => a.localeCompare(b));
    if (!hours.length) continue;
    result.push({
      id: thread.id,
      firstAt: new Date(hours[0][0].replace(' ', 'T') + '+08:00').toISOString(),
      lastAt: new Date(hours[hours.length - 1][0].replace(' ', 'T') + '+08:00').toISOString(),
      matchedHours: hours.length,
      tags: Object.keys(hours[hours.length - 1][1]),
      headline: null,
    });
  }
  return result.sort((a, b) => b.firstAt.localeCompare(a.firstAt) || b.id - a.id);
}
/** ID deduplication is shared by totals, daily counts, outlets and the headline list. */
export function observationCounts(rows: ObservationArticle[], scope: Observation['scope'], window: ReturnType<typeof observationWindow>) {
  const seen = new Set<number>();
  const counts = new Map<string, { articles: number; media: Set<string> }>();
  const outlets = new Map<string, { media: string; title: string; articles: number; days: Record<string, number> }>();
  const articles = rows.filter((r) => {
    if (+r.publishedAt < +window.start || +r.publishedAt >= +window.end || seen.has(r.id) || !matchesObservation(r.tags, scope))
      return false;
    seen.add(r.id);
    return true;
  });
  for (const r of articles) {
    const day = dayOf(r.publishedAt);
    const bucket = counts.get(day) ?? { articles: 0, media: new Set<string>() };
    bucket.articles++;
    bucket.media.add(r.media);
    counts.set(day, bucket);
    const outlet = outlets.get(r.media) ?? { media: r.media, title: info[r.media]?.title ?? r.media, articles: 0, days: {} };
    outlet.articles++;
    outlet.days[day] = (outlet.days[day] ?? 0) + 1;
    outlets.set(r.media, outlet);
  }
  const days: Observation['days'] = [];
  for (let d = +window.start; d <= +startOf(window.to); d += DAY) {
    const day = dayOf(new Date(d));
    const bucket = counts.get(day);
    days.push({
      day,
      articles: day > window.at ? null : (bucket?.articles ?? 0),
      media: day > window.at ? null : (bucket?.media.size ?? 0),
    });
  }
  return {
    days,
    outlets: [...outlets.values()].sort((a, b) => b.articles - a.articles || a.media.localeCompare(b.media)),
    totals: { articles: articles.length, media: outlets.size, events: 0 },
    recent: articles
      .sort((a, b) => +b.publishedAt - +a.publishedAt || b.id - a.id)
      .slice(0, 60)
      .map((a) => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
  };
}
async function read<T>(db: Db, query: SQL): Promise<T[]> {
  const [rows] = await db.execute(sql`SET STATEMENT max_statement_time=5 FOR ${query}`);
  return rows as unknown as T[];
}
export async function loadObservation(
  db: Db,
  scope: Observation['scope'],
  window: ReturnType<typeof observationWindow>,
): Promise<Observation> {
  const alternatives = scope.any.length
    ? sql`AND EXISTS (SELECT 1 FROM article_tags other WHERE other.article_id=a.id AND other.tag IN (${sql.join(
        scope.any.map((tag) => sql`${tag}`),
        sql`, `,
      )}))`
    : sql``;
  const raw = await read<Omit<ObservationArticle, 'tags' | 'publishedAt'> & { tags: string[] | string; publishedAt: Date | string }>(
    db,
    sql`
    SELECT a.id,a.media,a.title,a.published_at AS publishedAt,a.tags
    FROM article_tags t FORCE INDEX (tag_published) JOIN articles a ON a.id=t.article_id
    WHERE t.tag=${scope.anchor} AND t.published_at>=${window.start} AND t.published_at<${window.end} ${alternatives}
    ORDER BY t.published_at,a.id LIMIT ${MAX_ARTICLES + 1}`,
  );
  if (raw.length > MAX_ARTICLES) throw Error('observation-article-cap');
  const articles = raw.map((r) => ({ ...r, tags: json(r.tags), publishedAt: utcDate(r.publishedAt) }));
  const matchingArticles = new Map(articles.filter((a) => matchesObservation(a.tags, scope)).map((a) => [a.id, a]));
  const threads = await read<ObservationThread>(
    db,
    sql`
    SELECT id,first_time AS firstTime,last_time AS lastTime,major_tags AS majorTags,history
    FROM event_threads WHERE category='news' AND last_time>=${window.start} AND first_time<${window.end}
    ORDER BY last_time DESC,id DESC LIMIT ${MAX_THREADS + 1}`,
  );
  if (threads.length > MAX_THREADS) throw Error('observation-thread-cap');
  const events = observationEvents(
    threads.map((t) => ({ ...t, history: json(t.history) })),
    scope,
    window.start,
    window.end,
  );
  if (events.length > MAX_EVENTS) throw Error('observation-event-cap');
  // One representative snapshot per matching thread, limited to the visible
  // publication-time window. Never use a later headline during replay.
  if (events.length) {
    const ids = sql.join(
      events.map((e) => sql`${e.id}`),
      sql`, `,
    );
    const extra = scope.any.length
      ? sql`AND (${sql.join(
          scope.any.map((tag) => sql`JSON_CONTAINS(e.major,JSON_QUOTE(${tag}))`),
          sql` OR `,
        )})`
      : sql``;
    const representatives = await read<{ threadId: number; news: string | Array<{ id?: number; title: string; media: string }> }>(
      db,
      sql`
      SELECT e.thread_id AS threadId,e.major_news AS news FROM events e WHERE e.id IN (
        SELECT MAX(e.id) FROM events e JOIN event_snapshots s ON s.id=e.snapshot_id
        WHERE e.thread_id IN (${ids}) AND s.hour_start>=${window.start} AND s.hour_start<${window.end}
          AND JSON_CONTAINS(e.major,JSON_QUOTE(${scope.anchor})) ${extra} GROUP BY e.thread_id)`,
    );
    const byId = new Map(events.map((e) => [e.id, e]));
    for (const r of representatives) {
      const event = byId.get(r.threadId);
      const news = json(r.news)
        .map((n) => (n.id ? matchingArticles.get(n.id) : undefined))
        .find(Boolean);
      if (event && news) event.headline = { id: news.id, title: news.title, media: news.media };
    }
  }
  const [first] = await read<{ firstAt: Date | string | null }>(
    db,
    sql`SELECT MIN(first_time) AS firstAt FROM event_threads WHERE category='news'`,
  );
  const counts = observationCounts(articles, scope, window);
  return {
    scope,
    window: { from: window.from, to: window.to, at: window.at, end: window.end.toISOString() },
    generatedAt: new Date().toISOString(),
    ...counts,
    totals: { ...counts.totals, events: events.length },
    events,
    eventHistoryFrom: first?.firstAt ? utcDate(first.firstAt).toISOString() : null,
  };
}
export function registerObservations(app: FastifyInstance, db: Db) {
  const cache = new Map<string, { expires: number; promise: Promise<Observation> }>();
  let running = 0;
  app.get<{ Querystring: ObservationQuery }>('/api/v1/observations', async (request, reply) => {
    const q = request.query;
    if (Object.values(q).some((value) => typeof value !== 'string')) return reply.code(400).send({ error: '參數不可重複' });
    let scope: Observation['scope'];
    let window: ReturnType<typeof observationWindow>;
    try {
      if (q.v !== undefined && q.v !== '1') throw Error('不支援的追蹤條件版本');
      let anchor = q.anchor,
        any = q.with;
      if (q.seed !== undefined) {
        if (anchor !== undefined || any !== undefined || !/^[1-9]\d*$/.test(q.seed) || !Number.isSafeInteger(Number(q.seed)))
          throw Error('事件編號或追蹤條件錯誤');
        let seed: { major: string[] | string } | undefined;
        try {
          [seed] = await read<{ major: string[] | string }>(
            db,
            sql`SELECT major_tags AS major FROM event_threads WHERE id=${Number(q.seed)} AND category='news' LIMIT 1`,
          );
        } catch (error) {
          request.log.warn({ err: error }, 'observation seed unavailable');
          return reply.code(503).send({ error: '事件資料暫時無法取得' });
        }
        if (!seed) return reply.code(404).send({ error: '找不到事件' });
        const tags = json(seed.major);
        anchor = tags[0];
        any = tags[1];
      }
      const parsed = observationScope(anchor, any);
      scope = { ...parsed, id: createHash('sha256').update(JSON.stringify(parsed)).digest('hex').slice(0, 24) };
      window = observationWindow(q);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : '查詢格式錯誤' });
    }
    const key = JSON.stringify([scope.id, window.from, window.to, window.at]);
    let entry = cache.get(key);
    if (!entry || entry.expires < Date.now()) {
      if (running >= 2) return reply.code(503).send({ error: '長期查詢忙碌中，請稍後再試' });
      running++;
      const promise = loadObservation(db, scope, window).finally(() => {
        running--;
      });
      entry = { expires: Date.now() + 60000, promise };
      cache.delete(key);
      cache.set(key, entry);
      while (cache.size > 24) cache.delete(cache.keys().next().value!);
      const current = entry;
      promise.catch(() => {
        if (cache.get(key) === current) cache.delete(key);
      });
    }
    try {
      const data = await entry.promise;
      reply.header('cache-control', 'public, max-age=60');
      return data;
    } catch (error) {
      request.log.warn({ err: error }, 'long-term observation unavailable');
      return reply.code(503).send({ error: '資料量超出單次查詢上限或資料暫時無法取得；請縮短日期或增加搭配標籤後重試' });
    }
  });
}

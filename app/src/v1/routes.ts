import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import { excludedMedia } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads, rankingSnapshots, tagStats } from '../db/schema.ts';
import { applyRankingBasis, rankingBasis } from '../jobs/ranking-basis.ts';
import { BURST_STEPS, computeBurst, effectiveWeight, type RankingChart } from '../jobs/ranking-compute.ts';
import { HOURS, RANKING_CATEGORIES } from '../jobs/ranking-job.ts';
import { isTagNoise } from '../tag-noise.ts';
import { campOf, loadThreadCoverage } from './coverage.ts';
import { PERIOD_DAYS, taipeiDay, threadSeries, threadsInPeriod, threadsOnDay } from './event-archive.ts';
import { iconUrl } from './icons.ts';
import {
  discoverySignals,
  loadDiscoveryEvidence,
  type RankingGate,
  type RankingOrder,
  selectDiscoveryEntries,
} from './ranking-discovery.ts';
import { loadBurstTrails } from './ranking-history.ts';
import { registerTagFlow } from './tag-flow.ts';
import { loadRelatedTags } from './tag-related.ts';
import { completedHourWindow, loadHourlyTrends, registerTagSeries } from './tag-series.ts';
import { loadTagStatus } from './tag-status.ts';

const mediaInfo = catalog as unknown as Record<string, { icon: string | null; title: string | null }>;
export const CATEGORY_LABELS: Record<string, string> = {
  all: '所有媒體',
  news: '新聞媒體',
  '3c': '科技與 3C',
  women: '女性網站',
  alt: '非主流媒體',
  finance: '財經',
  style: '風格',
  movie: '影視',
  health: '健康',
  sports: '運動',
  travel: '旅遊',
  notag: '無標籤媒體',
  game: '遊戲',
  adct: '專題',
  blue: '藍營傾向媒體',
  green: '綠營傾向媒體',
};

export async function loadRanking(db: Db, category: string, { at }: { at?: Date } = {}) {
  const where = at
    ? and(eq(rankingSnapshots.category, category), sql`${rankingSnapshots.hourStart} <= ${at}`)
    : eq(rankingSnapshots.category, category);
  const [current] = await db.select().from(rankingSnapshots).where(where).orderBy(desc(rankingSnapshots.hourStart)).limit(1);
  if (!current) return null;
  const hours = BURST_STEPS.map(([h]) => new Date(current.hourStart.getTime() - h * 3600e3));
  const olders = await db
    .select({ hourStart: rankingSnapshots.hourStart, computedAt: rankingSnapshots.computedAt, chart: rankingSnapshots.chart })
    .from(rankingSnapshots)
    .where(and(eq(rankingSnapshots.category, category), inArray(rankingSnapshots.hourStart, hours)));
  const history = new Map<number, RankingChart | null>();
  const basis = rankingBasis(category);
  for (const [h] of BURST_STEPS) {
    const row = olders.find((o) => o.hourStart.getTime() === current.hourStart.getTime() - h * 3600e3);
    history.set(h, row ? applyRankingBasis(JSON.parse(row.chart) as RankingChart, basis, row.computedAt) : null);
  }
  const stored = JSON.parse(current.chart) as RankingChart;
  const chart = applyRankingBasis(stored, basis, current.computedAt);
  const entries = chart.available ? computeBurst(chart, history) : [];
  // Score rank a day earlier on the same basis, so the page can flag what is
  // new today versus what merely moved. Unknown when the old chart is missing,
  // on another basis, or truncated below this tag.
  const dayAgo = history.get(24);
  const comparable = dayAgo && dayAgo.available !== false && dayAgo.basis?.id === chart.basis?.id;
  const ranks = new Map(comparable ? dayAgo.entries.filter((e) => !isTagNoise(e.tag)).map((e, i) => [e.tag, i + 1]) : []);
  const compared = entries.map((e) => {
    const rank24h = ranks.get(e.tag) ?? null;
    return {
      ...e,
      rank24h,
      new: Boolean(comparable && dayAgo.truncated === false && rank24h === null),
      signals: discoverySignals(e, comparable ? dayAgo : null, basis.id),
    };
  });
  return {
    snapshot: {
      id: current.id,
      category,
      hourStart: current.hourStart,
      computedAt: current.computedAt,
      weight: effectiveWeight(chart),
      basis,
      available: chart.available,
      articleCount: stored.basis?.id === basis.id ? current.articleCount : null,
      mediaCount: stored.basis?.id === basis.id ? current.mediaCount : null,
      historyAvailable: [...history].filter(([, v]) => v?.available).map(([h]) => h),
    },
    entries: compared,
  };
}

export async function registerV1Routes(app: FastifyInstance, db: Db) {
  app.get('/api/v1/categories', async () =>
    Object.keys(RANKING_CATEGORIES).map((key) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      media: RANKING_CATEGORIES[key].media.length,
    })),
  );
  app.get('/api/v1/media', async () =>
    Object.fromEntries(
      Object.entries(mediaInfo)
        .filter(([k]) => !excludedMedia.has(k))
        .map(([k, v]) => [k, { title: v.title, icon: iconUrl(k), camp: campOf(k) }]),
    ),
  );
  app.get<{
    Querystring: {
      category?: string;
      order?: string;
      gate?: string;
      limit?: string;
      at?: string;
      trend?: string;
      related?: string;
      signals?: string;
      ranks?: string;
    };
  }>('/api/v1/ranking', async (request, reply) => {
    const category = request.query.category ?? 'all';
    if (!RANKING_CATEGORIES[category]) return reply.code(404).send({ error: 'unknown category' });
    const order = request.query.order ?? 'burst';
    if (!['burst', 'score', 'growth'].includes(order)) return reply.code(400).send({ error: 'bad order' });
    const gate = request.query.gate ?? (order === 'growth' ? 'early' : 'all');
    if (!['all', 'early', 'broad'].includes(gate)) return reply.code(400).send({ error: 'bad gate' });
    const limit = Math.min(500, Math.max(1, Math.floor(Number(request.query.limit) || 50)));
    const at = request.query.at ? new Date(request.query.at) : undefined;
    if (at && Number.isNaN(at.getTime())) return reply.code(400).send({ error: 'bad at' });
    const result = await loadRanking(db, category, { at });
    if (!result) return reply.code(404).send({ error: 'no snapshot' });
    const entries = selectDiscoveryEntries(result.entries, order as RankingOrder, gate as RankingGate);
    const selected = entries.slice(0, limit);
    const window = completedHourWindow(new Date(result.snapshot.computedAt), 49);
    const [trends, related, evidence] = await Promise.all([
      request.query.trend === '1'
        ? loadHourlyTrends(
            db,
            selected.map((e) => e.tag),
            RANKING_CATEGORIES[category].media,
            window.from,
            window.to,
            result.snapshot.basis,
          )
        : null,
      request.query.related === '1'
        ? loadRelatedTags(
            db,
            selected.map((e) => e.tag),
            result.snapshot.basis.media,
            new Date(new Date(result.snapshot.computedAt).getTime() - HOURS * 3600e3),
            new Date(result.snapshot.computedAt),
          )
        : null,
      request.query.signals === '1'
        ? loadDiscoveryEvidence(
            db,
            selected.map((e) => e.tag),
            result.snapshot.basis.media,
            new Date(result.snapshot.computedAt.getTime() - HOURS * 3600e3),
            result.snapshot.computedAt,
          )
        : null,
    ]);
    // Existing liveboard trails use the unrestricted burst order.
    const trails =
      request.query.ranks === '1' && order === 'burst'
        ? await loadBurstTrails(db, category, {
            hourStart: new Date(result.snapshot.hourStart),
            computedAt: new Date(result.snapshot.computedAt),
          })
        : null;
    reply.header('cache-control', 'public, max-age=60');
    return {
      ...result,
      order,
      gate,
      matchedCount: entries.length,
      unknownGrowthCount: result.entries.filter(
        (e) => e.signals.growth === null && (gate === 'all' || e.signals[gate as 'early' | 'broad']),
      ).length,
      entries: selected.map((e, i) => ({
        ...e,
        position: i + 1,
        ...(trends ? { trend: trends.get(e.tag) } : {}),
        ...(related ? { related: related.get(e.tag) ?? [] } : {}),
        ...(evidence?.get(e.tag) ?? {}),
        ...(trails ? { rankTrail: trails.get(e.tag) ?? [] } : {}),
      })),
    };
  });
  app.get<{ Params: { tag: string }; Querystring: { hours?: string; limit?: string } }>(
    '/api/v1/tags/:tag/articles',
    async (request, reply) => {
      const tag = request.params.tag.slice(0, 60);
      const hours = Math.min(24 * 14, Math.max(1, Number(request.query.hours) || 48));
      const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 60));
      const since = new Date(Date.now() - hours * 3600e3);
      const rows = await db
        .select({
          id: articles.id,
          media: articles.media,
          title: articles.title,
          url: articles.url,
          image: articles.image,
          publishedAt: articles.publishedAt,
          tags: articles.tags,
        })
        .from(articleTags)
        .innerJoin(articles, eq(articles.id, articleTags.articleId))
        .where(and(eq(articleTags.tag, tag), gte(articleTags.publishedAt, since)))
        .orderBy(desc(articleTags.publishedAt))
        .limit(limit);
      reply.header('cache-control', 'public, max-age=60');
      return { tag, hours, articles: rows.map((r) => ({ ...r, mediaTitle: mediaInfo[r.media]?.title ?? r.media })) };
    },
  );
  registerTagSeries(app, db);

  // Which other keywords rode along with this one, hour by hour.
  registerTagFlow(app, db);

  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/status', async (request, reply) => {
    const tag = request.params.tag.slice(0, 60);
    const ranking = await loadRanking(db, 'news');
    // Ranking entries are already burst-ordered, so the index is the position.
    reply.header('cache-control', 'public, max-age=60');
    return loadTagStatus(db, tag, ranking);
  });

  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/stats', async (request, reply) => {
    const tag = request.params.tag.slice(0, 60);
    const rows = await db.select().from(tagStats).where(eq(tagStats.tag, tag)).orderBy(desc(tagStats.lastHour));
    reply.header('cache-control', 'public, max-age=300');
    return {
      tag,
      stats: rows.map((r) => ({
        category: r.category,
        level: r.level,
        firstHour: r.firstHour,
        lastHour: r.lastHour,
        hoursCount: r.hoursCount,
        maxHour: r.maxHour,
        maxCount: r.maxCount,
      })),
    };
  });
  app.get<{ Params: { id: string } }>('/api/v1/events/threads/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return reply.code(400).send({ error: 'bad id' });
    const [thread] = await db.select().from(eventThreads).where(eq(eventThreads.id, id)).limit(1);
    if (!thread) return reply.code(404).send({ error: 'not found' });
    const rows = await db
      .select({
        rank: events.rank,
        score: events.score,
        tags: events.tags,
        major: events.major,
        news: events.news,
        majorNews: events.majorNews,
        hourStart: eventSnapshots.hourStart,
      })
      .from(events)
      .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
      .where(eq(events.threadId, id))
      .orderBy(desc(eventSnapshots.hourStart))
      // Two weeks of hours, so the page can read a long story day by day.
      .limit(24 * 14);
    const related = [...new Set([...thread.combinedFrom, ...thread.combinedTo])];
    reply.header('cache-control', 'public, max-age=120');
    return {
      thread: { ...thread, maxScore: thread.maxScore / 1e6 },
      related,
      hours: rows.map((r) => ({
        hourStart: r.hourStart,
        rank: r.rank,
        score: r.score / 1e6,
        major: r.major,
        tags: r.tags.slice(0, 12),
        news: (r.majorNews.length ? r.majorNews : r.news).slice(0, 6),
      })),
    };
  });

  // Hourly trend of the thread's major tags, with a margin before and after it.
  app.get<{ Params: { id: string } }>('/api/v1/events/threads/:id/series', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return reply.code(400).send({ error: 'bad id' });
    const [thread] = await db
      .select({ majorTags: eventThreads.majorTags, firstTime: eventThreads.firstTime, lastTime: eventThreads.lastTime })
      .from(eventThreads)
      .where(eq(eventThreads.id, id))
      .limit(1);
    if (!thread) return reply.code(404).send({ error: 'not found' });
    reply.header('cache-control', 'public, max-age=300');
    return { threadId: id, ...(await threadSeries(db, thread)) };
  });

  // Archive: every event thread active on one Taipei day (default: today).
  app.get<{ Querystring: { day?: string } }>('/api/v1/events/threads', async (request, reply) => {
    const day = request.query.day ?? taipeiDay(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return reply.code(400).send({ error: 'bad day' });
    reply.header('cache-control', day === taipeiDay(new Date()) ? 'public, max-age=120' : 'public, max-age=1800');
    return threadsOnDay(db, 'news', day);
  });

  // The main threads of the last 1, 7 or 31 days, for the 最新文章 listing.
  app.get<{ Querystring: { days?: string; limit?: string } }>('/api/v1/events/threads/period', async (request, reply) => {
    const days = Number(request.query.days ?? 1);
    if (!(PERIOD_DAYS as readonly number[]).includes(days)) return reply.code(400).send({ error: 'bad days' });
    const limit = Math.min(12, Math.max(1, Math.floor(Number(request.query.limit) || 6)));
    reply.header('cache-control', `public, max-age=${days === 1 ? 300 : 1800}`);
    return threadsInPeriod(db, 'news', days, limit);
  });

  // Same event, different headlines: every report carrying the thread's major
  // tags, grouped by outlet and by camp (藍／綠／其他) for side-by-side comparison.
  app.get<{ Params: { id: string } }>('/api/v1/events/threads/:id/coverage', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return reply.code(400).send({ error: 'bad id' });
    const [thread] = await db
      .select({
        id: eventThreads.id,
        majorTags: eventThreads.majorTags,
        firstTime: eventThreads.firstTime,
        lastTime: eventThreads.lastTime,
      })
      .from(eventThreads)
      .where(eq(eventThreads.id, id))
      .limit(1);
    if (!thread) return reply.code(404).send({ error: 'not found' });
    reply.header('cache-control', 'public, max-age=120');
    return { threadId: thread.id, ...(await loadThreadCoverage(db, thread)) };
  });

  // Per-media view (legacy /media/<media>/): that media's articles in the last
  // 24h, its top tags by count, and where it sits in the global ranking.
  app.get<{ Params: { media: string }; Querystring: { hours?: string } }>('/api/v1/media/:media', async (request, reply) => {
    const media = request.params.media.slice(0, 32);
    if (!mediaInfo[media] || excludedMedia.has(media)) return reply.code(404).send({ error: 'unknown media' });
    const hours = Math.min(168, Math.max(1, Number(request.query.hours) || 24));
    const since = new Date(Date.now() - hours * 3600e3);
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        image: articles.image,
        publishedAt: articles.publishedAt,
        tags: articles.tags,
      })
      .from(articles)
      .where(and(eq(articles.media, media), gte(articles.publishedAt, since), sql`${articles.title} <> ''`))
      .orderBy(desc(articles.publishedAt))
      .limit(200);
    const count = new Map<string, number>();
    for (const r of rows) for (const t of new Set(r.tags)) count.set(t, (count.get(t) ?? 0) + 1);
    const topTags = [...count]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([tag, n]) => ({ tag, count: n }));
    reply.header('cache-control', 'public, max-age=120');
    return {
      media,
      title: mediaInfo[media]?.title ?? media,
      icon: iconUrl(media),
      hours,
      articleCount: rows.length,
      topTags,
      articles: rows.slice(0, 60),
    };
  });
}

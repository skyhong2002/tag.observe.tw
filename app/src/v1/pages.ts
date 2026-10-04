import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import { topicStatus } from '../crawl/topic-kind.ts';
import { TOPIC_RULES, type TopicKind } from '../crawl/topics.ts';
import type { Db } from '../db/client.ts';
import { eventHours, latestEvents } from '../jobs/events-job.ts';
import { matchTopics, topicCoverage, topicTagger, topicTagSummary } from '../jobs/topic-related.ts';
import {
  allTopLevelTopics,
  firstRunPerMedia,
  latestTopicPerMedia,
  latestTopics,
  topicChildrenOf,
  topicCountPerMedia,
  topicSourceChecks,
} from '../jobs/topics-job.ts';
import { campOf } from './coverage.ts';
import { campBaseline, eventsAt, feedCoverage, hourStats, hoursSoFar, matchPrevRank, rankTrail, threadInfo } from './event-feed.ts';
import { iconUrl } from './icons.ts';

const mediaInfo = catalog as unknown as Record<string, { icon: string | null; title: string | null }>;
const TOPIC_MEDIA = TOPIC_RULES.map((r) => r.media);
const TOPIC_LINKS = Object.fromEntries(TOPIC_RULES.map((r) => [r.media, r.url]));
const TOPIC_NAMES = Object.fromEntries(TOPIC_RULES.map((r) => [r.media, r.name]));
const TOPIC_IMAGES = Object.fromEntries(TOPIC_RULES.map((r) => [r.media, r.fallbackImage]));
// Events are recomputed at :04 and :34; older than this means the worker is behind.
const EVENTS_FRESH_MS = 3 * 3600e3;

type TopicsQuery = { media?: string; limit?: string; per?: string; kind?: string; tag?: string; q?: string };

export function registerPageApis(app: FastifyInstance, db: Db) {
  app.get<{ Querystring: { limit?: string; at?: string } }>('/api/v1/events', async (request, reply) => {
    const limit = Math.min(30, Math.max(1, Number(request.query.limit) || 30));
    const at = request.query.at ? new Date(request.query.at) : undefined;
    if (at && Number.isNaN(at.getTime())) return reply.code(400).send({ error: 'bad at' });
    const latest = await latestEvents(db, 'news', limit, at);
    if (!latest) return reply.code(at ? 404 : 503).send({ error: 'no event snapshot' });
    const hour = latest.snapshot.hourStart;
    const nav = await eventHours(db, 'news', hour);
    const threadIds = latest.events.flatMap((e) => (e.threadId ? [e.threadId] : []));
    const baseline = await campBaseline(db, hour);
    const [coverage, prevEvents, threads, hours, dayStats, trails] = await Promise.all([
      feedCoverage(
        db,
        hour,
        latest.events.map((e) => e.major),
        baseline,
      ),
      eventsAt(db, 'news', nav.prev),
      threadInfo(db, threadIds),
      hoursSoFar(db, 'news', threadIds, hour),
      hourStats(db, 'news', nav.day),
      rankTrail(db, 'news', threadIds, hour),
    ]);
    // An archived hour is not stale, just old.
    const stale = !nav.next && Date.now() - hour.getTime() > EVENTS_FRESH_MS;
    reply.header('cache-control', stale || !nav.next ? 'public, max-age=60' : 'public, max-age=600');
    return {
      hour: hour.toISOString(),
      builtAt: latest.snapshot.computedAt.toISOString(),
      stale,
      prev: nav.prev?.toISOString() ?? null,
      next: nav.next?.toISOString() ?? null,
      dayHours: nav.day.map((d) => d.toISOString()),
      dayStats,
      baseline,
      events: latest.events.map((e, i) => {
        const thread = e.threadId ? threads.get(e.threadId) : undefined;
        return {
          rank: e.rank,
          score: e.score / 1e6,
          major: e.major,
          tags: e.tags.slice(0, 12).map(([tag, burst]) => ({ tag, burst })),
          news: (e.majorNews.length ? e.majorNews : e.news)
            .slice(0, 6)
            .map((n) => ({ id: n.id ?? null, media: n.media, camp: campOf(n.media), title: n.title, url: n.url, image: n.image })),
          relatedEventPk: e.threadId ? String(e.threadId) : null,
          threadId: e.threadId,
          // null when the story was not on the previous snapshot (new this hour).
          prevRank: matchPrevRank(e, prevEvents),
          hours: e.threadId ? (hours.get(e.threadId) ?? null) : null,
          rankTrail: e.threadId ? (trails.get(e.threadId) ?? null) : null,
          firstTime: thread?.firstTime.toISOString() ?? null,
          coverage: coverage[i],
        };
      }),
    };
  });

  app.get<{ Querystring: TopicsQuery }>('/api/v1/topics', async (request, reply) => {
    const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 20));
    const media = request.query.media;
    const tag = request.query.tag?.trim() || undefined;
    const q = request.query.q?.trim().slice(0, 50) || undefined;
    // 議題 (topic, the default) and 專題 (feature) are separate lists.
    const kind = (request.query.kind ?? 'topic') as TopicKind;
    if (kind !== 'topic' && kind !== 'feature') return reply.code(400).send({ error: 'bad kind' });
    // Topics stored in an outlet's first crawl run were already listed when
    // tracking began: their time is when we started watching, not a start date.
    // Newer rows carry their own backlog flag (a newly added listing or page).
    const run = (d: Date) => Math.floor(+d / 900e3);
    const now = new Date();
    const [firstRun, checks, allCounts, tagsOf] = await Promise.all([
      firstRunPerMedia(db),
      topicSourceChecks(db),
      topicCountPerMedia(db),
      topicTagger(db),
    ]);
    const counts = (m: string) => allCounts[m] ?? { topic: 0, feature: 0 };
    const fmt = (r: {
      id: number;
      media: string;
      firstSeen: Date;
      title: string;
      url: string;
      image: string | null;
      kind: string;
      backlog: boolean;
      sponsored: boolean;
      parentId: number | null;
      storyLastAt: Date | null;
      storyCount: number | null;
    }) => ({
      id: String(r.id),
      time: r.firstSeen.toISOString(),
      backlog: r.backlog || (!!firstRun[r.media] && run(r.firstSeen) === run(firstRun[r.media])),
      title: r.title,
      url: r.url,
      image: r.image,
      kind: r.kind as TopicKind,
      status: topicStatus(r.kind, r.storyLastAt, now),
      sponsored: !!r.sponsored,
      parentId: r.parentId,
      storyLastAt: r.storyLastAt?.toISOString() ?? null,
      storyCount: r.storyCount,
      // Keywords of the name itself, whether or not anything was published on it lately.
      tags: tagsOf(r.title),
    });
    // Recent coverage of each topic across every crawled outlet.
    const withCoverage = async <T extends { id: string; title: string }>(items: T[]) => {
      const coverage = await topicCoverage(
        db,
        items.map((f) => ({ title: f.title, id: f.id })),
      );
      return items.map((f) => {
        const c = coverage.get(f.title);
        return {
          ...f,
          coverage: c ? { ...c, latest: c.latest.map((l) => ({ ...l, mediaTitle: mediaInfo[l.media]?.title ?? l.media })) } : null,
        };
      });
    };
    const info = (m: string) => ({
      media: m,
      title: mediaInfo[m]?.title ?? TOPIC_NAMES[m] ?? m,
      icon: iconUrl(m),
    });
    // Every top-level 議題 and 專題 across outlets, both kinds: the keyword
    // summary over the live ones, and the tag / title search.
    const everything = async () =>
      (await allTopLevelTopics(db))
        .filter((r) => TOPIC_MEDIA.includes(r.media))
        .map((r) => ({ ...fmt(r), media: r.media, firstSeen: r.firstSeen }));
    const summary = (all: Awaited<ReturnType<typeof everything>>) => topicTagSummary(all.filter((t) => t.status !== 'ended'));
    reply.header('cache-control', 'public, max-age=300');
    if (!media && (tag || q)) {
      const all = await everything();
      const hits = matchTopics(all, { tag, q }, TOPIC_MEDIA);
      const max = Math.min(500, Math.max(1, Number(request.query.limit) || 300));
      return {
        tag: tag ?? null,
        q: q ?? null,
        total: hits.length,
        mediaCount: new Set(hits.map((h) => h.media)).size,
        counts: { topic: hits.filter((h) => h.kind === 'topic').length, feature: hits.filter((h) => h.kind === 'feature').length },
        topics: hits.slice(0, max).map(({ firstSeen: _, ...t }) => ({ ...t, mediaTitle: info(t.media).title, icon: info(t.media).icon })),
        tags: summary(all),
      };
    }
    if (media) {
      if (!TOPIC_MEDIA.includes(media)) return reply.code(404).send({ error: 'unknown media' });
      // Sub-topics are listed under their parent, not on their own.
      const rows = await latestTopics(db, media, limit, kind, { topLevel: true });
      const children = await topicChildrenOf(
        db,
        rows.map((r) => r.id),
      );
      const items = await withCoverage(rows.map(fmt));
      return {
        media,
        kind,
        title: mediaInfo[media]?.title ?? TOPIC_NAMES[media] ?? media,
        link: TOPIC_LINKS[media],
        mediaImage: TOPIC_IMAGES[media],
        check: checks[media],
        count: counts(media)[kind],
        counts: counts(media),
        topics: items.map((t) => ({ ...t, children: children.filter((c) => String(c.parentId) === t.id).map(fmt) })),
      };
    }
    const per = Math.min(10, Math.max(1, Number(request.query.per) || 4));
    const feedSize = Math.min(120, Math.max(1, Number(request.query.limit) || 60));
    const [recent, all] = await Promise.all([latestTopicPerMedia(db, Math.max(per, 12), kind), everything()]);
    // One list across outlets, newest first; backlog and 已停更 are left out. A crawl run stores
    // every outlet within a minute or two, so topics from the same run (same
    // 15-minute bucket) are interleaved by their position on each outlet's
    // listing (every outlet's 1st, then every 2nd…) instead of outlet by outlet.
    const feed = TOPIC_MEDIA.flatMap((m, order) =>
      recent[m].map((r, i) => ({
        r,
        m,
        order,
        t: run(r.firstSeen),
        rank: i - recent[m].findIndex((x) => run(x.firstSeen) === run(r.firstSeen)),
      })),
    )
      .filter(({ r }) => {
        const f = fmt(r);
        return !f.backlog && f.status !== 'ended';
      })
      .sort((a, b) => b.t - a.t || a.rank - b.rank || a.order - b.order)
      .slice(0, feedSize)
      .map(({ r, m }) => ({ ...fmt(r), media: m, mediaTitle: info(m).title, icon: info(m).icon, mediaImage: TOPIC_IMAGES[m] }));
    return {
      kind,
      media: TOPIC_MEDIA.map((m) => ({
        ...info(m),
        link: TOPIC_LINKS[m],
        check: checks[m],
        count: counts(m)[kind],
        counts: counts(m),
        latest: recent[m][0] ? fmt(recent[m][0]) : null,
        recent: recent[m].slice(0, per).map(fmt),
      })),
      feed: await withCoverage(feed),
      tags: summary(all),
    };
  });
}

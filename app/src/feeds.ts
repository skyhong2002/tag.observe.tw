import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../data/favicon-catalog.json' with { type: 'json' };
import { allSources, disabled } from './crawl/registry.ts';
import { TOPIC_RULES } from './crawl/topics.ts';
import type { Db } from './db/client.ts';
import { articles, articleTags, events, eventThreads, tagStats } from './db/schema.ts';
import { topicCountPerMedia } from './jobs/topics-job.ts';

// Crawler-facing files: robots.txt, sitemap.xml, and RSS 2.0 feeds for new
// events (/feeds/events.xml) and for one tag (/feeds/tag/<tag>.xml). Feeds
// carry headlines and links only, never article text.

const ORIGIN = 'https://tag.observe.tw';
const SITE = '新文易數';
const HOUR = 3600e3;
const mediaInfo = catalog as unknown as Record<string, { title: string | null }>;
const mediaTitle = (m: string) => mediaInfo[m]?.title ?? m;

// Events that reached this rank in some hour make the feed: lower ones are
// mostly single-outlet noise.
export const FEED_EVENT_RANK = 10;
const FEED_EVENT_HOURS = 72;
const FEED_TAG_DAYS = 7;
const SITEMAP_DAYS = 30;

// XML 1.0 forbids most control characters; headlines occasionally carry them.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;
export const xml = (s: string) =>
  s
    .replace(CONTROL, '')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);

export const robotsTxt = () =>
  [
    'User-agent: *',
    'Allow: /',
    // JSON endpoints are for programs (docs at /api/); every page they back is crawlable.
    'Disallow: /api/v',
    'Disallow: /_migration/',
    'Disallow: /demo/',
    // An always-on screen for a wall tablet, not a page for readers.
    'Disallow: /liveboard/',
    // A signed-in reader's own pages and private feeds.
    'Disallow: /my/',
    'Disallow: /feeds/u/',
    '',
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');

export interface SitemapUrl {
  loc: string;
  lastmod?: Date | null;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly';
  priority?: number;
}
export function renderSitemap(urls: SitemapUrl[]) {
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${xml(ORIGIN + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ''}${
          u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''
        }${u.priority !== undefined ? `<priority>${u.priority.toFixed(1)}</priority>` : ''}</url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export interface FeedItem {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
  description: string;
  categories?: string[];
}
export function renderRss(channel: { title: string; link: string; self: string; description: string }, items: FeedItem[]) {
  const updated = items.reduce<Date | null>((a, i) => (!a || i.pubDate > a ? i.pubDate : a), null) ?? new Date();
  const body = items
    .map((i) =>
      [
        '    <item>',
        `      <title>${xml(i.title)}</title>`,
        `      <link>${xml(i.link)}</link>`,
        `      <guid isPermaLink="false">${xml(i.guid)}</guid>`,
        `      <pubDate>${i.pubDate.toUTCString()}</pubDate>`,
        ...(i.categories ?? []).map((c) => `      <category>${xml(c)}</category>`),
        `      <description>${xml(i.description)}</description>`,
        '    </item>',
      ].join('\n'),
    )
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xml(channel.title)}</title>`,
    `    <link>${xml(channel.link)}</link>`,
    `    <atom:link href="${xml(channel.self)}" rel="self" type="application/rss+xml" />`,
    `    <description>${xml(channel.description)}</description>`,
    '    <language>zh-TW</language>',
    `    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>`,
    '    <ttl>30</ttl>',
    body,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n')
    .concat('\n');
}

type Headline = { title: string; url: string; media: string };
// Descriptions are HTML (escaped once more by renderRss), as RSS readers expect.
const headlineList = (news: Headline[]) =>
  `<ul>${news.map((n) => `<li><a href="${xml(n.url)}">【${xml(mediaTitle(n.media))}】${xml(n.title)}</a></li>`).join('')}</ul>`;

export async function eventFeedItems(db: Db, now = new Date()): Promise<FeedItem[]> {
  const threads = await db
    .select({
      id: eventThreads.id,
      firstTime: eventThreads.firstTime,
      majorTags: eventThreads.majorTags,
      maxTag: eventThreads.maxTag,
    })
    .from(eventThreads)
    .where(and(eq(eventThreads.category, 'news'), gte(eventThreads.lastTime, new Date(now.getTime() - FEED_EVENT_HOURS * HOUR))))
    .orderBy(desc(eventThreads.firstTime))
    .limit(200);
  if (!threads.length) return [];
  const best = new Map<number, { rank: number; news: Headline[] }>();
  const rows = await db
    .select({ threadId: events.threadId, rank: events.rank, news: events.news, majorNews: events.majorNews })
    .from(events)
    .where(
      inArray(
        events.threadId,
        threads.map((t) => t.id),
      ),
    );
  for (const r of rows) {
    const cur = best.get(r.threadId as number);
    if (!cur || r.rank < cur.rank)
      best.set(r.threadId as number, { rank: r.rank, news: (r.majorNews.length ? r.majorNews : r.news).slice(0, 6) });
  }
  return threads
    .filter((t) => (best.get(t.id)?.rank ?? Infinity) <= FEED_EVENT_RANK)
    .slice(0, 50)
    .map((t) => {
      const b = best.get(t.id) as { rank: number; news: Headline[] };
      const tags = t.majorTags.length ? t.majorTags : t.maxTag ? [t.maxTag] : [];
      const lead = b.news[0]?.title;
      return {
        title: [tags.join('、'), lead].filter(Boolean).join('：') || `事件 ${t.id}`,
        link: `${ORIGIN}/eve/${t.id}/`,
        guid: `${ORIGIN}/eve/${t.id}/`,
        pubDate: t.firstTime,
        categories: tags,
        description: `${headlineList(b.news)}<p><a href="${ORIGIN}/eve/${t.id}/">看各家標題對照</a></p>`,
      };
    });
}

export async function tagFeedItems(db: Db, tag: string, now = new Date()): Promise<FeedItem[]> {
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      tags: articles.tags,
    })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(eq(articleTags.tag, tag), gte(articleTags.publishedAt, new Date(now.getTime() - FEED_TAG_DAYS * 24 * HOUR))))
    .orderBy(desc(articleTags.publishedAt))
    .limit(50);
  return rows
    .filter((r) => r.title)
    .map((r) => ({
      title: `【${mediaTitle(r.media)}】${r.title}`,
      link: r.url,
      guid: `${ORIGIN}/article/${r.id}`,
      pubDate: r.publishedAt,
      categories: r.tags.slice(0, 10),
      description: xml(`${mediaTitle(r.media)}　標籤：${r.tags.join('、')}`),
    }));
}

export async function sitemapUrls(db: Db, now = new Date()): Promise<SitemapUrl[]> {
  const since = new Date(now.getTime() - SITEMAP_DAYS * 24 * HOUR);
  const [threads, tags] = await Promise.all([
    db
      .select({ id: eventThreads.id, lastTime: eventThreads.lastTime })
      .from(eventThreads)
      .where(and(eq(eventThreads.category, 'news'), gte(eventThreads.lastTime, since), gte(eventThreads.hours, 2)))
      .orderBy(desc(eventThreads.lastTime))
      .limit(5000),
    // Level 3 = several outlets each repeating the tag: real subjects, not one-off keywords.
    db
      .select({ tag: tagStats.tag, lastHour: tagStats.lastHour })
      .from(tagStats)
      .where(and(eq(tagStats.category, 'news'), eq(tagStats.level, 3), gte(tagStats.lastHour, since)))
      .orderBy(desc(tagStats.hoursCount))
      .limit(5000),
  ]);
  const off = new Set(disabled());
  // 專題 pages only for outlets that have at least one.
  const topicCounts = await topicCountPerMedia(db);
  const topicMedia = [...new Set(TOPIC_RULES.map((r) => r.media))].filter((m) => (topicCounts[m]?.topic ?? 0) > 0);
  const featureMedia = [...new Set(TOPIC_RULES.map((r) => r.media))].filter((m) => (topicCounts[m]?.feature ?? 0) > 0);
  return [
    { loc: '/', changefreq: 'hourly', priority: 1 },
    { loc: '/observe/', changefreq: 'daily', priority: 0.3 },
    { loc: '/ranking/', changefreq: 'hourly', priority: 0.9 },
    { loc: '/article/', changefreq: 'hourly', priority: 0.8 },
    { loc: '/event/', changefreq: 'hourly', priority: 0.9 },
    { loc: '/event/archive/', changefreq: 'hourly', priority: 0.6 },
    { loc: '/topic/', changefreq: 'hourly', priority: 0.7 },
    { loc: '/feature/', changefreq: 'daily', priority: 0.6 },
    { loc: '/media/', changefreq: 'daily', priority: 0.5 },
    { loc: '/similarity/', changefreq: 'hourly', priority: 0.7 },
    { loc: '/similarity/daily/', changefreq: 'daily', priority: 0.6 },
    { loc: '/similarity/about/', changefreq: 'weekly', priority: 0.3 },
    { loc: '/journalist/', changefreq: 'hourly', priority: 0.6 },
    { loc: '/media/traffic/', changefreq: 'weekly', priority: 0.5 },
    { loc: '/api/', changefreq: 'weekly', priority: 0.3 },
    { loc: '/method/', changefreq: 'weekly', priority: 0.3 },
    ...threads.map((t): SitemapUrl => ({ loc: `/eve/${t.id}/`, lastmod: t.lastTime, priority: 0.7 })),
    ...tags.map((t): SitemapUrl => ({ loc: `/tag/${encodeURIComponent(t.tag)}/`, lastmod: t.lastHour, priority: 0.6 })),
    ...topicMedia.map((m): SitemapUrl => ({ loc: `/topic/${m}/`, changefreq: 'daily', priority: 0.4 })),
    ...featureMedia.map((m): SitemapUrl => ({ loc: `/feature/${m}/`, changefreq: 'weekly', priority: 0.3 })),
    ...[...new Set(allSources().map((s) => s.media))]
      .filter((m) => !off.has(m))
      .map((m): SitemapUrl => ({ loc: `/media/${m}/`, changefreq: 'hourly', priority: 0.4 })),
  ];
}

export function registerFeeds(app: FastifyInstance, db: Db | null) {
  app.get('/robots.txt', async (_request, reply) =>
    reply.header('cache-control', 'public, max-age=86400').type('text/plain; charset=utf-8').send(robotsTxt()),
  );
  if (!db) return;
  app.get('/sitemap.xml', async (_request, reply) =>
    reply
      .header('cache-control', 'public, max-age=3600')
      .type('application/xml; charset=utf-8')
      .send(renderSitemap(await sitemapUrls(db))),
  );
  app.get('/feeds/events.xml', async (_request, reply) =>
    reply
      .header('cache-control', 'public, max-age=600')
      .type('application/rss+xml; charset=utf-8')
      .send(
        renderRss(
          {
            title: `${SITE}｜新聞事件`,
            link: `${ORIGIN}/event/`,
            self: `${ORIGIN}/feeds/events.xml`,
            description: `台灣各家媒體同時報導的新聞事件（曾進入每小時前 ${FEED_EVENT_RANK} 名），附代表標題與藍綠標題對照頁。`,
          },
          await eventFeedItems(db),
        ),
      ),
  );
  app.get<{ Params: { file: string } }>('/feeds/tag/:file', async (request, reply) => {
    const m = /^(.+)\.xml$/.exec(request.params.file);
    const tag = m?.[1].trim().slice(0, 60);
    if (!tag) return reply.code(404).type('text/plain; charset=utf-8').send('Not Found\n');
    const path = `/feeds/tag/${encodeURIComponent(tag)}.xml`;
    return reply
      .header('cache-control', 'public, max-age=600')
      .type('application/rss+xml; charset=utf-8')
      .send(
        renderRss(
          {
            title: `${SITE}｜${tag}`,
            link: `${ORIGIN}/tag/${encodeURIComponent(tag)}/`,
            self: ORIGIN + path,
            description: `各家媒體帶有「${tag}」標籤的最新報導（近 ${FEED_TAG_DAYS} 天）。`,
          },
          await tagFeedItems(db, tag),
        ),
      );
  });
}

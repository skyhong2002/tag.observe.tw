// End-to-end against a real MariaDB (TEST_DB_URL; CI uses a service container).
// Covers: index dedupe by url_key, article stage with title fallback, ranking,
// retention. Never point TEST_DB_URL at the production database: tables are truncated.
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FetchResult } from '../src/crawl/fetch.ts';
import { runArticles, runIndex } from '../src/crawl/pipeline.ts';
import type { SourceSpec } from '../src/crawl/sources.ts';
import { loadTitleVocab } from '../src/crawl/title-tags.ts';
import { measureTrafficCoverage } from '../src/crawl/traffic-coverage.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { articles, articleTags, jobRuns, rankingEntries, rankingSnapshots } from '../src/db/schema.ts';
import { runRankingJob } from '../src/jobs/ranking-job.ts';
import { runRetentionJob } from '../src/jobs/retention-job.ts';
import { loadSimilarity } from '../src/v1/similarity.ts';

const url = process.env.TEST_DB_URL;
const TABLES = [
  'article_tags',
  'articles',
  'ranking_entries',
  'ranking_snapshots',
  'job_runs',
  'crawl_runs',
  'events',
  'event_snapshots',
  'event_threads',
  'topics',
  'tag_stats',
  'source_probes',
  'rejected_urls',
];
const res = (u: string, body: string, status = 200): FetchResult => ({ url: u, status, body, contentType: 'text/html', ms: 1 });
const now = new Date();
const iso = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600e3).toUTCString();

describe.skipIf(!url)('integration (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of TABLES) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
  });
  afterAll(async () => {
    await close?.();
  });

  const spec: SourceSpec = {
    media: 'setn',
    group: 'news',
    list: { urls: [{ cat: 'news', url: 'https://www.setn.com/rss.xml' }] },
    article: { enabled: false, batch: 20, delayMs: 0 },
  };
  const feed = (scheme: string) => `<rss><channel>
    <item><title>川普與習近平會面</title><link>${scheme}://www.setn.com/News.aspx?NewsID=1&amp;utm_source=rss</link><pubDate>${iso(1)}</pubDate><category>川普</category><category>習近平</category></item>
    <item><title>川普談關稅</title><link>${scheme}://www.setn.com/News.aspx?NewsID=2</link><pubDate>${iso(2)}</pubDate><category>川普</category><category>關稅</category></item>
    <item><title>川普再談關稅與習近平</title><link>${scheme}://www.setn.com/News.aspx?NewsID=3</link><pubDate>${iso(3)}</pubDate><category>川普</category></item>
    <item><title>沒有標籤的川普關稅新聞</title><link>${scheme}://www.setn.com/News.aspx?NewsID=4</link><pubDate>${iso(1)}</pubDate></item>
  </channel></rss>`;

  it('indexes a feed and dedupes scheme/tracking variants by url_key', async () => {
    const first = await runIndex(db, spec, { fetch: async (u: string) => res(u, feed('https')) });
    expect(first.inserted).toBe(4);
    const again = await runIndex(db, spec, { fetch: async (u: string) => res(u, feed('http')) });
    expect(again.inserted).toBe(0);
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(articles);
    expect(Number(n)).toBe(4);
    const [{ t }] = await db.select({ t: sql<number>`COUNT(*)` }).from(articleTags);
    expect(Number(t)).toBe(5); // 川普+習近平, 川普+關稅, 川普
  });

  it('fetches untagged articles and tags them from the title when the page has no keywords', async () => {
    const vocab = await loadTitleVocab(db, { minArticles: 1, minShort: 1 });
    const body = Array.from({ length: 50 }, (_, i) => `第${i}項地方採訪報導指出公共建設應公開招標並邀請居民討論。`).join('');
    const page = `<html><head><meta property="og:image" content="https://attach.setn.com/x.jpg"><meta name="author" content="王記者"></head><body><article><p>根據路透社報導，當局公布新政策。</p><p>${body}</p></article></body></html>`;
    const r = await runArticles(db, spec, { fetch: async (u: string) => res(u, page), vocab, limit: 10 });
    expect(r.fetched).toBe(4); // body extraction includes already-tagged feed articles
    const [row] = await db
      .select({
        tags: articles.tags,
        status: articles.fetchStatus,
        image: articles.image,
        body: articles.body,
        authors: articles.authors,
        bodyStatus: articles.bodyStatus,
        attributions: articles.attributions,
      })
      .from(articles)
      .where(sql`${articles.title} = '沒有標籤的川普關稅新聞'`);
    expect(row.status).toBe('title');
    expect(row.tags).toEqual(expect.arrayContaining(['川普', '關稅']));
    expect(row.image).toBe('https://attach.setn.com/x.jpg');
    expect(row.body).toContain(body);
    expect(row.bodyStatus).toBe('ok');
    expect(row.authors).toEqual(['王記者']);
    expect(row.attributions).toEqual([expect.objectContaining({ media: 'reuters', countryCode: 'GB' })]);
    expect(
      (
        await runArticles(db, spec, {
          fetch: async () => {
            throw Error('already stored: must not refetch');
          },
        })
      ).fetched,
    ).toBe(0);
  });

  it('computes a ranking snapshot from own articles', async () => {
    await runRankingJob({ db }, ['all']);
    const [snap] = await db.select().from(rankingSnapshots);
    expect(snap.articleCount).toBe(4);
    const top = await db
      .select({ tag: rankingEntries.tag, count: rankingEntries.count })
      .from(rankingEntries)
      .orderBy(rankingEntries.rank)
      .limit(1);
    expect(top[0]).toEqual({ tag: '川普', count: 4 });
  });

  it('indexes plain sitemaps without titles, keeps only recent dated entries, and fills titles from the page', async () => {
    const edh: SourceSpec = {
      media: 'edh',
      group: 'hourly',
      list: { urls: [{ cat: 'news', url: 'https://edh.tw/sitemap.xml' }] },
      article: { enabled: false, batch: 20, delayMs: 0 },
    };
    const lastmod = (h: number) => new Date(now.getTime() - h * 3600e3).toISOString();
    const sitemap = `<urlset>
      <url><loc>https://edh.tw/</loc><lastmod>${lastmod(1)}</lastmod></url>
      <url><loc>https://edh.tw/articles/new1</loc><lastmod>${lastmod(2)}</lastmod></url>
      <url><loc>https://edh.tw/articles/old1</loc><lastmod>2021-01-01T00:00:00Z</lastmod></url>
      <url><loc>https://edh.tw/articles/undated</loc></url>
    </urlset>`;
    const r = await runIndex(db, edh, { fetch: async (u: string) => res(u, sitemap) });
    expect(r.inserted).toBe(1);
    const page =
      '<html><head><meta property="og:title" content="健康新聞標題"><meta name="keywords" content="健康,飲食"><meta property="article:published_time" content="2026-09-20T08:00:00+08:00"></head></html>';
    await runArticles(db, edh, { fetch: async (u: string) => res(u, page), limit: 10 });
    const [row] = await db
      .select({ title: articles.title, tags: articles.tags, publishedAt: articles.publishedAt })
      .from(articles)
      .where(sql`${articles.media} = 'edh'`);
    // lastmod is not a publish date: the page's article:published_time wins.
    expect(row).toEqual({ title: '健康新聞標題', tags: ['健康', '飲食'], publishedAt: new Date('2026-09-20T00:00:00Z') });
    const tagTimes = await db
      .selectDistinct({ publishedAt: articleTags.publishedAt })
      .from(articleTags)
      .innerJoin(articles, sql`${articles.id} = ${articleTags.articleId}`)
      .where(sql`${articles.media} = 'edh'`);
    expect(tagTimes).toEqual([{ publishedAt: new Date('2026-09-20T00:00:00Z') }]);
  });

  it('stops on HTTP 429 and bounds HTTP/content retries to three attempts', async () => {
    const ch: SourceSpec = {
      media: 'commonhealth',
      group: 'hourly',
      list: { urls: [{ cat: 'news', url: 'https://www.commonhealth.com.tw/sitemap.xml' }] },
      article: { enabled: true, batch: 20, delayMs: 0 },
    };
    await db.insert(articles).values(
      [1, 2, 3].map((i) => ({
        media: 'commonhealth',
        publishedAt: now,
        crawledAt: now,
        url: `https://www.commonhealth.com.tw/article/${i}`,
        urlKey: `www.commonhealth.com.tw/article/${i}`,
        title: `康健${i}`,
        tags: [],
        source: 'own',
      })),
    );
    const status = async () =>
      (
        await db
          .select({ url: articles.url, s: articles.fetchStatus })
          .from(articles)
          .where(sql`${articles.media} = 'commonhealth'`)
          .orderBy(articles.url)
      ).map((r) => r.s);
    let calls = 0;
    const throttled = await runArticles(db, ch, {
      fetch: async (u: string) => {
        calls++;
        return res(u, '', 429);
      },
      concurrency: 1,
    });
    expect({ calls, updated: throttled.updated, failed: throttled.failed }).toEqual({ calls: 1, updated: 0, failed: 0 });
    expect(await status()).toEqual([null, null, null]);

    await runArticles(db, ch, { fetch: async (u: string) => res(u, '', 500) });
    expect(await status()).toEqual(['error', 'error', 'error']);
    // Not retried within the hour...
    expect((await runArticles(db, ch, { fetch: async (u: string) => res(u, '', 500) })).fetched).toBe(0);
    // ...but an hour later once, and the second failure is final.
    const later = () => new Date(Date.now() + 2 * 3600e3);
    await runArticles(db, ch, { fetch: async (u: string) => res(u, '', 500), now: later });
    expect(await status()).toEqual(['failed', 'failed', 'failed']);
    expect((await runArticles(db, ch, { fetch: async (u: string) => res(u, '', 500), now: later })).fetched).toBe(0);
    // One final body retry is allowed after six hours, then attempts stay bounded.
    const finalRetry = () => new Date(Date.now() + 9 * 3600e3);
    expect((await runArticles(db, ch, { fetch: async (u: string) => res(u, '', 500), now: finalRetry })).fetched).toBe(3);
    expect(
      (await runArticles(db, ch, { fetch: async (u: string) => res(u, '', 500), now: () => new Date(Date.now() + 20 * 3600e3) })).fetched,
    ).toBe(0);
    await db.delete(articles).where(sql`${articles.media} = 'commonhealth'`);
  });

  it('drops partner stories from an aggregator and does not re-list them', async () => {
    const yahoo: SourceSpec = {
      media: 'yahoo',
      group: 'hourly',
      list: {
        urls: [{ cat: 'reporter', url: 'https://tw.news.yahoo.com/yahoo-reporter/' }],
        discover: { pattern: String.raw`-\d{9}\.html$` },
        articleId: String.raw`-(\d{9})\.html$`,
      },
      article: { enabled: true, batch: 20, delayMs: 0, provider: 'Yahoo' },
    };
    const section =
      '<a href="/own-story-111111111.html">Yahoo 特派記者的報導標題</a><a href="/partner-story-222222222.html">合作媒體的報導標題文字</a>';
    const article = (provider: string) =>
      `<meta property="article:published_time" content="${now.toISOString()}"><meta name="news_keywords" content="選舉,立法院"><script>{\\"provider\\":{\\"name\\":\\"${provider}\\"}}</script>`;
    const fetch = async (u: string) =>
      res(u, u.endsWith('yahoo-reporter/') ? section : article(u.includes('222222222') ? '理財周刊' : 'Yahoo新聞編輯室'));
    expect((await runIndex(db, yahoo, { fetch })).inserted).toBe(2);
    const r = await runArticles(db, yahoo, { fetch });
    expect({ updated: r.updated, rejected: r.rejected }).toEqual({ updated: 1, rejected: 1 });
    expect((await runIndex(db, yahoo, { fetch })).inserted).toBe(0);
    const rows = await db.select({ url: articles.url }).from(articles).where(sql`${articles.media} = 'yahoo'`);
    expect(rows.map((x) => x.url)).toEqual(['https://tw.news.yahoo.com/own-story-111111111.html']);
    await db.delete(articleTags).where(sql`${articleTags.articleId} IN (SELECT id FROM articles WHERE media = 'yahoo')`);
    await db.delete(articles).where(sql`${articles.media} = 'yahoo'`);
  });

  it('counts only collected, titled, dated, recent articles toward traffic coverage', async () => {
    const before = await measureTrafficCoverage(db, now);
    const recent = new Date(now.getTime() - 3600e3);
    const old = new Date(now.getTime() - 72 * 3600e3);
    const base = { title: '完整的測試新聞標題', tags: [], source: 'own', publishedAt: recent, crawledAt: now };
    await db.insert(articles).values([
      { ...base, media: 'udn', url: 'https://udn.com/coverage-valid' },
      { ...base, media: 'ettoday', url: 'https://ettoday.net/coverage-titleless', title: '' },
      { ...base, media: 'tvbs', url: 'https://news.tvbs.com.tw/coverage-pending', publishedAt: now },
      { ...base, media: 'tvbs', url: 'https://news.tvbs.com.tw/coverage-dateless', publishedAt: now, fetchedAt: now },
      { ...base, media: 'mirror', url: 'https://mirrormedia.mg/coverage-old', publishedAt: old },
      { ...base, media: 'storm', url: 'https://storm.mg/coverage-future', publishedAt: new Date(now.getTime() + 3600e3) },
      { ...base, media: 'nownews', url: 'https://nownews.com/coverage-old-crawl', crawledAt: old },
    ]);
    try {
      const after = await measureTrafficCoverage(db, now);
      expect(after.coveredTraffic - before.coveredTraffic).toBeCloseTo(39.01, 3);
      expect(after.coveredSources - before.coveredSources).toBe(1);
    } finally {
      await db.delete(articles).where(sql`${articles.url} LIKE '%/coverage-%'`);
    }
  });

  it('applies retention without touching recent data', async () => {
    const day = 86400e3;
    await db.insert(articles).values([
      {
        media: 'setn',
        url: 'https://www.setn.com/old-1',
        urlKey: 'www.setn.com/old-1',
        title: '舊文',
        publishedAt: new Date(now.getTime() - 100 * day),
        crawledAt: now,
        tags: ['舊'],
        description: '保留標題與標籤',
        body: '過期內文',
        bodyStatus: 'ok',
        contentFetchedAt: now,
        source: 'own',
      },
      {
        media: 'setn',
        url: 'https://www.setn.com/old-2',
        urlKey: 'www.setn.com/old-2',
        title: '從未抓取',
        publishedAt: new Date(now.getTime() - 20 * day),
        crawledAt: now,
        tags: [],
        source: 'own',
      },
    ]);
    await db.insert(jobRuns).values({ name: 'x', startedAt: new Date(now.getTime() - 40 * day), status: 'ok' });
    const out = await runRetentionJob(db);
    expect(out).toMatchObject({ descriptionsCleared: 1, bodiesCleared: 1, staleArticlesDeleted: 1, jobRunsDeleted: 1 });
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(articles);
    expect(Number(n)).toBe(6);
  });
  it('reserves backlog capacity and retries missing bodies on a bounded schedule', async () => {
    const media = 'content_queue_test';
    const queueSpec = { ...spec, media };
    const ids = await db
      .insert(articles)
      .values(
        Array.from({ length: 8 }, (_, i) => ({
          media,
          title: `正文排程測試${i}`,
          url: `https://example.com/queue/${i}`,
          tags: ['已有標籤'],
          publishedAt: new Date(now.getTime() - (8 - i) * 3600e3),
          crawledAt: now,
        })),
      )
      .$returningId();
    try {
      await runArticles(db, queueSpec, { limit: 5, fetch: async (u) => res(u, '<html></html>') });
      const attempted = await db
        .select({ id: articles.id, attempts: articles.contentAttempts })
        .from(articles)
        .where(sql`${articles.media} = ${media} AND ${articles.contentFetchedAt} IS NOT NULL`);
      expect(attempted.map((r) => r.id)).toContain(ids[0].id);
      expect(attempted.map((r) => r.id)).toContain(ids.at(-1)!.id);
      expect(attempted).toHaveLength(5);
      await runArticles(db, queueSpec, { limit: 10, fetch: async (u) => res(u, '<html></html>') });
      expect((await runArticles(db, queueSpec, { limit: 10, fetch: async (u) => res(u, '<html></html>') })).fetched).toBe(0);
      for (const elapsed of [7, 14]) {
        expect(
          (
            await runArticles(db, queueSpec, {
              limit: 10,
              now: () => new Date(now.getTime() + elapsed * 3600e3),
              fetch: async (u) => res(u, '<html></html>'),
            })
          ).fetched,
        ).toBe(8);
      }
      expect(
        (
          await runArticles(db, queueSpec, {
            limit: 10,
            now: () => new Date(now.getTime() + 21 * 3600e3),
            fetch: async (u) => res(u, '<html></html>'),
          })
        ).fetched,
      ).toBe(0);
    } finally {
      await db.delete(articles).where(sql`${articles.media} = ${media}`);
    }
  });

  it('serves cached full bodies and computes real cross-media similarity without contacting upstream', async () => {
    const [original] = await db.select().from(articles).where(sql`${articles.media} = 'setn' AND ${articles.bodyStatus} = 'ok'`).limit(1);
    const [copy] = await db
      .insert(articles)
      .values({
        media: 'cna',
        title: '相同內文，不同標題',
        url: 'https://cna.com.tw/test-copy',
        publishedAt: now,
        crawledAt: now,
        tags: [],
        body: original.body,
        bodyStatus: 'ok',
        authors: ['另一記者'],
        contentFetchedAt: now,
      })
      .$returningId();
    const app = await buildApp({ tagDbUrl: null, uiOrigin: 'http://127.0.0.1:1', rateLimit: false }, { db });
    try {
      const response = await app.inject(`/api/v1/articles/${original.id}/content`);
      expect(response.statusCode).toBe(200);
      expect(response.json().content.body).toBe(original.body);
      const listing = await app.inject('/api/v1/media/setn/content?limit=1');
      expect(listing.json().articles).toHaveLength(1);
      expect(listing.json().articles[0]).not.toHaveProperty('body');
      expect(listing.json().nextCursor).toBeTruthy();
      const data = await loadSimilarity(db, 48, 0.65);
      expect(data.pairs.some((pair) => pair.kind === 'identical' && [pair.a.id, pair.b.id].includes(copy.id))).toBe(true);
      expect(data.edges.some((edge) => edge.kind === 'citation' && edge.target === 'reuters')).toBe(true);
      expect(data.coverage.find((c) => c.media === 'yam')?.excludedFromStatistics).toBe(true);
      expect((await app.inject('/api/v1/similarity?threshold=NaN')).statusCode).toBe(400);
      expect((await app.inject('/api/v1/articles/999999999/content')).statusCode).toBe(404);
    } finally {
      await app.close();
      await db.delete(articles).where(sql`${articles.id} = ${copy.id}`);
    }
  });
});

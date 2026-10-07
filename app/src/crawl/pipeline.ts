import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import type { Db } from '../db/client.ts';
import { articles, articleTags, crawlRuns, rejectedUrls } from '../db/schema.ts';
import { isOwnMediaTag } from '../media-tags.ts';
import { extractAttributions } from '../similarity/attribution.ts';
import { runDiscoveryIndex } from './discovery-index.ts';
import { extractFeatureArticle as extractArticle } from './feature-article.ts';
import { type FeedItem, parseFeed } from './feed.ts';
import { fetchText, fetchViaCurl } from './fetch.ts';
import { discoverLinks, parseMarkerList } from './html-list.ts';
import { discoverNews } from './news-discovery.ts';
import type { SourceSpec } from './sources.ts';
import { headlineFromPage, normalizeTag, stripTitleSuffix, urlKey } from './text.ts';
import { type TitleVocab, tagsFromTitle } from './title-tags.ts';

export interface Logger {
  info: (o: object, m: string) => void;
  warn: (o: object, m: string) => void;
}
const noop: Logger = { info() {}, warn() {} };
const trunc = (s: string | null | undefined, n: number) => (s == null ? null : s.slice(0, n));
// Match the article extractor's keyword limit at every persistence path.
// Some WordPress RSS feeds put the entire headline in a category/tag field.
const usableTags = (tags: string[], media: string) => [
  ...new Set(tags.map(normalizeTag).filter((tag) => Buffer.byteLength(tag) > 1 && tag.length <= 30 && !isOwnMediaTag(tag, media))),
];
const PLAIN_SITEMAP_WINDOW_MS = 2 * 86400e3;
const PLAIN_SITEMAP_MAX = 300;
const FEED_START = /^\s*(?:<\?xml[^>]*>\s*)?(?:<\?xml-stylesheet[^>]*>\s*)?<(?:urlset|sitemapindex|rss|feed|rdf:RDF)\b/;

export async function listSource(spec: SourceSpec, fetch = fetchText): Promise<{ items: FeedItem[]; errors: string[] }> {
  if (spec.list.autoDiscover) {
    const result = await discoverNews(spec.list.autoDiscover, { fetch });
    return { items: result.items, errors: result.errors };
  }
  const oldest = Date.now() - 14 * 86400e3; // drop listing items older than this
  const items: FeedItem[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const queue = spec.list.urls.map((u) => ({ ...u, depth: 0 }));
  const include = spec.list.include ? new RegExp(spec.list.include) : null;
  const titleInclude = spec.list.titleInclude ? new RegExp(spec.list.titleInclude) : null;
  let fetched = 0;
  while (queue.length && fetched < 12) {
    const { cat, url, depth } = queue.shift() as { cat: string; url: string; depth: number };
    fetched++;
    try {
      const res = spec.list.curl
        ? await fetchViaCurl(url, { userAgent: spec.list.userAgent })
        : await fetch(url, { userAgent: spec.list.userAgent });
      if (res.status >= 400) {
        errors.push(`${url} -> ${res.status}`);
        continue;
      }
      // A feed or news sitemap listed beside discovered HTML pages keeps its
      // own dates and keywords (ftv: stalled sitemap + realtime page).
      if (spec.list.discover && !FEED_START.test(res.body.slice(0, 1000))) {
        for (const item of discoverLinks(
          res.body,
          res.url || url,
          new RegExp(spec.list.discover.pattern),
          spec.list.discover.minTitle,
          spec.list.discover.titleSelector,
        ))
          push(item, cat);
        continue;
      }
      if (spec.list.marker) {
        for (const item of parseMarkerList(res.body, url, spec.list.marker)) push(item, cat);
        continue;
      }
      const parsed = parseFeed(res.body);
      if (parsed.kind === 'sitemapindex') {
        // Follow the newest few child sitemaps (index lists are usually chronological).
        if (depth < 1) for (const child of (parsed.children ?? []).slice(0, 4)) queue.push({ cat, url: child, depth: depth + 1 });
        continue;
      }
      if (!parsed.items.length) errors.push(`${url} -> 0 items`);
      if (parsed.kind === 'sitemap' && !parsed.items.some((i) => i.publishedAt)) {
        // Plain (non-news) sitemap: only <lastmod>, which is a modification
        // time. Take entries modified in the last 2 days, newest first, capped;
        // their real publish time comes from the page in runArticles.
        const head = spec.list.sitemapHead;
        if (head && !parsed.items.some((i) => i.modifiedAt)) {
          for (const item of parsed.items.slice(0, head)) push(item, cat);
          continue;
        }
        const recent = parsed.items
          .filter((i) => i.modifiedAt && Date.now() - i.modifiedAt.getTime() < PLAIN_SITEMAP_WINDOW_MS)
          .sort((a, b) => (b.modifiedAt as Date).getTime() - (a.modifiedAt as Date).getTime());
        let added = 0;
        for (const item of recent) {
          if (added >= PLAIN_SITEMAP_MAX) break;
          if (push(item, cat)) added++;
        }
        continue;
      }
      for (const item of parsed.items) push(item, cat);
    } catch (error) {
      errors.push(`${url} -> ${(error as Error).message}`);
    }
  }
  function push(item: FeedItem, cat: string): boolean {
    if (item.publishedAt && item.publishedAt.getTime() < oldest) return false;
    if (titleInclude && !titleInclude.test(item.title ?? '')) return false;
    // Homepages and section roots sometimes appear in sitemaps.
    try {
      const u = new URL(item.url);
      // (WordPress permalinks like /?p=123 are articles, not the homepage.)
      if (u.pathname.replace(/\/+$/, '') === '' && !u.search) return false;
      if (include && !include.test(u.pathname + u.search)) return false;
    } catch {
      return false;
    }
    const key = urlKey(item.url, spec.list.articleId);
    if (seen.has(key)) return false;
    seen.add(key);
    items.push({ ...item, category: item.category ?? (cat || undefined) });
    return true;
  }
  return { items, errors };
}

export async function runIndex(
  db: Db,
  spec: SourceSpec,
  {
    fetch = fetchText,
    log = noop,
    now = () => new Date(),
    listed,
  }: {
    fetch?: typeof fetchText;
    log?: Logger;
    now?: () => Date;
    /** Already validated original-publisher items from an aggregator. */
    listed?: { items: FeedItem[]; errors: string[] };
  } = {},
): Promise<{ items: number; inserted: number; errors: string[] }> {
  if (spec.discovery) return runDiscoveryIndex(db, spec, { fetch, log, now });
  const started = now();
  const [run] = await db
    .insert(crawlRuns)
    .values({ media: spec.media, stage: 'index', startedAt: started, status: 'running' })
    .$returningId();
  try {
    const { items, errors } = listed ?? (await listSource(spec, fetch));
    let inserted = 0;
    for (let i = 0; i < items.length; i += 100) {
      // Titleless items (plain sitemaps) get their title from the page in runArticles.
      let batch = items.slice(i, i + 100).filter((it) => it.url.length <= 512);
      if (spec.article.provider && batch.length) {
        const rejected = new Set(
          (
            await db
              .select({ urlKey: rejectedUrls.urlKey })
              .from(rejectedUrls)
              .where(
                and(
                  eq(rejectedUrls.media, spec.media),
                  inArray(
                    rejectedUrls.urlKey,
                    batch.map((it) => urlKey(it.url, spec.list.articleId)),
                  ),
                ),
              )
          ).map((r) => r.urlKey),
        );
        batch = batch.filter((it) => !rejected.has(urlKey(it.url, spec.list.articleId)));
      }
      if (!batch.length) continue;
      const result = await db
        .insert(articles)
        .ignore()
        .values(
          batch.map((it) => {
            // Provider-restricted sources must still pass runArticles attribution checks.
            const content = spec.article.provider ? undefined : it.verifiedContent;
            return {
              media: spec.media,
              publishedAt: it.publishedAt ?? started,
              crawledAt: started,
              url: it.url,
              urlKey: urlKey(it.url, spec.list.articleId),
              title: trunc(stripTitleSuffix(it.title ?? '', spec.titleSuffix), 512) as string,
              image: trunc(it.image, 512),
              category: trunc(it.category, 64),
              creator: trunc(content?.authors.length ? content.authors.join('、') : it.creator, 256),
              description: trunc(it.description, 4000),
              summary: it.summary ?? null,
              summarySource: it.summary ? it.summarySource : null,
              tags: usableTags(it.tags ?? [], spec.media),
              fetchedAt: content ? started : null,
              fetchStatus: content ? (it.tags?.length ? 'ok' : 'notags') : null,
              ...(content
                ? {
                    ...content,
                    contentFetchedAt: started,
                    contentAttempts: 1,
                    attributions: extractAttributions(content.body, spec.media, it.verifiedProvider),
                  }
                : {}),
              source: 'own',
            };
          }),
        );
      inserted += (result as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
      // A legacy import is not a crawl request. Once our normal index actually
      // rediscovers it, it becomes an own collection with a real acquisition
      // time. The original row/time remains immutable in its legacy origin.
      await db
        .update(articles)
        .set({ source: 'own', crawledAt: started })
        .where(
          and(
            eq(articles.media, spec.media),
            eq(articles.source, 'legacy'),
            inArray(
              articles.urlKey,
              batch.map((it) => urlKey(it.url, spec.list.articleId)),
            ),
          ),
        );
      // A previously indexed URL can acquire its first usable body through a
      // repaired page rule or an explicitly trusted full-text publisher feed.
      // INSERT IGNORE alone would leave those existing blocked/empty rows stuck.
      if (!spec.article.provider)
        for (const item of batch) {
          const content = item.verifiedContent;
          if (!content) continue;
          const repairable = and(
            eq(articles.media, spec.media),
            eq(articles.urlKey, urlKey(item.url, spec.list.articleId)),
            or(
              isNull(articles.bodyStatus),
              inArray(articles.bodyStatus, ['missing', 'short', 'blocked', 'error']),
              // Legacy publication-based retention may have cleared a recently
              // acquired archive. Restore it only within its original lifetime.
              and(
                eq(articles.bodyStatus, 'expired'),
                gte(sql`COALESCE(${articles.contentFetchedAt}, ${articles.crawledAt})`, new Date(started.getTime() - 90 * 86400e3)),
              ),
            ),
          );
          // Keep repaired publication metadata and ranking dates consistent.
          // Lock the row so another worker cannot replace a valid body or race
          // the decision about whether its timestamp is only an index fallback.
          await db.transaction(async (tx) => {
            const [existing] = await tx
              .select({
                id: articles.id,
                title: articles.title,
                publishedAt: articles.publishedAt,
                crawledAt: articles.crawledAt,
                bodyStatus: articles.bodyStatus,
                contentFetchedAt: articles.contentFetchedAt,
              })
              .from(articles)
              .where(repairable)
              .limit(1)
              .for('update');
            if (!existing) return;
            const correctedDate =
              item.publishedAt && existing.publishedAt.getTime() === existing.crawledAt.getTime() ? item.publishedAt : null;
            const correctedTitle = !existing.title.trim() && item.title ? stripTitleSuffix(item.title, spec.titleSuffix) : null;
            await tx
              .update(articles)
              .set({
                ...content,
                authors: content.authors.length ? content.authors : undefined,
                creator: content.authors.length ? content.authors.join('、').slice(0, 256) : undefined,
                ...(correctedDate ? { publishedAt: correctedDate } : {}),
                ...(correctedTitle ? { title: trunc(correctedTitle, 512) as string } : {}),
                fetchedAt: started,
                contentFetchedAt: existing.bodyStatus === 'expired' ? (existing.contentFetchedAt ?? existing.crawledAt) : started,
                contentAttempts: sql`${articles.contentAttempts} + 1`,
                fetchStatus: item.tags?.length ? 'ok' : 'notags',
                ...(item.summary ? { summary: item.summary, summarySource: item.summarySource } : {}),
                attributions: extractAttributions(content.body, spec.media, item.verifiedProvider),
              })
              .where(repairable);
            if (correctedDate)
              await tx.update(articleTags).set({ publishedAt: correctedDate }).where(eq(articleTags.articleId, existing.id));
          });
        }
      // Feed-provided tags are usable immediately for ranking.
      const withTags = batch.filter((it) => it.tags?.length);
      if (withTags.length)
        await indexTags(
          db,
          spec.media,
          withTags.map((it) => ({ url: it.url, tags: it.tags as string[], publishedAt: it.publishedAt ?? started })),
        );
    }
    await db
      .update(crawlRuns)
      .set({
        finishedAt: now(),
        status: errors.length && !items.length ? 'failed' : 'ok',
        fetched: items.length,
        inserted,
        detail: errors.length ? errors.join('\n').slice(0, 4000) : null,
      })
      .where(eq(crawlRuns.id, run.id));
    log.info({ media: spec.media, items: items.length, inserted, errors: errors.length }, 'crawl index');
    return { items: items.length, inserted, errors };
  } catch (error) {
    await db
      .update(crawlRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(crawlRuns.id, run.id));
    throw error;
  }
}

async function indexTags(db: Db, media: string, rows: Array<{ url: string; tags: string[]; publishedAt: Date }>) {
  const ids = await db
    .select({ id: articles.id, url: articles.url, publishedAt: articles.publishedAt })
    .from(articles)
    .where(
      and(
        eq(articles.media, media),
        sql`${articles.url} IN (${sql.join(
          rows.map((r) => sql`${r.url}`),
          sql`, `,
        )})`,
      ),
    );
  const byUrl = new Map(ids.map((r) => [r.url, r]));
  const values = rows.flatMap((r) => {
    const article = byUrl.get(r.url);
    return article
      ? usableTags(r.tags, media).map((tag) => ({
          articleId: article.id,
          tag: tag.slice(0, 60),
          publishedAt: article.publishedAt,
        }))
      : [];
  });
  for (let i = 0; i < values.length; i += 500)
    await db
      .insert(articleTags)
      .values(values.slice(i, i + 500))
      .onDuplicateKeyUpdate({ set: { publishedAt: sql`VALUES(published_at)` } });
}

export async function runArticles(
  db: Db,
  spec: SourceSpec,
  {
    fetch = fetchText,
    log = noop,
    now = () => new Date(),
    limit = spec.article.batch,
    concurrency = 2,
    hours = 90 * 24,
    vocab = null as TitleVocab | null,
    signal = undefined as AbortSignal | undefined,
  } = {},
) {
  if (spec.discovery) return { fetched: 0, updated: 0, failed: 0, rejected: 0 };
  const started = now();
  // Every article needs body extraction, including previously tagged feeds.
  // Recent items go first, then the retained 90-day backlog is filled gradually.
  const pendingQuery = () =>
    db
      .select({
        id: articles.id,
        url: articles.url,
        publishedAt: articles.publishedAt,
        crawledAt: articles.crawledAt,
        title: articles.title,
        fetchStatus: articles.fetchStatus,
        urlKey: articles.urlKey,
      })
      .from(articles)
      .where(
        and(
          eq(articles.media, spec.media),
          eq(articles.source, 'own'),
          // HTTP errors retry after an hour; missing/blocked bodies retry after six hours, up to three attempts.
          or(
            isNull(articles.fetchedAt),
            isNull(articles.contentFetchedAt),
            and(
              eq(articles.fetchStatus, 'error'),
              lt(articles.contentAttempts, 3),
              lt(articles.fetchedAt, new Date(now().getTime() - 3600e3)),
            ),
            and(
              inArray(articles.bodyStatus, ['missing', 'blocked', 'error']),
              lt(articles.contentAttempts, 3),
              lt(articles.contentFetchedAt, new Date(now().getTime() - 6 * 3600e3)),
            ),
          ),
          gte(articles.crawledAt, new Date(now().getTime() - hours * 3600e3)),
        ),
      );
  // Reserve part of each batch for the oldest pending rows, so a busy outlet
  // cannot starve its retained backlog with a continuous stream of new links.
  const [recent, backlog] = await Promise.all([
    pendingQuery().orderBy(desc(articles.publishedAt), desc(articles.id)).limit(limit),
    pendingQuery()
      .orderBy(asc(articles.publishedAt), asc(articles.id))
      .limit(Math.max(1, Math.floor(limit / 5))),
  ]);
  const pending = [...new Map([...backlog, ...recent].map((row) => [row.id, row])).values()].slice(0, limit);
  if (!pending.length) return { fetched: 0, updated: 0, failed: 0, rejected: 0 };
  const [run] = await db
    .insert(crawlRuns)
    .values({ media: spec.media, stage: 'article', startedAt: started, status: 'running' })
    .$returningId();
  const gate = pLimit(concurrency);
  let updated = 0,
    failed = 0,
    rejected = 0;
  const provider = spec.article.provider ? new RegExp(spec.article.provider) : null;
  const providerBody = spec.article.providerBody ? new RegExp(spec.article.providerBody) : null;
  const errors: string[] = [];
  // HTTP 429 or a worker shutdown: stop this batch and leave the rest (and this
  // row) for the next run.
  let throttled = false;
  await Promise.all(
    pending.map((row, i) =>
      gate(async () => {
        if (i) await new Promise((r) => setTimeout(r, Math.min(spec.article.delayMs, 3000) * (i % concurrency)));
        if (throttled || signal?.aborted) return;
        try {
          const res = await fetch(row.url, { userAgent: spec.article.userAgent });
          if (res.status === 429) {
            throttled = true;
            errors.push(`${row.url} -> HTTP 429 (batch stopped)`);
            return;
          }
          if (res.status >= 400) throw Error('HTTP ' + res.status);
          const detail = extractArticle(res.body, row.url, spec.article);
          const providerMismatch = provider && !provider.test(detail.provider ?? '');
          if (providerMismatch || (provider && providerBody && !providerBody.test(detail.body ?? ''))) {
            await db
              .insert(rejectedUrls)
              .ignore()
              .values({
                media: spec.media,
                urlKey: row.urlKey ?? urlKey(row.url, spec.list.articleId),
                reason: (providerMismatch ? `provider:${detail.provider ?? 'none'}` : 'provider-body').slice(0, 64),
                createdAt: now(),
              });
            await db.delete(articleTags).where(eq(articleTags.articleId, row.id));
            await db.delete(articles).where(eq(articles.id, row.id));
            rejected++;
            return;
          }
          const pageTitle = detail.title ? stripTitleSuffix(detail.title, spec.titleSuffix) : null;
          // Discovered titles are listing anchor text; the page headline wins
          // when that text ran past the headline. Undated links taken from a
          // topic page carry whatever the card printed (womany adds the author,
          // 「N 個互動」, a lede or 「閱讀更多」): a shorter page title wins.
          const listed = row.title ?? '';
          const undated = row.publishedAt.getTime() === row.crawledAt.getTime();
          const title =
            Buffer.byteLength(listed) < 2
              ? pageTitle
              : spec.list.discover
                ? headlineFromPage(listed, pageTitle)
                : undated && pageTitle && pageTitle.length < listed.length
                  ? pageTitle
                  : null;
          const titleTags = !detail.tags.length && vocab ? tagsFromTitle(title || row.title || '', vocab) : [];
          const tags = usableTags(detail.tags.length ? detail.tags : titleTags, spec.media);
          // Undated discoveries use the page's publication. Reviewed feeds
          // that carry modification time also use this declared publication.
          const metaTime =
            detail.publishedAt && detail.publishedAt.getTime() < Date.now() + 86400e3 && detail.publishedAt.getFullYear() >= 2000
              ? detail.publishedAt
              : null;
          const publishedAt =
            metaTime && (spec.article.preferPagePublication || row.publishedAt.getTime() === row.crawledAt.getTime())
              ? metaTime
              : row.publishedAt;
          await db
            .update(articles)
            .set({
              fetchedAt: now(),
              fetchStatus: detail.tags.length ? 'ok' : titleTags.length ? 'title' : 'notags',
              ...(title ? { title: trunc(title, 512) as string } : {}),
              ...(publishedAt !== row.publishedAt ? { publishedAt } : {}),
              canonical: trunc(detail.canonical, 512),
              image: detail.image ? trunc(detail.image, 512) : undefined,
              description: detail.description ? trunc(detail.description, 4000) : undefined,
              ...(detail.summary ? { summary: detail.summary, summarySource: detail.summarySource } : {}),
              body: detail.body,
              authors: detail.authors.length ? detail.authors : undefined,
              creator: detail.authors.length ? detail.authors.join('、').slice(0, 256) : undefined,
              bodyStatus: detail.bodyStatus,
              bodySource: detail.bodySource.slice(0, 128),
              contentFetchedAt: now(),
              contentAttempts: sql`${articles.contentAttempts} + 1`,
              attributions: extractAttributions(detail.body ?? '', spec.media, detail.provider),
              tags: sql`IF(JSON_LENGTH(tags)=0, ${JSON.stringify(tags)}, tags)`,
            })
            .where(eq(articles.id, row.id));
          // Tags written at index time carry the listing time; move them with the article.
          if (publishedAt !== row.publishedAt) await db.update(articleTags).set({ publishedAt }).where(eq(articleTags.articleId, row.id));
          if (tags.length) {
            const values = [...new Set(tags)].map((tag) => ({
              articleId: row.id,
              tag: tag.slice(0, 60),
              publishedAt,
            }));
            await db
              .insert(articleTags)
              .values(values)
              .onDuplicateKeyUpdate({ set: { publishedAt: sql`VALUES(published_at)` } });
          }
          updated++;
        } catch (error) {
          failed++;
          errors.push(`${row.url} -> ${(error as Error).message}`);
          // Unreachable page: still tag from the title so the article counts.
          const titleTags = vocab ? tagsFromTitle(row.title ?? '', vocab) : [];
          await db
            .update(articles)
            .set({
              fetchedAt: now(),
              fetchStatus: row.fetchStatus === 'error' ? 'failed' : 'error',
              contentFetchedAt: now(),
              contentAttempts: sql`${articles.contentAttempts} + 1`,
              bodyStatus: 'error',
              ...(titleTags.length ? { tags: sql`IF(JSON_LENGTH(tags)=0, ${JSON.stringify(titleTags)}, tags)` } : {}),
            })
            .where(eq(articles.id, row.id));
          if (titleTags.length)
            await db
              .insert(articleTags)
              .values(titleTags.map((tag) => ({ articleId: row.id, tag: tag.slice(0, 60), publishedAt: row.publishedAt })))
              .onDuplicateKeyUpdate({ set: { publishedAt: sql`VALUES(published_at)` } });
        }
      }),
    ),
  );
  await db
    .update(crawlRuns)
    .set({
      finishedAt: now(),
      status: failed && failed === pending.length ? 'failed' : 'ok',
      fetched: pending.length,
      updated,
      failed,
      detail: errors.length ? errors.join('\n').slice(0, 4000) : null,
    })
    .where(eq(crawlRuns.id, run.id));
  log.info({ media: spec.media, fetched: pending.length, updated, failed, rejected }, 'crawl articles');
  return { fetched: pending.length, updated, failed, rejected };
}

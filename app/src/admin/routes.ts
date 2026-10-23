import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import type { SessionUser } from '../auth/google-login.ts';
import { fetchText } from '../crawl/fetch.ts';
import { runArticles, runIndex } from '../crawl/pipeline.ts';
import { allSources, disabled, excludedMedia, sourceByMedia } from '../crawl/registry.ts';
import { generatedRulesOf, refreshGeneratedRules } from '../crawl/rules/state.ts';
import { activeRevision, readAttempts, readRuleFile, rejectActiveRules } from '../crawl/rules/store.ts';
import { configuredHosts } from '../crawl/rules/targets.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import {
  articleAuthorEdits,
  articleAuthorLog,
  articles,
  articleTagEdits,
  articleTagLog,
  articleTags,
  crawlRuns,
  mediaCategories,
  mediaCategoryLog,
  robotsObservations,
} from '../db/schema.ts';
import { CAMP_KEYS, categoriesOf, categoryDefs, refreshMediaCategories } from '../media-categories.ts';
import { mediaTagDomains, mediaTags, TRAFFIC_SITE } from '../media-traffic/site-tags.ts';
import { iconUrl } from '../v1/icons.ts';
import { articleDetail, hostOf, lookupUrl, outletSummary } from './lookup.ts';
import { userActivity } from './user-activity.ts';

// Admin tools behind /admin/media/ (docs/login.md): edit an outlet's labels
// and crawl it on demand. Everything sits under /auth/admin/, outside the
// public /api/ (CORS *, GET only); every write must come from the site itself.

/** The slice of a BullMQ queue these routes use (the worker's 'tag-jobs'). */
export interface JobQueue {
  add(name: string, data: unknown, opts: { jobId: string; removeOnComplete: object; removeOnFail: object }): Promise<{ id?: string }>;
  getJob(id: string): Promise<
    | {
        id?: string;
        name: string;
        data: unknown;
        returnvalue: unknown;
        failedReason?: string;
        timestamp: number;
        finishedOn?: number;
        getState(): Promise<string>;
      }
    | null
    | undefined
  >;
  getJobs(types: string[]): Promise<Array<{ id?: string; name: string; data: unknown } | undefined>>;
}

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
  queue: () => JobQueue;
};

const info = favicons as unknown as Record<string, { icon: string | null; title: string | null }>;
const TAG_MAX = 60;
const TAGS_MAX = 40;
export const REFETCH_MS = 15_000;
const AUTHOR_MAX = 64;
const AUTHORS_MAX = 10;

/** Every outlet an admin can label: the favicon catalog plus crawl sources. */
export const knownMedia = () =>
  [...new Set([...Object.keys(info), ...allSources().map((s) => s.media)])].filter((m) => !excludedMedia.has(m)).sort();

export function registerAdminRoutes(app: FastifyInstance, db: Db, { requireAdmin, origin, queue }: Options) {
  const admin = async (request: FastifyRequest, reply: FastifyReply, write = false) => {
    if (write && request.headers.origin !== origin) {
      reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
      return null;
    }
    return requireAdmin(request, reply);
  };
  const known = (media: string) => media.length <= 32 && knownMedia().includes(media);
  // Only the camp labels are edited here; every other tag is managed on
  // traffic.observe.tw (media-traffic/site-tags.ts) and shown read-only.
  const camps = new Set<string>(CAMP_KEYS);
  const campsOf = (media: string) => categoriesOf(media).filter((key) => camps.has(key));
  const campDefs = () => categoryDefs().filter((d) => camps.has(d.key));
  const tagsOf = (media: string) => ({ tags: mediaTags(media), tagDomains: mediaTagDomains(media) });

  app.get<{ Querystring: { url?: string } }>('/auth/admin/lookup', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    const url = request.query.url ?? '';
    if (!hostOf(url) || url.length > 2048) return reply.code(400).send({ error: '需要一個 http(s) 網址' });
    const found = await lookupUrl(db, url, origin);
    return { url, ...found, candidates: found.candidates.map((c) => ({ ...c, icon: iconUrl(c.media) })) };
  });

  app.get('/auth/admin/media', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    // Label edits per outlet, newest first: how many, and the last one.
    // The log grows by hand edits only, so reading it whole stays small.
    const edits = new Map<string, { count: number; lastAt: Date; lastBy: string }>();
    const log = await db
      .select({ media: mediaCategoryLog.media, email: mediaCategoryLog.email, at: mediaCategoryLog.at })
      .from(mediaCategoryLog)
      .where(ne(mediaCategoryLog.media, ''))
      .orderBy(desc(mediaCategoryLog.id));
    for (const { media, email, at } of log) {
      const seen = edits.get(media);
      if (seen) seen.count++;
      else edits.set(media, { count: 1, lastAt: at, lastBy: email });
    }
    // robots.txt of each outlet's main host (jobs/robots-job.ts), and whether generated crawl rules are live.
    const robots = new Map((await db.select().from(robotsObservations)).map((r) => [r.host, r]));
    const media = knownMedia().map((media) => {
      const spec = sourceByMedia(media);
      const host = spec ? configuredHosts(spec)[0] : undefined;
      const seen = host ? robots.get(host) : undefined;
      const active = generatedRulesOf(media);
      return {
        ...outletSummary(media),
        icon: iconUrl(media),
        categories: campsOf(media),
        ...tagsOf(media),
        edits: edits.get(media) ?? null,
        robots: seen ? { host: seen.host, status: seen.status, googleOnly: seen.googleOnly, checkedAt: seen.checkedAt } : null,
        generatedRules: active ? { revision: active.revision, trigger: active.trigger } : null,
      };
    });
    return {
      media,
      categories: campDefs(),
      trafficSite: TRAFFIC_SITE,
    };
  });

  // 帳號 tab: what each signed-in account has read, followed, reported and edited.
  app.get('/auth/admin/user-activity', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    return userActivity(db);
  });

  app.get<{ Params: { media: string } }>('/auth/admin/media/:media', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    const { media } = request.params;
    if (!known(media)) return reply.code(404).send({ error: 'unknown media' });
    const spec = sourceByMedia(media);
    const [log, runs] = await Promise.all([
      db.select().from(mediaCategoryLog).where(eq(mediaCategoryLog.media, media)).orderBy(desc(mediaCategoryLog.id)).limit(20),
      db
        .select({
          stage: crawlRuns.stage,
          status: crawlRuns.status,
          startedAt: crawlRuns.startedAt,
          finishedAt: crawlRuns.finishedAt,
          fetched: crawlRuns.fetched,
          inserted: crawlRuns.inserted,
          updated: crawlRuns.updated,
          failed: crawlRuns.failed,
        })
        .from(crawlRuns)
        .where(eq(crawlRuns.media, media))
        .orderBy(desc(crawlRuns.startedAt))
        .limit(6),
    ]);
    const hosts = spec ? configuredHosts(spec) : [];
    const [robots, rules, attempts] = await Promise.all([
      hosts.length ? db.select().from(robotsObservations).where(inArray(robotsObservations.host, hosts)) : [],
      readRuleFile(media),
      readAttempts(new Date(Date.now() - 60 * 86400e3)),
    ]);
    return {
      ...outletSummary(media),
      icon: iconUrl(media),
      categories: campsOf(media),
      definitions: campDefs(),
      logLabels: Object.fromEntries(categoryDefs().map((d) => [d.key, d.label])),
      ...tagsOf(media),
      trafficSite: TRAFFIC_SITE,
      crawler: spec ? { group: spec.group, disabled: disabled().has(media), aggregator: Boolean(spec.discovery) } : null,
      runs,
      log,
      robots: hosts.map((host) => robots.find((r) => r.host === host) ?? { host, status: null }),
      generatedRules: {
        active: activeRevision(rules),
        history: rules.revisions.map(({ revision, status, trigger, createdAt, rejectedAt, rejectedBy }) => ({
          revision,
          status,
          trigger,
          createdAt,
          rejectedAt: rejectedAt ?? null,
          rejectedBy: rejectedBy ?? null,
        })),
        attempts: attempts
          .filter((a) => a.media === media)
          .slice(-10)
          .reverse(),
      },
    };
  });

  // 停用 AI 規則: the outlet goes back to its hand-written rules within a minute
  // (the worker re-reads the rule files); the next broken stretch may generate new ones.
  app.post<{ Params: { media: string } }>('/auth/admin/media/:media/generated-rules/reject', async (request, reply) => {
    const user = await admin(request, reply, true);
    if (!user) return reply;
    const { media } = request.params;
    if (!known(media)) return reply.code(404).send({ error: 'unknown media' });
    const rejected = await rejectActiveRules(media, user.email);
    if (!rejected) return reply.code(404).send({ error: 'no active generated rules' });
    await refreshGeneratedRules(undefined, true);
    return { media, rejected: true };
  });

  app.put<{ Params: { media: string }; Body: { categories?: unknown } }>('/auth/admin/media/:media/categories', async (request, reply) => {
    const user = await admin(request, reply, true);
    if (!user) return reply;
    const { media } = request.params;
    if (!known(media)) return reply.code(404).send({ error: 'unknown media' });
    const wanted = request.body?.categories;
    if (!Array.isArray(wanted) || !wanted.every((k) => typeof k === 'string' && camps.has(k)))
      return reply.code(400).send({ error: '這裡只能設定政治傾向（blue、green）；其他標籤請到 traffic.observe.tw 管理' });
    await refreshMediaCategories(db);
    // The other groups stay untouched (analysis cohorts and the rollback copy).
    const before = new Set(campsOf(media));
    const after = new Set(wanted as string[]);
    const added = [...after].filter((k) => !before.has(k));
    const removed = [...before].filter((k) => !after.has(k));
    const at = new Date();
    if (added.length)
      await db
        .insert(mediaCategories)
        .ignore()
        .values(added.map((category) => ({ media, category })));
    if (removed.length)
      await db.delete(mediaCategories).where(and(eq(mediaCategories.media, media), inArray(mediaCategories.category, removed)));
    const changes = [
      ...added.map((category) => ({ category, action: 'add' as const })),
      ...removed.map((category) => ({ category, action: 'remove' as const })),
    ];
    if (changes.length) await db.insert(mediaCategoryLog).values(changes.map((c) => ({ ...c, media, email: user.email, at })));
    await refreshMediaCategories(db);
    return { media, categories: campsOf(media), added, removed };
  });

  // New tags are created on traffic.observe.tw now (media-traffic/site-tags.ts).
  app.post('/auth/admin/categories', async (request, reply) => {
    if (!(await admin(request, reply, true))) return reply;
    return reply.code(410).send({ error: '媒體標籤改到 traffic.observe.tw 管理', manage: `${TRAFFIC_SITE}/sites/` });
  });

  // 「重抓這一篇」: fetch the page now, inline, and report the stored result.
  app.post<{ Params: { media: string }; Body: { url?: unknown } }>('/auth/admin/media/:media/refetch', async (request, reply) => {
    if (!(await admin(request, reply, true))) return reply;
    const { media } = request.params;
    const url = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
    const spec = sourceByMedia(media);
    if (!spec || spec.discovery) return reply.code(404).send({ error: '這家媒體沒有可用的爬蟲設定' });
    if (!hostOf(url) || url.length > 512) return reply.code(400).send({ error: '需要一個 http(s) 網址' });
    const key = urlKey(url, spec.list.articleId);
    const find = async () =>
      (
        await db
          .select({ id: articles.id })
          .from(articles)
          .where(and(eq(articles.media, media), eq(articles.urlKey, key)))
          .limit(1)
      )[0];
    let row = await find();
    const added = !row;
    if (!row) {
      await runIndex(db, spec, { log: request.log, listed: { items: [{ url, title: '', publishedAt: null }], errors: [] } });
      row = await find();
      if (!row) return reply.code(422).send({ error: '無法收錄這個網址（可能曾被判定不是這家媒體的文章）' });
    }
    // Re-fetching hands the tags and byline back to the page, undoing hand edits.
    await db.delete(articleTagEdits).where(eq(articleTagEdits.articleId, row.id));
    await db.delete(articleAuthorEdits).where(eq(articleAuthorEdits.articleId, row.id));
    // An admin is waiting on the page: one try, at most REFETCH_MS, no retry.
    const result = await runArticles(db, spec, {
      log: request.log,
      only: [row.id],
      fetch: (url, options) => fetchText(url, { ...options, timeout: REFETCH_MS, retries: 0 }),
    });
    return { added, result, article: await articleDetail(db, row.id) };
  });

  app.get<{ Params: { id: string } }>('/auth/admin/articles/:id', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    const article = await articleDetail(db, Number(request.params.id));
    return article ?? reply.code(404).send({ error: 'no such article' });
  });

  // 全文: the stored body as crawled, outside the public seven-day window and
  // without the reader excerpt. A body already moved to the archive is only
  // reported as archived; reading it does not restore it.
  app.get<{ Params: { id: string } }>('/auth/admin/articles/:id/body', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    const id = Number(request.params.id);
    const [row] = await db
      .select({
        id: articles.id,
        body: articles.body,
        bodyStatus: articles.bodyStatus,
        bodySource: articles.bodySource,
        contentFetchedAt: articles.contentFetchedAt,
        archived: sql<number>`${articles.contentArchiveHash} IS NOT NULL`,
      })
      .from(articles)
      .where(Number.isSafeInteger(id) && id > 0 ? eq(articles.id, id) : sql`FALSE`);
    if (!row) return reply.code(404).send({ error: 'no such article' });
    const body = row.body?.trim() ? row.body : null;
    return {
      id: row.id,
      body,
      chars: body ? Array.from(body).length : 0,
      status: row.bodyStatus,
      source: row.bodySource,
      fetchedAt: row.contentFetchedAt,
      archived: !body && Boolean(Number(row.archived)),
    };
  });

  // 單篇標籤增減: the whole list replaces the article's tags, in the JSON
  // column (ranking, events) and in article_tags (tag pages, search), and
  // marks the article so crawls keep the edit.
  app.put<{ Params: { id: string }; Body: { tags?: unknown } }>('/auth/admin/articles/:id/tags', async (request, reply) => {
    const user = await admin(request, reply, true);
    if (!user) return reply;
    const id = Number(request.params.id);
    const wanted = request.body?.tags;
    if (!Array.isArray(wanted) || wanted.length > TAGS_MAX || !wanted.every((t) => typeof t === 'string'))
      return reply.code(400).send({ error: `tags 需為最多 ${TAGS_MAX} 個字串` });
    const tags = [...new Set((wanted as string[]).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (tags.some((t) => t.length > TAG_MAX)) return reply.code(400).send({ error: `每個標籤最多 ${TAG_MAX} 字` });
    const [row] = await db
      .select({ id: articles.id, tags: articles.tags, publishedAt: articles.publishedAt })
      .from(articles)
      .where(Number.isSafeInteger(id) ? eq(articles.id, id) : sql`FALSE`);
    if (!row) return reply.code(404).send({ error: 'no such article' });
    const before = new Set(row.tags);
    const added = tags.filter((t) => !before.has(t));
    const removed = row.tags.filter((t) => !tags.includes(t));
    const at = new Date();
    await db.transaction(async (tx) => {
      await tx.update(articles).set({ tags }).where(eq(articles.id, id));
      if (removed.length) await tx.delete(articleTags).where(and(eq(articleTags.articleId, id), inArray(articleTags.tag, removed)));
      if (added.length)
        await tx
          .insert(articleTags)
          .values(added.map((tag) => ({ articleId: id, tag, publishedAt: row.publishedAt })))
          .onDuplicateKeyUpdate({ set: { publishedAt: sql`VALUES(published_at)` } });
      await tx
        .insert(articleTagEdits)
        .values({ articleId: id, editedAt: at, email: user.email })
        .onDuplicateKeyUpdate({ set: { editedAt: at, email: user.email } });
      const changes = [
        ...added.map((tag) => ({ tag, action: 'add' as const })),
        ...removed.map((tag) => ({ tag, action: 'remove' as const })),
      ];
      if (changes.length) await tx.insert(articleTagLog).values(changes.map((c) => ({ ...c, articleId: id, email: user.email, at })));
    });
    return { added, removed, article: await articleDetail(db, id) };
  });

  // 手動改署名: the list replaces articles.authors (creator follows), is
  // logged, and marks the article so crawls and author repairs keep it. An
  // empty list means 未署名.
  app.put<{ Params: { id: string }; Body: { authors?: unknown } }>('/auth/admin/articles/:id/authors', async (request, reply) => {
    const user = await admin(request, reply, true);
    if (!user) return reply;
    const id = Number(request.params.id);
    const wanted = request.body?.authors;
    if (!Array.isArray(wanted) || wanted.length > AUTHORS_MAX || !wanted.every((a) => typeof a === 'string'))
      return reply.code(400).send({ error: `authors 需為最多 ${AUTHORS_MAX} 個字串` });
    const authors = [...new Set((wanted as string[]).map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (authors.some((a) => a.length > AUTHOR_MAX)) return reply.code(400).send({ error: `每個署名最多 ${AUTHOR_MAX} 字` });
    const [row] = await db
      .select({ id: articles.id, authors: articles.authors, creator: articles.creator })
      .from(articles)
      .where(Number.isSafeInteger(id) && id > 0 ? eq(articles.id, id) : sql`FALSE`);
    if (!row) return reply.code(404).send({ error: 'no such article' });
    const before = row.authors?.length ? row.authors : row.creator ? [row.creator] : [];
    const at = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(articles)
        .set({ authors, creator: authors.length ? authors.join('、').slice(0, 256) : null })
        .where(eq(articles.id, id));
      await tx
        .insert(articleAuthorEdits)
        .values({ articleId: id, editedAt: at, email: user.email })
        .onDuplicateKeyUpdate({ set: { editedAt: at, email: user.email } });
      if (JSON.stringify(before) !== JSON.stringify(authors))
        await tx.insert(articleAuthorLog).values({ articleId: id, before, after: authors, email: user.email, at });
    });
    return { article: await articleDetail(db, id) };
  });

  app.post<{ Params: { media: string }; Body: { stage?: unknown } }>('/auth/admin/media/:media/crawl', async (request, reply) => {
    if (!(await admin(request, reply, true))) return reply;
    const { media } = request.params;
    const stage = request.body?.stage;
    if (!sourceByMedia(media)) return reply.code(404).send({ error: '這家媒體沒有爬蟲設定' });
    if (stage !== 'index' && stage !== 'articles') return reply.code(400).send({ error: 'stage must be index or articles' });
    const jobs = queue();
    // Pressing the button twice joins the run that is already queued.
    const same = (await jobs.getJobs(['waiting', 'active', 'delayed'])).find(
      (job) =>
        job?.name === 'crawl-media' && (job.data as { media?: string }).media === media && (job.data as { stage?: string }).stage === stage,
    );
    if (same?.id) return { jobId: same.id, queued: false };
    const job = await jobs.add(
      'crawl-media',
      { media, stage },
      { jobId: `crawl-media-${media}-${stage}-${Date.now()}`, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 } },
    );
    return reply.code(202).send({ jobId: job.id, queued: true });
  });

  app.get<{ Params: { id: string } }>('/auth/admin/jobs/:id', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    if (!request.params.id.startsWith('crawl-media-')) return reply.code(404).send({ error: 'no such job' });
    const job = await queue().getJob(request.params.id);
    if (!job) return reply.code(404).send({ error: 'no such job' });
    return {
      id: job.id,
      state: await job.getState(),
      data: job.data,
      result: job.returnvalue ?? null,
      error: job.failedReason ?? null,
      queuedAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  });
}

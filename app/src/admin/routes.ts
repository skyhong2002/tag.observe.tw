import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import type { SessionUser } from '../auth/google-login.ts';
import { runArticles, runIndex } from '../crawl/pipeline.ts';
import { allSources, disabled, excludedMedia, sourceByMedia } from '../crawl/registry.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import { articles, crawlRuns, mediaCategories, mediaCategoryDefs, mediaCategoryLog } from '../db/schema.ts';
import { categoriesOf, categoryDefs, refreshMediaCategories } from '../media-categories.ts';
import { iconUrl } from '../v1/icons.ts';
import { hostOf, lookupUrl, outletSummary } from './lookup.ts';

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
const KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const LABEL_MAX = 64;

/** Every outlet an admin can label: the favicon catalog plus crawl sources. */
const knownMedia = () =>
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

  app.get<{ Querystring: { url?: string } }>('/auth/admin/lookup', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    const url = request.query.url ?? '';
    if (!hostOf(url) || url.length > 2048) return reply.code(400).send({ error: '需要一個 http(s) 網址' });
    const found = await lookupUrl(db, url);
    return { url, ...found, candidates: found.candidates.map((c) => ({ ...c, icon: iconUrl(c.media) })) };
  });

  app.get('/auth/admin/media', async (request, reply) => {
    if (!(await admin(request, reply))) return reply;
    return {
      media: knownMedia().map((media) => ({ ...outletSummary(media), icon: iconUrl(media), categories: categoriesOf(media) })),
      categories: categoryDefs(),
    };
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
    return {
      ...outletSummary(media),
      icon: iconUrl(media),
      categories: categoriesOf(media),
      definitions: categoryDefs(),
      crawler: spec ? { group: spec.group, disabled: disabled().has(media), aggregator: Boolean(spec.discovery) } : null,
      runs,
      log,
    };
  });

  app.put<{ Params: { media: string }; Body: { categories?: unknown } }>('/auth/admin/media/:media/categories', async (request, reply) => {
    const user = await admin(request, reply, true);
    if (!user) return reply;
    const { media } = request.params;
    if (!known(media)) return reply.code(404).send({ error: 'unknown media' });
    const wanted = request.body?.categories;
    const defined = new Set(categoryDefs().map((d) => d.key));
    if (!Array.isArray(wanted) || !wanted.every((k) => typeof k === 'string' && defined.has(k)))
      return reply.code(400).send({ error: 'categories must be a list of defined label keys' });
    await refreshMediaCategories(db);
    const before = new Set(categoriesOf(media));
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
    return { media, categories: categoriesOf(media), added, removed };
  });

  app.post<{ Body: { label?: unknown; key?: unknown } }>('/auth/admin/categories', async (request, reply) => {
    const user = await admin(request, reply, true);
    if (!user) return reply;
    const label = typeof request.body?.label === 'string' ? request.body.label.trim() : '';
    if (!label || label.length > LABEL_MAX) return reply.code(400).send({ error: `標籤名稱需 1–${LABEL_MAX} 字` });
    await refreshMediaCategories(db);
    const defs = categoryDefs();
    if (defs.some((d) => d.label === label)) return reply.code(409).send({ error: '已經有這個標籤' });
    const given = typeof request.body?.key === 'string' ? request.body.key.trim().toLowerCase() : '';
    // Only an all-ASCII label makes a readable key; Chinese ones are numbered.
    const slug = /^[\x20-\x7e]+$/.test(label)
      ? label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 32)
      : '';
    let key = given || slug;
    if (!given && (!KEY.test(key) || key === 'all' || defs.some((d) => d.key === key))) {
      let n = defs.length + 1;
      while (defs.some((d) => d.key === `tag${n}`)) n++;
      key = `tag${n}`;
    }
    if (!KEY.test(key) || key === 'all') return reply.code(400).send({ error: '代碼只能用小寫英數字、- 和 _' });
    if (defs.some((d) => d.key === key)) return reply.code(409).send({ error: '已經有這個代碼' });
    const at = new Date();
    const sort = Math.max(0, ...defs.map((d) => d.sort)) + 1;
    await db.insert(mediaCategoryDefs).values({ key, label, sort, createdAt: at });
    await db.insert(mediaCategoryLog).values({ media: '', category: key, action: 'create', email: user.email, at });
    await refreshMediaCategories(db);
    return reply.code(201).send({ key, label, sort });
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
    const result = await runArticles(db, spec, { log: request.log, only: [row.id] });
    const [article] = await db
      .select({
        id: articles.id,
        title: articles.title,
        tags: articles.tags,
        fetchStatus: articles.fetchStatus,
        fetchedAt: articles.fetchedAt,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(eq(articles.id, row.id));
    return { added, result, article: article ?? null };
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

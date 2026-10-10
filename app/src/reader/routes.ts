import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { knownMedia } from '../admin/routes.ts';
import { hashToken, type SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import {
  articles,
  eventThreads,
  readerHistory,
  readerReports,
  userApiKeys,
  userFeedTokens,
  userFollows,
  userPrefs,
  userSaves,
  users,
} from '../db/schema.ts';
import { renderRss } from '../feeds.ts';
import { categoriesOf } from '../media-categories.ts';
import { outletIdentity } from '../similarity/attribution.ts';
import { API_KEYS_PER_USER, type ApiKeyLookup, newApiKey } from './api-keys.ts';
import { feedRssItems, loadFollows, mediaTitle, readerFeed } from './feed.ts';
import { loadSuggestions } from './suggestions.ts';
import {
  FOLLOWS_MAX,
  type Follow,
  type Prefs,
  parseFollow,
  parseId,
  parsePrefs,
  parseReport,
  parseSave,
  SAVES_MAX,
  type SaveKind,
} from './validate.ts';

// What a signed-in reader can do (docs/login.md#讀者功能): follow tags, outlets,
// journalists and events; read them as 我的動態 or a private RSS feed; save
// articles and events; keep preferences across devices; opt in to a reading
// report; hold personal API keys; and report mistakes for admins to review.
// Everything sits under /auth/, outside the public /api/, and every write must
// come from the site itself.

type Options = {
  currentUser: (request: FastifyRequest) => Promise<SessionUser | null>;
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
  apiKeys: ApiKeyLookup;
};

const ORIGIN = 'https://tag.observe.tw';
const REPORTS_PER_DAY = 20;
const REPORT_DAYS = 30;
const LABEL_MAX = 64;
const known = (media: string) => media.length <= 32 && knownMedia().includes(media);
const camp = (media: string) => {
  const keys = categoriesOf(media);
  // Both labels ticked counts as blue, as on the rest of the site.
  return keys.includes('blue') ? 'blue' : keys.includes('green') ? 'green' : null;
};

/** Outlets are followed by key; the list shows their names. */
const labelled = (follows: Follow[]) => follows.map((f) => (f.kind === 'media' ? { ...f, label: mediaTitle(f.target) } : f));

export async function loadPrefs(db: Db, userId: number): Promise<Prefs> {
  const [row] = await db.select({ prefs: userPrefs.prefs }).from(userPrefs).where(eq(userPrefs.userId, userId));
  return (row?.prefs ?? {}) as Prefs;
}

export function registerReaderRoutes(app: FastifyInstance, db: Db, { currentUser, requireAdmin, origin, apiKeys }: Options) {
  /** The signed-in reader, or null after answering 401/403 itself. */
  const reader = async (request: FastifyRequest, reply: FastifyReply, write = false) => {
    reply.header('cache-control', 'no-store');
    if (write && request.headers.origin !== origin) {
      reply.code(403).send({ error: 'same-origin requests only' });
      return null;
    }
    const user = await currentUser(request);
    if (!user) reply.code(401).send({ error: 'sign in first' });
    return user;
  };

  // ── Follows and 我的動態 ────────────────────────────────────────────────
  app.get('/auth/me/follows', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    return { follows: labelled(await loadFollows(db, user.id)), max: FOLLOWS_MAX };
  });

  app.put<{ Body: { kind?: unknown; target?: unknown; follow?: unknown } }>('/auth/me/follows', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const follow = parseFollow(request.body, known);
    if (typeof follow === 'string') return reply.code(400).send({ error: follow });
    if (typeof request.body?.follow !== 'boolean') return reply.code(400).send({ error: 'follow must be true or false' });
    const where = and(eq(userFollows.userId, user.id), eq(userFollows.kind, follow.kind), eq(userFollows.target, follow.target));
    if (!request.body.follow) await db.delete(userFollows).where(where);
    else {
      if (follow.kind === 'event') {
        const [thread] = await db
          .select({ id: eventThreads.id })
          .from(eventThreads)
          .where(eq(eventThreads.id, Number(follow.target)));
        if (!thread) return reply.code(404).send({ error: 'no such event' });
      }
      const [{ n }] = await db.select({ n: count() }).from(userFollows).where(eq(userFollows.userId, user.id));
      const [already] = await db.select({ kind: userFollows.kind }).from(userFollows).where(where);
      if (!already && n >= FOLLOWS_MAX) return reply.code(409).send({ error: `最多追蹤 ${FOLLOWS_MAX} 項` });
      if (!already) await db.insert(userFollows).values({ userId: user.id, ...follow, createdAt: new Date() });
    }
    return { follows: labelled(await loadFollows(db, user.id)), max: FOLLOWS_MAX };
  });

  app.get('/auth/me/feed', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    const [follows, prefs] = await Promise.all([loadFollows(db, user.id), loadPrefs(db, user.id)]);
    return readerFeed(db, follows, prefs.hiddenMedia);
  });

  app.get('/auth/me/suggestions', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    const [follows, prefs] = await Promise.all([loadFollows(db, user.id), loadPrefs(db, user.id)]);
    return loadSuggestions(db, user.id, follows, Boolean(prefs.history));
  });

  // ── Private RSS ─────────────────────────────────────────────────────────
  const feedUrl = (token: string) => `${ORIGIN}/feeds/u/${token}.xml`;
  app.get('/auth/me/feed-token', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    const [row] = await db.select().from(userFeedTokens).where(eq(userFeedTokens.userId, user.id));
    return { url: row ? feedUrl(row.token) : null, createdAt: row?.createdAt.toISOString() ?? null };
  });
  // Creating again replaces the token, so a leaked URL stops working.
  app.post('/auth/me/feed-token', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const token = randomBytes(24).toString('base64url');
    const at = new Date();
    await db
      .insert(userFeedTokens)
      .values({ userId: user.id, token, createdAt: at })
      .onDuplicateKeyUpdate({ set: { token, createdAt: at } });
    return { url: feedUrl(token), createdAt: at.toISOString() };
  });
  app.delete('/auth/me/feed-token', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    await db.delete(userFeedTokens).where(eq(userFeedTokens.userId, user.id));
    return { url: null, createdAt: null };
  });
  app.get<{ Params: { file: string } }>('/feeds/u/:file', async (request, reply) => {
    const token = /^([\w-]{32})\.xml$/.exec(request.params.file)?.[1];
    const [row] = token
      ? await db.select({ userId: userFeedTokens.userId }).from(userFeedTokens).where(eq(userFeedTokens.token, token))
      : [];
    if (!row) return reply.code(404).header('cache-control', 'no-store').type('text/plain; charset=utf-8').send('Not Found\n');
    const [follows, prefs] = await Promise.all([loadFollows(db, row.userId), loadPrefs(db, row.userId)]);
    const feed = await readerFeed(db, follows, prefs.hiddenMedia);
    return reply
      .header('cache-control', 'private, max-age=600')
      .header('x-robots-tag', 'noindex')
      .type('application/rss+xml; charset=utf-8')
      .send(
        renderRss(
          {
            title: '新文易數｜我的動態',
            link: `${ORIGIN}/my/`,
            self: feedUrl(token as string),
            description: `你在新文易數追蹤的標籤、媒體、記者與事件，近 ${feed.days} 天的報導。`,
          },
          feedRssItems(feed),
        ),
      );
  });

  // ── Saves ───────────────────────────────────────────────────────────────
  async function listSaves(userId: number) {
    const rows = await db.select().from(userSaves).where(eq(userSaves.userId, userId)).orderBy(desc(userSaves.createdAt));
    const ids = (kind: SaveKind) => rows.filter((r) => r.kind === kind).map((r) => r.targetId);
    const [articleRows, threadRows] = await Promise.all([
      ids('article').length
        ? db
            .select({ id: articles.id, media: articles.media, title: articles.title, url: articles.url, publishedAt: articles.publishedAt })
            .from(articles)
            .where(inArray(articles.id, ids('article')))
        : [],
      ids('event').length
        ? db
            .select({
              id: eventThreads.id,
              majorTags: eventThreads.majorTags,
              maxTag: eventThreads.maxTag,
              lastTime: eventThreads.lastTime,
            })
            .from(eventThreads)
            .where(inArray(eventThreads.id, ids('event')))
        : [],
    ]);
    const byArticle = new Map(articleRows.map((a) => [a.id, a]));
    const byThread = new Map(threadRows.map((t) => [t.id, t]));
    return rows.map((r) => {
      const base = { kind: r.kind, id: r.targetId, note: r.note, savedAt: r.createdAt.toISOString() };
      if (r.kind === 'article') {
        const a = byArticle.get(r.targetId);
        return {
          ...base,
          article: a ? { ...a, mediaTitle: mediaTitle(a.media), publishedAt: a.publishedAt.toISOString() } : null,
        };
      }
      const t = byThread.get(r.targetId);
      const tags = t ? (t.majorTags.length ? t.majorTags : t.maxTag ? [t.maxTag] : []) : [];
      return { ...base, event: t ? { id: t.id, tags, lastTime: t.lastTime.toISOString() } : null };
    });
  }
  app.get('/auth/me/saves', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    return { saves: await listSaves(user.id), max: SAVES_MAX };
  });
  app.put<{ Body: { kind?: unknown; id?: unknown; note?: unknown; saved?: unknown } }>('/auth/me/saves', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const save = parseSave(request.body);
    if (typeof save === 'string') return reply.code(400).send({ error: save });
    if (typeof request.body?.saved !== 'boolean') return reply.code(400).send({ error: 'saved must be true or false' });
    const where = and(eq(userSaves.userId, user.id), eq(userSaves.kind, save.kind), eq(userSaves.targetId, save.id));
    if (!request.body.saved) {
      await db.delete(userSaves).where(where);
      return { saves: await listSaves(user.id), max: SAVES_MAX };
    }
    const [exists] =
      save.kind === 'article'
        ? await db.select({ id: articles.id }).from(articles).where(eq(articles.id, save.id))
        : await db.select({ id: eventThreads.id }).from(eventThreads).where(eq(eventThreads.id, save.id));
    if (!exists) return reply.code(404).send({ error: `no such ${save.kind}` });
    const [already] = await db.select({ id: userSaves.targetId }).from(userSaves).where(where);
    if (already) await db.update(userSaves).set({ note: save.note }).where(where);
    else {
      const [{ n }] = await db.select({ n: count() }).from(userSaves).where(eq(userSaves.userId, user.id));
      if (n >= SAVES_MAX) return reply.code(409).send({ error: `最多收藏 ${SAVES_MAX} 項` });
      await db.insert(userSaves).values({ userId: user.id, kind: save.kind, targetId: save.id, note: save.note, createdAt: new Date() });
    }
    return { saves: await listSaves(user.id), max: SAVES_MAX };
  });

  // ── Preferences and reading history ─────────────────────────────────────
  app.get('/auth/me/prefs', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    return { prefs: await loadPrefs(db, user.id) };
  });
  app.put('/auth/me/prefs', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const change = parsePrefs(request.body, known);
    if (typeof change === 'string') return reply.code(400).send({ error: change });
    const prefs = { ...(await loadPrefs(db, user.id)), ...change };
    // Turning the history off forgets it.
    if (change.history === false) await db.delete(readerHistory).where(eq(readerHistory.userId, user.id));
    const at = new Date();
    await db
      .insert(userPrefs)
      .values({ userId: user.id, prefs, updatedAt: at })
      .onDuplicateKeyUpdate({ set: { prefs, updatedAt: at } });
    return { prefs };
  });

  app.post<{ Body: { articleId?: unknown } }>('/auth/me/history', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const id = parseId(request.body?.articleId);
    if (!id) return reply.code(400).send({ error: 'articleId must be a positive integer' });
    if (!(await loadPrefs(db, user.id)).history) return { recorded: false };
    const [exists] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, id));
    if (!exists) return reply.code(404).send({ error: 'no such article' });
    const at = new Date();
    await db
      .insert(readerHistory)
      .values({ userId: user.id, articleId: id, readAt: at })
      .onDuplicateKeyUpdate({ set: { readAt: at } });
    return { recorded: true };
  });
  app.delete('/auth/me/history', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    await db.delete(readerHistory).where(eq(readerHistory.userId, user.id));
    return { deleted: true };
  });
  app.get('/auth/me/history/report', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    const since = new Date(Date.now() - REPORT_DAYS * 86_400e3);
    const rows = await db
      .select({
        id: articles.id,
        media: articles.media,
        title: articles.title,
        url: articles.url,
        tags: articles.tags,
        readAt: readerHistory.readAt,
      })
      .from(readerHistory)
      .innerJoin(articles, eq(articles.id, readerHistory.articleId))
      .where(and(eq(readerHistory.userId, user.id), gte(readerHistory.readAt, since)))
      .orderBy(desc(readerHistory.readAt))
      .limit(2000);
    return { enabled: Boolean((await loadPrefs(db, user.id)).history), ...readingReport(rows) };
  });

  // ── API keys ────────────────────────────────────────────────────────────
  const keyList = async (userId: number) =>
    (
      await db
        .select({
          id: userApiKeys.id,
          prefix: userApiKeys.prefix,
          label: userApiKeys.label,
          createdAt: userApiKeys.createdAt,
          lastUsedAt: userApiKeys.lastUsedAt,
        })
        .from(userApiKeys)
        .where(and(eq(userApiKeys.userId, userId), isNull(userApiKeys.revokedAt)))
        .orderBy(desc(userApiKeys.id))
    ).map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null }));
  app.get('/auth/me/api-keys', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    return { keys: await keyList(user.id), max: API_KEYS_PER_USER };
  });
  app.post<{ Body: { label?: unknown } }>('/auth/me/api-keys', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const label = typeof request.body?.label === 'string' ? request.body.label.trim() : '';
    if (!label || label.length > LABEL_MAX) return reply.code(400).send({ error: `label: name the key (at most ${LABEL_MAX} characters)` });
    if ((await keyList(user.id)).length >= API_KEYS_PER_USER)
      return reply.code(409).send({ error: `最多 ${API_KEYS_PER_USER} 把金鑰，請先撤銷一把` });
    const key = newApiKey();
    await db
      .insert(userApiKeys)
      .values({ userId: user.id, keyHash: hashToken(key), prefix: key.slice(0, 10), label, createdAt: new Date() });
    // The only time the key itself is sent.
    return reply.code(201).send({ key, keys: await keyList(user.id), max: API_KEYS_PER_USER });
  });
  app.delete<{ Params: { id: string } }>('/auth/me/api-keys/:id', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const id = parseId(request.params.id);
    const [row] = id
      ? await db
          .select({ hash: userApiKeys.keyHash })
          .from(userApiKeys)
          .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.id), isNull(userApiKeys.revokedAt)))
      : [];
    if (!row) return reply.code(404).send({ error: 'no such key' });
    await db
      .update(userApiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(userApiKeys.id, id as number));
    apiKeys.forget(row.hash);
    return { keys: await keyList(user.id), max: API_KEYS_PER_USER };
  });

  // ── Reports ─────────────────────────────────────────────────────────────
  const reportFields = {
    id: readerReports.id,
    articleId: readerReports.articleId,
    kind: readerReports.kind,
    tags: readerReports.tags,
    message: readerReports.message,
    status: readerReports.status,
    createdAt: readerReports.createdAt,
    resolvedAt: readerReports.resolvedAt,
    resolution: readerReports.resolution,
    title: articles.title,
    media: articles.media,
    url: articles.url,
  };
  app.get('/auth/me/reports', async (request, reply) => {
    const user = await reader(request, reply);
    if (!user) return reply;
    const rows = await db
      .select(reportFields)
      .from(readerReports)
      .leftJoin(articles, eq(articles.id, readerReports.articleId))
      .where(eq(readerReports.userId, user.id))
      .orderBy(desc(readerReports.id))
      .limit(100);
    return { reports: rows.map(reportView) };
  });
  app.post('/auth/me/reports', async (request, reply) => {
    const user = await reader(request, reply, true);
    if (!user) return reply;
    const report = parseReport(request.body);
    if (typeof report === 'string') return reply.code(400).send({ error: report });
    const [exists] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, report.articleId));
    if (!exists) return reply.code(404).send({ error: 'no such article' });
    const [{ n }] = await db
      .select({ n: count() })
      .from(readerReports)
      .where(and(eq(readerReports.userId, user.id), gte(readerReports.createdAt, new Date(Date.now() - 86_400e3))));
    if (n >= REPORTS_PER_DAY) return reply.code(429).send({ error: `每天最多回報 ${REPORTS_PER_DAY} 次` });
    const [{ id }] = await db
      .insert(readerReports)
      .values({ userId: user.id, ...report, createdAt: new Date() })
      .$returningId();
    return reply.code(201).send({ id });
  });

  app.get<{ Querystring: { status?: string } }>('/auth/admin/reports', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const status = ['open', 'accepted', 'rejected'].includes(request.query.status ?? '') ? request.query.status : 'open';
    const rows = await db
      .select({ ...reportFields, email: users.email, name: users.name, currentTags: articles.tags })
      .from(readerReports)
      .leftJoin(articles, eq(articles.id, readerReports.articleId))
      .leftJoin(users, eq(users.id, readerReports.userId))
      .where(eq(readerReports.status, status as 'open'))
      .orderBy(status === 'open' ? readerReports.id : desc(readerReports.id))
      .limit(200);
    const [{ open }] = await db.select({ open: count() }).from(readerReports).where(eq(readerReports.status, 'open'));
    return {
      open,
      reports: rows.map((r) => ({ ...reportView(r), reporter: { email: r.email, name: r.name }, currentTags: r.currentTags ?? [] })),
    };
  });
  // Resolving only records the decision; applying suggested tags goes through
  // PUT /auth/admin/articles/:id/tags, which keeps the tag log.
  app.put<{ Params: { id: string }; Body: { status?: unknown; resolution?: unknown } }>(
    '/auth/admin/reports/:id',
    async (request, reply) => {
      if (request.headers.origin !== origin) {
        reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
        return reply;
      }
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const id = parseId(request.params.id);
      const { status, resolution } = request.body ?? {};
      if (status !== 'accepted' && status !== 'rejected' && status !== 'open')
        return reply.code(400).send({ error: 'status must be accepted, rejected or open' });
      const note = typeof resolution === 'string' ? resolution.trim() : '';
      if (note.length > 255) return reply.code(400).send({ error: 'resolution must be at most 255 characters' });
      const [row] = id ? await db.select({ id: readerReports.id }).from(readerReports).where(eq(readerReports.id, id)) : [];
      if (!row) return reply.code(404).send({ error: 'no such report' });
      const open = status === 'open';
      await db
        .update(readerReports)
        .set({ status, resolvedAt: open ? null : new Date(), resolvedBy: open ? null : user.email, resolution: open ? null : note || null })
        .where(eq(readerReports.id, row.id));
      return { id: row.id, status };
    },
  );
}

type ReportRow = {
  id: number;
  articleId: number;
  kind: string;
  tags: string[] | null;
  message: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolution: string | null;
  title: string | null;
  media: string | null;
  url: string | null;
};
const reportView = (r: ReportRow) => ({
  id: r.id,
  kind: r.kind,
  tags: r.tags,
  message: r.message,
  status: r.status,
  createdAt: r.createdAt.toISOString(),
  resolvedAt: r.resolvedAt?.toISOString() ?? null,
  resolution: r.resolution,
  article: r.title
    ? { id: r.articleId, title: r.title, media: r.media as string, mediaTitle: mediaTitle(r.media as string), url: r.url }
    : null,
});

type HistoryRow = { id: number; media: string; title: string; url: string; tags: string[]; readAt: Date };

/** The /my/reading/ summary: which outlets, camps, countries and tags a reader's last month came from. */
export function readingReport(rows: HistoryRow[]) {
  const tally = <K>(keys: K[]) => {
    const map = new Map<K, number>();
    for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
    return [...map].sort((a, b) => b[1] - a[1]);
  };
  const days = new Map<string, number>();
  for (const r of rows) {
    const day = new Date(r.readAt.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const camps = { blue: 0, green: 0, other: 0 };
  for (const r of rows) camps[camp(r.media) ?? 'other']++;
  return {
    days: REPORT_DAYS,
    total: rows.length,
    media: tally(rows.map((r) => r.media)).map(([media, n]) => ({ media, title: mediaTitle(media), count: n, camp: camp(media) })),
    camps,
    countries: tally(rows.map((r) => outletIdentity(r.media).country || '未知')).map(([country, n]) => ({ country, count: n })),
    tags: tally(rows.flatMap((r) => [...new Set(r.tags)]))
      .slice(0, 20)
      .map(([tag, n]) => ({ tag, count: n })),
    daily: [...days].sort().map(([day, n]) => ({ day, count: n })),
    recent: rows.slice(0, 30).map((r) => ({
      id: r.id,
      media: r.media,
      mediaTitle: mediaTitle(r.media),
      title: r.title,
      url: r.url,
      readAt: r.readAt.toISOString(),
    })),
  };
}

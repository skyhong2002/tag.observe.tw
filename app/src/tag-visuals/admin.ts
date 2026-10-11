import { and, asc, desc, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { type TagVisualKind, type TagVisualStatus, tagVisualCandidates, tagVisualLog, tagVisuals } from '../db/schema.ts';
import { refreshPages } from '../pictures/refresh.ts';
import { visualMime } from '../v1/tag-visual.ts';
import { isEmoji } from './emoji.ts';
import { recolourLogo } from './recolour.ts';

// /admin/tag-visuals/: admins look over the pictures of non-person tags by
// status and by kind, click one of each tag's candidates (like the avatars'
// review), hide the picture, or set their own emoji or logo
// (docs/tag-visuals.md). AI picks stay hidden until chosen here; every change
// is logged in tag_visual_log, and re-runs leave chosen and hidden tags alone.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
  /** The web server, told to rebuild the home and tag pages when a picture changes. */
  uiOrigin?: string | null;
};

const STATUSES: TagVisualStatus[] = ['review', 'auto', 'voted', 'chosen', 'hidden', 'none'];
const KINDS: (TagVisualKind | 'none')[] = ['place', 'logo', 'emoji', 'none'];
const kindIs = (kind: TagVisualKind | 'none'): SQL => (kind === 'none' ? isNull(tagVisuals.kind) : eq(tagVisuals.kind, kind));
const PAGE = 60;
// A logo upload, base64 in JSON: up to about 3 MB of image.
const UPLOAD_LIMIT = 4 * 1024 * 1024;

const candidatePath = (tag: string, rank: number, at: Date, size: 'small' | 'large') =>
  `/auth/admin/tag-visuals/${encodeURIComponent(tag)}/candidates/${rank}?v=${(at.getTime() / 1000).toString(36)}${size === 'large' ? '&size=large' : ''}`;
const imagePath = (tag: string, at: Date, size: 'small' | 'large') =>
  `/auth/admin/tag-visuals/${encodeURIComponent(tag)}/image?v=${(at.getTime() / 1000).toString(36)}${size === 'large' ? '&size=large' : ''}`;

const columns = {
  tag: tagVisuals.tag,
  kind: tagVisuals.kind,
  status: tagVisuals.status,
  value: tagVisuals.value,
  wikidataId: tagVisuals.wikidataId,
  label: tagVisuals.label,
  note: tagVisuals.note,
  shownRank: tagVisuals.shownRank,
  hasImage: sql<number>`${tagVisuals.image} IS NOT NULL`,
  hasLarge: sql<number>`${tagVisuals.large} IS NOT NULL`,
  pageUrl: tagVisuals.pageUrl,
  license: tagVisuals.license,
  checkedAt: tagVisuals.checkedAt,
  reviewedBy: tagVisuals.reviewedBy,
  reviewedAt: tagVisuals.reviewedAt,
};

type Listed = {
  [K in keyof typeof columns]: K extends 'hasImage' | 'hasLarge'
    ? number
    : (typeof tagVisuals.$inferSelect)[K & keyof typeof tagVisuals.$inferSelect];
};

const present = ({ hasImage, hasLarge, ...r }: Listed) => {
  const at = r.reviewedAt ?? r.checkedAt;
  return {
    ...r,
    image: Number(hasImage) ? imagePath(r.tag, at, 'small') : null,
    large: Number(hasLarge) ? imagePath(r.tag, at, 'large') : null,
  };
};

export function registerTagVisualAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin, uiOrigin = null }: Options) {
  const sameOrigin = (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.origin === origin) return true;
    reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
    return false;
  };

  /** Each listed tag's candidates, best first, with admin image URLs. */
  const withCandidates = async (rows: ReturnType<typeof present>[]) => {
    const tags = rows.map((r) => r.tag);
    const found = tags.length
      ? await db
          .select({
            tag: tagVisualCandidates.tag,
            rank: tagVisualCandidates.rank,
            kind: tagVisualCandidates.kind,
            value: tagVisualCandidates.value,
            label: tagVisualCandidates.label,
            note: tagVisualCandidates.note,
            pageUrl: tagVisualCandidates.pageUrl,
            license: tagVisualCandidates.license,
            hasImage: sql<number>`${tagVisualCandidates.image} IS NOT NULL`,
            hasLarge: sql<number>`${tagVisualCandidates.large} IS NOT NULL`,
          })
          .from(tagVisualCandidates)
          .where(inArray(tagVisualCandidates.tag, tags))
          .orderBy(asc(tagVisualCandidates.tag), asc(tagVisualCandidates.rank))
      : [];
    return rows.map((r) => ({
      ...r,
      candidates: found
        .filter((c) => c.tag === r.tag)
        .map(({ tag, hasImage, hasLarge, ...c }) => ({
          ...c,
          image: Number(hasImage) ? candidatePath(tag, c.rank, r.checkedAt, 'small') : null,
          large: Number(hasLarge) ? candidatePath(tag, c.rank, r.checkedAt, 'large') : null,
        })),
    }));
  };

  // ?status= lists one status, newest first, ?kind= narrows it to one kind of
  // picture (none: no picture); ?tag= looks one tag up (a blank row if it has none yet).
  app.get<{ Querystring: { status?: string; kind?: string; offset?: string; tag?: string } }>(
    '/auth/admin/tag-visuals',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return reply;
      reply.header('cache-control', 'no-store');
      const status = STATUSES.find((s) => s === request.query.status) ?? 'review';
      const kind = KINDS.find((k) => k === request.query.kind) ?? null;
      const offset = Math.max(0, Number(request.query.offset) || 0);
      const [byStatus, byKind] = await Promise.all([
        db.select({ status: tagVisuals.status, n: sql<number>`COUNT(*)` }).from(tagVisuals).groupBy(tagVisuals.status),
        db
          .select({ kind: tagVisuals.kind, n: sql<number>`COUNT(*)` })
          .from(tagVisuals)
          .where(eq(tagVisuals.status, status))
          .groupBy(tagVisuals.kind),
      ]);
      const counts = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]));
      const kinds = Object.fromEntries(byKind.map((r) => [r.kind ?? 'none', Number(r.n)]));
      const tag = request.query.tag?.trim();
      if (tag) {
        const [row] = await db.select(columns).from(tagVisuals).where(eq(tagVisuals.tag, tag));
        return {
          status,
          kind,
          counts,
          kinds,
          offset: 0,
          next: null,
          visuals: row
            ? await withCandidates([present(row as Listed)])
            : [{ tag, kind: null, status: null, image: null, large: null, candidates: [] }],
        };
      }
      const rows = await db
        .select(columns)
        .from(tagVisuals)
        .where(and(eq(tagVisuals.status, status), kind ? kindIs(kind) : undefined))
        .orderBy(desc(tagVisuals.checkedAt), asc(tagVisuals.tag))
        .limit(PAGE)
        .offset(offset);
      return {
        status,
        kind,
        counts,
        kinds,
        offset,
        next: rows.length === PAGE ? offset + PAGE : null,
        visuals: await withCandidates(rows.map((r) => present(r as Listed))),
      };
    },
  );

  app.get<{ Params: { tag: string; rank: string }; Querystring: { size?: string } }>(
    '/auth/admin/tag-visuals/:tag/candidates/:rank',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return reply;
      const large = request.query.size === 'large';
      const [row] = await db
        .select({ kind: tagVisualCandidates.kind, image: large ? tagVisualCandidates.large : tagVisualCandidates.image })
        .from(tagVisualCandidates)
        .where(and(eq(tagVisualCandidates.tag, request.params.tag), eq(tagVisualCandidates.rank, Number(request.params.rank) || 0)));
      if (!row?.image) return reply.code(404).send({ error: 'no picture' });
      return reply
        .header('content-type', visualMime(row.kind))
        .header('cache-control', 'private, max-age=86400')
        .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
        .send(row.image);
    },
  );

  // Any status, for the review page only.
  app.get<{ Params: { tag: string }; Querystring: { size?: string } }>('/auth/admin/tag-visuals/:tag/image', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const large = request.query.size === 'large';
    const [row] = await db
      .select({ kind: tagVisuals.kind, image: large ? tagVisuals.large : tagVisuals.image })
      .from(tagVisuals)
      .where(eq(tagVisuals.tag, request.params.tag));
    if (!row?.image) return reply.code(404).send({ error: 'no picture' });
    return reply
      .header('content-type', visualMime(row.kind))
      .header('cache-control', 'private, max-age=86400')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(row.image);
  });

  const record = async (
    tag: string,
    action: (typeof tagVisualLog.$inferInsert)['action'],
    detail: string,
    email: string,
    set: Partial<typeof tagVisuals.$inferInsert>,
  ) => {
    const at = new Date();
    const values = { ...set, reviewedBy: email, reviewedAt: at };
    await db.transaction(async (tx) => {
      await tx
        .insert(tagVisuals)
        .values({ tag, status: 'chosen', checkedAt: at, ...values })
        .onDuplicateKeyUpdate({ set: values });
      await tx.insert(tagVisualLog).values({ tag, action, detail: detail.slice(0, 120), email, at });
    });
    refreshPages(uiOrigin, tag);
    return { tag, status: set.status, kind: set.kind, value: set.value, shownRank: set.shownRank, reviewedBy: email, reviewedAt: at };
  };

  // { rank } shows that candidate; { action: 'confirm' } shows what is in use;
  // { action: 'hide' } turns it off; { emoji } sets the admin's own and shows it.
  app.put<{ Params: { tag: string }; Body: { rank?: unknown; action?: unknown; emoji?: unknown } }>(
    '/auth/admin/tag-visuals/:tag',
    async (request, reply) => {
      if (!sameOrigin(request, reply)) return reply;
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const { tag } = request.params;
      if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
      const body = request.body ?? {};
      const [old] = await db
        .select({ kind: tagVisuals.kind, value: tagVisuals.value, status: tagVisuals.status })
        .from(tagVisuals)
        .where(eq(tagVisuals.tag, tag));
      const was = old?.kind ? `${old.kind} ${old.value ?? ''}`.trim() : '無';
      if (body.rank !== undefined) {
        if (!(typeof body.rank === 'number' && Number.isInteger(body.rank)))
          return reply.code(400).send({ error: 'rank must be a candidate rank' });
        const [c] = await db
          .select()
          .from(tagVisualCandidates)
          .where(and(eq(tagVisualCandidates.tag, tag), eq(tagVisualCandidates.rank, body.rank)));
        if (!c) return reply.code(404).send({ error: 'no such candidate' });
        const { tag: _, rank, ...picture } = c;
        return record(tag, 'pick', `${was} → #${rank} ${c.kind} ${c.value ?? ''}`.trim(), user.email, {
          ...picture,
          status: 'chosen',
          shownRank: rank,
        });
      }
      if (body.action === 'confirm') {
        if (!old?.kind) return reply.code(409).send({ error: 'nothing to confirm' });
        return record(tag, 'confirm', `${old.status} → chosen：${was}`, user.email, { status: 'chosen' });
      }
      if (body.action === 'hide') {
        if (!old) return reply.code(404).send({ error: 'no such tag visual' });
        return record(tag, 'hide', was, user.email, { status: 'hidden' });
      }
      const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : null;
      if (emoji !== null) {
        if (!isEmoji(emoji)) return reply.code(400).send({ error: 'not one emoji' });
        return record(tag, 'emoji', `${was} → ${emoji}`, user.email, {
          status: 'chosen',
          kind: 'emoji',
          value: emoji,
          shownRank: null,
          note: null,
          image: null,
          large: null,
          pageUrl: null,
          license: null,
          licenseUrl: null,
          artist: null,
        });
      }
      return reply.code(400).send({ error: 'send rank, action (confirm or hide) or emoji' });
    },
  );

  // { image: base64 } of a PNG, JPEG, WebP or SVG logo: recoloured and shown.
  app.post<{ Params: { tag: string }; Body: { image?: unknown } }>(
    '/auth/admin/tag-visuals/:tag/logo',
    { bodyLimit: UPLOAD_LIMIT },
    async (request, reply) => {
      if (!sameOrigin(request, reply)) return reply;
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const { tag } = request.params;
      if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
      const data = typeof request.body?.image === 'string' ? Buffer.from(request.body.image, 'base64') : null;
      if (!data?.length) return reply.code(400).send({ error: 'image (base64) required' });
      let image: Buffer;
      try {
        image = await recolourLogo(data);
      } catch (err) {
        return reply.code(400).send({ error: `unreadable image: ${(err as Error).message}` });
      }
      return record(tag, 'upload', `${data.length} bytes`, user.email, {
        status: 'chosen',
        kind: 'logo',
        value: null,
        shownRank: null,
        note: '管理員上傳',
        image,
        large: null,
        pageUrl: null,
        license: null,
        licenseUrl: null,
        artist: null,
      });
    },
  );
}

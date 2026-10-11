import { asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { type TagVisualStatus, tagVisualLog, tagVisuals } from '../db/schema.ts';
import { visualMime } from '../v1/tag-visual.ts';
import { iconSvg, isEmoji, isIcon, searchIcons } from './icons.ts';
import { recolourLogo } from './recolour.ts';

// /admin/tag-visuals/: admins confirm or hide the pictures of non-person
// tags, swap in another emoji or icon, or upload a logo
// (docs/tag-visuals.md). AI picks stay hidden until confirmed here; every
// change is logged in tag_visual_log, and re-runs leave chosen and hidden
// tags alone.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};

const STATUSES: TagVisualStatus[] = ['review', 'auto', 'chosen', 'hidden', 'none'];
const PAGE = 60;
// A logo upload, base64 in JSON: up to about 3 MB of image.
const UPLOAD_LIMIT = 4 * 1024 * 1024;

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

export function registerTagVisualAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin }: Options) {
  const sameOrigin = (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.origin === origin) return true;
    reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
    return false;
  };

  // ?status= lists one status, newest first; ?tag= looks one tag up (a blank row if it has none yet).
  app.get<{ Querystring: { status?: string; offset?: string; tag?: string } }>('/auth/admin/tag-visuals', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const status = STATUSES.find((s) => s === request.query.status) ?? 'review';
    const offset = Math.max(0, Number(request.query.offset) || 0);
    const counts = Object.fromEntries(
      (await db.select({ status: tagVisuals.status, n: sql<number>`COUNT(*)` }).from(tagVisuals).groupBy(tagVisuals.status)).map((r) => [
        r.status,
        Number(r.n),
      ]),
    );
    const tag = request.query.tag?.trim();
    if (tag) {
      const [row] = await db.select(columns).from(tagVisuals).where(eq(tagVisuals.tag, tag));
      return {
        status,
        counts,
        offset: 0,
        next: null,
        visuals: [row ? present(row as Listed) : { tag, kind: null, status: null, image: null, large: null }],
      };
    }
    const rows = await db
      .select(columns)
      .from(tagVisuals)
      .where(eq(tagVisuals.status, status))
      .orderBy(desc(tagVisuals.checkedAt), asc(tagVisuals.tag))
      .limit(PAGE)
      .offset(offset);
    return { status, counts, offset, next: rows.length === PAGE ? offset + PAGE : null, visuals: rows.map((r) => present(r as Listed)) };
  });

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

  app.get<{ Querystring: { q?: string } }>('/auth/admin/tag-visuals/icons', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    return { icons: searchIcons(request.query.q ?? '') };
  });

  app.get<{ Params: { name: string } }>('/auth/admin/tag-visuals/icons/:name', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const svg = iconSvg(request.params.name);
    if (!svg) return reply.code(404).send({ error: 'no such icon' });
    return reply.header('content-type', 'image/svg+xml').header('cache-control', 'private, max-age=86400').send(svg);
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
    return { tag, status: set.status, kind: set.kind, value: set.value, reviewedBy: email, reviewedAt: at };
  };

  // { action: 'confirm' } shows what is there; { action: 'hide' } turns it off;
  // { emoji } or { icon } replaces it and shows it.
  app.put<{ Params: { tag: string }; Body: { action?: unknown; emoji?: unknown; icon?: unknown } }>(
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
          note: null,
          image: null,
          large: null,
          pageUrl: null,
          license: null,
          licenseUrl: null,
          artist: null,
        });
      }
      const icon = typeof body.icon === 'string' ? body.icon.trim() : null;
      if (icon !== null) {
        if (!isIcon(icon)) return reply.code(400).send({ error: 'no such icon' });
        return record(tag, 'icon', `${was} → ${icon}`, user.email, {
          status: 'chosen',
          kind: 'icon',
          value: icon,
          note: null,
          image: Buffer.from(iconSvg(icon) as string),
          large: null,
          pageUrl: null,
          license: null,
          licenseUrl: null,
          artist: null,
        });
      }
      return reply.code(400).send({ error: 'send action (confirm or hide), emoji or icon' });
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

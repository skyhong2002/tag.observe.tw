import { and, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import type { Db } from '../db/client.ts';
import { type TagVisualKind, tagVisuals } from '../db/schema.ts';
import { parseAccent, reaccent, reaccentSvg } from '../tag-visuals/recolour.ts';

// The picture for a non-person tag (docs/tag-visuals.md): a place outline,
// a flag or a logo in the site's orange, or an emoji. AI picks waiting for
// review and hidden ones are not served. Pictures are stored in the brand
// orange; `accent` (six hex digits) serves them in another service's colour.

export const SHOWN_VISUAL = ['auto', 'chosen', 'voted'] as const;
/** Flags and logos are raster (WebP); place outlines are SVG. */
export const isRaster = (kind: TagVisualKind | null) => kind === 'logo' || kind === 'flag';
export const visualMime = (kind: TagVisualKind | null) => (isRaster(kind) ? 'image/webp' : 'image/svg+xml');

// `v` changes whenever the picture can change (a re-run or an admin edit), so the image itself caches for a day.
const imagePath = (tag: string, at: Date, size: 'small' | 'large', accent: string | null = null) =>
  `/api/v1/tags/${encodeURIComponent(tag)}/visual-image?v=${(at.getTime() / 1000).toString(36)}${size === 'large' ? '&size=large' : ''}${accent ? `&accent=${accent}` : ''}`;

/**
 * Every shown picture that can stand in for its word in a cloud (the home
 * page draws them like the person sketches): Taiwan places as where they are
 * on the island, other places as their outline, logos, emoji as themselves.
 * A logo or flag also gets its width ÷ height, so the cloud can give a
 * wordmark a wide slot instead of a square.
 */
export async function tagVisualsForCloud(db: Db, accent: string | null = null) {
  const rows = await db
    .select({
      tag: tagVisuals.tag,
      kind: tagVisuals.kind,
      value: tagVisuals.value,
      checkedAt: tagVisuals.checkedAt,
      reviewedAt: tagVisuals.reviewedAt,
      hasImage: sql<number>`${tagVisuals.image} IS NOT NULL`,
      hasLarge: sql<number>`${tagVisuals.large} IS NOT NULL`,
    })
    .from(tagVisuals)
    .where(inArray(tagVisuals.status, [...SHOWN_VISUAL]));
  const logos = new Map(
    (
      await db
        .select({ tag: tagVisuals.tag, image: tagVisuals.image })
        .from(tagVisuals)
        .where(and(inArray(tagVisuals.kind, ['logo', 'flag']), inArray(tagVisuals.status, [...SHOWN_VISUAL])))
    ).map((r) => [r.tag, r.image] as const),
  );
  const aspectOf = async (image: Buffer | null | undefined) => {
    if (!image) return undefined;
    const { width, height } = await sharp(image)
      .metadata()
      .catch(() => ({ width: 0, height: 0 }));
    return width && height ? Math.round((width / height) * 100) / 100 : undefined;
  };
  const out: Record<string, { kind: TagVisualKind; image: string | null; emoji: string | null; aspect?: number }> = {};
  for (const r of rows) {
    if (!r.kind) continue;
    const at = r.reviewedAt ?? r.checkedAt;
    if (r.kind === 'emoji') {
      if (r.value) out[r.tag] = { kind: r.kind, image: null, emoji: r.value };
      continue;
    }
    const taiwan = r.kind === 'place' && r.value?.startsWith('tw-') && Number(r.hasLarge);
    if (!taiwan && !Number(r.hasImage)) continue;
    const aspect = isRaster(r.kind) ? await aspectOf(logos.get(r.tag)) : undefined;
    out[r.tag] = {
      kind: r.kind,
      image: imagePath(r.tag, at, taiwan ? 'large' : 'small', accent),
      emoji: null,
      ...(aspect ? { aspect } : {}),
    };
  }
  return out;
}

export async function tagVisual(db: Db, tag: string, accent: string | null = null) {
  const [v] = await db
    .select({
      kind: tagVisuals.kind,
      value: tagVisuals.value,
      label: tagVisuals.label,
      wikidataId: tagVisuals.wikidataId,
      hasImage: sql<number>`${tagVisuals.image} IS NOT NULL`,
      hasLarge: sql<number>`${tagVisuals.large} IS NOT NULL`,
      pageUrl: tagVisuals.pageUrl,
      license: tagVisuals.license,
      licenseUrl: tagVisuals.licenseUrl,
      artist: tagVisuals.artist,
      checkedAt: tagVisuals.checkedAt,
      reviewedAt: tagVisuals.reviewedAt,
    })
    .from(tagVisuals)
    .where(and(eq(tagVisuals.tag, tag), inArray(tagVisuals.status, [...SHOWN_VISUAL])));
  if (!v?.kind) return null;
  const at = v.reviewedAt ?? v.checkedAt;
  return {
    kind: v.kind,
    emoji: v.kind === 'emoji' ? v.value : null,
    label: v.label,
    wikidataId: v.wikidataId,
    image: Number(v.hasImage) ? imagePath(tag, at, 'small', accent) : null,
    large: Number(v.hasLarge) ? imagePath(tag, at, 'large', accent) : null,
    source: v.pageUrl ? { pageUrl: v.pageUrl, license: v.license, licenseUrl: v.licenseUrl, artist: v.artist } : null,
  };
}

export function registerTagVisual(app: FastifyInstance, db: Db) {
  app.get<{ Querystring: { accent?: string } }>('/api/v1/tag-visuals', async (request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return { visuals: await tagVisualsForCloud(db, parseAccent(request.query.accent)) };
  });

  app.get<{ Params: { tag: string }; Querystring: { accent?: string } }>('/api/v1/tags/:tag/visual', async (request, reply) => {
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    reply.header('cache-control', 'public, max-age=300');
    return { tag, visual: await tagVisual(db, tag, parseAccent(request.query.accent)) };
  });

  // small: the outline or logo (tag chips); large: where the place is (tag page).
  app.get<{ Params: { tag: string }; Querystring: { size?: string; accent?: string } }>(
    '/api/v1/tags/:tag/visual-image',
    async (request, reply) => {
      const large = request.query.size === 'large';
      const [row] = await db
        .select({ kind: tagVisuals.kind, image: large ? tagVisuals.large : tagVisuals.image })
        .from(tagVisuals)
        .where(and(eq(tagVisuals.tag, request.params.tag), inArray(tagVisuals.status, [...SHOWN_VISUAL])));
      if (!row?.image) return reply.code(404).send({ error: 'no picture' });
      const accent = parseAccent(request.query.accent);
      const body = !accent ? row.image : isRaster(row.kind) ? await reaccent(row.image, accent) : reaccentSvg(row.image, accent);
      return reply
        .header('content-type', visualMime(row.kind))
        .header('cache-control', 'public, max-age=86400')
        .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
        .send(body);
    },
  );
}

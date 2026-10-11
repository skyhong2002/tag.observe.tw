import { and, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { type TagVisualKind, tagVisuals } from '../db/schema.ts';

// The picture for a non-person tag (docs/tag-visuals.md): a place outline,
// a logo in the site's orange, an emoji or a line icon. AI picks waiting for
// review and hidden ones are not served.

export const SHOWN_VISUAL = ['auto', 'chosen'] as const;
export const visualMime = (kind: TagVisualKind | null) => (kind === 'logo' ? 'image/webp' : 'image/svg+xml');

// `v` changes whenever the picture can change (a re-run or an admin edit), so the image itself caches for a day.
const imagePath = (tag: string, at: Date, size: 'small' | 'large') =>
  `/api/v1/tags/${encodeURIComponent(tag)}/visual-image?v=${(at.getTime() / 1000).toString(36)}${size === 'large' ? '&size=large' : ''}`;

export async function tagVisual(db: Db, tag: string) {
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
    icon: v.kind === 'icon' ? v.value : null,
    label: v.label,
    wikidataId: v.wikidataId,
    image: Number(v.hasImage) ? imagePath(tag, at, 'small') : null,
    large: Number(v.hasLarge) ? imagePath(tag, at, 'large') : null,
    source: v.pageUrl ? { pageUrl: v.pageUrl, license: v.license, licenseUrl: v.licenseUrl, artist: v.artist } : null,
  };
}

export function registerTagVisual(app: FastifyInstance, db: Db) {
  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/visual', async (request, reply) => {
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    reply.header('cache-control', 'public, max-age=300');
    return { tag, visual: await tagVisual(db, tag) };
  });

  // small: the outline, logo or icon (tag chips); large: where the place is (tag page).
  app.get<{ Params: { tag: string }; Querystring: { size?: string } }>('/api/v1/tags/:tag/visual-image', async (request, reply) => {
    const large = request.query.size === 'large';
    const [row] = await db
      .select({ kind: tagVisuals.kind, image: large ? tagVisuals.large : tagVisuals.image })
      .from(tagVisuals)
      .where(and(eq(tagVisuals.tag, request.params.tag), inArray(tagVisuals.status, [...SHOWN_VISUAL])));
    if (!row?.image) return reply.code(404).send({ error: 'no picture' });
    return reply
      .header('content-type', visualMime(row.kind))
      .header('cache-control', 'public, max-age=86400')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(row.image);
  });
}

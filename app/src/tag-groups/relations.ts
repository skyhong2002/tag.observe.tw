import { sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { outletIdentity } from '../similarity/attribution.ts';

// Keep evidence local to an article. A keyword supplied by a publisher is
// not proof of a mention, authorship or speech. No body/PII is exposed here.
export function registerTagRelationsAdmin(
  app: FastifyInstance,
  db: Db,
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>,
) {
  app.get<{ Params: { tag: string }; Querystring: { before?: string } }>('/auth/admin/tags/:tag/articles', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const tag = request.params.tag.trim();
    if (!tag || tag.length > 60) return reply.code(400).send({ error: 'tag must be 1–60 characters' });
    const before = request.query.before === undefined ? null : Number(request.query.before);
    if (before !== null && (!Number.isSafeInteger(before) || before < 1)) return reply.code(400).send({ error: 'invalid before' });
    // Materialize the indexed lookups before joining articles. IN (UNION ...)
    // can make MariaDB scan the entire articles table for a rare tag.
    // UNION deduplicates ids, so both relationships still occupy one row.
    const [result] = await db.execute(sql`
      SELECT a.id, a.title, a.url, a.media, DATE_FORMAT(a.published_at, '%Y-%m-%dT%H:%i:%s.000Z') AS publishedAt,
        EXISTS(SELECT 1 FROM article_tags t WHERE t.article_id = a.id AND t.tag = ${tag}) AS tagged,
        w.poster, w.platform, w.evidence, w.version
      FROM (
        SELECT article_id FROM article_tags WHERE tag = ${tag}
          ${before === null ? sql`` : sql`AND article_id < ${before}`}
        UNION SELECT article_id FROM article_writing WHERE poster = ${tag} AND platform IS NOT NULL
          ${before === null ? sql`` : sql`AND article_id < ${before}`}
      ) matches
      STRAIGHT_JOIN articles a ON a.id = matches.article_id
      LEFT JOIN article_writing w ON w.article_id = a.id AND w.poster = ${tag}
      ORDER BY a.id DESC LIMIT 31`);
    type Row = {
      id: number;
      title: string;
      url: string;
      media: string;
      publishedAt: string;
      tagged: number;
      poster: string | null;
      platform: string | null;
      evidence: string | null;
      version: string | null;
    };
    const rows = result as unknown as Row[];
    const page = rows.slice(0, 30);
    return {
      tag,
      articles: page.map((r) => ({
        id: Number(r.id),
        title: r.title,
        url: r.url,
        media: r.media,
        mediaName: outletIdentity(r.media).name,
        publishedAt: r.publishedAt,
        relations: [
          ...(r.tagged ? [{ kind: 'tagged', label: '文章標籤', evidence: '文章目前的標籤資料', version: null, platform: null }] : []),
          ...(r.poster && r.platform
            ? [{ kind: 'retold', label: '被轉述', evidence: r.evidence, version: r.version, platform: r.platform }]
            : []),
        ],
      })),
      next: rows.length > 30 ? Number(page[page.length - 1].id) : null,
    };
  });
}

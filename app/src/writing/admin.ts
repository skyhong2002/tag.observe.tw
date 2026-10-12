import { desc, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { writingPeopleLog } from '../db/schema.ts';
import { taipeiDay } from '../v1/event-archive.ts';
import { roleTags } from './roles.ts';

// Read-only list of detected retelling subjects for unified tag management.
// Manual classifications are edited through tag-groups/admin.ts.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};
export function registerWritingAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin }: Options) {
  app.get<{ Querystring: { q?: string } }>('/auth/admin/writing/people', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const since = taipeiDay(new Date(Date.now() - 30 * 86400e3));
    const q = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 40) : '';
    // Count each article once, but credit every label in its set.
    const [rows] = await db.execute(sql`
      SELECT w.poster AS name, w.role, w.roles, w.role_source AS basis, COUNT(*) AS n
      FROM article_writing w
      WHERE w.day >= ${since} AND w.poster IS NOT NULL
        ${q ? sql`AND w.poster LIKE ${`%${q}%`}` : sql``}
      GROUP BY w.poster, w.role, w.roles, w.role_source`);
    const [outletRows] = await db.execute(sql`
      SELECT w.poster AS name, COUNT(DISTINCT w.media) AS outlets, MAX(p.source) AS source, MAX(p.note) AS note
      FROM article_writing w LEFT JOIN writing_people p ON p.name = w.poster
      WHERE w.day >= ${since} AND w.poster IS NOT NULL
        ${q ? sql`AND w.poster LIKE ${`%${q}%`}` : sql``}
      GROUP BY w.poster`);
    const extra = new Map(
      (outletRows as unknown as Array<{ name: string; outlets: number; source: string | null; note: string | null }>).map((r) => [
        r.name,
        r,
      ]),
    );
    const byName = new Map<string, { roles: Map<string, number>; bases: Map<string, number>; articles: number }>();
    for (const r of rows as unknown as Array<{ name: string; role: string; roles: unknown; basis: string | null; n: number }>) {
      const e = byName.get(r.name) ?? { roles: new Map(), bases: new Map(), articles: 0 };
      const n = Number(r.n);
      e.articles += n;
      for (const role of roleTags(r.roles, r.role)) e.roles.set(role, (e.roles.get(role) ?? 0) + n);
      e.bases.set(r.basis ?? '', (e.bases.get(r.basis ?? '') ?? 0) + n);
      byName.set(r.name, e);
    }
    const top = <K>(m: Map<K, number>) => [...m].sort((a, b) => b[1] - a[1]);
    const posters = [...byName]
      .sort((a, b) => b[1].articles - a[1].articles)
      .slice(0, 200)
      .map(([name, e]) => ({
        name,
        role: top(e.roles)[0][0],
        tags: roleTags([...e.roles.keys()]),
        roles: top(e.roles).map(([role, n]) => ({ role, n })),
        basis: top(e.bases)[0][0] || null,
        articles: e.articles,
        outlets: Number(extra.get(name)?.outlets ?? 0),
        source: extra.get(name)?.source ?? null,
        note: extra.get(name)?.note ?? null,
      }));
    const log = await db.select().from(writingPeopleLog).orderBy(desc(writingPeopleLog.id)).limit(30);
    return {
      since,
      posters,
      log: log.map((r) => ({ ...r, beforeRoles: roleTags(r.beforeRoles, r.before), afterRoles: roleTags(r.afterRoles, r.after) })),
    };
  });

  // Old clients must not create a second, competing classification source.
  app.put<{ Params: { name: string } }>('/auth/admin/writing/people/:name', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (request.headers.origin !== origin) return reply.code(403).send({ error: 'same-origin requests only' });
    if (!(await requireAdmin(request, reply))) return reply;
    return reply.code(409).send({
      error: '請至「標籤管理」編輯共用分類。',
      manageUrl: `/admin/tags/?tag=${encodeURIComponent(request.params.name)}`,
    });
  });
}

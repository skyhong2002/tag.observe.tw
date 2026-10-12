import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { articleWriting, writingPeople, writingPeopleLog } from '../db/schema.ts';
import { taipeiDay } from '../v1/event-archive.ts';
import { parseRoles, roleTags } from './roles.ts';
import { ROLES } from './rules.ts';

// Admins correct the labels of a speaker name on /admin/writing/. A correction
// wins over title words in the article and over the learned role, applies to
// every analysed article naming that poster, and is logged with who and why.
// Clearing it hands the name back to the daily people job.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};
const NOTE_MAX = 255;

/** Rows that name this poster: exactly, or as the end of an unresolved name run. */
const naming = (name: string) =>
  or(
    eq(articleWriting.poster, name),
    and(eq(articleWriting.role, '未知'), like(articleWriting.poster, `%${name.replace(/[\\%_]/g, '\\$&')}`)),
  );

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

  app.put<{ Params: { name: string }; Body: { roles?: unknown; role?: unknown; note?: unknown } }>(
    '/auth/admin/writing/people/:name',
    async (request, reply) => {
      if (request.headers.origin !== origin) {
        reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
        return reply;
      }
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const name = request.params.name.trim();
      if (name.length < 2 || name.length > 40) return reply.code(400).send({ error: 'name must be 2–40 characters' });
      // Accept the legacy single-role payload during a rolling frontend upgrade.
      const roles = parseRoles(
        request.body?.roles !== undefined ? request.body.roles : request.body?.role === null ? null : [request.body?.role],
      );
      if (roles === undefined)
        return reply
          .code(400)
          .send({ error: `roles must be a non-empty array of ${ROLES.filter((r) => r !== '未知').join('、')}, or null to clear` });
      const role = roles?.[0] ?? null;
      const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
      if (role !== null && !note) return reply.code(400).send({ error: 'note: say why the role is corrected' });
      if (note.length > NOTE_MAX) return reply.code(400).send({ error: `note must be at most ${NOTE_MAX} characters` });
      const at = new Date();
      const result = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(writingPeople).where(eq(writingPeople.name, name));
        const before = current?.source === 'admin' ? current.role : null;
        const beforeRoles = current?.source === 'admin' ? roleTags(current.roles, current.role) : null;
        let relabelled = 0;
        if (role === null) {
          if (current?.source === 'admin') await tx.delete(writingPeople).where(eq(writingPeople.name, name));
          // Back to 未知 until the people job or the clause decides again.
          const [r] = await tx
            .update(articleWriting)
            .set({ role: '未知', roles: ['未知'], roleSource: null })
            .where(and(eq(articleWriting.poster, name), eq(articleWriting.roleSource, 'people')));
          relabelled = r.affectedRows;
        } else {
          await tx
            .insert(writingPeople)
            .values({ name, role, roles, source: 'admin', note, email: user.email, updatedAt: at })
            .onDuplicateKeyUpdate({ set: { role, roles, source: 'admin', note, email: user.email, updatedAt: at } });
          const [r] = await tx.update(articleWriting).set({ role, roles, poster: name, roleSource: 'people' }).where(naming(name));
          relabelled = r.affectedRows;
        }
        if (before !== null || role !== null)
          await tx
            .insert(writingPeopleLog)
            .values({ name, before, after: role, beforeRoles, afterRoles: roles, note, email: user.email, at });
        return { relabelled };
      });
      return { name, role, roles, note, ...result };
    },
  );
}

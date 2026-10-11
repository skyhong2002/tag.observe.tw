import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { articleWriting, writingPeople, writingPeopleLog } from '../db/schema.ts';
import { taipeiDay } from '../v1/event-archive.ts';
import { ROLES, type Role } from './rules.ts';

// Admins correct the role of a poster name on /admin/writing/. A correction
// wins over title words in the article and over the learned role, applies to
// every analysed article naming that poster, and is logged with who and why.
// Clearing it hands the name back to the daily people job.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};
const NOTE_MAX = 255;

export function parseRole(value: unknown): Role | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value) && value !== '未知' ? (value as Role) : undefined;
}

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
    const [posters] = await db.execute(sql`
      SELECT w.poster AS name, MAX(w.role) AS role, COUNT(*) AS articles, COUNT(DISTINCT w.media) AS outlets,
        MAX(p.source) AS source, MAX(p.note) AS note
      FROM article_writing w LEFT JOIN writing_people p ON p.name = w.poster
      WHERE w.day >= ${since} AND w.poster IS NOT NULL AND w.role <> '網友民眾'
        ${q ? sql`AND w.poster LIKE ${`%${q}%`}` : sql``}
      GROUP BY w.poster ORDER BY articles DESC LIMIT 200`);
    const log = await db.select().from(writingPeopleLog).orderBy(desc(writingPeopleLog.id)).limit(30);
    return { since, posters, log };
  });

  app.put<{ Params: { name: string }; Body: { role?: unknown; note?: unknown } }>(
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
      const role = parseRole(request.body?.role);
      if (role === undefined)
        return reply.code(400).send({ error: `role must be one of ${ROLES.filter((r) => r !== '未知').join('、')}, or null to clear` });
      const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
      if (role !== null && !note) return reply.code(400).send({ error: 'note: say why the role is corrected' });
      if (note.length > NOTE_MAX) return reply.code(400).send({ error: `note must be at most ${NOTE_MAX} characters` });
      const at = new Date();
      const result = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(writingPeople).where(eq(writingPeople.name, name));
        const before = current?.source === 'admin' ? current.role : null;
        let relabelled = 0;
        if (role === null) {
          if (current?.source === 'admin') await tx.delete(writingPeople).where(eq(writingPeople.name, name));
          // Back to 未知 until the people job or the clause decides again.
          const [r] = await tx
            .update(articleWriting)
            .set({ role: '未知', roleSource: null })
            .where(and(eq(articleWriting.poster, name), eq(articleWriting.roleSource, 'people')));
          relabelled = r.affectedRows;
        } else {
          await tx
            .insert(writingPeople)
            .values({ name, role, source: 'admin', note, email: user.email, updatedAt: at })
            .onDuplicateKeyUpdate({ set: { role, source: 'admin', note, email: user.email, updatedAt: at } });
          const [r] = await tx.update(articleWriting).set({ role, poster: name, roleSource: 'people' }).where(naming(name));
          relabelled = r.affectedRows;
        }
        if (before !== null || role !== null)
          await tx.insert(writingPeopleLog).values({ name, before, after: role, note, email: user.email, at });
        return { relabelled };
      });
      return { name, role, note, ...result };
    },
  );
}

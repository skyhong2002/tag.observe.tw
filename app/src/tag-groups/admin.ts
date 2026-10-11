import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { type TagGroupStatus, tagGroupDefs, tagGroupMemberLog, tagGroupMembers, tagWikidata } from '../db/schema.ts';

// /admin/tag-groups/: admins confirm or reject what the rules filed, put a
// tag in any group by hand and add groups (docs/tag-groups.md). Every
// decision is logged in tag_group_member_log.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};

const STATUSES: TagGroupStatus[] = ['review', 'auto', 'confirmed', 'rejected'];
const PAGE = 100;

export function registerTagGroupAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin }: Options) {
  const sameOrigin = (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.origin === origin) return true;
    reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
    return false;
  };

  app.get('/auth/admin/tag-groups', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const [defs, counts] = await Promise.all([
      db.select().from(tagGroupDefs).orderBy(asc(tagGroupDefs.sort), asc(tagGroupDefs.id)),
      db
        .select({ groupId: tagGroupMembers.groupId, status: tagGroupMembers.status, n: sql<number>`COUNT(*)` })
        .from(tagGroupMembers)
        .groupBy(tagGroupMembers.groupId, tagGroupMembers.status),
    ]);
    return {
      groups: defs.map((d) => ({
        id: d.id,
        label: d.label,
        kind: d.kind,
        counts: Object.fromEntries(counts.filter((c) => c.groupId === d.id).map((c) => [c.status, Number(c.n)])),
      })),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { status?: string; offset?: string } }>(
    '/auth/admin/tag-groups/:id',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return reply;
      reply.header('cache-control', 'no-store');
      const groupId = Number(request.params.id);
      const status = STATUSES.find((s) => s === request.query.status) ?? 'review';
      const offset = Math.max(0, Number(request.query.offset) || 0);
      const members = await db
        .select()
        .from(tagGroupMembers)
        .where(and(eq(tagGroupMembers.groupId, groupId), eq(tagGroupMembers.status, status)))
        .orderBy(sql`${tagGroupMembers.score} IS NULL`, sql`${tagGroupMembers.score} DESC`, asc(tagGroupMembers.tag))
        .limit(PAGE)
        .offset(offset);
      return { groupId, status, offset, next: members.length === PAGE ? offset + PAGE : null, members };
    },
  );

  // Every group a tag is in or was rejected from, plus its Wikidata type.
  app.get<{ Params: { tag: string } }>('/auth/admin/tag-groups/tags/:tag', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const { tag } = request.params;
    const [members, [wikidata]] = await Promise.all([
      db.select().from(tagGroupMembers).where(eq(tagGroupMembers.tag, tag)),
      db.select().from(tagWikidata).where(eq(tagWikidata.tag, tag)),
    ]);
    return { tag, members, wikidata: wikidata ?? null };
  });

  // { status: 'confirmed' } puts the tag in the group (adding it if needed);
  // { status: 'rejected' } takes it out and keeps the rules from re-adding it.
  app.put<{ Params: { id: string; tag: string }; Body: { status?: unknown } }>(
    '/auth/admin/tag-groups/:id/tags/:tag',
    async (request, reply) => {
      if (!sameOrigin(request, reply)) return reply;
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const groupId = Number(request.params.id);
      const tag = request.params.tag.trim();
      const status = request.body?.status;
      if (status !== 'confirmed' && status !== 'rejected') return reply.code(400).send({ error: 'status must be confirmed or rejected' });
      if (!tag || tag.length > 60) return reply.code(400).send({ error: 'tag must be 1–60 characters' });
      const [group] = await db.select({ id: tagGroupDefs.id }).from(tagGroupDefs).where(eq(tagGroupDefs.id, groupId));
      if (!group) return reply.code(404).send({ error: 'no such group' });
      const [old] = await db
        .select()
        .from(tagGroupMembers)
        .where(and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.groupId, groupId)));
      const at = new Date();
      const set = { status, reviewedBy: user.email, reviewedAt: at, updatedAt: at } as const;
      await db.transaction(async (tx) => {
        if (old)
          await tx
            .update(tagGroupMembers)
            .set(set)
            .where(and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.groupId, groupId)));
        else await tx.insert(tagGroupMembers).values({ tag, groupId, source: 'admin', ...set });
        await tx.insert(tagGroupMemberLog).values({
          tag,
          groupId,
          action: status === 'confirmed' ? 'confirm' : 'reject',
          fromStatus: old?.status ?? null,
          email: user.email,
          at,
        });
      });
      return { tag, groupId, status };
    },
  );

  app.post<{ Body: { label?: unknown; kind?: unknown } }>('/auth/admin/tag-groups', async (request, reply) => {
    if (!sameOrigin(request, reply)) return reply;
    if (!(await requireAdmin(request, reply))) return reply;
    const label = typeof request.body?.label === 'string' ? request.body.label.trim() : '';
    const kind = request.body?.kind === 'topic' ? 'topic' : 'group';
    if (!label || label.length > 32) return reply.code(400).send({ error: 'label must be 1–32 characters' });
    const [dupe] = await db.select({ id: tagGroupDefs.id }).from(tagGroupDefs).where(eq(tagGroupDefs.label, label));
    if (dupe) return reply.code(409).send({ error: 'group exists', id: dupe.id });
    const [{ sort }] = await db.select({ sort: sql<number>`COALESCE(MAX(${tagGroupDefs.sort}), 0) + 1` }).from(tagGroupDefs);
    const [res] = await db.insert(tagGroupDefs).values({ label, kind, sort: Number(sort), createdAt: new Date() });
    return { id: res.insertId, label, kind };
  });
}

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { type TagGroupStatus, tagGroupDefLog, tagGroupDefs, tagGroupMemberLog, tagGroupMembers, tagWikidata } from '../db/schema.ts';
import { registerTagRelationsAdmin } from './relations.ts';
import { activeGroups, descendants, moveProblem } from './tree.ts';
import { syncWritingTag, tagsInGroups } from './writing.ts';

// /admin/tag-groups/: admins confirm or reject what the rules filed, put a
// tag in any group by hand, and add, rename, nest, reorder or delete groups
// (docs/tag-groups.md). Member decisions are logged in
// tag_group_member_log, group changes in tag_group_def_log.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};

const STATUSES: TagGroupStatus[] = ['review', 'auto', 'confirmed', 'rejected'];
const PAGE = 100;

export function registerTagGroupAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin }: Options) {
  registerTagRelationsAdmin(app, db, requireAdmin);
  const sameOrigin = (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.origin === origin) return true;
    reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
    return false;
  };
  /** The signed-in admin for a write from the site itself, or null (reply sent). */
  const writer = async (request: FastifyRequest, reply: FastifyReply) => (sameOrigin(request, reply) ? requireAdmin(request, reply) : null);
  const logDef = (groupId: number, action: (typeof tagGroupDefLog.$inferInsert)['action'], detail: string, email: string) =>
    db.insert(tagGroupDefLog).values({ groupId, action, detail: detail.slice(0, 120), email, at: new Date() });

  app.get('/auth/admin/tag-groups', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const [defs, counts] = await Promise.all([
      activeGroups(db),
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
        parentId: d.parentId,
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
      const user = await writer(request, reply);
      if (!user) return reply;
      const groupId = Number(request.params.id);
      const tag = request.params.tag.trim();
      const status = request.body?.status;
      if (status !== 'confirmed' && status !== 'rejected') return reply.code(400).send({ error: 'status must be confirmed or rejected' });
      if (!tag || tag.length > 60) return reply.code(400).send({ error: 'tag must be 1–60 characters' });
      const [group] = await db
        .select({ id: tagGroupDefs.id })
        .from(tagGroupDefs)
        .where(and(eq(tagGroupDefs.id, groupId), isNull(tagGroupDefs.deletedAt)));
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
        await syncWritingTag(tx, tag, user.email);
      });
      return { tag, groupId, status };
    },
  );

  app.post<{ Body: { label?: unknown; kind?: unknown; parentId?: unknown } }>('/auth/admin/tag-groups', async (request, reply) => {
    const user = await writer(request, reply);
    if (!user) return reply;
    const label = typeof request.body?.label === 'string' ? request.body.label.trim() : '';
    const kind = request.body?.kind === 'topic' ? 'topic' : 'group';
    if (!label || label.length > 32) return reply.code(400).send({ error: 'label must be 1–32 characters' });
    const defs = await activeGroups(db);
    const dupe = defs.find((d) => d.label === label);
    if (dupe) return reply.code(409).send({ error: 'group exists', id: dupe.id });
    const parentId = typeof request.body?.parentId === 'number' ? request.body.parentId : null;
    const parent = parentId === null ? null : defs.find((d) => d.id === parentId);
    if (parentId !== null && (!parent || parent.kind !== kind))
      return reply.code(400).send({ error: 'parent must be a group of the same kind' });
    const sort = Math.max(0, ...defs.map((d) => d.sort)) + 1;
    const [res] = await db.insert(tagGroupDefs).values({ label, kind, sort, parentId, createdAt: new Date() });
    await logDef(res.insertId, 'create', parent ? `${label}（上層：${parent.label}）` : label, user.email);
    return { id: res.insertId, label, kind, parentId };
  });

  // { label } renames; { parentId: id | null } moves the group under another
  // of the same kind, or to the top.
  app.patch<{ Params: { id: string }; Body: { label?: unknown; parentId?: unknown } }>(
    '/auth/admin/tag-groups/:id',
    async (request, reply) => {
      const user = await writer(request, reply);
      if (!user) return reply;
      const id = Number(request.params.id);
      const defs = await activeGroups(db);
      const group = defs.find((d) => d.id === id);
      if (!group) return reply.code(404).send({ error: 'no such group' });
      const body = request.body ?? {};
      const set: { label?: string; parentId?: number | null } = {};
      if (body.label !== undefined) {
        const label = typeof body.label === 'string' ? body.label.trim() : '';
        if (!label || label.length > 32) return reply.code(400).send({ error: 'label must be 1–32 characters' });
        if (defs.some((d) => d.label === label && d.id !== id)) return reply.code(409).send({ error: 'another group has this name' });
        if (label !== group.label) set.label = label;
      }
      if (body.parentId !== undefined) {
        if (body.parentId !== null && typeof body.parentId !== 'number')
          return reply.code(400).send({ error: 'parentId must be a group id or null' });
        const problem = moveProblem(defs, id, body.parentId);
        if (problem) return reply.code(400).send({ error: problem });
        if (body.parentId !== group.parentId) set.parentId = body.parentId;
      }
      if (!Object.keys(set).length) return { id, label: group.label, parentId: group.parentId };
      const affected = set.parentId !== undefined ? await tagsInGroups(db, descendants(defs, id)) : [];
      await db.transaction(async (tx) => {
        await tx.update(tagGroupDefs).set(set).where(eq(tagGroupDefs.id, id));
        for (const tag of affected) await syncWritingTag(tx, tag, user.email);
      });
      if (set.label) await logDef(id, 'rename', `${group.label} → ${set.label}`, user.email);
      if (set.parentId !== undefined) {
        const parent = defs.find((d) => d.id === set.parentId);
        await logDef(id, 'move', parent ? `上層：${parent.label}` : '移到最上層', user.email);
      }
      return { id, label: set.label ?? group.label, parentId: set.parentId !== undefined ? set.parentId : group.parentId };
    },
  );

  // { ids: [...] }: the new order of these groups (one kind at a time).
  app.put<{ Body: { ids?: unknown } }>('/auth/admin/tag-groups/order', async (request, reply) => {
    const user = await writer(request, reply);
    if (!user) return reply;
    const ids = request.body?.ids;
    if (!Array.isArray(ids) || !ids.length || !ids.every((n) => Number.isInteger(n)))
      return reply.code(400).send({ error: 'ids must be a list of group ids' });
    const defs = await activeGroups(db);
    const listed = defs.filter((d) => ids.includes(d.id));
    if (listed.length !== new Set(ids).size) return reply.code(404).send({ error: 'no such group' });
    // Reuse the slots these groups already hold, so other groups keep theirs.
    const slots = listed.map((d) => d.sort).sort((a, b) => a - b);
    await db.transaction(async (tx) => {
      for (const [i, groupId] of (ids as number[]).entries())
        await tx.update(tagGroupDefs).set({ sort: slots[i] }).where(eq(tagGroupDefs.id, groupId));
    });
    await logDef(
      ids[0] as number,
      'sort',
      `順序：${(ids as number[]).map((i) => defs.find((d) => d.id === i)?.label).join('、')}`,
      user.email,
    );
    return { ids };
  });

  // Deletes a group: its tags leave it, its subgroups move up a level, and
  // the rules stop filing into it. The definition row stays, marked deleted.
  app.delete<{ Params: { id: string } }>('/auth/admin/tag-groups/:id', async (request, reply) => {
    const user = await writer(request, reply);
    if (!user) return reply;
    const id = Number(request.params.id);
    const defs = await activeGroups(db);
    const group = defs.find((d) => d.id === id);
    if (!group) return reply.code(404).send({ error: 'no such group' });
    const children = defs.filter((d) => d.parentId === id).map((d) => d.id);
    const affected = await tagsInGroups(db, descendants(defs, id));
    let removed = 0;
    await db.transaction(async (tx) => {
      await tx.update(tagGroupDefs).set({ deletedAt: new Date(), parentId: null }).where(eq(tagGroupDefs.id, id));
      if (children.length) await tx.update(tagGroupDefs).set({ parentId: group.parentId }).where(inArray(tagGroupDefs.id, children));
      const [res] = await tx.delete(tagGroupMembers).where(eq(tagGroupMembers.groupId, id));
      removed = res.affectedRows;
      for (const tag of affected) await syncWritingTag(tx, tag, user.email);
    });
    await logDef(id, 'delete', `${group.label}（${removed} 個標籤）`, user.email);
    return { id, deleted: true, tags: removed, children };
  });
}

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { tagGroupDefs, tagGroupMembers } from '../db/schema.ts';

// Tag groups (docs/tag-groups.md): only rows the rules filed (auto) or an
// admin confirmed are public; review and rejected rows are not.

const SHOWN = ['auto', 'confirmed'] as const;
const PAGE = 1000;

export async function groupsOfTag(db: Db, tag: string) {
  return db
    .select({ id: tagGroupDefs.id, label: tagGroupDefs.label, kind: tagGroupDefs.kind, source: tagGroupMembers.source })
    .from(tagGroupMembers)
    .innerJoin(tagGroupDefs, eq(tagGroupDefs.id, tagGroupMembers.groupId))
    .where(and(eq(tagGroupMembers.tag, tag), inArray(tagGroupMembers.status, [...SHOWN])))
    .orderBy(asc(tagGroupDefs.sort), asc(tagGroupDefs.id));
}

export function registerTagGroups(app: FastifyInstance, db: Db) {
  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/groups', async (request, reply) => {
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    reply.header('cache-control', 'public, max-age=300');
    return { tag, groups: await groupsOfTag(db, tag) };
  });

  app.get('/api/v1/tag-groups', async (_request, reply) => {
    const [defs, counts] = await Promise.all([
      db.select().from(tagGroupDefs).orderBy(asc(tagGroupDefs.sort), asc(tagGroupDefs.id)),
      db
        .select({ groupId: tagGroupMembers.groupId, n: sql<number>`COUNT(*)` })
        .from(tagGroupMembers)
        .where(inArray(tagGroupMembers.status, [...SHOWN]))
        .groupBy(tagGroupMembers.groupId),
    ]);
    const n = new Map(counts.map((c) => [c.groupId, Number(c.n)]));
    reply.header('cache-control', 'public, max-age=300');
    return { groups: defs.map((d) => ({ id: d.id, label: d.label, kind: d.kind, tags: n.get(d.id) ?? 0 })) };
  });

  app.get<{ Params: { id: string }; Querystring: { offset?: string } }>('/api/v1/tag-groups/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const offset = Math.max(0, Math.floor(Number(request.query.offset)) || 0);
    const [group] = Number.isInteger(id) ? await db.select().from(tagGroupDefs).where(eq(tagGroupDefs.id, id)) : [];
    if (!group) return reply.code(404).send({ error: 'no such group' });
    const tags = await db
      .select({ tag: tagGroupMembers.tag, source: tagGroupMembers.source })
      .from(tagGroupMembers)
      .where(and(eq(tagGroupMembers.groupId, id), inArray(tagGroupMembers.status, [...SHOWN])))
      .orderBy(asc(tagGroupMembers.tag))
      .limit(PAGE)
      .offset(offset);
    reply.header('cache-control', 'public, max-age=300');
    return { id: group.id, label: group.label, kind: group.kind, offset, next: tags.length === PAGE ? offset + PAGE : null, tags };
  });
}

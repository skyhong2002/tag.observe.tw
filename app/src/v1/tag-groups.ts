import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { articleTags, tagGroupMembers, tagStats } from '../db/schema.ts';
import { activeGroups, ancestors, type Def, descendants } from '../tag-groups/tree.ts';

// Tag groups (docs/tag-groups.md): only rows the rules filed (auto) or an
// admin confirmed are public; review and rejected rows are not. A group's
// tags include its subgroups' tags, and a tag in a subgroup is shown in the
// groups above it too.

const SHOWN = ['auto', 'confirmed'] as const;
const PAGE = 1000;
const RANKED = 200;

const ref = (d: Def) => ({ id: d.id, label: d.label, kind: d.kind });

export async function groupsOfTag(db: Db, tag: string) {
  const [defs, rows] = await Promise.all([
    activeGroups(db),
    db
      .select({ groupId: tagGroupMembers.groupId, source: tagGroupMembers.source })
      .from(tagGroupMembers)
      .where(and(eq(tagGroupMembers.tag, tag), inArray(tagGroupMembers.status, [...SHOWN]))),
  ]);
  const source = new Map(rows.map((r) => [r.groupId, r.source as string]));
  const implied = new Set(rows.flatMap((r) => ancestors(defs, r.groupId).map((d) => d.id)).filter((id) => !source.has(id)));
  return defs
    .filter((d) => source.has(d.id) || implied.has(d.id))
    .map((d) => ({ ...ref(d), parentId: d.parentId, source: source.get(d.id) ?? 'parent' }));
}

async function groupOr404(db: Db, rawId: string) {
  const id = Number(rawId);
  const defs = await activeGroups(db);
  const group = defs.find((d) => d.id === id);
  return group ? { defs, group, ids: descendants(defs, id) } : null;
}

const shownTagsOf = (db: Db, ids: number[]) =>
  db
    .selectDistinct({ tag: tagGroupMembers.tag })
    .from(tagGroupMembers)
    .where(and(inArray(tagGroupMembers.groupId, ids), inArray(tagGroupMembers.status, [...SHOWN])));

type Counted = { tag: string; recent: number; previous: number };
const overviewCache = new Map<number, { at: number; value: Promise<unknown> }>();

/** Every group with its busiest tags over `days` against the `days` before:
 *  one count over all tags past the ranking's first bar (tag_stats level 2)
 *  that sit in any group, shared out to the groups in memory. Kept for ten
 *  minutes per `days`, as every group page and the index read it. */
export function groupOverview(db: Db, days: number, top = 5) {
  const hit = overviewCache.get(days);
  if (hit && Date.now() - hit.at < 600e3) return hit.value as ReturnType<typeof computeOverview>;
  const value = computeOverview(db, days, top);
  overviewCache.set(days, { at: Date.now(), value });
  value.catch(() => overviewCache.delete(days));
  return value;
}

async function computeOverview(db: Db, days: number, top: number) {
  const now = Date.now();
  const since = new Date(now - days * 86_400_000);
  const before = new Date(now - 2 * days * 86_400_000);
  const [defs, members, active] = await Promise.all([
    activeGroups(db),
    db
      .selectDistinct({ groupId: tagGroupMembers.groupId, tag: tagGroupMembers.tag })
      .from(tagGroupMembers)
      .where(inArray(tagGroupMembers.status, [...SHOWN])),
    db
      .selectDistinct({ tag: tagStats.tag })
      .from(tagStats)
      .where(and(eq(tagStats.category, 'news'), eq(tagStats.level, 2), gte(tagStats.lastHour, before))),
  ]);
  const grouped = new Set(members.map((m) => m.tag));
  const candidates = active.map((a) => a.tag).filter((t) => grouped.has(t));
  const counts = new Map<string, Counted>();
  for (let i = 0; i < candidates.length; i += 1000) {
    const recent = sql<number>`SUM(${articleTags.publishedAt} >= ${since})`;
    const rows = await db
      .select({ tag: articleTags.tag, recent, previous: sql<number>`SUM(${articleTags.publishedAt} < ${since})` })
      .from(articleTags)
      .where(and(inArray(articleTags.tag, candidates.slice(i, i + 1000)), gte(articleTags.publishedAt, before)))
      .groupBy(articleTags.tag);
    for (const r of rows) counts.set(r.tag, { tag: r.tag, recent: Number(r.recent), previous: Number(r.previous) });
  }
  const tagsIn = new Map<number, Set<string>>();
  for (const m of members) (tagsIn.get(m.groupId) ?? tagsIn.set(m.groupId, new Set()).get(m.groupId))?.add(m.tag);
  return defs.map((d) => {
    const tags = new Set(descendants(defs, d.id).flatMap((g) => [...(tagsIn.get(g) ?? [])]));
    const ranked = [...tags]
      .map((t) => counts.get(t))
      .filter((c): c is Counted => !!c && c.recent > 0)
      .sort((a, b) => b.recent - a.recent || a.tag.localeCompare(b.tag));
    return {
      ...ref(d),
      parentId: d.parentId,
      tags: tags.size,
      // Tags in the news this period, and their reports summed.
      active: ranked.length,
      recent: ranked.reduce((n, c) => n + c.recent, 0),
      previous: ranked.reduce((n, c) => n + c.previous, 0),
      top: ranked.slice(0, top),
    };
  });
}

export function registerTagGroups(app: FastifyInstance, db: Db) {
  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/groups', async (request, reply) => {
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    reply.header('cache-control', 'public, max-age=300');
    return { tag, groups: await groupsOfTag(db, tag) };
  });

  app.get<{ Querystring: { days?: string } }>('/api/v1/tag-groups/overview', async (request, reply) => {
    const days = [1, 7, 30].includes(Number(request.query.days)) ? Number(request.query.days) : 7;
    reply.header('cache-control', 'public, max-age=300');
    return { days, groups: await groupOverview(db, days) };
  });

  app.get('/api/v1/tag-groups', async (_request, reply) => {
    const [defs, rows] = await Promise.all([
      activeGroups(db),
      db
        .selectDistinct({ groupId: tagGroupMembers.groupId, tag: tagGroupMembers.tag })
        .from(tagGroupMembers)
        .where(inArray(tagGroupMembers.status, [...SHOWN])),
    ]);
    const tagsIn = new Map<number, Set<string>>();
    for (const r of rows) (tagsIn.get(r.groupId) ?? tagsIn.set(r.groupId, new Set()).get(r.groupId))?.add(r.tag);
    const count = (id: number) => new Set(descendants(defs, id).flatMap((g) => [...(tagsIn.get(g) ?? [])])).size;
    reply.header('cache-control', 'public, max-age=300');
    return { groups: defs.map((d) => ({ ...ref(d), parentId: d.parentId, tags: count(d.id) })) };
  });

  app.get<{ Params: { id: string }; Querystring: { offset?: string } }>('/api/v1/tag-groups/:id', async (request, reply) => {
    const found = await groupOr404(db, request.params.id);
    if (!found) return reply.code(404).send({ error: 'no such group' });
    const { defs, group, ids } = found;
    const offset = Math.max(0, Math.floor(Number(request.query.offset)) || 0);
    const tags = await db
      .select({ tag: tagGroupMembers.tag, groupId: tagGroupMembers.groupId, source: tagGroupMembers.source })
      .from(tagGroupMembers)
      .where(and(inArray(tagGroupMembers.groupId, ids), inArray(tagGroupMembers.status, [...SHOWN])))
      .orderBy(asc(tagGroupMembers.tag), asc(tagGroupMembers.groupId))
      .limit(PAGE)
      .offset(offset);
    reply.header('cache-control', 'public, max-age=300');
    return {
      ...ref(group),
      parents: ancestors(defs, group.id).map(ref),
      children: defs.filter((d) => d.parentId === group.id).map(ref),
      offset,
      next: tags.length === PAGE ? offset + PAGE : null,
      tags,
    };
  });

  // The group's busiest tags: reports tagged in the last `days` against the
  // `days` before, so tags in one group can be compared.
  app.get<{ Params: { id: string }; Querystring: { days?: string } }>('/api/v1/tag-groups/:id/ranking', async (request, reply) => {
    const found = await groupOr404(db, request.params.id);
    if (!found) return reply.code(404).send({ error: 'no such group' });
    const { defs, group, ids } = found;
    const days = [1, 7, 30].includes(Number(request.query.days)) ? Number(request.query.days) : 7;
    const now = Date.now();
    const since = new Date(now - days * 86_400_000);
    const before = new Date(now - 2 * days * 86_400_000);
    // Only tags that reached the news ranking's first bar (tag_stats level 2,
    // two outlets) in the window: counting every member of 生活 straight
    // from article_tags takes seconds, this takes milliseconds.
    const [candidates, members] = await Promise.all([
      db
        .selectDistinct({ tag: tagStats.tag })
        .from(tagStats)
        .where(
          and(
            eq(tagStats.category, 'news'),
            eq(tagStats.level, 2),
            gte(tagStats.lastHour, before),
            inArray(tagStats.tag, shownTagsOf(db, ids)),
          ),
        ),
      db
        .select({ tag: tagGroupMembers.tag, groupId: tagGroupMembers.groupId })
        .from(tagGroupMembers)
        .where(and(inArray(tagGroupMembers.groupId, ids), inArray(tagGroupMembers.status, [...SHOWN]))),
    ]);
    const recent = sql<number>`SUM(${articleTags.publishedAt} >= ${since})`;
    const rows = candidates.length
      ? await db
          .select({ tag: articleTags.tag, recent, previous: sql<number>`SUM(${articleTags.publishedAt} < ${since})` })
          .from(articleTags)
          .where(
            and(
              inArray(
                articleTags.tag,
                candidates.map((c) => c.tag),
              ),
              gte(articleTags.publishedAt, before),
            ),
          )
          .groupBy(articleTags.tag)
          .orderBy(desc(recent), asc(articleTags.tag))
          .limit(RANKED)
      : [];
    const total = new Set(members.map((m) => m.tag)).size;
    // Which subgroups each tag is in, for a group with subgroups.
    const sub = new Map<string, number[]>();
    for (const m of members) if (m.groupId !== group.id) sub.set(m.tag, [...(sub.get(m.tag) ?? []), m.groupId]);
    reply.header('cache-control', 'public, max-age=300');
    return {
      ...ref(group),
      parents: ancestors(defs, group.id).map(ref),
      children: defs.filter((d) => d.parentId === group.id).map(ref),
      subgroups: defs.filter((d) => d.id !== group.id && ids.includes(d.id)).map(ref),
      days,
      tags: total,
      ranking: rows
        .map((r) => ({ tag: r.tag, recent: Number(r.recent), previous: Number(r.previous), groups: sub.get(r.tag) ?? [] }))
        .filter((r) => r.recent > 0),
    };
  });
}

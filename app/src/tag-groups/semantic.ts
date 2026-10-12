import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { tagGroupDefs, tagGroupMembers, tagSubmissions } from '../db/schema.ts';
import { ancestors } from './tree.ts';

export const RELATION_TYPES = ['is-a', 'related', 'alias'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];
export const tagId = (tag: string) => createHash('sha256').update(tag, 'utf8').digest('hex');
export const tagRef = (tag: string) => ({ id: tagId(tag), label: tag, href: `/tag/${encodeURIComponent(tag)}/` });
export const validSemanticTag = (tag: unknown): tag is string =>
  typeof tag === 'string' && tag.length > 0 && [...tag].length <= 60 && tag === tag.trim() && !/[\p{Cc}\p{Cs}]/u.test(tag);

/** Symmetric related/alias edges share one key. Labels remain byte-exact:
 * neither case folding nor synonym merging changes vocabulary IDs. */
export function relationKey(tag: string, type: RelationType, target: string) {
  const ends = type === 'is-a' ? [tag, target] : [tag, target].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return tagId(JSON.stringify(['relation', type, ...ends]));
}

export type PublicRelation = {
  id: string;
  type: RelationType;
  target: ReturnType<typeof tagRef>;
  source: string;
  sourceDetail: string;
  createdAt: string | null;
  status: 'approved';
  inherited: boolean;
  depth: number;
};

/** Existing group memberships remain the authority for classification. New
 * semantic edges add what that system lacks, without copying the vocabulary.
 * Topics are not is-a; co-occurrence is never read here. */
export async function publicRelations(db: Db, tag: string) {
  const [defs, memberships, direct] = await Promise.all([
    db.select().from(tagGroupDefs).where(isNull(tagGroupDefs.deletedAt)),
    db
      .select()
      .from(tagGroupMembers)
      .where(and(eq(tagGroupMembers.tag, tag), inArray(tagGroupMembers.status, ['auto', 'confirmed']))),
    db
      .select({
        id: tagSubmissions.id,
        tag: tagSubmissions.tag,
        target: tagSubmissions.target,
        type: tagSubmissions.relationType,
        groupId: tagSubmissions.targetGroupId,
        source: tagSubmissions.source,
        at: tagSubmissions.createdAt,
      })
      .from(tagSubmissions)
      .where(
        and(
          eq(tagSubmissions.kind, 'relation'),
          eq(tagSubmissions.status, 'approved'),
          or(eq(tagSubmissions.tag, tag), and(eq(tagSubmissions.target, tag), inArray(tagSubmissions.relationType, ['related', 'alias']))),
        ),
      )
      .orderBy(asc(tagSubmissions.id))
      .limit(201),
  ]);
  const relations: PublicRelation[] = direct
    .slice(0, 200)
    .filter((r) => r.target && r.type && r.groupId === null)
    .map((r) => ({
      id: `relation:${r.id}`,
      type: r.type as RelationType,
      target: tagRef(r.tag === tag ? (r.target as string) : r.tag),
      source: r.source,
      sourceDetail: r.source,
      createdAt: r.at.toISOString(),
      status: 'approved',
      inherited: false,
      depth: 1,
    }));
  const grouped = new Map<number, PublicRelation>();
  for (const membership of memberships.filter((m) => m.tag === tag)) {
    const own = defs.find((d) => d.id === membership.groupId && d.kind === 'group');
    if (!own) continue;
    const submitted = direct.find((r) => r.groupId === own.id && r.tag === tag);
    const path = [own, ...ancestors(defs, own.id)];
    for (let i = 0; i < path.length; i++) {
      const group = path[i];
      const previous = grouped.get(group.id);
      if (previous && previous.depth <= i + 1) continue;
      grouped.set(group.id, {
        id: `group-membership:${tagId(tag)}:${group.id}`,
        type: 'is-a',
        target: { id: `group:${group.id}`, label: group.label, href: `/group/${group.id}/` },
        source: submitted?.source ?? (membership.source === 'admin' ? 'manual' : 'rule'),
        sourceDetail: membership.source,
        // Legacy rows have updated_at, not a creation timestamp. Do not invent one.
        createdAt: submitted?.at.toISOString() ?? null,
        status: 'approved',
        inherited: i > 0,
        depth: i + 1,
      });
    }
  }
  // Follow reviewed tag→tag classifications too. Each edge keeps its own ID
  // and provenance; depth makes inferred ancestors distinguishable from direct
  // membership. Bounds protect the public endpoint, with explicit truncation.
  let truncated = direct.length > 200;
  let frontier = relations.filter((r) => r.type === 'is-a').map((r) => r.target.label);
  const seen = new Set([tag]);
  for (let depth = 2; frontier.length && depth <= 8; depth++) {
    frontier = [...new Set(frontier)].filter((t) => !seen.has(t));
    if (!frontier.length) break;
    for (const t of frontier) seen.add(t);
    const inheritedMemberships = await db
      .select()
      .from(tagGroupMembers)
      .where(and(inArray(tagGroupMembers.tag, frontier), inArray(tagGroupMembers.status, ['auto', 'confirmed'])))
      .limit(201);
    if (inheritedMemberships.length > 200) truncated = true;
    for (const membership of inheritedMemberships.slice(0, 200).filter((m) => frontier.includes(m.tag))) {
      const own = defs.find((d) => d.id === membership.groupId && d.kind === 'group');
      if (!own) continue;
      const path = [own, ...ancestors(defs, own.id)];
      for (let i = 0; i < path.length; i++) {
        const group = path[i];
        if (grouped.has(group.id)) continue;
        grouped.set(group.id, {
          id: `group-membership:${tagId(membership.tag)}:${group.id}`,
          type: 'is-a',
          target: { id: `group:${group.id}`, label: group.label, href: `/group/${group.id}/` },
          source: membership.source === 'admin' ? 'manual' : 'rule',
          sourceDetail: membership.source,
          createdAt: null,
          status: 'approved',
          inherited: true,
          depth: depth + i,
        });
      }
    }
    const rows = await db
      .select({
        id: tagSubmissions.id,
        target: tagSubmissions.target,
        groupId: tagSubmissions.targetGroupId,
        source: tagSubmissions.source,
        at: tagSubmissions.createdAt,
      })
      .from(tagSubmissions)
      .where(
        and(
          inArray(tagSubmissions.tag, frontier),
          eq(tagSubmissions.kind, 'relation'),
          eq(tagSubmissions.relationType, 'is-a'),
          isNull(tagSubmissions.targetGroupId),
          eq(tagSubmissions.status, 'approved'),
        ),
      )
      .orderBy(asc(tagSubmissions.id))
      .limit(201);
    const next: string[] = [];
    for (const row of rows) {
      if (relations.length >= 200) {
        truncated = true;
        break;
      }
      if (!row.target) continue;
      const group = row.groupId === null ? null : defs.find((d) => d.id === row.groupId);
      if (row.groupId !== null && !group) continue;
      const target = group ? { id: `group:${group.id}`, label: group.label, href: `/group/${group.id}/` } : tagRef(row.target);
      if (!relations.some((r) => r.type === 'is-a' && r.target.id === target.id))
        relations.push({
          id: `relation:${row.id}`,
          type: 'is-a',
          target,
          source: row.source,
          sourceDetail: row.source,
          createdAt: row.at.toISOString(),
          status: 'approved',
          inherited: true,
          depth,
        });
      if (!group && !seen.has(row.target)) next.push(row.target);
    }
    frontier = next;
    if (truncated) break;
  }
  if (frontier.length) truncated = true;
  return { tag, tagId: tagId(tag), relations: [...grouped.values(), ...relations], truncated };
}

/** Run while holding tag_relation_lock. Bounded graph walk fails closed;
 * human reviewers cannot accidentally publish cycles, even concurrently. */
export async function isACycle(db: Db, tag: string, target: string) {
  let frontier = [target];
  const seen = new Set<string>();
  for (let depth = 0; frontier.length; depth++) {
    if (depth >= 32 || seen.size > 1000) throw Error('分類鏈過深或過大，請先整理關係');
    if (frontier.includes(tag)) return true;
    for (const t of frontier) seen.add(t);
    const rows = await db
      .select({ target: tagSubmissions.target })
      .from(tagSubmissions)
      .where(
        and(
          inArray(tagSubmissions.tag, frontier),
          eq(tagSubmissions.kind, 'relation'),
          eq(tagSubmissions.relationType, 'is-a'),
          isNull(tagSubmissions.targetGroupId),
          eq(tagSubmissions.status, 'approved'),
        ),
      )
      .limit(1001);
    if (rows.length > 1000) throw Error('分類鏈過大，請先整理關係');
    frontier = [...new Set(rows.flatMap((r) => (r.target && !seen.has(r.target) ? [r.target] : [])))];
  }
  return false;
}

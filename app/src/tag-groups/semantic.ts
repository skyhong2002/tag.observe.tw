import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { tagGroupDefs, tagGroupMembers, tagSubmissions } from '../db/schema.ts';

export const RELATION_TYPES = ['is-a', 'related', 'alias'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];
export const tagId = (tag: string) => createHash('sha256').update(tag, 'utf8').digest('hex');
export const tagRef = (tag: string) => ({ id: tagId(tag), label: tag, href: `/tag/${encodeURIComponent(tag)}/` });
export const validSemanticTag = (tag: unknown): tag is string =>
  typeof tag === 'string' && tag.length > 0 && [...tag].length <= 60 && tag === tag.trim() && !/[\p{Cc}\p{Cs}]/u.test(tag);

/** Symmetric related/alias edges share one key. Labels remain byte-exact:
 * neither case folding nor synonym merging changes vocabulary IDs. */
export function relationKey(tag: string, type: RelationType, target: string | { groupId: number }) {
  // A literal label such as "group:811" is valid vocabulary. Keep identity
  // kinds in the serialized structure, never in a user-controllable prefix.
  const from = ['tag', tag] as const;
  const to = typeof target === 'string' ? (['tag', target] as const) : (['group', target.groupId] as const);
  const ends =
    type === 'is-a'
      ? [from, to]
      : [from, to].sort((a, b) => Buffer.compare(Buffer.from(JSON.stringify(a)), Buffer.from(JSON.stringify(b))));
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
  const LIMIT = 200;
  const MAX_DEPTH = 8;
  const relations: PublicRelation[] = [];
  const groupRelations = new Map<number, PublicRelation>();
  const definitions = new Map<number, { id: number; label: string; kind: string; parentId: number | null } | null>();
  let truncated = false;
  const append = (relation: PublicRelation) => {
    if (relations.some((r) => r.type === relation.type && r.target.id === relation.target.id)) return;
    if (relations.length >= LIMIT) {
      truncated = true;
      return;
    }
    relations.push(relation);
  };
  const loadGroups = async (ids: number[]) => {
    const missing = [...new Set(ids)].filter((id) => !definitions.has(id));
    if (!missing.length) return;
    const admitted = missing.slice(0, relations.length >= LIMIT ? 0 : LIMIT - definitions.size);
    if (admitted.length < missing.length) truncated = true;
    if (!admitted.length) return;
    for (const id of admitted) definitions.set(id, null);
    const rows = await db
      .select({ id: tagGroupDefs.id, label: tagGroupDefs.label, kind: tagGroupDefs.kind, parentId: tagGroupDefs.parentId })
      .from(tagGroupDefs)
      .where(and(inArray(tagGroupDefs.id, admitted), isNull(tagGroupDefs.deletedAt)))
      .limit(201);
    for (const row of rows) if (definitions.has(row.id)) definitions.set(row.id, row);
  };
  const membershipsFor = (tags: string[]) =>
    db
      .select({ tag: tagGroupMembers.tag, groupId: tagGroupMembers.groupId, source: tagGroupMembers.source })
      .from(tagGroupMembers)
      .where(
        and(
          // Keep the indexed collation predicate, but enforce exact vocabulary
          // identity before LIMIT so near-equivalent labels cannot consume it.
          inArray(tagGroupMembers.tag, tags),
          or(...tags.map((label) => sql`BINARY ${tagGroupMembers.tag} = BINARY ${label}`)),
          inArray(tagGroupMembers.status, ['auto', 'confirmed']),
        ),
      )
      .orderBy(asc(tagGroupMembers.groupId), asc(tagGroupMembers.tag))
      .limit(201);
  const [memberships, direct] = await Promise.all([
    membershipsFor([tag]),
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
  if (memberships.length > LIMIT || direct.length > LIMIT) truncated = true;
  type GroupStep = { id: number; source: string; sourceDetail: string; createdAt: string | null; originTag: string; depth: number };
  const projectGroups = async (steps: GroupStep[]) => {
    let frontier = steps;
    for (let round = 0; frontier.length && round < MAX_DEPTH; round++) {
      // Each membership query is bounded and each tree level loads only its IDs.
      await loadGroups(frontier.map((step) => step.id));
      const next: GroupStep[] = [];
      for (const step of frontier) {
        const group = definitions.get(step.id);
        if (group?.kind !== 'group') continue;
        const previous = groupRelations.get(group.id);
        if (previous && previous.depth <= step.depth) continue;
        const relation: PublicRelation = {
          id: `group-membership:${tagId(step.originTag)}:${group.id}`,
          type: 'is-a',
          target: { id: `group:${group.id}`, label: group.label, href: `/group/${group.id}/` },
          source: step.source,
          sourceDetail: step.sourceDetail,
          createdAt: step.createdAt,
          status: 'approved',
          inherited: step.depth > 1,
          depth: step.depth,
        };
        if (previous) {
          Object.assign(previous, relation);
        } else {
          const before = relations.length;
          append(relation);
          if (relations.length === before) continue;
          groupRelations.set(group.id, relation);
        }
        if (group.parentId !== null) {
          if (step.depth >= MAX_DEPTH) truncated = true;
          else next.push({ ...step, id: group.parentId, depth: step.depth + 1 });
        }
      }
      frontier = next;
    }
  };
  await projectGroups(
    memberships
      .slice(0, LIMIT)
      .filter((m) => m.tag === tag)
      .map((m) => {
        const submitted = direct.find((r) => r.groupId === m.groupId && r.tag === tag);
        return {
          id: m.groupId,
          source: submitted?.source ?? (m.source === 'admin' ? 'manual' : 'rule'),
          sourceDetail: m.source,
          createdAt: submitted?.at.toISOString() ?? null,
          originTag: tag,
          depth: 1,
        };
      }),
  );
  for (const row of direct.slice(0, LIMIT)) {
    if (!row.target || !row.type || row.groupId !== null) continue;
    append({
      id: `relation:${row.id}`,
      type: row.type as RelationType,
      target: tagRef(row.tag === tag ? row.target : row.tag),
      source: row.source,
      sourceDetail: row.source,
      createdAt: row.at.toISOString(),
      status: 'approved',
      inherited: false,
      depth: 1,
    });
  }
  let frontier = relations.filter((r) => r.type === 'is-a' && !r.target.id.startsWith('group:')).map((r) => r.target.label);
  const seen = new Set([tag]);
  for (let depth = 2; frontier.length && depth <= MAX_DEPTH; depth++) {
    frontier = [...new Set(frontier)].filter((label) => !seen.has(label));
    if (!frontier.length) break;
    if (relations.length >= LIMIT) {
      truncated = true;
      break;
    }
    for (const label of frontier) seen.add(label);
    const [inheritedMemberships, rows] = await Promise.all([
      membershipsFor(frontier),
      db
        .select({ id: tagSubmissions.id, target: tagSubmissions.target, source: tagSubmissions.source, at: tagSubmissions.createdAt })
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
        .limit(201),
    ]);
    if (inheritedMemberships.length > LIMIT || rows.length > LIMIT) truncated = true;
    await projectGroups(
      inheritedMemberships
        .slice(0, LIMIT)
        .filter((m) => frontier.includes(m.tag))
        .map((m) => ({
          id: m.groupId,
          source: m.source === 'admin' ? 'manual' : 'rule',
          sourceDetail: m.source,
          createdAt: null,
          originTag: m.tag,
          depth,
        })),
    );
    const next: string[] = [];
    for (const row of rows.slice(0, LIMIT)) {
      if (!row.target) continue;
      append({
        id: `relation:${row.id}`,
        type: 'is-a',
        target: tagRef(row.target),
        source: row.source,
        sourceDetail: row.source,
        createdAt: row.at.toISOString(),
        status: 'approved',
        inherited: true,
        depth,
      });
      if (!seen.has(row.target)) next.push(row.target);
    }
    frontier = next;
  }
  if (frontier.length) truncated = true;
  return { tag, tagId: tagId(tag), relations, truncated };
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

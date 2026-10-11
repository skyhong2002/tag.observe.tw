import { asc, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { type TagGroupKind, tagGroupDefs } from '../db/schema.ts';

// The group tree (docs/tag-groups.md): a group may sit inside another of
// the same kind, and pages for a group count its descendants' tags too.

export type Def = { id: number; label: string; kind: TagGroupKind; sort: number; parentId: number | null };

/** Groups not deleted, in the admins' order. */
export function activeGroups(db: Db): Promise<Def[]> {
  return db
    .select({
      id: tagGroupDefs.id,
      label: tagGroupDefs.label,
      kind: tagGroupDefs.kind,
      sort: tagGroupDefs.sort,
      parentId: tagGroupDefs.parentId,
    })
    .from(tagGroupDefs)
    .where(isNull(tagGroupDefs.deletedAt))
    .orderBy(asc(tagGroupDefs.sort), asc(tagGroupDefs.id));
}

/** `id` and every group below it. */
export function descendants(defs: Def[], id: number): number[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const d of defs) if (d.parentId === out[i] && !out.includes(d.id)) out.push(d.id);
  return out;
}

/** The groups above `id`, nearest first. */
export function ancestors(defs: Def[], id: number): Def[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: Def[] = [];
  let parent = byId.get(id)?.parentId;
  while (parent != null && !out.some((d) => d.id === parent)) {
    const d = byId.get(parent);
    if (!d) break;
    out.push(d);
    parent = d.parentId;
  }
  return out;
}

/** Why `id` cannot move under `parentId`, or null when it can. */
export function moveProblem(defs: Def[], id: number, parentId: number | null): string | null {
  if (parentId === null) return null;
  const parent = defs.find((d) => d.id === parentId);
  const self = defs.find((d) => d.id === id);
  if (!parent || !self) return 'no such group';
  if (parent.kind !== self.kind) return 'parent must be the same kind';
  if (descendants(defs, id).includes(parentId)) return 'a group cannot sit inside itself or its own subgroup';
  return null;
}

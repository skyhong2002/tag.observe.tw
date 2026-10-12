// Shared classifications are the source of manual writing labels. The old
// writing_people entry is only a materialized projection for the analyser.
import { and, eq, inArray, isNull, like, or } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articleWriting, tagGroupDefs, tagGroupMembers, writingPeople } from '../db/schema.ts';
import { roleTags } from '../writing/roles.ts';
import type { Role } from '../writing/rules.ts';

type Store = Pick<Db, 'select' | 'insert' | 'update' | 'delete'>;
export type WritingGroup = { id: number; parentId: number | null; writingRole: string | null };

export function inheritedRoles(defs: WritingGroup[], id: number): Role[] {
  const visited = new Set<number>();
  const roles: string[] = [];
  let next: number | null = id;
  while (next !== null && !visited.has(next)) {
    visited.add(next);
    const group = defs.find((d) => d.id === next);
    if (!group) break;
    if (group.writingRole) roles.push(group.writingRole);
    next = group.parentId;
  }
  return roleTags(roles);
}

export async function syncWritingTag(db: Store, tag: string, email: string) {
  // The writing analyser only stores name runs up to 40 characters.
  if (tag.length > 40) return;
  const defs = await db
    .select({ id: tagGroupDefs.id, parentId: tagGroupDefs.parentId, writingRole: tagGroupDefs.writingRole })
    .from(tagGroupDefs)
    .where(isNull(tagGroupDefs.deletedAt));
  const rows = await db.select().from(tagGroupMembers).where(eq(tagGroupMembers.tag, tag));
  const mapped = rows.map((row) => ({ ...row, roles: inheritedRoles(defs, row.groupId) })).filter((r) => r.roles.length);
  const manual = mapped.some((r) => (r.status === 'confirmed' || r.status === 'rejected') && (r.source === 'admin' || r.reviewedBy));
  if (!manual) {
    const [previous] = await db.select().from(writingPeople).where(eq(writingPeople.name, tag));
    if (previous?.source !== 'admin') return;
    await db.delete(writingPeople).where(eq(writingPeople.name, tag));
    await db
      .update(articleWriting)
      .set({ role: '未知', roles: ['未知'], roleSource: null })
      .where(and(eq(articleWriting.poster, tag), eq(articleWriting.roleSource, 'people')));
    return;
  }
  const visible = roleTags(mapped.filter((r) => r.status === 'confirmed' || r.status === 'auto').flatMap((r) => r.roles));
  const roles: Role[] = visible.length ? visible : ['未知'];
  const values = { role: roles[0], roles, source: 'admin' as const, note: '共用標籤分類', email, updatedAt: new Date() };
  await db
    .insert(writingPeople)
    .values({ name: tag, ...values })
    .onDuplicateKeyUpdate({ set: values });
  await db
    .update(articleWriting)
    .set({ role: roles[0], roles, poster: tag, roleSource: 'people' })
    .where(
      or(
        eq(articleWriting.poster, tag),
        and(eq(articleWriting.role, '未知'), like(articleWriting.poster, `%${tag.replace(/[\\%_]/g, '\\$&')}`)),
      ),
    );
}

/** A move/deletion can change inherited roles of members in the whole subtree. */
export async function tagsInGroups(db: Store, ids: number[]) {
  const rows = await db.select({ tag: tagGroupMembers.tag }).from(tagGroupMembers).where(inArray(tagGroupMembers.groupId, ids));
  return [...new Set(rows.map((r) => r.tag))];
}

import { readFileSync } from 'node:fs';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '../app/src/db/client.ts';
import { tagGroupDefs, tagGroupMemberLog, tagGroupMembers } from '../app/src/db/schema.ts';
import { CURATED_GROUPS } from '../app/src/tag-groups/rules.ts';

// Applies term rosters (docs/tag-groups.md「任期名冊」) researched from official
// lists: renames each group to 「<year> <role>」, confirms the roster's tags
// and rejects every other row in the group, with a member-log entry per
// change. Names marked ambiguous or left for a spot check are not added.
//   node --env-file=.env tools/apply-group-rosters.ts rosters.json            # dry run
//   node --env-file=.env tools/apply-group-rosters.ts rosters.json --write
// rosters.json: [{ groupId (null = create with `newId`), newId?, newLabel,
//   members: [{ tag, role, status, ambiguous, note }], keep: [tag], add: [tag],
//   addAltSpellings?: [tag] }]

type Member = { tag: string | null; role?: string; status?: string; ambiguous?: boolean; note?: string };
type Roster = {
  groupId: number | null;
  newId?: number;
  newLabel: string;
  members: Member[];
  keep: string[];
  add: string[];
  addAltSpellings?: string[];
};

const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const write = process.argv.includes('--write');
const rosters = JSON.parse(readFileSync(file, 'utf8')) as Roster[];
const by = `roster:${new Date().toISOString().slice(0, 10)}`;
const { db, close } = createDb();
try {
  for (const r of rosters) {
    const id = r.groupId ?? r.newId;
    if (!id || !CURATED_GROUPS.has(id)) throw Error(`${r.newLabel}: group ${id} is not in CURATED_GROUPS`);
    const reference = new Set(r.members.filter((m) => m.note?.includes('僅供參考')).map((m) => m.tag));
    const wanted = new Set([...r.keep, ...r.add, ...(r.addAltSpellings ?? [])].filter((t) => !reference.has(t)));
    const info = new Map(r.members.filter((m) => m.tag).map((m) => [m.tag as string, m]));
    const note = (tag: string) => {
      const m = info.get(tag);
      const status = m?.status && !['在任', '候選人', '登記參選'].includes(m.status) ? `・${m.status}` : '';
      return `${m?.role ?? ''}${status}`.slice(0, 120) || null;
    };
    const [def] = await db.select().from(tagGroupDefs).where(eq(tagGroupDefs.id, id));
    const rows = await db.select().from(tagGroupMembers).where(eq(tagGroupMembers.groupId, id));
    const have = new Map(rows.map((m) => [m.tag, m]));
    const confirm = [...wanted].filter((t) => have.get(t)?.status !== 'confirmed' || have.get(t)?.source !== 'admin');
    const reject = rows.filter((m) => !wanted.has(m.tag) && m.status !== 'rejected');
    console.log(
      JSON.stringify({ id, from: def?.label ?? null, to: r.newLabel, roster: wanted.size, confirm: confirm.length, reject: reject.length }),
    );
    if (!write) continue;
    const at = new Date();
    await db.transaction(async (tx) => {
      if (!def)
        await tx.insert(tagGroupDefs).values({ id, label: r.newLabel, kind: 'group', sort: 28, writingRole: '公職政治', createdAt: at });
      else if (def.label !== r.newLabel) await tx.update(tagGroupDefs).set({ label: r.newLabel }).where(eq(tagGroupDefs.id, id));
      for (const tag of confirm) {
        const old = have.get(tag);
        const row = {
          source: 'admin' as const,
          status: 'confirmed' as const,
          score: null,
          note: note(tag),
          updatedAt: at,
          reviewedBy: by,
          reviewedAt: at,
        };
        if (old)
          await tx
            .update(tagGroupMembers)
            .set(row)
            .where(and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.groupId, id)));
        else await tx.insert(tagGroupMembers).values({ tag, groupId: id, ...row });
        await tx.insert(tagGroupMemberLog).values({ tag, groupId: id, action: 'confirm', fromStatus: old?.status ?? null, email: by, at });
      }
      const gone = reject.map((m) => m.tag);
      for (let i = 0; i < gone.length; i += 200) {
        const chunk = gone.slice(i, i + 200);
        await tx
          .update(tagGroupMembers)
          .set({ status: 'rejected', note: `不在「${r.newLabel}」名冊`, updatedAt: at, reviewedBy: by, reviewedAt: at })
          .where(and(eq(tagGroupMembers.groupId, id), inArray(tagGroupMembers.tag, chunk)));
      }
      if (reject.length)
        await tx
          .insert(tagGroupMemberLog)
          .values(reject.map((m) => ({ tag: m.tag, groupId: id, action: 'reject' as const, fromStatus: m.status, email: by, at })));
    });
  }
} finally {
  await close();
}

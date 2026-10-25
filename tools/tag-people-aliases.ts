import { eq, isNotNull } from 'drizzle-orm';
import { entities } from '../app/src/avatars/wikidata.ts';
import { createDb } from '../app/src/db/client.ts';
import { tagPeople } from '../app/src/db/schema.ts';

// Adds Wikidata's Chinese aliases to the person facts already stored, without
// redoing the avatar lookup (photos). New lookups store them themselves
// (findPerson); this fills the people checked before 2026-10-16. The
// relations page asks readers about the aliases recent headlines use.
//   node --env-file=.env tools/tag-people-aliases.ts            # dry run
//   node --env-file=.env tools/tag-people-aliases.ts --write
const write = process.argv.includes('--write');
const { db, close } = createDb();
try {
  const rows = await db
    .select({ tag: tagPeople.tag, qid: tagPeople.wikidataId, facts: tagPeople.facts })
    .from(tagPeople)
    .where(isNotNull(tagPeople.wikidataId));
  const people = rows.filter((r) => r.qid && r.facts);
  let changed = 0;
  for (let i = 0; i < people.length; i += 50) {
    const chunk = people.slice(i, i + 50);
    const found = await entities(
      chunk.map((p) => p.qid as string),
      'aliases',
    );
    for (const p of chunk) {
      const e = found[p.qid as string];
      const aliases = [
        ...new Set(
          ['zh-tw', 'zh-hant', 'zh'].flatMap((l) => (e?.aliases?.[l] ?? []).map((a) => a.value.trim())).filter((a) => a && a !== p.tag),
        ),
      ].slice(0, 12);
      if (JSON.stringify(aliases) === JSON.stringify(p.facts?.aliases ?? [])) continue;
      changed++;
      console.log(`${p.tag}\t${aliases.join('、') || '（無）'}`);
      if (write && p.facts)
        await db
          .update(tagPeople)
          .set({ facts: { ...p.facts, aliases } })
          .where(eq(tagPeople.tag, p.tag));
    }
  }
  console.log(JSON.stringify({ people: people.length, changed, written: write }));
} finally {
  await close();
}

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import pino from 'pino';
import { createDb, type Db } from '../app/src/db/client.ts';
import { tagGroupMembers } from '../app/src/db/schema.ts';
import { aiConfig, fileAi } from '../app/src/tag-groups/ai.ts';
import { DATED_GROUPS } from '../app/src/tag-groups/rules.ts';
import { filePeople, fileSections, fileWikidata, rankedTags, seedGroupDefs } from '../app/src/tag-groups/run.ts';

// Tag groups (docs/tag-groups.md).
//   node --env-file=.env tools/tag-groups.ts legacy <group-snapshot/selected.sql> <legacy-…/core.sql.gz>
//   node --env-file=.env tools/tag-groups.ts auto --top 500          # person, section, wikidata, then ai
//   node --env-file=.env tools/tag-groups.ts auto 台積電 颱風         # these tags only
// `auto` steps can run alone: person, section, wikidata, ai. The ai step
// needs TAG_AI_BASE_URL and TAG_AI_API_KEY (TAG_AI_MODEL, default sky-fast)
// and is skipped without them. --force asks Wikidata and the AI again for
// tags asked in the last 30 days.
const log = pino({ level: 'info' });
const [command = 'auto', ...rest] = process.argv.slice(2);
const flags = rest.filter((a) => a.startsWith('--'));
const topAt = rest.indexOf('--top');
const named = rest.filter((a, i) => !a.startsWith('--') && !(topAt >= 0 && i === topAt + 1));

/** Rows of `INSERT INTO \`table\` VALUES (…),(…);` in a mysqldump. */
function dumpRows(dump: string, table: string): string[][] {
  const out: string[][] = [];
  const value = /'((?:[^'\\]|\\.)*)'|(NULL|-?[\d.]+)/gy;
  for (const line of dump.split('\n')) {
    if (!line.startsWith(`INSERT INTO \`${table}\` VALUES `)) continue;
    let i = line.indexOf('VALUES ') + 7;
    while (line[i] === '(') {
      i++;
      const row: string[] = [];
      for (;;) {
        value.lastIndex = i;
        const m = value.exec(line);
        if (!m) throw Error(`${table}: cannot parse at ${i}`);
        row.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]);
        i = value.lastIndex;
        if (line[i] === ',') i++;
        else if (line[i] === ')') break;
      }
      out.push(row);
      i += 2; // "),"
    }
  }
  return out;
}

const read = (path: string) => (path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString('utf8');

async function importLegacy(db: Db, groupDump: string, coreDump: string) {
  await seedGroupDefs(db);
  // tag_group_log: pk, ctime, mtime, del_flag, tag, group_id — tagged by hand.
  const groups = dumpRows(read(groupDump), 'tag_group_log').filter((r) => r[3] !== '1' && r[4].length <= 60);
  const picked = new Map<string, typeof tagGroupMembers.$inferInsert>();
  for (const [, ctime, , , tag, group] of groups) {
    const groupId = Number(group);
    const dated = DATED_GROUPS.has(groupId);
    picked.set(`${tag}\t${groupId}`, {
      tag,
      groupId,
      source: 'legacy',
      status: dated ? 'review' : 'confirmed',
      note: dated ? `舊站 ${ctime.slice(0, 4)} 年標記，可能已過時` : `舊站 ${ctime.slice(0, 4)} 年標記`,
      updatedAt: new Date(),
      reviewedBy: 'legacy',
      reviewedAt: new Date(`${ctime.replace(' ', 'T')}+08:00`),
    });
  }
  // catalogue_tag: pk, ctime, mtime, stime, del_flag, tag, catid, counter —
  // counted from article sections by a 2016 cron job, so auto, not confirmed.
  const counts = new Map<string, Map<number, number>>();
  for (const r of dumpRows(read(coreDump), 'catalogue_tag')) {
    const cat = Number(r[6]);
    if (r[4] === '1' || cat > 10 || r[5].length > 60) continue;
    const m = counts.get(r[5]) ?? new Map<number, number>();
    m.set(cat, (m.get(cat) ?? 0) + Number(r[7]));
    counts.set(r[5], m);
  }
  let topics = 0;
  for (const [tag, m] of counts) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const best = [...m]
      .map(([cat, n]) => ({ groupId: 100 + cat, share: n / total }))
      .filter((t) => t.share >= 0.3)
      .sort((a, b) => b.share - a.share)
      .slice(0, 2);
    for (const t of best) {
      const key = `${tag}\t${t.groupId}`;
      if (picked.has(key)) continue;
      topics++;
      picked.set(key, {
        tag,
        groupId: t.groupId,
        source: 'legacy',
        status: 'auto',
        score: Math.round(t.share * 100) / 100,
        note: `舊站 2016 版別統計 ${Math.round(t.share * 100)}%`,
        updatedAt: new Date(),
      });
    }
  }
  const values = [...picked.values()];
  // INSERT IGNORE: rows an admin or a rule already made stay as they are.
  for (let i = 0; i < values.length; i += 500)
    await db
      .insert(tagGroupMembers)
      .ignore()
      .values(values.slice(i, i + 500));
  return { groups: values.length - topics, topics };
}

const { db, close } = createDb();
try {
  if (command === 'legacy') {
    if (named.length !== 2) throw Error('usage: tag-groups.ts legacy <selected.sql> <core.sql.gz>');
    console.log(JSON.stringify(await importLegacy(db, named[0], named[1])));
  } else {
    await seedGroupDefs(db);
    const all = ['person', 'section', 'wikidata', 'ai'];
    const steps = all.includes(command) ? [command] : all;
    const tags = named.length ? named : await rankedTags(db, { limit: Number(rest[topAt + 1]) || 500 });
    const result: Record<string, unknown> = {};
    // Sections first: the Wikidata type rules check the tag's topics.
    if (steps.includes('person')) result.person = await filePeople(db);
    if (steps.includes('section')) result.section = await fileSections(db, tags);
    if (steps.includes('wikidata'))
      result.wikidata = await fileWikidata(db, tags, { force: flags.includes('--force'), log: (o) => log.debug(o, 'wikidata') });
    // Last: only what the rules left without a group or a topic goes to the AI.
    const ai = aiConfig();
    if (steps.includes('ai'))
      result.ai = ai
        ? await fileAi(db, tags, ai, { force: flags.includes('--force'), log: (o) => log.debug(o, 'ai') })
        : 'skipped: no TAG_AI_API_KEY';
    console.log(JSON.stringify({ tags: tags.length, ...result }));
  }
} finally {
  await close();
}

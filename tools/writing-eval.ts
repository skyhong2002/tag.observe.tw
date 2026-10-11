// Accuracy of the writing rules (app/src/writing/rules.ts) on hand-checked
// articles (app/data/writing-labels.json). Read-only; run it before and after
// changing a rule, and before bumping VERSION.
//
//   node --env-file=.env tools/writing-eval.ts [--verbose]
import { inArray } from 'drizzle-orm';
import labels from '../app/data/writing-labels.json' with { type: 'json' };
import { createDb } from '../app/src/db/client.ts';
import { articles } from '../app/src/db/schema.ts';
import { loadPeople } from '../app/src/jobs/writing-job.ts';
import { analyzeArticle } from '../app/src/writing/analyze.ts';
import { VERSION } from '../app/src/writing/rules.ts';

type Label = { id: number; social: boolean; platform?: string; role?: string };
const verbose = process.argv.includes('--verbose');
const { db, close } = createDb();
try {
  const list = labels.labels as Label[];
  const rows = await db
    .select({ id: articles.id, title: articles.title, body: articles.body })
    .from(articles)
    .where(
      inArray(
        articles.id,
        list.map((l) => l.id),
      ),
    );
  const byId = new Map(rows.filter((r) => r.body).map((r) => [r.id, r]));
  const people = await loadPeople(db);
  const tally = { tp: 0, fp: 0, fn: 0, tn: 0, platform: [0, 0], role: [0, 0], skipped: 0 };
  for (const label of list) {
    const row = byId.get(label.id);
    if (!row) {
      tally.skipped++;
      continue;
    }
    const got = analyzeArticle(row.title, row.body ?? '', people);
    const social = got.platform !== null;
    if (social && label.social) tally.tp++;
    else if (social) tally.fp++;
    else if (label.social) tally.fn++;
    else tally.tn++;
    const misses: string[] = [];
    if (social !== label.social) misses.push(`social ${social} ≠ ${label.social}`);
    if (social && label.social && label.platform) {
      tally.platform[1]++;
      if (got.platform === label.platform) tally.platform[0]++;
      else misses.push(`platform ${got.platform} ≠ ${label.platform}`);
    }
    if (social && label.social && label.role) {
      tally.role[1]++;
      if (got.role === label.role) tally.role[0]++;
      else misses.push(`role ${got.role} ≠ ${label.role}`);
    }
    if (misses.length && verbose) console.log(`${label.id}\t${misses.join('; ')}\t${got.poster ?? ''}\t${got.evidence ?? ''}`);
  }
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}% (${a}/${b})` : '–');
  console.log(`rules ${VERSION}, labels ${list.length}, skipped (body gone) ${tally.skipped}`);
  console.log(`social: precision ${pct(tally.tp, tally.tp + tally.fp)}, recall ${pct(tally.tp, tally.tp + tally.fn)}`);
  console.log(`platform ${pct(...(tally.platform as [number, number]))}, role ${pct(...(tally.role as [number, number]))}`);
} finally {
  await close();
}

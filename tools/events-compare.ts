// Replay event clustering on the live database with the legacy rules and the
// current ones, and print how coherent each event's headlines are, so a rule
// change can be judged before it is deployed and watched after.
//
//   node --env-file=.env tools/events-compare.ts [--limit 30] [--json out.json] [--quiet]
//
// Cohesion is tag-independent: the mean pairwise Jaccard of headline character
// bigrams inside an event, against the same measure between headlines of
// different events (the background). Higher within/background is better.
import noEqual from '../app/data/no-equal-tags.json' with { type: 'json' };
import { createDb } from '../app/src/db/client.ts';
import { type ArticleRow, clusterEvents, type EventCluster } from '../app/src/jobs/events-compute.ts';
import { loadEventInputs } from '../app/src/jobs/events-job.ts';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const limit = Number(arg('--limit') ?? 30);
const quiet = process.argv.includes('--quiet');

const bigrams = (s: string) => {
  const t = s
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2));
  return out;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n || 1);
};
function cohesion(events: EventCluster[]) {
  const sets = events.map((e) => e.news.map((n) => bigrams(n.title)));
  const within: number[] = [];
  for (const s of sets) {
    const v: number[] = [];
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) v.push(jaccard(s[i], s[j]));
    within.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : Number.NaN);
  }
  const bg: number[] = [];
  for (let a = 0; a < sets.length; a++)
    for (let b = a + 1; b < sets.length; b++) for (const x of sets[a]) for (const y of sets[b]) bg.push(jaccard(x, y));
  const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : Number.NaN);
  return { within, meanWithin: mean(within.filter((x) => !Number.isNaN(x))), background: mean(bg) };
}
/** Headlines whose bigram overlap with every other headline of the event is
 *  below the background: the ones a reader would call unrelated. */
function outliers(e: EventCluster, background: number) {
  const sets = e.news.map((n) => bigrams(n.title));
  return e.news.filter((_, i) => sets.every((s, j) => j === i || jaccard(sets[i], s) <= background));
}

const { db, close } = createDb();
try {
  const now = new Date();
  const { burst, rows } = await loadEventInputs(db, now);
  const list = (noEqual as { tags: string[] }).tags;
  const variants: Record<string, Parameters<typeof clusterEvents>[3]> = {
    legacy: { now, minShared: 1, newsLimit: 5, siteTagMin: Number.POSITIVE_INFINITY, duplicateShare: 2, aliases: false },
    current: { now },
  };
  const report: Record<string, unknown> = { at: now.toISOString(), articles: rows.length };
  for (const [name, opts] of Object.entries(variants)) {
    const events = clusterEvents(burst, rows as ArticleRow[], list, opts).slice(0, limit);
    const c = cohesion(events);
    const out = events.map((e) => outliers(e, c.background).length);
    const summary = {
      events: events.length,
      meanWithin: +c.meanWithin.toFixed(3),
      background: +c.background.toFixed(3),
      ratio: +(c.meanWithin / c.background).toFixed(2),
      outlierHeadlines: out.reduce((a, b) => a + b, 0),
      headlines: events.reduce((n, e) => n + e.news.length, 0),
    };
    report[name] = {
      ...summary,
      events: events.map((e, i) => ({
        rank: e.rank,
        tags: e.tags.map(([t]) => t),
        major: e.major,
        articles: e.articles,
        within: +c.within[i].toFixed(3),
        outliers: out[i],
        news: e.news.map((n) => `${n.media} | ${n.title}`),
      })),
    };
    console.log(`\n##### ${name}`, JSON.stringify(summary));
    if (!quiet)
      for (const [i, e] of events.entries()) {
        console.log(
          `\n=== #${e.rank} within=${c.within[i].toFixed(2)} outliers=${out[i]} articles=${e.articles} tags=${e.tags.map(([t]) => t).join(' ')}`,
        );
        for (const n of e.news)
          console.log(`   ${outliers(e, c.background).includes(n) ? '!!' : '  '} ${n.media} | ${n.title.slice(0, 70)}`);
      }
  }
  const json = arg('--json');
  if (json) await import('node:fs/promises').then((fs) => fs.writeFile(json, JSON.stringify(report, null, 1)));
} finally {
  await close();
}

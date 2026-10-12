/** Read-only distribution report from a completely hydrated private aggregate. */
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { probeHome } from '../app/src/vocabulary/runner.ts';
import { countVocabularyTier, newVocabularyTiers, vocabularyTerm } from '../app/src/vocabulary/snapshots.ts';

const directory = process.env.TAG_VOCABULARY_EXPORT_DIR;
if (!directory) throw Error('Export directory required');
const db = new DatabaseSync(join(directory, 'aggregate.sqlite'), { readOnly: true });
const get = (key: string) => {
  const row = db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
  return row ? JSON.parse(String(row.value)) : null;
};
if (!get('recentHydrationComplete') && !get('recentCountsReady')) throw Error('Recent-count hydration incomplete');
const asOf = get('recentHydrationAsOf') ?? get('startedAt');
const tiers = newVocabularyTiers();
const histograms: Record<string, Map<number, number>> = Object.fromEntries(['total', '30', '90', '180'].map((k) => [k, new Map()]));
let total = 0,
  noise = 0,
  noEqual = 0,
  inconsistentCounts = 0,
  homeMaxMs = 0;
const started = Date.now();
try {
  for (const row of db
    .prepare(
      'SELECT t.label,n,first_at,last_at,r30,r90,r180,as_of FROM terms t LEFT JOIN recent_counts USING(label) ORDER BY t.label COLLATE BINARY',
    )
    .iterate()) {
    if (total++ % 10000 === 0) {
      await delay(5);
      if (total % 100000 === 1) {
        const home = await probeHome();
        homeMaxMs = Math.max(homeMaxMs, home.ttfbMs);
        if (home.status !== 200 || home.ttfbMs > 1000) throw Error('home-ttfb');
      }
    }
    const term = vocabularyTerm({
      tag: String(row.label),
      articleCount: Number(row.n),
      firstPublishedAt: String(row.first_at),
      lastPublishedAt: String(row.last_at),
      recentArticleCount: Number(row.r180 ?? 0),
      recentArticleCounts: { '30': Number(row.r30 ?? 0), '90': Number(row.r90 ?? 0), '180': Number(row.r180 ?? 0) },
      recentCountsAsOf: String(row.as_of ?? asOf),
    });
    if (term.noise) noise++;
    if (term.noEqual) noEqual++;
    if (term.recentArticleCount! > term.articleCount) inconsistentCounts++;
    countVocabularyTier(tiers, term);
    if (term.noise || [...term.label].length < 2) continue;
    for (const key of ['total', '30', '90', '180'] as const) {
      const n = key === 'total' ? term.articleCount : term.recentArticleCounts![key];
      histograms[key].set(n, (histograms[key].get(n) ?? 0) + 1);
    }
  }
  const budgetThresholds = Object.fromEntries(
    Object.entries(histograms).map(([key, hist]) => {
      let count = 0,
        lastThreshold: number | null = null;
      for (const [threshold, n] of [...hist].sort((a, b) => b[0] - a[0])) {
        if (count + n > 50000) break;
        count += n;
        lastThreshold = threshold;
      }
      return [key, { articleCountAtLeast: lastThreshold, terms: count, budget: 50000 }];
    }),
  );
  console.log(
    JSON.stringify(
      { total, noise, noEqual, windowAsOf: asOf, tiers, budgetThresholds, inconsistentCounts, elapsedMs: Date.now() - started, homeMaxMs },
      null,
      2,
    ),
  );
} finally {
  db.close();
}

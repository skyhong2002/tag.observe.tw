import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { refreshedAuthorCredits } from '../app/src/crawl/author-refresh.ts';
import { extractClosingReporterNames, extractLeadReporterNames, reporterNames } from '../app/src/crawl/byline.ts';
import { extractFeatureArticle } from '../app/src/crawl/feature-article.ts';
import { fetchText } from '../app/src/crawl/fetch.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles } from '../app/src/db/schema.ts';

// Refresh credits only; body retention, ranking, citations and fetch timestamps
// are deliberately untouched. Use --after-id from the final summary to resume.
const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    backup: { type: 'string' },
    media: { type: 'string' },
    ids: { type: 'string' },
    limit: { type: 'string', default: '100' },
    'after-id': { type: 'string', default: '0' },
    hours: { type: 'string', default: String(90 * 24) },
    'stored-body': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(`Refresh article reporter credits (dry-run by default).
  --media outlet1,outlet2   Restrict outlets
  --ids 123,456            Restrict article IDs
  --limit 100             Bounded batch size (1–10000)
  --after-id 0            Resume after the previous batch's lastId
  --hours 2160            Acquisition window; 0 includes all history
  --stored-body           Read the stored lead without HTTP requests
  --apply                 Apply credit-only updates with race protection
  --backup /path/file     Optional durable JSONL copy of original credits
Without --stored-body, re-fetch pages using the crawler's current site rules.
HTTP 429 stops the batch; resume from lastId after waiting.`);
  process.exit(0);
}
const limit = Number(values.limit);
const afterId = Number(values['after-id']);
const hours = Number(values.hours);
const ids = values.ids?.split(',').map(Number);
const selected = values.media
  ?.split(',')
  .map((media) => media.trim())
  .filter(Boolean);
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw Error('limit must be 1–10000');
if (!Number.isSafeInteger(afterId) || afterId < 0) throw Error('after-id must be a nonnegative integer');
if (!Number.isSafeInteger(hours) || hours < 0 || hours > 24 * 365 * 100) throw Error('hours must be 0–876000');
if (ids?.some((id) => !Number.isSafeInteger(id) || id < 1)) throw Error('ids must be comma-separated positive integers');
if (values.media !== undefined && !selected?.length) throw Error('media must contain at least one outlet');
if (values.backup) mkdirSync(dirname(values.backup), { recursive: true, mode: 0o700 });

const { db, close } = createDb();
const counts = { scanned: 0, changed: 0, unchanged: 0, unavailable: 0, raced: 0 };
let lastId = afterId;
let stoppedOn429 = false;
try {
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      url: articles.url,
      body: articles.body,
      authors: articles.authors,
      creator: articles.creator,
    })
    .from(articles)
    .where(
      and(
        sql`${articles.id} > ${afterId}`,
        hours ? gte(articles.crawledAt, new Date(Date.now() - hours * 3600e3)) : undefined,
        selected?.length ? inArray(articles.media, selected) : undefined,
        ids?.length ? inArray(articles.id, ids) : undefined,
        values['stored-body'] ? sql`${articles.body} IS NOT NULL` : undefined,
      ),
    )
    .orderBy(asc(articles.id))
    .limit(limit);
  console.log(JSON.stringify({ selected: rows.length, applied: values.apply, mode: values['stored-body'] ? 'stored-body' : 'refetch' }));
  for (const row of rows) {
    const spec = sourceByMedia(row.media);
    try {
      let extracted: string[];
      if (values['stored-body']) {
        // Restrict inference to the lead, skipping photo captions and stopping
        // at ordinary prose so later mentions cannot establish authorship.
        extracted = extractLeadReporterNames(row.body ?? '');
        if (!extracted.length) extracted = extractClosingReporterNames(row.body ?? '');
        if (!extracted.length) extracted = (row.authors?.length ? row.authors : row.creator ? [row.creator] : []).flatMap(reporterNames);
      } else {
        const response = await fetchText(row.url, { userAgent: spec?.article.userAgent, timeout: 10000, retries: 0 });
        if (response.status === 429) {
          stoppedOn429 = true;
          console.log(JSON.stringify({ id: row.id, media: row.media, error: 'HTTP 429; batch stopped', retryAfterId: lastId }));
          break;
        }
        if (response.status >= 400) throw Error(`HTTP ${response.status}`);
        const detail = extractFeatureArticle(response.body, row.url, spec?.article);
        if (spec?.article.provider && !new RegExp(spec.article.provider).test(detail.provider ?? '')) throw Error('provider changed');
        if (detail.bodyStatus === 'blocked') throw Error('blocked page');
        extracted = detail.authors;
      }
      counts.scanned++;
      const update = refreshedAuthorCredits(row, extracted);
      if (!update) {
        counts.unchanged++;
      } else {
        if (values.apply) {
          if (values.backup)
            appendFileSync(
              values.backup,
              JSON.stringify({
                savedAt: new Date(),
                id: row.id,
                media: row.media,
                url: row.url,
                authors: row.authors,
                creator: row.creator,
              }) + '\n',
              { mode: 0o600, flush: true },
            );
          const [result] = await db
            .update(articles)
            .set(update)
            .where(
              and(
                eq(articles.id, row.id),
                sql`${articles.authors} <=> ${row.authors === null ? null : JSON.stringify(row.authors)}`,
                sql`${articles.creator} <=> ${row.creator}`,
                // Stored-body evidence must still be the current body.
                values['stored-body'] ? sql`BINARY ${articles.body} <=> BINARY ${row.body}` : undefined,
              ),
            );
          if (!result.affectedRows) {
            counts.raced++;
            lastId = row.id;
            continue;
          }
        }
        counts.changed++;
        console.log(JSON.stringify({ id: row.id, media: row.media, before: { authors: row.authors, creator: row.creator }, ...update }));
      }
    } catch (error) {
      counts.unavailable++;
      console.log(JSON.stringify({ id: row.id, media: row.media, error: (error as Error).message }));
    }
    lastId = row.id;
    if (!values['stored-body']) await setTimeout(Math.max(250, Math.min(spec?.article.delayMs ?? 250, 3000)));
  }
  console.log(JSON.stringify({ ...counts, applied: values.apply, lastId, stoppedOn429, batchFull: rows.length === limit }));
} finally {
  await close();
}

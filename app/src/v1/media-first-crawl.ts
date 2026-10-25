import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { and, inArray, sql } from 'drizzle-orm';
import { crawlTimestamp } from '../crawl/schedule.ts';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';

// When our own crawler first stored an article for each outlet. It practically
// never changes, but MIN(crawled_at) over all own rows reads every article row
// (~20 GB) and took 50–60 s cold. Remember it per outlet in a file and only
// look up outlets that are not known yet. Delete the file after a repair that
// moves older rows to another outlet.
export const firstCrawlFile = () =>
  process.env.TAG_MEDIA_FIRST_CRAWL_FILE || join(homedir(), '.local/share/tag-analysis/media-first-crawl.json');

async function readFirstCrawls(): Promise<Record<string, string>> {
  try {
    const value = JSON.parse(await readFile(firstCrawlFile(), 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

async function writeFirstCrawls(value: Record<string, string>) {
  const file = firstCrawlFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
}

/** Own outlets with at least one article; answered from the (source, media, published_at) index alone. */
export const ownTotals = (db: Db) =>
  db
    .select({ media: articles.media, totalCollected: sql<number>`COUNT(*)` })
    .from(articles)
    .where(sql`${articles.source} = 'own'`)
    .groupBy(articles.media);

/** First crawl time (ISO) for each given outlet that has own articles. */
export async function firstCrawls(db: Db, media: string[], warn?: (error: unknown) => void): Promise<Record<string, string>> {
  const known = await readFirstCrawls();
  const unknown = media.filter((name) => !known[name]);
  if (unknown.length) {
    const found = await db
      .select({ media: articles.media, first: sql<Date | string | null>`MIN(${articles.crawledAt})` })
      .from(articles)
      .where(and(sql`${articles.source} = 'own'`, inArray(articles.media, unknown)))
      .groupBy(articles.media);
    let changed = false;
    for (const row of found) {
      const first = crawlTimestamp(row.first);
      if (first) {
        known[row.media] = first.toISOString();
        changed = true;
      }
    }
    if (changed) await writeFirstCrawls(known).catch((error) => warn?.(error));
  }
  return Object.fromEntries(media.flatMap((name) => (known[name] ? [[name, known[name]]] : [])));
}

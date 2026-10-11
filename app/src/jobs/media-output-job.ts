import type { Db } from '../db/client.ts';
import { articleHosts, publisherHosts, readOutput, refreshOutput, writeOutput } from '../media-traffic/output.ts';

/** Daily output per publisher (media-traffic/output.ts): news sitemap counts plus our articles on the measured host. */
export async function runMediaOutputJob(db: Db, targets = publisherHosts()) {
  const result = await refreshOutput(targets, await readOutput(), await articleHosts(db));
  await writeOutput(result);
  if (result.status === 'failed') throw Error(result.error || 'No news sitemaps read');
  return {
    media: result.media.length,
    withSitemap: result.media.filter((row) => row.sitemaps.length).length,
    status: result.status,
    checkedAt: result.checkedAt,
  };
}

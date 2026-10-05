// Seed feature pages into the normal article queue; optionally fetch a bounded batch now.
import { desc, eq } from 'drizzle-orm';
import pLimit from 'p-limit';
import { extractFeatureArticle } from '../app/src/crawl/feature-article.ts';
import { fetchText } from '../app/src/crawl/fetch.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { topics } from '../app/src/db/schema.ts';
import { indexFeatureArticle, indexMissingFeatureArticles } from '../app/src/jobs/feature-article.ts';
import { articleMediaOf } from '../app/src/jobs/topic-stories.ts';

const apply = process.argv.includes('--apply');
const limit = Math.min(300, Math.max(0, Number(process.argv.find((s) => s.startsWith('--limit='))?.slice(8)) || 0));
const ids = process.argv
  .find((s) => s.startsWith('--ids='))
  ?.slice(6)
  .split(',')
  .map(Number);
const { db, close } = createDb();
try {
  const rows = await db.select().from(topics).where(eq(topics.kind, 'feature')).orderBy(desc(topics.storyLastAt));
  console.log(JSON.stringify({ features: rows.length, apply, inserted: apply ? await indexMissingFeatureArticles(db) : 0 }));
  if (apply && limit) {
    const gate = pLimit(2);
    await Promise.all(
      rows
        .filter((r) => !ids || ids.includes(r.id))
        .slice(0, limit)
        .map((r) =>
          gate(async () => {
            try {
              const res = await fetchText(r.url, { timeout: 15000 });
              if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
              const detail = extractFeatureArticle(res.body, r.url, sourceByMedia(articleMediaOf(r.media))?.article);
              await indexFeatureArticle(db, r, detail);
              console.log(
                JSON.stringify({
                  id: r.id,
                  media: r.media,
                  status: detail.bodyStatus,
                  chars: detail.body?.length ?? 0,
                  image: !!detail.image,
                }),
              );
            } catch (error) {
              console.log(JSON.stringify({ id: r.id, error: String(error) }));
            }
          }),
        ),
    );
  }
} finally {
  await close();
}

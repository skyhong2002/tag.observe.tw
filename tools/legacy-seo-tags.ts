// Lists the tags whose tag.observe.tw page has its own statistics (tag_stats), one
// per line, for the legacy site's canonical guard (infra/legacy-tag/seo_guard.php).
// A tag here answers 200 with a self canonical on the new site; every other legacy
// tag page keeps a tag.analysis.tw canonical. tag_stats rows are only ever upserted,
// so a listed tag does not later turn into a 404.
//   node --env-file=.env tools/legacy-seo-tags.ts > observe-tags.txt
import { createDb } from '../app/src/db/client.ts';
import { tagStats } from '../app/src/db/schema.ts';

// Same rule as legacy_seo_bad_tag(): those URLs answer 404 on the legacy site.
const BAD = /[{}<>"\\\u0000-\u001f\u007f]/;

const { db, close } = createDb();
try {
  const rows = await db.selectDistinct({ tag: tagStats.tag }).from(tagStats);
  const tags = [...new Set(rows.map((r) => r.tag.trim()))].filter((t) => t && !BAD.test(t)).sort();
  if (tags.length < 1000) throw new Error(`only ${tags.length} tags; refusing to publish a short list`);
  process.stdout.write(`\n${tags.join('\n')}\n`);
  console.error(`${tags.length} tags`);
} finally {
  await close();
}

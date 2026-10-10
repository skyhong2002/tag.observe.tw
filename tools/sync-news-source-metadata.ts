// Register every catalog identity in the API without inferring political labels.
// media-catalog.json only seeds an empty DB, so newly catalogued outlets also
// get the 「新聞媒體」 label in the DB (TAG_DB_URL). Outlets already in the seed
// keep whatever labels admins gave them at /admin/media/.
import { readFile, writeFile } from 'node:fs/promises';
import names from '../app/data/media-names.json' with { type: 'json' };
import catalog from '../app/data/news-source-catalog.json' with { type: 'json' };
import { createDb } from '../app/src/db/client.ts';
import { mediaCategories } from '../app/src/db/schema.ts';

const iconsUrl = new URL('../app/data/favicon-catalog.json', import.meta.url);
const categoriesUrl = new URL('../app/data/media-catalog.json', import.meta.url);
const icons = JSON.parse(await readFile(iconsUrl, 'utf8')) as Record<string, { title: string | null; icon: string | null }>;
const categories = JSON.parse(await readFile(categoriesUrl, 'utf8')) as { categories: Record<string, string[]> };
const news = new Set(categories.categories.news);
const reviewed = names.media as Record<string, { name: string | null }>;
const missing = catalog.sources.filter((source) => !reviewed[source.media]?.name);
if (missing.length) throw new Error(`Review new media names before syncing: ${missing.map((source) => source.media).join(', ')}`);
let added = 0;
const fresh = catalog.sources.map((source) => source.media).filter((media) => !news.has(media));
for (const source of catalog.sources) {
  if (!icons[source.media]) {
    icons[source.media] = { title: reviewed[source.media].name, icon: null };
    added++;
  }
  news.add(source.media);
}
for (const [media, entry] of Object.entries(reviewed)) {
  if (icons[media]) icons[media].title = entry.name;
}
categories.categories.news = [...news];
await writeFile(iconsUrl, JSON.stringify(icons, null, 2) + '\n');
await writeFile(categoriesUrl, JSON.stringify(categories, null, 2) + '\n');
if (fresh.length && process.env.TAG_DB_URL) {
  const { db, close } = createDb();
  try {
    await db
      .insert(mediaCategories)
      .ignore()
      .values(fresh.map((media) => ({ media, category: 'news' })));
  } finally {
    await close();
  }
}
console.log(JSON.stringify({ added, news: news.size, labelled: process.env.TAG_DB_URL ? fresh : [] }));

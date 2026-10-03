// Register every catalog identity in the API without inferring political labels.
import { readFile, writeFile } from 'node:fs/promises';
import catalog from '../app/data/news-source-catalog.json' with { type: 'json' };

const iconsUrl = new URL('../app/data/favicon-catalog.json', import.meta.url);
const categoriesUrl = new URL('../app/data/media-catalog.json', import.meta.url);
const icons = JSON.parse(await readFile(iconsUrl, 'utf8')) as Record<string, { title: string; icon: string | null }>;
const categories = JSON.parse(await readFile(categoriesUrl, 'utf8')) as { categories: Record<string, string[]> };
const news = new Set(categories.categories.news);
let added = 0;
for (const source of catalog.sources) {
  if (!icons[source.media]) {
    icons[source.media] = { title: source.name, icon: null };
    added++;
  }
  news.add(source.media);
}
categories.categories.news = [...news];
await writeFile(iconsUrl, JSON.stringify(icons, null, 2) + '\n');
await writeFile(categoriesUrl, JSON.stringify(categories, null, 2) + '\n');
console.log(JSON.stringify({ added, news: news.size }));

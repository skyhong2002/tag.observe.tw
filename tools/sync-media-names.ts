// Only human-reviewed names may update the shared API/UI title catalog.
import { readFile, writeFile } from 'node:fs/promises';
import names from '../app/data/media-names.json' with { type: 'json' };

const url = new URL('../app/data/favicon-catalog.json', import.meta.url);
const icons = JSON.parse(await readFile(url, 'utf8')) as Record<string, { title: string | null; icon: string | null }>;
const reviewed = names.media as Record<string, { name: string | null }>;
const missing = Object.keys(icons).filter((media) => !reviewed[media]);
if (missing.length) throw new Error(`Review media names before syncing: ${missing.join(', ')}`);
const changes = Object.keys(reviewed).filter((media) => icons[media]?.title !== reviewed[media].name);
if (process.argv.includes('--check')) {
  if (changes.length) throw new Error(`Run node tools/sync-media-names.ts: ${changes.join(', ')}`);
} else if (changes.length) {
  for (const media of changes) icons[media] = { ...icons[media], title: reviewed[media].name, icon: icons[media]?.icon ?? null };
  await writeFile(url, JSON.stringify(icons, null, 2) + '\n');
}
console.log(JSON.stringify({ reviewed: Object.keys(reviewed).length, changed: changes.length }));

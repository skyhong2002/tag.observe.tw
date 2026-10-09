// Read a selected immutable archive version; do not hydrate or alter visibility.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { decodeContent } from '../../app/src/nearline/content.ts';
import { type ArchiveIndexEntry, decimalId } from '../../app/src/nearline/query-index.ts';
import { archiveStoreFromEnv } from '../../app/src/nearline/store.ts';

async function main() {
  process.umask(0o077);
  const { values } = parseArgs({ options: { entry: { type: 'string' }, out: { type: 'string' } } });
  if (!values.entry || !values.out) throw new Error('Entry and output required');
  const entry = JSON.parse(await readFile(values.entry, 'utf8')) as ArchiveIndexEntry;
  const store = archiveStoreFromEnv();
  if (!store || entry.kind !== 'article_content' || entry.selector?.type !== 'article_version')
    throw new Error('Unsupported content retrieval');
  const id = Number(decimalId(entry.selector.articleId, true));
  if (!Number.isSafeInteger(id)) throw new Error('Unsupported article ID');
  const artifact = entry.artifacts.find((item) => item.role === 'content');
  if (!artifact || entry.artifacts.length !== 1 || artifact.remote !== store.remote)
    throw new Error('Unexpected archive storage');
  const data = await store.getVerified(artifact.key, artifact.sha256);
  const article = decodeContent(data, id, entry.selector.contentHash);
  const temporary = `${values.out}.partial`;
  await writeFile(temporary, `${JSON.stringify({ article, archiveEntryId: entry.id })}\n`, { mode: 0o600 });
  await rename(temporary, values.out);
}

main().catch(() => {
  console.error('Selected content retrieval failed; check private archive receipts.');
  process.exitCode = 1;
});

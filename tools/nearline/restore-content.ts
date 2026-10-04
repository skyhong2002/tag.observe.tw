// Explicit internal cache hydration; public body visibility remains seven days.
import { parseArgs } from 'node:util';
import { createDb } from '../../app/src/db/client.ts';
import { restoreArticleContent } from '../../app/src/nearline/content.ts';
import { archiveStoreFromEnv } from '../../app/src/nearline/store.ts';

const { values } = parseArgs({ options: { id: { type: 'string' } } });
const id = Number(values.id);
if (!Number.isSafeInteger(id) || id <= 0) throw new Error('--id must be a positive safe integer');
const store = archiveStoreFromEnv();
if (!store) throw new Error('Content archive storage is not configured');
const connection = createDb();
try {
  console.log(JSON.stringify(await restoreArticleContent(connection.db, store, id)));
} finally {
  await connection.close();
}

import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { excludedMedia } from '../../app/src/crawl/registry.ts';
import { legacyMapping, legacyMappingVersion, MIXED_ARTICLE_TABLES } from '../../app/src/legacy/mapping.ts';

const { values } = parseArgs({ options: { state: { type: 'string' }, columns: { type: 'string' }, out: { type: 'string' } } });
if (!values.state || !values.columns || !values.out) throw new Error('--state --columns --out are required');
const state = JSON.parse(readFileSync(values.state, 'utf8'));
const lines = readFileSync(values.columns, 'utf8').trim().split('\n');
const fields = lines.shift()!.split('\t');
const columns = new Map<string, Map<string, Record<string, string>>>();
for (const line of lines) {
  const row = Object.fromEntries(line.split('\t').map((cell, i) => [fields[i], cell]));
  const table = columns.get(row.TABLE_NAME) ?? new Map();
  table.set(row.COLUMN_NAME, row);
  columns.set(row.TABLE_NAME, table);
}
const references = new Set([
  'media_list',
  'catalogue',
  'catalogue_tag',
  'tags',
  'tags_noequal',
  'tags_url',
  'tag_group',
  'topic_list',
  'topic_tag',
  'topic_news',
  'acattag_topic',
]);
const tables = Object.entries(
  state.tables as Record<string, { status: string; chunks: { sha256: string; bytes: number }[]; estimated_rows?: number; error?: string }>,
).map(([table, status]) => {
  const mixed = MIXED_ARTICLE_TABLES.has(table);
  const mapping = legacyMapping(table);
  let action = 'nearline_only';
  let reason = references.has(table)
    ? 'reference_rules_preserved_without_changing_live_semantics'
    : table.startsWith('show_')
      ? 'legacy_computation_cache_or_history_separate_from_current_algorithms'
      : 'historical_auxiliary_or_unmapped_source';
  if (table.startsWith('tag_') && excludedMedia.has(table.slice(4))) reason = 'excluded_from_live_site_by_user_request';
  if (mapping || mixed) {
    const schema = columns.get(table);
    const required = ['newsid', 'url', 'title', 'ctime', 'create_time', 'tags', ...(mixed ? ['media'] : [])];
    const valid =
      schema &&
      required.every((name) => schema.has(name)) &&
      schema.get('newsid')?.COLUMN_KEY === 'PRI' &&
      /^\w*int\(/.test(schema.get('newsid')!.COLUMN_TYPE) &&
      ['ctime', 'create_time'].every((name) => schema.get(name)?.COLUMN_TYPE === 'datetime');
    if (valid) {
      action = 'import_articles';
      reason = mixed ? 'explicit_row_media_and_reviewed_publisher_domain' : 'exact_media_code_and_reviewed_publisher_domain';
    } else reason = 'article_schema_requires_review';
  }
  if (status.status === 'excluded' || status.status === 'blocked') {
    action = 'source_gap';
    reason = status.error ?? status.status;
  }
  return {
    table,
    media: mapping?.sourceMedia ?? (mixed ? 'mixed' : null),
    targetMedia: mapping?.spec.media ?? null,
    action,
    reason,
    backupStatus: status.status,
    estimatedRows: status.estimated_rows ?? null,
    capturedChunks: status.chunks.length,
    compressedBytes: status.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
  };
});
tables.sort((a, b) =>
  a.table === 'tag_cna'
    ? -1
    : b.table === 'tag_cna'
      ? 1
      : Number(MIXED_ARTICLE_TABLES.has(a.table)) - Number(MIXED_ARTICLE_TABLES.has(b.table)) || a.table.localeCompare(b.table),
);
const plan = {
  version: 1,
  generation: state.generation,
  source: state.source,
  generatedAt: new Date().toISOString(),
  mappingVersion: legacyMappingVersion,
  mappingSha256: createHash('sha256')
    .update(readFileSync(new URL('../../app/data/legacy-media-mapping.json', import.meta.url)))
    .digest('hex'),
  policy:
    'One-time historical import. Full original rows stay on NAS. Unknown media, recent rows and conflicts remain explicitly quarantined. Cache/rule histories do not replace current algorithms.',
  tables,
};
writeFileSync(values.out + '.partial', JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
renameSync(values.out + '.partial', values.out);
console.log(
  JSON.stringify(
    {
      tables: tables.length,
      actions: tables.reduce(
        (out, row) => {
          out[row.action] = (out[row.action] ?? 0) + 1;
          return out;
        },
        {} as Record<string, number>,
      ),
      articleChunks: tables.filter((t) => t.action === 'import_articles').reduce((sum, t) => sum + t.capturedChunks, 0),
    },
    null,
    2,
  ),
);

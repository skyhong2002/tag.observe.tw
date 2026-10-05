// One-off, resumable historical article migration. Default: temporary-table dry run.
import { createHash } from 'node:crypto';
import { appendFileSync, createReadStream, mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createGunzip } from 'node:zlib';
import type { SourceSpec } from '../../app/src/crawl/sources.ts';
import { createDb } from '../../app/src/db/client.ts';
import { type ImportOutcome, importCandidates, type LegacyCandidate } from '../../app/src/legacy/import.ts';
import { jsonLines } from '../../app/src/legacy/jsonl.ts';
import { legacyMapping, legacyMappingVersion, legacyTableSupported } from '../../app/src/legacy/mapping.ts';
import { normalizeLegacyArticle } from '../../app/src/legacy/normalize.ts';

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    out: { type: 'string' },
    apply: { type: 'boolean', default: false },
    'allow-recent': { type: 'boolean', default: false },
  },
});
if (!values.package || !values.out) throw new Error('--package and a new --out directory are required');
const directory = values.package;
const report = JSON.parse(readFileSync(join(directory, 'report.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(directory, 'source-manifest.json'), 'utf8'));
if (!legacyTableSupported(manifest.table) || manifest.source !== 'tag-analysis/tag' || manifest.chunks.length !== 1)
  throw new Error('Requires a mapped single-chunk article package');
if (report.rows > 100000 || !report.restore_row_count_verified || report.restored_rows !== report.rows)
  throw new Error('Verified bounded restore is required');
const fallbackSpec: SourceSpec = {
  media: 'unmapped',
  group: 'news',
  list: { urls: [] },
  article: { enabled: false, batch: 1, delayMs: 0 },
};
const spec = legacyMapping(manifest.table)?.spec ?? fallbackSpec;
const context = {
  source: manifest.source,
  table: manifest.table,
  generation: manifest.generation,
  capturedAt: manifest.chunks[0].captured_at,
  objects: [manifest.chunks[0].sha256],
  spec,
};
const path = join(directory, 'articles.jsonl.gz');
const hash = createHash('sha256');
for await (const bytes of createReadStream(path)) hash.update(bytes);
if (hash.digest('hex') !== report.compressedSha256) throw new Error('Compressed package hash mismatch');
const rows: LegacyCandidate[] = [];
const rawHash = createHash('sha256');
const stream = createReadStream(path).pipe(createGunzip());
let rawBytes = 0;
stream.on('data', (bytes: Buffer) => {
  rawBytes += bytes.length;
  rawHash.update(bytes);
  if (rawBytes > 512 * 1024 ** 2) stream.destroy(new Error('Decompressed package too large'));
});
const sourceKeys = new Set<string>();
for await (const line of jsonLines(stream)) {
  if (!line) continue;
  const input = JSON.parse(line);
  const mapped = legacyMapping(manifest.table, input.raw);
  const row = normalizeLegacyArticle(input.raw, {
    ...context,
    spec: mapped?.spec ?? fallbackSpec,
    publisherRoots: mapped?.publisherRoots ?? [],
    publisherHosts: mapped?.publisherHosts ?? [],
    mixedTable: mapped?.mixed ?? false,
    sourceMedia: mapped?.sourceMedia,
  });
  if (!mapped) {
    row.disposition = 'quarantine';
    row.reasons.push('unmapped_legacy_media');
  }
  if (
    row.lineage.rawSha256 !== input.lineage.rawSha256 ||
    row.lineage.sourceKey !== input.lineage.sourceKey ||
    JSON.stringify(row.lineage.objects) !== JSON.stringify(input.lineage.objects) ||
    input.lineage.generation !== manifest.generation
  )
    throw new Error('Raw lineage mismatch');
  if (sourceKeys.has(row.lineage.sourceKey)) throw new Error('Duplicate source key in package');
  sourceKeys.add(row.lineage.sourceKey);
  rows.push(row);
  if (rows.length > 100000) throw new Error('Row limit exceeded');
}
if (rows.length !== report.rows || rawHash.digest('hex') !== report.normalizedSha256)
  throw new Error('Normalized package integrity mismatch');
const disk = statfsSync(directory);
if (disk.bavail * disk.bsize < 20 * 1024 ** 3) throw new Error('At least 20 GiB local free space required');
if (values.apply && !process.env.TAG_CONTENT_ARCHIVE_REMOTE) throw new Error('Content nearline configuration required for apply');
if (values.apply && values['allow-recent']) {
  const health = await fetch(`http://127.0.0.1:${Number(process.env.WORKER_METRICS_PORT || 18133)}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!health.ok || ((await health.json()) as { legacyOwnershipPolicy?: string }).legacyOwnershipPolicy !== 'own-indexed-v2')
    throw new Error('Running worker has not enabled own-indexed-v2; recent import remains blocked');
}
mkdirSync(values.out, { mode: 0o700 });
const auditPath = join(values.out, 'outcomes.jsonl');
writeFileSync(auditPath, '', { mode: 0o600, flag: 'wx' });
const now = new Date();
const summary = {
  mode: values.apply ? 'apply' : 'dry-run',
  startedAt: now.toISOString(),
  finishedAt: null as string | null,
  status: 'running',
  packageSha256: report.compressedSha256,
  generation: manifest.generation,
  sourceObject: manifest.chunks[0].object,
  adapter: 'legacy-article-import-v3',
  allowRecent: values['allow-recent'],
  requiredWorkerPolicy: values['allow-recent'] ? 'own-indexed-v2' : null,
  mappingVersion: legacyMappingVersion,
  mappingSha256: createHash('sha256')
    .update(readFileSync(new URL('../../app/data/legacy-media-mapping.json', import.meta.url)))
    .digest('hex'),
  normalizerSha256: createHash('sha256')
    .update(readFileSync(new URL('../../app/src/legacy/normalize.ts', import.meta.url)))
    .digest('hex'),
  rows: rows.length,
  verifiedOrigins: 0,
  processed: 0,
  counts: {} as Record<string, number>,
  error: null as string | null,
};
const save = () => writeFileSync(join(values.out!, 'report.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
save();
const db = createDb(undefined, { poolSize: 1 });
try {
  const c = await db.pool.getConnection();
  try {
    if (values.apply && values['allow-recent']) {
      const [indexes] = await c.query<import('mysql2/promise').RowDataPacket[]>(
        "SHOW INDEX FROM articles WHERE Key_name='articles_source_media_published'",
      );
      const columns = indexes.sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index)).map((row) => row.Column_name);
      if (columns.join(',') !== 'source,media,published_at')
        throw new Error('Recent import requires the live ownership index (migration 0018)');
    }
    const outcomes = await importCandidates(c, rows, {
      apply: values.apply,
      allowRecent: values['allow-recent'],
      generation: manifest.generation,
      object: manifest.chunks[0].object,
      now,
      onBatch(batch: ImportOutcome[]) {
        appendFileSync(auditPath, batch.map((r) => JSON.stringify(r) + '\n').join(''));
        for (const r of batch) summary.counts[r.action] = (summary.counts[r.action] ?? 0) + 1;
        summary.processed += batch.length;
        save();
        if (summary.processed % 5000 === 0) console.log(JSON.stringify({ processed: summary.processed, counts: summary.counts }));
      },
    });
    const linked = values.apply ? outcomes.filter((row) => row.articleId) : [];
    for (let start = 0; start < linked.length; start += 500) {
      const batch = linked.slice(start, start + 500);
      const [verified] = await c.query<import('mysql2/promise').RowDataPacket[]>(
        'SELECT o.source_key,o.raw_hash,o.article_id FROM article_origins o JOIN articles a ON a.id=o.article_id WHERE (o.source_key,o.raw_hash) IN (?)',
        [batch.map((row) => [row.sourceKey, row.rawHash])],
      );
      const actual = new Map(verified.map((row) => [row.source_key + '/' + row.raw_hash, String(row.article_id)]));
      if (batch.some((row) => actual.get(row.sourceKey + '/' + row.rawHash) !== row.articleId))
        throw new Error('Origin/article readback verification failed');
      summary.verifiedOrigins += batch.length;
    }
    summary.status = 'complete';
  } finally {
    c.release();
  }
} catch (error) {
  summary.status = 'failed';
  summary.error = (error as Error).message;
  process.exitCode = 1;
} finally {
  await db.close();
  summary.finishedAt = new Date().toISOString();
  save();
}
console.log(JSON.stringify(summary, null, 2));

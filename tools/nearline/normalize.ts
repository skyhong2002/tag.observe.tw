import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { SourceSpec } from '../../app/src/crawl/sources.ts';
import { jsonLines } from '../../app/src/legacy/jsonl.ts';
import { legacyMapping, legacyMappingVersion, legacyTableSupported, MIXED_ARTICLE_TABLES } from '../../app/src/legacy/mapping.ts';
import { type LegacyRow, normalizeLegacyArticle } from '../../app/src/legacy/normalize.ts';

const { values } = parseArgs({
  options: { input: { type: 'string' }, manifest: { type: 'string' }, media: { type: 'string' }, out: { type: 'string' } },
});
if (!values.input || !values.manifest || !values.media || !values.out) throw new Error('--input --manifest --media --out are required');
const fallbackSpec: SourceSpec = {
  media: 'unmapped',
  group: 'news',
  list: { urls: [] },
  article: { enabled: false, batch: 1, delayMs: 0 },
};
const spec = legacyMapping(`tag_${values.media}`)?.spec ?? fallbackSpec;
const manifest = JSON.parse(readFileSync(values.manifest, 'utf8'));
if (!legacyTableSupported(manifest.table) || (!MIXED_ARTICLE_TABLES.has(manifest.table) && manifest.table !== `tag_${values.media}`))
  throw new Error('Unreviewed source table');
mkdirSync(values.out, { recursive: true, mode: 0o700 });
const target = join(values.out, 'articles.jsonl');
if ([target, `${target}.gz`, `${target}.partial`, join(values.out, 'report.json')].some(existsSync))
  throw new Error('Output already exists');
const context = {
  source: manifest.source,
  table: manifest.table,
  generation: manifest.generation,
  capturedAt: manifest.chunks
    .map((c: { captured_at: string }) => c.captured_at)
    .sort()
    .at(-1),
  objects: manifest.chunks.map((c: { sha256: string }) => c.sha256),
  spec,
};
if (!Number.isFinite(Date.parse(context.capturedAt))) throw new Error('Manifest has no valid capture time');
const report = {
  adapter: 'legacy-article-staging-v3',
  mappingVersion: legacyMappingVersion,
  mappingSha256: createHash('sha256')
    .update(readFileSync(new URL('../../app/data/legacy-media-mapping.json', import.meta.url)))
    .digest('hex'),
  retentionPolicy: 'verified-nearline-v1 (requires migration and worker deployment)',
  source: manifest.source,
  table: manifest.table,
  generation: manifest.generation,
  rows: 0,
  candidates: 0,
  quarantined: 0,
  withinPackageDuplicateKeys: 0,
  reasons: {} as Record<string, number>,
  warnings: {} as Record<string, number>,
  productionCompared: false,
  productionWritten: false,
  objects: context.objects,
  normalizedSha256: '',
  compressedSha256: '',
  adapterSha256: createHash('sha256')
    .update(readFileSync(new URL('../../app/src/legacy/normalize.ts', import.meta.url)))
    .digest('hex'),
  textHelpersSha256: createHash('sha256')
    .update(readFileSync(new URL('../../app/src/crawl/text.ts', import.meta.url)))
    .digest('hex'),
  sourceSpecSha256: createHash('sha256').update(JSON.stringify(spec)).digest('hex'),
  note: 'All rows retained including duplicates/quarantine; candidates need retention, cross-package/current-site identity and media review before import.',
};
const seen = new Map<string, string>();
const hash = createHash('sha256');
const fd = openSync(`${target}.partial`, 'wx', 0o600);
try {
  for await (const line of jsonLines(createReadStream(values.input))) {
    if (!line) continue;
    const raw = JSON.parse(line) as LegacyRow;
    const mapped = legacyMapping(manifest.table, raw);
    const record = normalizeLegacyArticle(raw, {
      ...context,
      spec: mapped?.spec ?? fallbackSpec,
      publisherRoots: mapped?.publisherRoots ?? [],
      publisherHosts: mapped?.publisherHosts ?? [],
      mixedTable: mapped?.mixed ?? false,
      sourceMedia: mapped?.sourceMedia,
    });
    if (!mapped) {
      record.disposition = 'quarantine';
      record.reasons.push('unmapped_legacy_media');
    }
    let duplicateOf: string | null = null;
    if (record.disposition === 'candidate') {
      const key = `${record.article.media}\0${record.article.urlKey}`;
      duplicateOf = seen.get(key) ?? null;
      if (duplicateOf) report.withinPackageDuplicateKeys++;
      else seen.set(key, record.lineage.sourceKey);
      report.candidates++;
    } else report.quarantined++;
    for (const reason of record.reasons) report.reasons[reason] = (report.reasons[reason] ?? 0) + 1;
    for (const warning of record.warnings) report.warnings[warning] = (report.warnings[warning] ?? 0) + 1;
    const output = JSON.stringify({ ...record, duplicateOf }) + '\n';
    writeSync(fd, output);
    hash.update(output);
    report.rows++;
  }
} finally {
  closeSync(fd);
}
report.normalizedSha256 = hash.digest('hex');
renameSync(`${target}.partial`, target);
const compressed = spawnSync('gzip', ['-n', target], { stdio: 'inherit' });
if (compressed.status !== 0) throw new Error('Compression failed');
const compressedHash = createHash('sha256');
for await (const bytes of createReadStream(`${target}.gz`)) compressedHash.update(bytes);
report.compressedSha256 = compressedHash.digest('hex');
writeFileSync(join(values.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(report, null, 2));

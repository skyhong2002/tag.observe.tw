import { createHash } from 'node:crypto';

/** Internal catalog contract. Publishing this metadata does not fetch content. */
export type ArchiveKind = 'sql_data' | 'sql_schema' | 'sql_programs' | 'article_content' | 'source_gap';
export interface ArchiveQuery {
  source?: 'legacy' | 'site';
  kind?: ArchiveKind;
  generation?: string;
  table?: string;
  articleId?: string;
  legacyId?: string;
  objectHash?: string;
  id?: string;
  limit?: number;
  cursor?: string;
}
export interface ArchiveArtifact {
  role: 'schema' | 'data' | 'programs' | 'content';
  remote: string;
  key: string;
  sha256: string;
  bytes: number | null;
  rawBytes: number | null;
}
export interface ArchiveIndexEntry {
  id: string;
  kind: ArchiveKind;
  source: {
    type: 'legacy' | 'site';
    generation: string | null;
    table: string | null;
    tableComplete: boolean | null;
    chunk?: number;
  };
  availability: 'archived' | 'unavailable';
  format: 'mysql-sql-gzip' | 'tag-content-v1-gzip' | null;
  selector:
    | { type: 'article_version'; articleId: string; contentHash: string }
    | { type: 'legacy_range'; key: string | null; lowerExclusive: string | null; upperInclusive: string | null; wholeTable: boolean }
    | null;
  artifacts: ArchiveArtifact[];
  retrieval: {
    adapter: 'legacy-isolated-sql' | 'legacy-programs-review' | 'site-content-v1' | null;
    requiresConversion: boolean;
  };
  integration: {
    classification: string;
    mappingSha256: string | null;
    tableRowsAccountedFor: number | null;
    tableQuarantinedRows: number | null;
    packageIndependentlyVerified?: boolean;
    packageReplayPending?: boolean;
    preparedReceipt?: string | null;
    applyReceipt?: string | null;
  } | null;
  verification: {
    basis: 'source-manifest-receipt' | 'article-archives-receipt';
    observedAt: string | null;
    freshObjectReadback: false;
  } | null;
  reason?: string;
}
export interface ArchiveQueryResponse {
  format: 'tag-nearline-query-v1';
  indexRevision: string;
  indexBuiltAt: string;
  sourceSnapshots: Array<{
    role: 'catalog' | 'legacy-manifest' | 'site-snapshot';
    sha256: string;
    observedAt: string | null;
    generation?: string;
  }>;
  count: number;
  entries: ArchiveIndexEntry[];
  nextCursor: string | null;
}

export const archiveEntryId = (kind: ArchiveKind, ...parts: string[]) =>
  `nli1_${createHash('sha256')
    .update([kind, ...parts].join('\0'))
    .digest('hex')}`;

export function decimalId(value: string, positive = false): string {
  if (typeof value !== 'string' || !/^-?(0|[1-9]\d*)$/.test(value) || value === '-0') throw new Error('Invalid decimal ID');
  const id = BigInt(value);
  if (id < -(2n ** 63n) || id > 2n ** 64n - 1n || (positive && id <= 0n)) throw new Error('ID outside MySQL range');
  return value;
}
const sha256 = (value: string) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid SHA256');
  return value;
};

export interface SiteArchiveRecord {
  type: 'archive';
  articleId: string;
  contentHash: string;
  objectKey: string;
  objectHash: string;
  archiveRemote: string;
  archivedAt: string;
  verifiedAt: string;
}

export function siteArchiveEntry(row: SiteArchiveRecord): ArchiveIndexEntry {
  decimalId(row.articleId, true);
  sha256(row.contentHash);
  sha256(row.objectHash);
  if (row.objectKey !== `objects/${row.objectHash.slice(0, 2)}/${row.objectHash}.json.gz`)
    throw new Error('Archive object key/hash mismatch');
  if (!/^[A-Za-z0-9_-]+:[^\0\r\n]+$/.test(row.archiveRemote)) throw new Error('Invalid archive remote');
  if (!row.verifiedAt || !/(Z|[+-]\d\d:\d\d)$/.test(row.verifiedAt) || !Number.isFinite(Date.parse(row.verifiedAt)))
    throw new Error('Missing archive verification date/timezone');
  return {
    id: archiveEntryId('article_content', row.articleId, row.contentHash),
    kind: 'article_content',
    source: { type: 'site', generation: null, table: 'articles', tableComplete: null },
    availability: 'archived',
    format: 'tag-content-v1-gzip',
    selector: { type: 'article_version', articleId: row.articleId, contentHash: row.contentHash },
    artifacts: [
      {
        role: 'content',
        remote: row.archiveRemote.replace(/\/+$/, ''),
        key: row.objectKey,
        sha256: row.objectHash,
        bytes: null,
        rawBytes: null,
      },
    ],
    retrieval: { adapter: 'site-content-v1', requiresConversion: false },
    integration: null,
    verification: { basis: 'article-archives-receipt', observedAt: row.verifiedAt, freshObjectReadback: false },
  };
}

export interface OriginRecord {
  sourceKey: string;
  rawHash: string;
  articleId: string;
  generation: string;
  sourceObject: string;
}

/** Resolve through the existing article_origins index, without exporting 40M rows. */
export function legacyOriginReference(row: OriginRecord) {
  decimalId(row.articleId, true);
  sha256(row.rawHash);
  const object = /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.sql\.gz$/.exec(row.sourceObject);
  const objectHash = object ? object[2] : row.sourceObject;
  sha256(objectHash);
  if (object && object[1] !== objectHash.slice(0, 2)) throw new Error('Origin object prefix/hash mismatch');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(row.generation)) throw new Error('Invalid origin generation');
  const match = /^tag-analysis\/tag\/([A-Za-z0-9_-]{1,128})\/(-?(?:0|[1-9]\d*))$/.exec(row.sourceKey);
  if (!match) throw new Error('Unsupported legacy source identity');
  const [, table, legacyId] = match;
  decimalId(legacyId);
  return {
    entryId: archiveEntryId('sql_data', row.generation, table, objectHash),
    articleId: row.articleId,
    sourceKey: row.sourceKey,
    rawHash: row.rawHash,
    query: { id: archiveEntryId('sql_data', row.generation, table, objectHash) } satisfies ArchiveQuery,
    selector: { generation: row.generation, table, legacyId },
    // This is a reference to a package, not proof that the current index contains it.
    availability: 'index_lookup_required' as const,
  };
}

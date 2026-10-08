import { describe, expect, it } from 'vitest';
import { decimalId, legacyOriginReference, siteArchiveEntry } from './query-index.ts';

const archive = {
  type: 'archive' as const,
  articleId: '9007199254740993',
  contentHash: 'a'.repeat(64),
  objectKey: `objects/bb/${'b'.repeat(64)}.json.gz`,
  objectHash: 'b'.repeat(64),
  archiveRemote: 'nas:Archive/site',
  archivedAt: '2026-10-08T00:00:00Z',
  verifiedAt: '2026-10-08T00:01:00Z',
};
const origin = {
  articleId: archive.articleId,
  sourceKey: 'tag-analysis/tag/tag_test/18446744073709551615',
  rawHash: 'c'.repeat(64),
  sourceObject: 'd'.repeat(64),
  generation: 'generation-1',
};

describe('unified nearline identity adapters', () => {
  it('keeps content versions and legacy generations distinct', () => {
    expect(siteArchiveEntry(archive).id).not.toBe(siteArchiveEntry({ ...archive, contentHash: 'c'.repeat(64) }).id);
    expect(legacyOriginReference(origin).entryId).not.toBe(legacyOriginReference({ ...origin, generation: 'generation-2' }).entryId);
    expect(legacyOriginReference(origin).selector.legacyId).toBe('18446744073709551615');
  });
  it('rejects rounded numeric IDs and malformed object receipts', () => {
    expect(() => decimalId(Number('9007199254740993') as unknown as string)).toThrow();
    expect(() => decimalId('18446744073709551616')).toThrow();
    expect(() => siteArchiveEntry({ ...archive, objectKey: '../content.gz' })).toThrow();
    expect(() => siteArchiveEntry({ ...archive, verifiedAt: '' })).toThrow();
    expect(() => legacyOriginReference({ ...origin, sourceKey: 'unknown-source/1' })).toThrow();
  });
  it('returns explicit metadata references without claiming a fetch or restore', () => {
    const site = siteArchiveEntry(archive);
    const legacy = legacyOriginReference(origin);
    expect(site.verification?.freshObjectReadback).toBe(false);
    expect(site.artifacts[0].bytes).toBeNull();
    expect(legacy.availability).toBe('index_lookup_required');
    expect(legacy.query.id).toBe(legacy.entryId);
  });
  it('resolves actual relative SQL object paths to the same package as hash receipts', () => {
    expect(legacyOriginReference({ ...origin, sourceObject: `objects/dd/${origin.sourceObject}.sql.gz` }).entryId).toBe(
      legacyOriginReference(origin).entryId,
    );
    expect(() => legacyOriginReference({ ...origin, sourceObject: `objects/aa/${origin.sourceObject}.sql.gz` })).toThrow();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { articleDiscoveries } from '../db/schema.ts';
import { discoverDongtaiwang } from './discovery-dongtaiwang.ts';
import { discoveryPublisher, runDiscoveryIndex } from './discovery-index.ts';
import { discoverNews } from './news-discovery.ts';
import { runIndex } from './pipeline.ts';
import type { SourceSpec } from './sources.ts';

vi.mock('./discovery-dongtaiwang.ts', () => ({ discoverDongtaiwang: vi.fn() }));
vi.mock('./news-discovery.ts', () => ({ discoverNews: vi.fn() }));
vi.mock('./pipeline.ts', () => ({ runIndex: vi.fn() }));
const publisher: SourceSpec = { media: 'ntdtv', group: 'hourly', list: { urls: [] }, article: { enabled: true, batch: 1, delayMs: 0 } };
const spec: SourceSpec = { ...publisher, media: 'dongtaiwang', discovery: 'dongtaiwang' };
const log = { info() {}, warn() {} };
const candidate = {
  url: 'https://www.ntdtv.com/gb/2020/01/01/a123.html',
  title: '不能信任聚合站日期標題',
  discoveryUrl: 'https://dongtaiwang.com/loc/phome.php?v=0',
};
const publishedAt = new Date('2020-01-01T08:00:00Z');

function memoryDb(stored = true, rowPatch: { body?: string; publishedAt?: Date } = {}) {
  const associations: unknown[] = [];
  const db = {
    insert: (table: unknown) => {
      const chain = {
        ignore: () => chain,
        values: (value: unknown) => {
          if (table === articleDiscoveries) associations.push(value);
          return chain;
        },
        $returningId: async () => [{ id: 1 }],
      };
      return chain;
    },
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (stored ? [{ id: 99, publishedAt, body: '原媒體公開完整正文', ...rowPatch }] : []) }),
      }),
    }),
  };
  return { db: db as unknown as Db, associations };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(discoverDongtaiwang).mockResolvedValue({ items: [candidate], errors: [], attempted: 1, listingUrl: candidate.discoveryUrl });
  vi.mocked(discoverNews).mockResolvedValue({
    items: [
      {
        url: candidate.url,
        title: '原媒體的正式標題',
        publishedAt,
        verifiedContent: { body: '原媒體公開完整正文', authors: ['作者'], bodySource: 'article', bodyStatus: 'ok' },
      },
    ],
    errors: [],
    attempted: 1,
    listingUrl: candidate.url,
    strategy: 'html',
    samples: [],
  });
  vi.mocked(runIndex).mockResolvedValue({ items: 1, inserted: 1, errors: [] });
});

describe('aggregator discovery attribution', () => {
  it('only assigns unique reviewed enabled publisher hosts, preserving exclusions', () => {
    const websites = [{ media: 'ntdtv', websiteUrl: 'https://www.ntdtv.com/' }];
    expect(discoveryPublisher(candidate.url, [publisher], new Set(), websites)?.media).toBe('ntdtv');
    expect(discoveryPublisher(candidate.url, [publisher], new Set(['ntdtv']), websites)).toBeNull();
    expect(discoveryPublisher(candidate.url, [{ ...publisher, group: 'off' }], new Set(), websites)).toBeNull();
    expect(discoveryPublisher('https://www.ntdtv.com.attacker.test/article', [publisher], new Set(), websites)).toBeNull();
    expect(discoveryPublisher('https://user:pass@www.ntdtv.com/article', [publisher], new Set(), websites)).toBeNull();
    expect(
      discoveryPublisher(candidate.url, [publisher, { ...publisher, media: 'duplicate' }], new Set(), [
        ...websites,
        { ...websites[0], media: 'duplicate' },
      ]),
    ).toBeNull();
  });
  it('stores original publisher and true old publication, then records discovery separately', async () => {
    const { db, associations } = memoryDb();
    const result = await runDiscoveryIndex(db, spec, { log });
    expect(result.items).toBe(1);
    expect(vi.mocked(discoverNews).mock.calls[0][0]).toMatchObject({ includeArchive: true, articleUrls: [candidate.url] });
    const [, savedPublisher, options] = vi.mocked(runIndex).mock.calls[0];
    expect(savedPublisher.media).toBe('ntdtv');
    expect(options?.listed?.items[0]).toMatchObject({ publishedAt, title: '原媒體的正式標題' });
    expect(associations).toEqual([expect.objectContaining({ articleId: 99, media: 'dongtaiwang', discoveryUrl: candidate.discoveryUrl })]);
  });
  it('does not mark a source successful without stored full text', async () => {
    const { db, associations } = memoryDb(false);
    expect((await runDiscoveryIndex(db, spec, { log })).items).toBe(0);
    expect(associations).toEqual([]);
  });
  it('rejects undated or incomplete publisher pages', async () => {
    vi.mocked(discoverNews).mockResolvedValue({
      items: [],
      errors: ['No public dated full body'],
      attempted: 1,
      listingUrl: candidate.url,
      strategy: 'none',
      samples: [],
    });
    const { db, associations } = memoryDb();
    expect((await runDiscoveryIndex(db, spec, { log })).items).toBe(0);
    expect(runIndex).not.toHaveBeenCalled();
    expect(associations).toEqual([]);
  });
  it.each([{ body: '缺字的舊正文' }, { publishedAt: new Date('2020-01-01T16:00:00Z') }])(
    'does not attribute a conflicting stored copy: %j',
    async (rowPatch) => {
      const { db, associations } = memoryDb(true, rowPatch);
      expect((await runDiscoveryIndex(db, spec, { log })).items).toBe(0);
      expect(associations).toEqual([]);
    },
  );
  it('backs off a rate-limited publisher for the rest of the run', async () => {
    vi.mocked(discoverDongtaiwang).mockResolvedValue({
      items: [candidate, { ...candidate, url: candidate.url.replace('123', '124') }],
      errors: [],
      attempted: 1,
      listingUrl: candidate.discoveryUrl,
    });
    vi.mocked(discoverNews).mockResolvedValue({
      items: [],
      errors: ['HTTP 429'],
      attempted: 1,
      listingUrl: null,
      strategy: 'none',
      samples: [],
    });
    await runDiscoveryIndex(memoryDb().db, spec, { log });
    expect(discoverNews).toHaveBeenCalledTimes(1);
    expect(runIndex).not.toHaveBeenCalled();
  });
});

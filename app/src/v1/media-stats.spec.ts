import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import disabledSpec from '../../data/crawl-disabled.json' with { type: 'json' };
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import { buildApp } from '../app.js';
import type { Db } from '../db/client.ts';
import { listedMediaSources, registerMediaStats, statusFor, taipeiMidnight } from './media-stats.ts';

vi.mock('../crawl/registry.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../crawl/registry.ts')>()),
  allSources: () => [
    { media: 'cna', group: 'news' },
    { media: 'bigmedia', group: 'off' },
    { media: 'cti', group: 'hourly' },
    { media: 'ctitv', group: 'hourly' },
    { media: 'social.php', group: 'off' },
  ],
  disabled: () => new Set(['cti']),
}));

const now = Date.parse('2026-09-29T07:00:00Z'); // 15:00 Taipei
const h = (x: number) => new Date(now - x * 3600e3);
describe('media stats', () => {
  it('shares concurrent reads and reuses the advertised short-lived snapshot', async () => {
    const chain = {
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => [],
      groupBy: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [];
      },
    };
    const select = vi.fn(() => ({ from: () => chain }));
    const db = { select } as unknown as Db;
    const app = Fastify();
    registerMediaStats(app, db);
    try {
      const [first, second] = await Promise.all([app.inject('/api/v1/media-stats'), app.inject('/api/v1/media-stats')]);
      expect(first.statusCode).toBe(200);
      expect(second.json()).toEqual(first.json());
      const calls = select.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      expect((await app.inject('/api/v1/media-stats')).json()).toEqual(first.json());
      expect(select.mock.calls.length).toBe(calls);
    } finally {
      await app.close();
    }
  });
  it('computes the start of the Taipei day', () => {
    expect(taipeiMidnight(now).toISOString()).toBe('2026-09-28T16:00:00.000Z');
    expect(taipeiMidnight(Date.parse('2026-09-28T16:30:00Z')).toISOString()).toBe('2026-09-28T16:00:00.000Z');
    expect(taipeiMidnight(Date.parse('2026-09-28T15:59:00Z')).toISOString()).toBe('2026-09-27T16:00:00.000Z');
  });
  it('classifies crawl health', () => {
    const base = { disabled: false, group: 'news', lastArticle: h(1), runs3h: 20, failed3h: 0 };
    expect(statusFor(base, now)).toBe('ok');
    expect(statusFor({ ...base, lastArticle: h(7) }, now)).toBe('stale');
    expect(statusFor({ ...base, group: 'hourly', lastArticle: h(7) }, now)).toBe('ok');
    expect(statusFor({ ...base, failed3h: 20 }, now)).toBe('failing');
    expect(statusFor({ ...base, lastArticle: null }, now)).toBe('stale');
    expect(statusFor({ ...base, disabled: true }, now)).toBe('disabled');
  });

  it('keeps registered outlets without a schedule and excludes duplicates and parser artifacts', () => {
    const rows = listedMediaSources([
      { media: 'bigmedia', group: 'off' },
      { media: 'cti', group: 'hourly' },
      { media: 'ctitv', group: 'news' },
      { media: 'want', group: 'hourly' },
      { media: 'social.php', group: 'off' },
    ]);
    expect(rows).toContainEqual({ media: 'bigmedia', group: 'off' });
    expect(rows).toContainEqual({ media: 'afp', group: 'off' });
    expect(rows).toContainEqual({ media: 'ctitv', group: 'news' });
    expect(rows.some((row) => ['cti', 'ctit', 'want', 'social.php'].includes(row.media))).toBe(false);
  });

  it('returns the complete directory even when there are no articles or crawl runs', async () => {
    const chain = { innerJoin: () => chain, where: () => chain, orderBy: () => chain, limit: async () => [], groupBy: async () => [] };
    const db = { select: () => ({ from: () => chain }) } as unknown as Db;
    const app = Fastify();
    registerMediaStats(app, db);
    try {
      const response = await app.inject('/api/v1/media-stats');
      expect(response.statusCode).toBe(200);
      const result = response.json();
      const ids = result.media.map((row: { media: string }) => row.media);
      // Duplicates and outlets removed on request stay out of the directory.
      const hidden = new Set([...Object.keys(disabledSpec.duplicates), ...disabledSpec.excludedMedia]);
      for (const [media, entry] of Object.entries(catalog)) {
        if (entry.title && !hidden.has(media)) expect(ids).toContain(media);
      }
      expect(result.media.find((row: { media: string }) => row.media === 'bigmedia')).toMatchObject({
        title: '鉅聞天下',
        status: 'disabled',
        schedule: 'off',
        last24h: 0,
      });
      expect(result.media.find((row: { media: string }) => row.media === 'afp')).toMatchObject({
        title: '法新社',
        status: 'disabled',
        schedule: 'off',
      });
      expect(result.media.find((row: { media: string }) => row.media === 'cna').topics).toMatchObject({
        media: 'cna',
        sources: [],
        status: 'pending',
        counts: { topic: 0, feature: 0 },
        rulesUrl: expect.stringMatching(/app\/src\/crawl\/topics\.ts#L\d+$/),
      });
      expect(result.media.find((row: { media: string }) => row.media === 'afp').topics).toBeNull();
      expect(result.totals.activeSources).toBe(2);
      expect(result.totals.disabledSources).toBe(result.media.length - 2);
      expect(result.summaryWindow).toMatchObject({ hours: 168, basis: 'published_at' });
      expect(result.media.find((row: { media: string }) => row.media === 'cna').summary).toEqual({
        total: 0,
        withSummary: 0,
        sources: [],
        exampleId: null,
      });
    } finally {
      await app.close();
    }
  });

  it('counts discovery rows without double-counting original publications in site totals', async () => {
    const recent = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const counts = {
      pendingDate: 0,
      today: 2,
      last24h: 2,
      last7d: 2,
      tagged24h: 1,
      lastArticle: recent,
      summaryTotal: 2,
      summaryCount: 1,
      summarySources: 'meta:description',
      summaryExampleId: 9,
    };
    const batches = [
      [{ media: 'cna', ...counts }],
      [{ media: 'cna', first: recent, totalCollected: 100 }],
      [{ media: 'google_news', ...counts, first: recent, totalCollected: 50 }],
      [],
    ];
    let query = 0;
    const db = {
      select: () => {
        const values = batches[query++] ?? [];
        const chain = {
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: async () => [],
          groupBy: async () => values,
        };
        return { from: () => chain };
      },
    } as unknown as Db;
    const app = Fastify();
    registerMediaStats(app, db);
    try {
      const response = await app.inject('/api/v1/media-stats');
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.media.find((row: { media: string }) => row.media === 'google_news')).toMatchObject({
        sourceKind: 'discovery',
        totalCollected: 50,
        today: 2,
        last24h: 2,
        last7d: 2,
      });
      expect(result.media.find((row: { media: string }) => row.media === 'cna')).toMatchObject({
        sourceKind: 'publisher',
        today: 2,
        totalCollected: 100,
      });
      expect(result.totals).toMatchObject({ today: 2, last24h: 2, publishingMedia24h: 1, taggedShare24h: 0.5 });
      expect(result.media.find((row: { media: string }) => row.media === 'google_news').summary).toBeNull();
      expect(result.media.find((row: { media: string }) => row.media === 'cna').summary).toEqual({
        total: 2,
        withSummary: 1,
        sources: ['meta:description'],
        exampleId: 9,
      });
    } finally {
      await app.close();
    }
  });

  it("reports each topic listing's latest result, kind and the outlet's topic/feature counts", async () => {
    const finished = new Date(Date.now() - 600e3);
    const run = {
      media: 'cna',
      status: 'partial',
      finishedAt: finished,
      fetched: 20,
      detail: JSON.stringify({
        sources: [
          { url: 'https://www.cna.com.tw/list/newstopic.aspx', kind: 'topic', items: 20, pages: 2 },
          // Recorded before kinds existed: the listing's current declaration fills in.
          { url: 'https://www.cna.com.tw/project/project_list/api/specialfeature.json', items: 0, error: 'HTTP 500' },
        ],
      }),
    };
    const db = {
      select: (fields?: Record<string, unknown>) => {
        const isCount = !!fields && 'kind' in fields && 'count' in fields;
        const chain = {
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          // topicSourceChecks: the latest run (all columns), then the last ok run ({ at }).
          limit: async () => (!fields ? [run] : []),
          groupBy: async () =>
            isCount
              ? [
                  { media: 'cna', kind: 'topic', count: 20 },
                  { media: 'cna', kind: 'feature', count: 7 },
                ]
              : [],
        };
        return { from: () => chain };
      },
    } as unknown as Db;
    const app = Fastify();
    registerMediaStats(app, db);
    try {
      const result = (await app.inject('/api/v1/media-stats')).json();
      expect(result.media.find((row: { media: string }) => row.media === 'cna').topics).toEqual({
        media: 'cna',
        sources: [
          { url: 'https://www.cna.com.tw/list/newstopic.aspx', kind: 'topic', items: 20, pages: 2 },
          { url: 'https://www.cna.com.tw/project/project_list/api/specialfeature.json', kind: 'feature', items: 0, error: 'HTTP 500' },
        ],
        checkedAt: finished.toISOString(),
        lastSuccessAt: null,
        status: 'partial',
        counts: { topic: 20, feature: 7 },
        rulesUrl: expect.stringContaining('app/src/crawl/topics.ts#L'),
      });
    } finally {
      await app.close();
    }
  });
});

describe('retained public statistics producer', () => {
  it('shares concurrent reads, forwards only DNT, retains credential no-store and does not scan DB', async () => {
    vi.stubEnv('TAG_MEDIA_STATS_SHARED_ORIGIN', 'http://127.0.0.1:18230');
    const body = { generatedAt: new Date().toISOString(), totals: { today: 1 }, media: [] };
    const fetching = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify(body));
    });
    const db = {
      select: vi.fn(() => {
        throw Error('unexpected historical scan');
      }),
    };
    const app = await buildApp({ uiOrigin: 'http://127.0.0.1:9' }, { db: db as never });
    await app.ready();
    await new Promise((resolve) => setImmediate(resolve));
    const bootstrapCalls = db.select.mock.calls.length;
    try {
      const r = await Promise.all(
        ['cookie', 'authorization', 'x-service-token', 'x-api-key'].map((h) =>
          app.inject({ url: '/api/v1/media-stats', headers: { [h]: 'private-canary' } }),
        ),
      );
      expect(fetching).toHaveBeenCalledOnce();
      for (const reply of r) {
        expect(reply.statusCode).toBe(200);
        expect(reply.json()).toEqual(body);
        expect(reply.headers['cache-control']).toBe('private, no-store');
      }
      expect(fetching.mock.calls[0][0]).toBe('http://127.0.0.1:18230/api/v1/media-stats');
      expect(fetching.mock.calls[0][1]?.headers).toEqual({ DNT: '1' });
      expect(fetching.mock.calls[0][1]?.redirect).toBe('error');
      expect(db.select.mock.calls.length).toBe(bootstrapCalls);
      const anonymous = await app.inject('/api/v1/media-stats');
      expect(anonymous.headers['cache-control']).toBe('public, max-age=120');
    } finally {
      await app.close();
      fetching.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it('rejects a failed or oversized upstream without falling back to another DB scan', async () => {
    vi.stubEnv('TAG_MEDIA_STATS_SHARED_ORIGIN', 'http://127.0.0.1:18230');
    const fetching = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    const app = Fastify();
    registerMediaStats(app, {} as Db);
    try {
      expect((await app.inject('/api/v1/media-stats')).statusCode).toBe(503);
      fetching.mockResolvedValue(new Response(' '.repeat(2 * 1024 ** 2 + 1)));
      const reply = await app.inject('/api/v1/media-stats');
      expect(reply.statusCode).toBe(503);
      expect(reply.headers['cache-control']).toBe('no-store');
    } finally {
      await app.close();
      fetching.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it('rejects external/private-service origins and cycles', () => {
    for (const origin of [
      'https://example.com',
      'http://127.0.0.1:13306',
      'http://127.0.0.1:18230/admin',
      'http://secret@127.0.0.1:18230',
    ]) {
      vi.stubEnv('TAG_MEDIA_STATS_SHARED_ORIGIN', origin);
      expect(() => registerMediaStats(Fastify(), {} as Db)).toThrow('invalid loopback');
    }
    vi.unstubAllEnvs();
  });
});

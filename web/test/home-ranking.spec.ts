import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRanking, type Ranking } from '../src/lib/api.ts';
import { fetchHomeRanking, homeRankingRows, rankingReady } from '../src/lib/home-ranking.mts';

afterEach(() => vi.unstubAllGlobals());

const ranking = { snapshot: { available: true }, entries: [{ tag: '測試關鍵字' }] } as Ranking;

describe('home ranking availability', () => {
  it('retries a failed cached response with a fresh server request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(ranking));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchRanking('news', 'burst', 16, true)).toEqual(ranking);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ next: { revalidate: 60 } });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ cache: 'no-store' });
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries transport failures and propagates a persistent failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(Response.json(ranking));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchRanking('news', 'burst')).toEqual(ranking);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
    );
    await expect(fetchRanking('news', 'burst')).rejects.toThrow('503');
  });

  it('recovers the panel independently through the public origin without browser caching', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(ranking));
    const signal = new AbortController().signal;
    expect(await fetchHomeRanking(signal, fetcher)).toEqual(ranking);
    expect(fetcher.mock.calls[0]).toEqual([
      '/api/v1/ranking?category=news&order=score&limit=8&trend=1',
      { cache: 'no-store', signal, headers: { accept: 'application/json' } },
    ]);
  });

  it('keeps the ranking visible when the optional trend endpoint fails', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json(ranking));
    expect(await fetchHomeRanking(new AbortController().signal, fetcher)).toEqual(ranking);
    expect(fetcher.mock.calls[1][0]).not.toContain('trend=1');
  });

  it('distinguishes an unavailable snapshot from a valid empty ranking', async () => {
    const empty = { snapshot: { available: true }, entries: [] } as unknown as Ranking;
    expect(rankingReady(empty)).toBe(true);
    expect(rankingReady(null)).toBe(false);
    const unavailable = { ...ranking, snapshot: { ...ranking.snapshot, available: false } };
    expect(rankingReady(unavailable)).toBe(false);
    await expect(
      fetchHomeRanking(
        new AbortController().signal,
        vi.fn<typeof fetch>(async () => Response.json(unavailable)),
      ),
    ).rejects.toThrow('not ready');
    await expect(
      fetchHomeRanking(
        new AbortController().signal,
        vi.fn<typeof fetch>(async () => Response.json({})),
      ),
    ).rejects.toThrow('not ready');
  });
});

describe('home ranking rows', () => {
  it('keeps only what the panel draws, for its eight rows', () => {
    const entry = (i: number) => ({
      tag: `t${i}`,
      rank: i,
      rank24h: i === 1 ? null : i + 1,
      new: i === 2,
      count: 10 * i,
      normalized: 12.345,
      score: 1,
      position: i,
      burst: null,
      history: { 3: 1 },
      media: { cna: 3, ltn: 1 },
      trend: [
        { t: 'a', hourlyCount: 1, average24h: 1.23456 },
        { t: 'b', hourlyCount: null, average24h: null },
      ],
    });
    const rows = homeRankingRows({
      snapshot: { available: true },
      entries: Array.from({ length: 16 }, (_, i) => entry(i + 1)),
    } as unknown as Ranking);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      tag: 't1',
      rank: 1,
      rank24h: null,
      new: false,
      mediaCount: 2,
      count: 10,
      normalized: 12.345,
      trend: [1.23, null],
    });
    expect(homeRankingRows({ snapshot: { available: true }, entries: [{ tag: 'x', media: {} }] } as unknown as Ranking)[0].trend).toEqual(
      [],
    );
  });
});

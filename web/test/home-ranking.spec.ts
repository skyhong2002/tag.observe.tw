import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRanking, type Ranking } from '../src/lib/api.ts';
import { fetchHomeRanking, rankingReady } from '../src/lib/home-ranking.mts';

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
      '/api/v1/ranking/?category=news&order=burst&limit=8&trend=1',
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

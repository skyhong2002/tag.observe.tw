import { describe, expect, it, vi } from 'vitest';
import { campShareCounts, fetchCampShare, wholePercentages } from '../../web/src/lib/camp-share.mts';

const ranking = (articleCount: number | null, hourStart = '2026-10-07T14:00:00Z', available = true) => ({
  snapshot: { articleCount, hourStart, available },
});

describe('home news volume recovery', () => {
  it('keeps genuine zero camp counts while refusing missing counts', () => {
    const share = campShareCounts(ranking(100), ranking(0), ranking(40));
    expect(share?.camps.map((c) => c.articles)).toEqual([40, 60, 0]);
    expect(campShareCounts(ranking(100), ranking(null), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(100), null, ranking(40))).toBeNull();
  });

  it('refuses incompatible bases, corrupt counts and time windows', () => {
    expect(campShareCounts(ranking(100), ranking(50, undefined, false), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(100), ranking(80), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(100), ranking(-1), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(100), ranking(Number.NaN), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(100), ranking(40, 'invalid'), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(100), ranking(40, '2026-10-07T12:00:00Z'), ranking(40))).toBeNull();
    expect(campShareCounts(ranking(0), ranking(0), ranking(0))).toBeNull();
  });

  it('reads fresh counts through the same public origin when the initial render lacked data', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const category = new URL(String(input), 'https://tag.observe.tw').searchParams.get('category');
      return Response.json(ranking(category === 'news' ? 100 : category === 'green' ? 40 : 30));
    });
    const signal = new AbortController().signal;
    expect((await fetchCampShare(signal, fetcher)).camps.map((c) => c.articles)).toEqual([40, 30, 30]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [path, options] of fetcher.mock.calls) {
      expect(String(path)).toMatch(/^\/api\/v1\/ranking\?/);
      expect(options).toMatchObject({ cache: 'no-store', signal });
    }
  });

  it('aligns all three requests to the last completed hour during a ranking update', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const params = new URL(String(input), 'https://tag.observe.tw').searchParams;
      const category = params.get('category');
      const hour = params.get('at') ?? (category === 'blue' ? '2026-10-07T13:00:00Z' : '2026-10-07T14:00:00Z');
      return Response.json(ranking(category === 'news' ? 100 : 30, hour));
    });
    const result = await fetchCampShare(new AbortController().signal, fetcher);
    expect(result.hourStart).toBe('2026-10-07T13:00:00.000Z');
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(
      fetcher.mock.calls
        .slice(3)
        .every(([path]) => new URL(String(path), 'https://tag.observe.tw').searchParams.get('at') === result.hourStart),
    ).toBe(true);
  });

  it('reports API failures and missing snapshots so the UI can retry instead of showing invented percentages', async () => {
    const signal = new AbortController().signal;
    await expect(
      fetchCampShare(
        signal,
        vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow('503');
    await expect(
      fetchCampShare(
        signal,
        vi.fn<typeof fetch>(async () => Response.json({})),
      ),
    ).rejects.toThrow('Missing ranking snapshot');
    await expect(
      fetchCampShare(
        signal,
        vi.fn<typeof fetch>(async () => Response.json(ranking(null))),
      ),
    ).rejects.toThrow('not ready');
  });

  it('keeps rounded percentages totaling 100', () => {
    expect(wholePercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercentages([3868, 1207, 3718]).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

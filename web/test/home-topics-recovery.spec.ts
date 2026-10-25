import { afterEach, expect, it, vi } from 'vitest';
import { loadHomeTopics } from '../src/lib/demo.ts';
import type { FeedTopic } from '../src/lib/pages.ts';
import { fetchTopicSearch, fetchTopics } from '../src/lib/pages.ts';

const data = { media: [{ media: 'cna' }], feed: [] };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps valid empty data distinct from an unavailable API', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(data)),
  );
  expect(await loadHomeTopics()).toEqual({ outlets: 1, today: 0, latest: [] });
  expect(log).not.toHaveBeenCalled();
  expect(info).toHaveBeenCalledWith(
    'topics SSR request',
    expect.objectContaining({ outcome: 'ok', status: 200, elapsedMs: expect.any(Number) }),
  );
});

it('recovers once from an interrupted SSR connection without caching the retry', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError('private diagnostic text'))
    .mockResolvedValueOnce(Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchTopics()).toEqual(data);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][1]).toMatchObject({ cache: 'no-store' });
  expect(fetcher.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
  expect(log).toHaveBeenCalledWith(
    'topics SSR request',
    expect.objectContaining({ outcome: 'recovered', firstFailure: 'transport', status: 200, elapsedMs: expect.any(Number) }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain('private diagnostic text');
});

it('recovers a cached HTTP failure with the existing uncached retry', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('old failure', { status: 500 }))
    .mockResolvedValueOnce(Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchTopics()).toEqual(data);
  expect(log).toHaveBeenCalledWith(
    'topics SSR request',
    expect.objectContaining({ outcome: 'recovered', firstFailure: 'http-500', status: 200 }),
  );
});

it('bounds retries and logs status/timing without a sensitive query or response body', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetcher = vi.fn<typeof fetch>(async () => new Response('DB_PASSWORD=must-not-be-logged', { status: 500 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchTopicSearch({ kind: 'topic', q: 'sensitive-free-text' })).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledWith('topics SSR request', expect.objectContaining({ outcome: 'unavailable', status: 500 }));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/sensitive-free-text|DB_PASSWORD|must-not-be-logged/);
});

it('records invalid JSON as unavailable rather than claiming recovery', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('invalid private body', { status: 200 })),
  );
  expect(await fetchTopics()).toBeNull();
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith(
    'topics SSR request',
    expect.objectContaining({ outcome: 'unavailable', failure: 'invalid-json', status: 200 }),
  );
});

it('does not wait for cancellation of a Next cloned error body before retrying', async () => {
  const { createRequire } = await import('node:module');
  const requireWeb = createRequire(new URL('../package.json', import.meta.url));
  const { cloneResponse } = requireWeb('next/dist/server/lib/clone-response');
  const [response, retained] = cloneResponse(new Response('candidate failure', { status: 500 }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response).mockResolvedValueOnce(Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  const work = fetchTopics();
  try {
    const result = await Promise.race([work, new Promise((resolve) => setTimeout(() => resolve('blocked-by-clone'), 200))]);
    expect(result).toEqual(data);
  } finally {
    await retained.text();
    await work;
  }
});

it('recovers a missing SSR panel through the same-origin public API without browser caching', async () => {
  const { fetchHomeTopics } = await import('../src/lib/home-topics.mts');
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(data));
  const signal = new AbortController().signal;
  expect(await fetchHomeTopics(signal, fetcher)).toEqual({ outlets: 1, today: 0, latest: [] });
  expect(fetcher.mock.calls[0]).toEqual([
    '/api/v1/topics?limit=120&kind=topic',
    { cache: 'no-store', signal, headers: { accept: 'application/json' } },
  ]);
});

it('keeps a public API failure distinct from a valid empty list without exposing its body', async () => {
  const { fetchHomeTopics } = await import('../src/lib/home-topics.mts');
  await expect(
    fetchHomeTopics(new AbortController().signal, async () => new Response('private error details', { status: 503 })),
  ).rejects.toThrow('Topics temporarily unavailable');
  await expect(fetchHomeTopics(new AbortController().signal, async () => Response.json({ error: 'wrong schema' }))).rejects.toThrow(
    'Invalid topics response',
  );
});

it('preserves the first five distinct outlets and the existing recent-update count', async () => {
  const { summarizeHomeTopics } = await import('../src/lib/home-topics.mts');
  const now = Date.parse('2026-10-14T17:00:00Z');
  const feed: FeedTopic[] = ['cna', 'cna', 'udn', 'ltn', 'tvbs', 'ctv', 'pts'].map((media, i) => ({
    media,
    mediaTitle: media,
    icon: null,
    id: String(i),
    title: 'Public topic',
    time: new Date(now - i * 3600000).toISOString(),
    url: `https://example.test/topic/${i}`,
    image: null,
    updatedAt: new Date(now - i * 3600000).toISOString(),
  }));
  const result = summarizeHomeTopics({ media: [], feed }, now);
  expect(result?.today).toBe(7);
  expect(result?.latest.map((x) => x.media)).toEqual(['cna', 'udn', 'ltn', 'tvbs', 'ctv']);
});

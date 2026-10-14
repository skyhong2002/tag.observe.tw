import { afterEach, expect, it, vi } from 'vitest';
import { loadHomeTopics } from '../src/lib/demo.ts';
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

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError, fetchCategories } from '../src/lib/api.ts';

type Init = RequestInit & { next?: { revalidate?: number } };
let calls: Init[];
let warn: ReturnType<typeof vi.spyOn>;

function stub(...replies: Array<() => Promise<Response>>) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: Init) => {
      calls.push(init);
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      return reply();
    }),
  );
}
const ok = () => Promise.resolve(Response.json([{ key: 'all' }]));
const status = (code: number) => () => Promise.resolve(new Response('busy', { status: code }));
const timeout = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
const refused = () => Promise.reject(new TypeError('fetch failed'));

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('reads once through the data cache when the API answers', async () => {
  stub(ok);
  await expect(fetchCategories()).resolves.toEqual([{ key: 'all' }]);
  expect(calls).toHaveLength(1);
  expect(calls[0].next?.revalidate).toBe(600);
  expect(warn).not.toHaveBeenCalled();
});

it.each([
  ['a gateway 503 during a restart', status(503)],
  ['a gateway 502', status(502)],
  ['a refused connection', refused],
])('retries once, uncached, after %s and logs the recovery', async (_name, failure) => {
  stub(failure, ok);
  await expect(fetchCategories()).resolves.toEqual([{ key: 'all' }]);
  expect(calls).toHaveLength(2);
  expect(calls[1].cache).toBe('no-store');
  expect(calls[1].next).toBeUndefined();
  expect(warn).toHaveBeenCalledWith('api request', expect.objectContaining({ outcome: 'recovered' }));
});

it.each([
  ['a timeout', timeout, null, 'timeout'],
  ['a 500', status(500), 500, 'http-500'],
  ['a 504', status(504), 504, 'http-504'],
  ['a 404', status(404), 404, 'http-404'],
  ['a 429', status(429), 429, 'http-429'],
])('does not ask a slow or failing API twice after %s', async (_name, failure, code, kind) => {
  stub(failure, ok);
  const error = await fetchCategories().catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: code, failure: kind, path: '/api/v1/categories' });
  expect(calls).toHaveLength(1);
  expect(warn).toHaveBeenCalledWith('api request', expect.objectContaining({ outcome: 'failed', retried: false }));
});

it('stops after the single retry when the API is still down', async () => {
  stub(status(503));
  await expect(fetchCategories()).rejects.toMatchObject({ status: 503, message: '/api/v1/categories -> 503' });
  expect(calls).toHaveLength(2);
  expect(warn).toHaveBeenCalledWith('api request', expect.objectContaining({ outcome: 'failed', retried: true }));
});

it('skips the retry when the first attempt used up the time budget', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  stub(() => {
    now = 7200;
    return status(503)();
  }, ok);
  await expect(fetchCategories()).rejects.toBeInstanceOf(ApiError);
  expect(calls).toHaveLength(1);
});

it('bounds the retry by what is left of the 8 s budget', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const timeouts: number[] = [];
  const real = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    timeouts.push(ms);
    return real(ms);
  });
  stub(() => {
    now = 3000;
    return status(503)();
  }, ok);
  await fetchCategories();
  expect(timeouts).toEqual([6000, 8000 - 3000 - 250]);
});

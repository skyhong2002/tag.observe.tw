import { afterEach, expect, it, vi } from 'vitest';
import { fetchEvents } from '../src/lib/pages.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const snapshot = { hour: '2026-10-07T04:00:00Z', builtAt: '2026-10-07T04:34:00Z', events: [{ rank: 1 }] };

it.each(['connection reset', '503', 'invalid JSON', 'empty snapshot'])('recovers from %s on the first read', async (failure) => {
  vi.useFakeTimers();
  const fetch = vi.fn();
  if (failure === 'connection reset') fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
  else if (failure === '503') fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
  else if (failure === 'invalid JSON') fetch.mockResolvedValueOnce(new Response('{'));
  else fetch.mockResolvedValueOnce(Response.json({ ...snapshot, events: [] }));
  fetch.mockResolvedValueOnce(Response.json(snapshot));
  vi.stubGlobal('fetch', fetch);

  const result = fetchEvents(24);
  await vi.runAllTimersAsync();
  expect(await result).toEqual(snapshot);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].next).toEqual({ revalidate: 120 });
  expect(fetch.mock.calls[1][1].cache).toBe('no-store');
  expect(fetch.mock.calls[1][1].next).toBeUndefined();
  expect(fetch.mock.calls[1][1].signal).not.toBe(fetch.mock.calls[0][1].signal);
});

it('bounds retries during a persistent outage', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
  vi.stubGlobal('fetch', fetch);
  const result = fetchEvents();
  await vi.runAllTimersAsync();
  expect(await result).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('returns successful events without another request', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(snapshot));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchEvents()).toEqual(snapshot);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('does not replace an empty archive hour with current events', async () => {
  const empty = { ...snapshot, events: [] };
  const fetch = vi.fn().mockResolvedValue(Response.json(empty));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchEvents(24, snapshot.hour)).toEqual(empty);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain(`&at=${encodeURIComponent(snapshot.hour)}`);
});

it('does not retry an invalid request', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchEvents()).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

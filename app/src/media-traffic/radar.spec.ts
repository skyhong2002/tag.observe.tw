import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyRadar, fetchRadarDomain, readRadar, refreshRadar, writeRadar } from './radar.ts';

const now = new Date('2026-10-10T00:00:00Z');
const payload = (details: Record<string, unknown> = { bucket: '2000', categories: [] }) => ({
  success: true,
  result: { details_0: details, meta: { dateRange: [{ startTime: '2026-10-08T00:00:00Z', endTime: '2026-10-09T00:00:00Z' }] } },
});
const respond =
  (data = payload()) =>
  async () =>
    new Response(JSON.stringify(data));
afterEach(() => vi.unstubAllEnvs());

describe('Cloudflare Radar official domain rankings', () => {
  it('keeps greater-than buckets as lower bounds rather than top-N rankings', async () => {
    const row = await fetchRadarDomain(
      'news.ltn.com.tw',
      'test-token',
      respond(payload({ rank: null, bucket: '>200000', categories: [] })),
      now,
    );
    expect(row).toMatchObject({ rank: null, bucket: null, bucketLowerBound: 200000 });
  });
  it('requests the official authenticated endpoint and keeps a bucket distinct from a rank', async () => {
    const request = vi.fn(respond());
    const result = await fetchRadarDomain('udn.com', 'test-token', request, now);
    expect(request.mock.calls[0]).toEqual([
      'https://api.cloudflare.com/client/v4/radar/ranking/domain/udn.com?rankingType=POPULAR&format=JSON',
      expect.objectContaining({ headers: { accept: 'application/json', authorization: 'Bearer test-token' }, redirect: 'error' }),
    ]);
    expect(result).toMatchObject({ domain: 'udn.com', rank: null, bucket: 2000, dateEnd: '2026-10-09T00:00:00Z' });
    expect(await fetchRadarDomain('google.com', 'test-token', respond(payload({ rank: 3 })), now)).toMatchObject({ rank: 3, bucket: null });
    expect(await fetchRadarDomain('small.example', 'test-token', respond(payload({ categories: [] })), now)).toMatchObject({
      rank: null,
      bucket: null,
    });
  });
  it.each([{ bucket: 'NaN' }, { bucket: '0' }, { bucket: ['2000'] }, { bucket: 2000 }, { rank: -1 }, { rank: '3' }, { rank: 101 }])(
    'rejects invalid ranking fields %j',
    async (details) => {
      await expect(fetchRadarDomain('udn.com', 'test-token', respond(payload(details)), now)).rejects.toThrow('Invalid Radar');
    },
  );
  it('rejects invalid, reversed or future periods and unsuccessful envelopes', async () => {
    for (const range of [
      { startTime: 'bad', endTime: '2026-10-09' },
      { startTime: '2026-10-09', endTime: '2026-10-08' },
      { startTime: '2026-10-09', endTime: '2026-10-11' },
    ]) {
      const data = payload();
      data.result.meta.dateRange = [range];
      await expect(fetchRadarDomain('udn.com', 'test-token', respond(data), now)).rejects.toThrow();
    }
    await expect(fetchRadarDomain('udn.com', 'test-token', respond({ ...payload(), success: false }), now)).rejects.toThrow();
  });
  it('makes no requests without a token and retains previously fetched data', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_API_TOKEN', '');
    const row = await fetchRadarDomain('udn.com', 'test-token', respond(), now);
    const request = vi.fn(respond());
    const result = await refreshRadar(['udn.com'], { ...emptyRadar(), domains: [row] }, { request, token: '' });
    expect(result.status).toBe('unconfigured');
    expect(result.domains).toEqual([row]);
    expect(request).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 429])('handles HTTP %i without discarding old values', async (status) => {
    const row = await fetchRadarDomain('udn.com', 'test-token', respond(), now);
    const request = vi.fn(async () => new Response('private upstream body', { status }));
    const result = await refreshRadar(
      ['udn.com', 'ltn.com.tw', 'ettoday.net', 'tvbs.com.tw'],
      { ...emptyRadar(), domains: [row] },
      {
        request,
        token: 'test-token',
        now,
        delay: async () => {},
      },
    );
    expect(result.status).toBe(status === 400 ? 'failed' : 'blocked');
    expect(result.domains).toEqual([row]);
    expect(result.error).toBe(`Cloudflare Radar HTTP ${status}`);
    expect(request).toHaveBeenCalledTimes(status === 400 ? 3 : 1);
  });
  it('keeps successful domains and preserves other domains during a partial refresh', async () => {
    const row = await fetchRadarDomain('udn.com', 'test-token', respond(), now);
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload({ rank: 5 }))))
      .mockRejectedValueOnce(Error('secret-token'));
    const result = await refreshRadar(
      ['google.com', 'ltn.com.tw'],
      { ...emptyRadar(), domains: [row] },
      {
        request,
        token: 'test-token',
        now,
        delay: async () => {},
      },
    );
    expect(result.status).toBe('partial');
    expect(result.domains.map((r) => r.domain)).toEqual(['udn.com', 'google.com']);
    expect(result.error).not.toContain('secret-token');
  });
  it('round trips snapshots and rejects corrupt files', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_API_TOKEN', 'test-token');
    const dir = await mkdtemp(join(tmpdir(), 'radar-test-'));
    const file = join(dir, 'snapshot.json');
    try {
      expect((await readRadar(file)).status).toBe('pending');
      const data = { ...emptyRadar(), status: 'ok' as const, domains: [await fetchRadarDomain('udn.com', 'test-token', respond(), now)] };
      await writeRadar(data, file);
      expect(await readRadar(file)).toEqual(data);
      vi.stubEnv('CLOUDFLARE_RADAR_API_TOKEN', '');
      expect((await readRadar(file)).status).toBe('unconfigured');
      await writeFile(file, JSON.stringify({ ...data, domains: [{ ...data.domains[0], rank: '2000' }] }));
      await expect(readRadar(file)).rejects.toThrow('Invalid Radar snapshot');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

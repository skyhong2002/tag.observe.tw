import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { listedMediaSources, registerMediaStats, statusFor, taipeiMidnight } from './media-stats.ts';

vi.mock('../crawl/registry.ts', () => ({
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
      { media: 'social.php', group: 'off' },
    ]);
    expect(rows).toContainEqual({ media: 'bigmedia', group: 'off' });
    expect(rows).toContainEqual({ media: 'afp', group: 'off' });
    expect(rows).toContainEqual({ media: 'ctitv', group: 'news' });
    expect(rows.some((row) => ['cti', 'ctit', 'social.php'].includes(row.media))).toBe(false);
  });

  it('returns the complete directory even when there are no articles or crawl runs', async () => {
    const db = { select: () => ({ from: () => ({ where: () => ({ groupBy: async () => [] }) }) }) } as unknown as Db;
    const app = Fastify();
    registerMediaStats(app, db);
    try {
      const response = await app.inject('/api/v1/media-stats');
      expect(response.statusCode).toBe(200);
      const result = response.json();
      const ids = result.media.map((row: { media: string }) => row.media);
      for (const [media, entry] of Object.entries(catalog)) {
        if (entry.title && media !== 'cti') expect(ids).toContain(media);
      }
      expect(result.media.find((row: { media: string }) => row.media === 'bigmedia')).toMatchObject({
        title: 'BigMedia 鉅聞',
        status: 'disabled',
        schedule: 'off',
        last24h: 0,
      });
      expect(result.media.find((row: { media: string }) => row.media === 'afp')).toMatchObject({
        title: '法新社',
        status: 'disabled',
        schedule: 'off',
      });
      expect(result.totals.activeSources).toBe(2);
      expect(result.totals.disabledSources).toBe(result.media.length - 2);
    } finally {
      await app.close();
    }
  });
});

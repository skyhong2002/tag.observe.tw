import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { crawlGroup, orderDueSources } from './crawl-job.ts';

const { runIndex, sourcesInGroup } = vi.hoisted(() => ({
  runIndex: vi.fn(async (_db: unknown, spec: { media: string }) => ({ items: 1, inserted: 0, errors: [] as string[], media: spec.media })),
  sourcesInGroup: vi.fn(() => [{ media: 'first' }, { media: 'fresh' }, { media: 'stale' }, { media: 'never' }]),
}));
vi.mock('../crawl/pipeline.ts', () => ({ runIndex }));
vi.mock('../crawl/registry.ts', () => ({ sourcesInGroup }));

const now = new Date('2026-10-05T10:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60e3);
const hour = 60 * 60e3;

describe('group crawl order', () => {
  it('visits least-recently-indexed sources first and skips ones indexed within 80% of the period', () => {
    const specs = [{ media: 'a' }, { media: 'b' }, { media: 'c' }, { media: 'd' }];
    const lastRun = new Map([
      ['a', minutesAgo(50)],
      ['b', minutesAgo(10)],
      ['c', minutesAgo(90)],
    ]);
    expect(orderDueSources(specs, lastRun, hour, now).map((s) => s.media)).toEqual(['d', 'c', 'a']);
    expect(orderDueSources(specs, lastRun, 9 * 60e3, now).map((s) => s.media)).toEqual(['d', 'c', 'a', 'b']);
  });

  it('continues an interrupted hourly pass from the sources that have not run yet', async () => {
    const groupBy = vi.fn(async () => [
      { media: 'first', last: minutesAgo(5) },
      { media: 'fresh', last: minutesAgo(47) },
      { media: 'stale', last: minutesAgo(61) },
    ]);
    const db = { select: () => ({ from: () => ({ where: () => ({ groupBy }) }) }) } as unknown as Db;
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
    const result = await crawlGroup(db, 'hourly', { log, now });
    expect(runIndex.mock.calls.map(([, spec]) => spec.media)).toEqual(['never', 'stale', 'first', 'fresh'].slice(0, 2));
    expect(result).toMatchObject({ group: 'hourly', sources: 2, skipped: 2, items: 2, failed: [] });
  });

  it('stops dispatching sources once shutdown is signalled and reports what was left', async () => {
    runIndex.mockClear();
    const controller = new AbortController();
    runIndex.mockImplementationOnce(async (_db: unknown, spec: { media: string }) => {
      controller.abort();
      return { items: 1, inserted: 0, errors: [], media: spec.media };
    });
    const db = { select: () => ({ from: () => ({ where: () => ({ groupBy: async () => [] }) }) }) } as unknown as Db;
    const warn = vi.fn();
    const result = await crawlGroup(db, 'hourly', {
      log: { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() } as never,
      now,
      signal: controller.signal,
      concurrency: 1,
    });
    expect(runIndex).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sources: 1, stopped: 3, items: 1 });
    expect(warn).toHaveBeenCalledWith({ group: 'hourly', stopped: 3 }, 'crawl index group stopped early for shutdown');
  });

  it('falls back to catalog order when run history cannot be read', async () => {
    runIndex.mockClear();
    const db = {
      select: () => ({ from: () => ({ where: () => ({ groupBy: async () => Promise.reject(new Error('db down')) }) }) }),
    } as unknown as Db;
    const warn = vi.fn();
    const result = await crawlGroup(db, 'news', { log: { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() } as never, now });
    expect(warn).toHaveBeenCalledOnce();
    expect(runIndex.mock.calls.map(([, spec]) => spec.media)).toEqual(['first', 'fresh', 'stale', 'never']);
    expect(result.skipped).toBe(0);
  });
});

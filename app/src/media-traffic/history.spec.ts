import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.ts';
import {
  loadRadarHistory,
  loadTrafficHistory,
  saveRadarHistory,
  saveTrafficHistory,
  type TrafficHistory,
  withRadarHistory,
  withTrafficHistory,
} from './history.ts';
import type { DomainTraffic, TrafficProfile } from './live.ts';
import type { RadarDomain } from './radar.ts';

const profile = (month: string, tw: number): TrafficProfile => ({
  month,
  countries: [{ code: 'TW', share: tw }],
  channels: { Direct: 0.5 },
  bounceRate: 0.5,
  pagesPerVisit: 2,
  timeOnSite: 90,
  globalRank: 1000,
  countryRank: { code: 'TW', rank: 10 },
  categoryRank: null,
});
const traffic = (fetchedAt: string, monthly: Array<[string, number]>, profiles: TrafficProfile[] = []): DomainTraffic => ({
  domain: 'udn.com',
  fetchedAt,
  monthly: monthly.map(([month, visits]) => ({ month, visits })),
  profiles: Object.fromEntries(profiles.map((p) => [p.month, p])),
});
const radar = (fetchedAt: string, dateEnd: string, bucket: number): RadarDomain => ({
  domain: 'udn.com',
  fetchedAt,
  dateStart: dateEnd,
  dateEnd,
  rank: null,
  bucket,
  bucketLowerBound: null,
});

describe('traffic history merge', () => {
  it('folds stored months into the snapshot and restores domains only the database has', () => {
    const history = new Map<string, TrafficHistory>([
      [
        'udn.com',
        {
          fetchedAt: '2026-09-10T00:00:00.000Z',
          monthly: [
            { month: '202606', visits: 1 },
            { month: '202607', visits: 2 },
          ],
          profiles: { '202606': profile('202606', 0.8) },
        },
      ],
      ['lost.example', { fetchedAt: '2026-08-01T00:00:00.000Z', monthly: [{ month: '202606', visits: 9 }], profiles: {} }],
    ]);
    const merged = withTrafficHistory(
      [
        traffic(
          '2026-10-10T00:00:00Z',
          [
            ['202607', 3],
            ['202608', 4],
          ],
          [profile('202609', 0.9)],
        ),
      ],
      history,
    );
    expect(merged[0].monthly).toEqual([
      { month: '202606', visits: 1 },
      { month: '202607', visits: 3 },
      { month: '202608', visits: 4 },
    ]);
    expect(Object.keys(merged[0].profiles ?? {})).toEqual(['202606', '202609']);
    expect(merged.find((row) => row.domain === 'lost.example')?.monthly).toEqual([{ month: '202606', visits: 9 }]);
  });

  it('attaches Radar periods and restores the latest period of a domain missing from the snapshot', () => {
    const periods = [
      {
        fetchedAt: '2026-09-28T00:00:00.000Z',
        dateStart: '2026-09-28T00:00:00.000Z',
        dateEnd: '2026-09-28T00:00:00.000Z',
        rank: null,
        bucket: 50000,
        bucketLowerBound: null,
      },
      {
        fetchedAt: '2026-10-05T00:00:00.000Z',
        dateStart: '2026-10-05T00:00:00.000Z',
        dateEnd: '2026-10-05T00:00:00.000Z',
        rank: null,
        bucket: 20000,
        bucketLowerBound: null,
      },
    ];
    const merged = withRadarHistory([], new Map([['udn.com', periods]]));
    expect(merged).toEqual([{ domain: 'udn.com', ...periods[1], history: periods }]);
  });
});

// Round trip through MariaDB: MEDIA_HISTORY_TEST_DB_URL must point at a disposable database.
const testUrl = process.env.MEDIA_HISTORY_TEST_DB_URL;
describe.skipIf(!testUrl)('traffic history in disposable MariaDB', () => {
  const connection = testUrl ? createDb(testUrl) : null;
  beforeAll(async () => {
    await migrate(connection!.db, { migrationsFolder: resolve('app/src/db/migrations') });
  });
  afterAll(async () => {
    await connection?.close();
  });

  it('keeps every month, takes revisions only from newer fetches and keeps the first sighting', async () => {
    const db = connection!.db;
    await saveTrafficHistory(db, [
      traffic(
        '2026-09-10T00:00:00Z',
        [
          ['202606', 1],
          ['202607', 2],
          ['202608', 3],
        ],
        [profile('202608', 0.8)],
      ),
    ]);
    // Next month Similarweb drops 202606 and revises 202607.
    await saveTrafficHistory(db, [
      traffic(
        '2026-10-10T00:00:00Z',
        [
          ['202607', 20],
          ['202608', 3],
          ['202609', 4],
        ],
        [profile('202609', 0.9)],
      ),
    ]);
    // Replaying the older snapshot must not undo the revision.
    await saveTrafficHistory(db, [traffic('2026-09-10T00:00:00Z', [['202607', 2]])]);
    const stored = (await loadTrafficHistory(db)).get('udn.com');
    expect(stored?.monthly).toEqual([
      { month: '202606', visits: 1 },
      { month: '202607', visits: 20 },
      { month: '202608', visits: 3 },
      { month: '202609', visits: 4 },
    ]);
    expect(Object.keys(stored?.profiles ?? {})).toEqual(['202608', '202609']);
    expect(stored?.profiles['202609'].countries[0]).toEqual({ code: 'TW', share: 0.9 });
    expect(stored?.fetchedAt).toBe('2026-10-10T00:00:00.000Z');
  });

  it('keeps one row per Radar period', async () => {
    const db = connection!.db;
    await saveRadarHistory(db, [radar('2026-09-29T00:00:00Z', '2026-09-28T00:00:00Z', 50000)]);
    await saveRadarHistory(db, [radar('2026-10-06T00:00:00Z', '2026-10-05T00:00:00Z', 20000)]);
    await saveRadarHistory(db, [radar('2026-10-07T00:00:00Z', '2026-10-05T00:00:00Z', 20000)]);
    const periods = (await loadRadarHistory(db)).get('udn.com');
    expect(periods?.map((p) => [p.dateEnd, p.bucket])).toEqual([
      ['2026-09-28T00:00:00.000Z', 50000],
      ['2026-10-05T00:00:00.000Z', 20000],
    ]);
    expect(periods?.[1].fetchedAt).toBe('2026-10-07T00:00:00.000Z');
  });
});

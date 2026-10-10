import { sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { mediaRadarRanks, mediaTrafficMonths, mediaTrafficProfiles } from '../db/schema.ts';
import type { DomainTraffic, TrafficProfile, VisitMonth } from './live.ts';
import type { RadarDomain } from './radar.ts';

// Long-term record of Similarweb months and Radar periods. Similarweb only ever
// returns the latest three months and Radar the latest period, so every batch
// writes what it saw here; nothing is deleted, and a revised value replaces the
// old one while first_seen_at keeps the first sighting. Rows are idempotent, so
// writing the whole snapshot each run is safe and seeds the tables on first use.

const chunk = <T>(rows: T[], size = 500) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

export async function saveTrafficHistory(db: Db, domains: DomainTraffic[]) {
  const months = domains.flatMap((row) =>
    row.monthly.map((point) => ({
      domain: row.domain,
      month: point.month,
      visits: Math.round(point.visits),
      firstSeenAt: new Date(row.fetchedAt),
      fetchedAt: new Date(row.fetchedAt),
    })),
  );
  const profiles = domains.flatMap((row) =>
    Object.values(row.profiles ?? {}).map((profile) => ({
      domain: row.domain,
      month: profile.month,
      profile,
      firstSeenAt: new Date(row.fetchedAt),
      fetchedAt: new Date(row.fetchedAt),
    })),
  );
  // Only a newer fetch may overwrite a value, so replaying an old snapshot never undoes a revision.
  for (const rows of chunk(months))
    await db
      .insert(mediaTrafficMonths)
      .values(rows)
      .onDuplicateKeyUpdate({
        set: {
          visits: sql`IF(VALUES(fetched_at) >= fetched_at, VALUES(visits), visits)`,
          fetchedAt: sql`GREATEST(fetched_at, VALUES(fetched_at))`,
        },
      });
  for (const rows of chunk(profiles))
    await db
      .insert(mediaTrafficProfiles)
      .values(rows)
      .onDuplicateKeyUpdate({
        set: {
          profile: sql`IF(VALUES(fetched_at) >= fetched_at, VALUES(profile), profile)`,
          fetchedAt: sql`GREATEST(fetched_at, VALUES(fetched_at))`,
        },
      });
  return { months: months.length, profiles: profiles.length };
}

export async function saveRadarHistory(db: Db, domains: RadarDomain[]) {
  const rows = domains.map((row) => ({
    domain: row.domain,
    dateEnd: new Date(row.dateEnd),
    dateStart: new Date(row.dateStart),
    rank: row.rank,
    bucket: row.bucket,
    bucketLowerBound: row.bucketLowerBound ?? null,
    firstSeenAt: new Date(row.fetchedAt),
    fetchedAt: new Date(row.fetchedAt),
  }));
  for (const part of chunk(rows))
    await db
      .insert(mediaRadarRanks)
      .values(part)
      .onDuplicateKeyUpdate({
        set: {
          rank: sql`IF(VALUES(fetched_at) >= fetched_at, VALUES(rank), rank)`,
          bucket: sql`IF(VALUES(fetched_at) >= fetched_at, VALUES(bucket), bucket)`,
          bucketLowerBound: sql`IF(VALUES(fetched_at) >= fetched_at, VALUES(bucket_lower_bound), bucket_lower_bound)`,
          fetchedAt: sql`GREATEST(fetched_at, VALUES(fetched_at))`,
        },
      });
  return { periods: rows.length };
}

export interface TrafficHistory {
  /** Latest time any of the domain's rows was fetched. */
  fetchedAt: string;
  monthly: VisitMonth[];
  profiles: Record<string, TrafficProfile>;
}
export async function loadTrafficHistory(db: Db): Promise<Map<string, TrafficHistory>> {
  const [months, profiles] = await Promise.all([
    db
      .select({
        domain: mediaTrafficMonths.domain,
        month: mediaTrafficMonths.month,
        visits: mediaTrafficMonths.visits,
        fetchedAt: mediaTrafficMonths.fetchedAt,
      })
      .from(mediaTrafficMonths),
    db
      .select({ domain: mediaTrafficProfiles.domain, month: mediaTrafficProfiles.month, profile: mediaTrafficProfiles.profile })
      .from(mediaTrafficProfiles),
  ]);
  const out = new Map<string, TrafficHistory>();
  const entry = (domain: string) =>
    out.get(domain) ?? (out.set(domain, { fetchedAt: new Date(0).toISOString(), monthly: [], profiles: {} }).get(domain) as TrafficHistory);
  for (const row of months) {
    const value = entry(row.domain);
    value.monthly.push({ month: row.month, visits: row.visits });
    if (row.fetchedAt.toISOString() > value.fetchedAt) value.fetchedAt = row.fetchedAt.toISOString();
  }
  for (const row of profiles) {
    const profile = (typeof row.profile === 'string' ? JSON.parse(row.profile) : row.profile) as TrafficProfile;
    entry(row.domain).profiles[row.month] = profile;
  }
  for (const value of out.values()) value.monthly.sort((a, b) => a.month.localeCompare(b.month));
  return out;
}

export interface RadarPeriod {
  fetchedAt: string;
  dateStart: string;
  dateEnd: string;
  rank: number | null;
  bucket: number | null;
  bucketLowerBound: number | null;
}
export async function loadRadarHistory(db: Db): Promise<Map<string, RadarPeriod[]>> {
  const rows = await db.select().from(mediaRadarRanks).orderBy(mediaRadarRanks.domain, mediaRadarRanks.dateEnd);
  const out = new Map<string, RadarPeriod[]>();
  for (const row of rows) {
    const list = out.get(row.domain) ?? [];
    list.push({
      fetchedAt: row.fetchedAt.toISOString(),
      dateStart: row.dateStart.toISOString(),
      dateEnd: row.dateEnd.toISOString(),
      rank: row.rank,
      bucket: row.bucket,
      bucketLowerBound: row.bucketLowerBound,
    });
    out.set(row.domain, list);
  }
  return out;
}

/** Snapshot rows with every stored month and profile folded in (the snapshot wins
 *  for months it holds); domains only the database still has are added back. */
export function withTrafficHistory(domains: DomainTraffic[], history: Map<string, TrafficHistory>): DomainTraffic[] {
  const seen = new Set(domains.map((row) => row.domain));
  const restored = [...history]
    .filter(([domain]) => !seen.has(domain))
    .map(([domain, past]) => ({ domain, fetchedAt: past.fetchedAt, monthly: past.monthly, profiles: past.profiles }));
  return [...domains, ...restored].map((row) => {
    const past = history.get(row.domain);
    if (!past) return row;
    const months = new Map(past.monthly.map((point) => [point.month, point.visits]));
    for (const point of row.monthly) months.set(point.month, point.visits);
    return {
      ...row,
      monthly: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, visits]) => ({ month, visits })),
      profiles: { ...past.profiles, ...row.profiles },
    };
  });
}

/** Each snapshot row gains its stored periods; a domain only the database still has is restored from its latest period. */
export function withRadarHistory(domains: RadarDomain[], history: Map<string, RadarPeriod[]>) {
  const seen = new Set(domains.map((row) => row.domain));
  const restored: RadarDomain[] = [...history]
    .filter(([domain, periods]) => !seen.has(domain) && periods.length)
    .map(([domain, periods]) => {
      const { fetchedAt, dateStart, dateEnd, rank, bucket, bucketLowerBound } = periods.at(-1) as RadarPeriod;
      return { domain, fetchedAt, dateStart, dateEnd, rank, bucket, bucketLowerBound };
    });
  return [...domains, ...restored].map((row) => ({ ...row, history: history.get(row.domain) ?? [] }));
}

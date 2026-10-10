import { mediaNames } from './media-names.mts';
import { type NewsSource, resolveCatalogSource, safeWebsiteUrl, type TrafficSource } from './media-traffic.mts';

export interface CrawlComparison {
  generatedAt: string;
  collectionStartedAt: string | null;
  months: string[];
  media: Array<{
    media: string;
    sourceKind: 'publisher' | 'discovery';
    firstAcquiredAt: string | null;
    monthly: Array<{ month: string; articles: number }>;
  }>;
}
export interface TrafficPoint {
  month: string;
  traffic: number | null;
  rawTraffic: number | null;
  growth: number | null;
  adjusted: boolean;
  ambiguous: boolean;
}
export interface LiveTraffic {
  status: 'pending' | 'ok' | 'partial' | 'blocked' | 'failed';
  checkedAt: string | null;
  error: string | null;
  domains: Array<{ domain: string; fetchedAt: string; monthly: Array<{ month: string; visits: number }> }>;
}
export interface RadarData {
  status: 'unconfigured' | LiveTraffic['status'];
  checkedAt: string | null;
  error: string | null;
  domains: Array<{
    domain: string;
    fetchedAt: string;
    dateStart: string;
    dateEnd: string;
    rank: number | null;
    bucket: number | null;
    bucketLowerBound?: number | null;
  }>;
}
export interface ComparisonOutlet {
  key: string;
  media: string | null;
  name: string;
  domain: string | null;
  sourceKind: 'publisher' | 'discovery';
  firstAcquiredAt: string | null;
  traffic: TrafficPoint[];
  monthly: Array<{ month: string; articles: number }> | null;
  trafficFetchedAt?: string;
  referenceTraffic?: TrafficPoint[];
  referenceDomain?: string | null;
  radar?: RadarData['domains'][number];
}
export interface ComparisonData {
  months: string[];
  trafficMonths: string[];
  crawlMonths: string[];
  outlets: ComparisonOutlet[];
  collectionStartedAt: string | null;
  generatedAt: string | null;
  trafficSource: 'reference-sheet' | 'similarweb-extension';
  liveTrafficStatus: LiveTraffic['status'] | null;
  liveTrafficCheckedAt: string | null;
  liveTrafficError: string | null;
  referenceMonths: string[];
  radarStatus: RadarData['status'] | null;
  radarCheckedAt: string | null;
  radarError: string | null;
}
const identity = (s: string) => s.replace(/\s/g, '').toLowerCase();
/** Fetch status of the automatic sources (Similarweb, Cloudflare Radar). */
export const sourceStatusLabels = {
  pending: '尚未抓取',
  ok: '抓取完成',
  partial: '部分網域未能更新',
  blocked: '來源拒絕連線',
  failed: '暫時無法取得資料',
  unconfigured: '尚未設定 API Token',
} as const;
export const shortMonth = (month: string) => `${month.slice(0, 4)}/${month.slice(4)}`;
export const taipeiMonth = (date: string) => new Date(Date.parse(date) + 8 * 3600e3).toISOString().slice(0, 7).replace('-', '');

/** One publisher per comparison row. Whole-site and news-channel figures must
 * never be added together; use the catalog's explicitly named primary row. */
export function primaryTraffic(rows: TrafficSource[], source?: NewsSource): TrafficSource | null {
  const exact = source ? rows.filter((r) => identity(r.name) === identity(source.name)) : [];
  const candidates = exact.length ? exact : rows.filter((r) => r.traffic !== null);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && candidates.every((r) => r.traffic === candidates[0].traffic)) return candidates[0];
  return null;
}

export function buildComparison(
  snapshots: Array<{ month: string; sources: TrafficSource[] }>,
  catalog: NewsSource[],
  crawl: CrawlComparison | null,
  /** Outlets removed from the site on request; their spreadsheet rows are dropped too. */
  hidden: ReadonlySet<string> = new Set(),
  live: LiveTraffic | null = null,
  radar: RadarData | null = null,
): ComparisonData {
  const outlets = new Map<string, ComparisonOutlet>();
  const collected = new Map(crawl?.media.map((m) => [m.media, m]) ?? []);
  for (const snapshot of snapshots) {
    const groups = new Map<string, { rows: TrafficSource[]; source?: NewsSource }>();
    for (const row of snapshot.sources) {
      const source = resolveCatalogSource(row, catalog);
      const key = source?.media ?? `unmapped:${identity(row.name)}`;
      const group = groups.get(key) ?? { rows: [], source };
      group.rows.push(row);
      groups.set(key, group);
    }
    for (const [key, group] of groups) {
      const row = primaryTraffic(group.rows, group.source);
      const acquired = collected.get(key);
      const outlet = outlets.get(key) ?? {
        key,
        media: group.source?.media ?? null,
        name: (group.source && mediaNames[group.source.media]?.name) || group.source?.name || group.rows[0].name,
        domain: null,
        sourceKind: acquired?.sourceKind ?? (['google_news', 'dongtaiwang'].includes(key) ? 'discovery' : 'publisher'),
        firstAcquiredAt: acquired?.firstAcquiredAt ?? null,
        traffic: [],
        monthly: acquired?.monthly ?? (crawl && group.source ? [] : null),
      };
      const domains = [...new Set(group.rows.map((r) => r.domain).filter((domain): domain is string => !!domain))];
      outlet.domain ??= row?.domain ?? (domains.length === 1 ? domains[0] : null);
      const adjusted = !!row && (/\/\s*\d+(?:\.\d+)?\s*$/.test(row.name) || row.notes.some((n) => /^原表流量公式：/.test(n)));
      outlet.traffic.push({
        month: snapshot.month,
        traffic: adjusted ? null : (row?.traffic ?? null),
        rawTraffic: row?.traffic ?? null,
        growth: adjusted ? null : (row?.growth ?? null),
        adjusted,
        ambiguous: row === null && group.rows.some((r) => r.traffic !== null),
      });
      outlets.set(key, outlet);
    }
  }
  for (const entry of crawl?.media ?? []) {
    if (outlets.has(entry.media)) continue;
    const source = catalog.find((s) => s.media === entry.media);
    outlets.set(entry.media, {
      key: entry.media,
      media: entry.media,
      name: mediaNames[entry.media]?.name || source?.name || entry.media,
      domain: null,
      sourceKind: entry.sourceKind,
      firstAcquiredAt: entry.firstAcquiredAt,
      monthly: entry.monthly,
      traffic: [],
    });
  }
  if (live || radar) {
    // Direct source data remains visible even when the crawler API is unavailable
    // and a publisher has never appeared in the reference spreadsheet.
    for (const source of catalog) {
      if (outlets.has(source.media)) continue;
      outlets.set(source.media, {
        key: source.media,
        media: source.media,
        name: mediaNames[source.media]?.name || source.name,
        domain: null,
        sourceKind: ['google_news', 'dongtaiwang'].includes(source.media) ? 'discovery' : 'publisher',
        firstAcquiredAt: null,
        monthly: crawl ? [] : null,
        traffic: [],
      });
    }
  }
  // Display fallback only: preserve the original spreadsheet domain and figures.
  // Crawler-only outlets also have reviewed websites in the name registry.
  for (const outlet of outlets.values()) {
    if (outlet.domain || !outlet.media) continue;
    const source = catalog.find((s) => s.media === outlet.media);
    const website = safeWebsiteUrl(source?.websiteUrl) ?? safeWebsiteUrl(mediaNames[outlet.media]?.sourceUrl);
    outlet.domain = website ? new URL(website).hostname.replace(/^www\./, '') : null;
  }
  const liveByDomain = new Map(live?.domains.map((row) => [row.domain, row]) ?? []);
  const radarByDomain = new Map(radar?.domains.map((row) => [row.domain, row]) ?? []);
  const useLive = live !== null;
  // Preserve GeneHong's original scope and units before applying official-domain sources.
  for (const outlet of outlets.values()) {
    outlet.referenceTraffic = outlet.traffic;
    outlet.referenceDomain = outlet.domain;
    const source = catalog.find((s) => s.media === outlet.media);
    const website = safeWebsiteUrl(source?.websiteUrl);
    const domain = website ? new URL(website).hostname.replace(/^www\./, '') : outlet.domain;
    if (outlet.sourceKind === 'publisher' && domain) outlet.radar = radarByDomain.get(domain);
  }
  if (useLive) {
    for (const outlet of outlets.values()) {
      const source = catalog.find((s) => s.media === outlet.media);
      const official = safeWebsiteUrl(source?.websiteUrl);
      if (official) outlet.domain = new URL(official).hostname.replace(/^www\./, '');
      const current = outlet.sourceKind === 'publisher' && outlet.domain ? liveByDomain.get(outlet.domain) : undefined;
      outlet.trafficFetchedAt = current?.fetchedAt;
      outlet.traffic = (current?.monthly ?? []).map((point) => ({
        month: point.month,
        traffic: point.visits,
        rawTraffic: point.visits,
        growth: null,
        adjusted: false,
        ambiguous: false,
      }));
    }
  }
  const trafficMonths = [
    ...new Set(
      useLive
        ? [...outlets.values()].filter((o) => !o.media || !hidden.has(o.media)).flatMap((o) => o.traffic.map((p) => p.month))
        : snapshots.map((s) => s.month),
    ),
  ].sort();
  return {
    months: [...new Set([...trafficMonths, ...(crawl?.months ?? [])])].sort(),
    trafficMonths,
    crawlMonths: crawl?.months ?? [],
    outlets: [...outlets.values()].filter((outlet) => !outlet.media || !hidden.has(outlet.media)),
    collectionStartedAt: crawl?.collectionStartedAt ?? null,
    generatedAt: crawl?.generatedAt ?? null,
    trafficSource: useLive ? 'similarweb-extension' : 'reference-sheet',
    liveTrafficStatus: live?.status ?? null,
    liveTrafficCheckedAt: live?.checkedAt ?? null,
    liveTrafficError: live?.error ?? null,
    referenceMonths: snapshots.map((s) => s.month).sort(),
    radarStatus: radar?.status ?? null,
    radarCheckedAt: radar?.checkedAt ?? null,
    radarError: radar?.error ?? null,
  };
}

/** Zero before collection started is absence of history, not observed silence. */
export function collectionPoint(outlet: ComparisonOutlet, month: string) {
  if (!outlet.monthly || !outlet.firstAcquiredAt) return { articles: null, historical: true };
  const historical = month < taipeiMonth(outlet.firstAcquiredAt);
  const point = outlet.monthly.find((p) => p.month === month);
  return { articles: !point || (historical && point.articles === 0) ? null : point.articles, historical };
}

export function rankValues(outlets: ComparisonOutlet[], value: (outlet: ComparisonOutlet) => number | null) {
  const sorted = outlets
    .map((o) => ({ key: o.key, value: value(o) }))
    .filter((p) => p.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  let rank = 0;
  return new Map(
    sorted.map((p, i) => {
      if (i === 0 || p.value !== sorted[i - 1].value) rank = i + 1;
      return [p.key, rank];
    }),
  );
}

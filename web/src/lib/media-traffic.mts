export interface TrafficSource {
  row: number;
  name: string;
  domain: string | null;
  classification: string | null;
  category: string;
  rank: number | null;
  traffic: number | null;
  growth: number | null;
  notes: string[];
}

export interface ReferenceSource {
  media: string;
  name: string;
  domain: string;
}

export interface NewsSource {
  media: string;
  name: string;
  websiteUrl: string | null;
  referenceNames: string[];
  referenceRows: number[];
  existing: boolean;
  websiteEvidence: string | null;
  notes: string;
}

export interface NewsCrawlAudit {
  media: string;
  websiteUrl: string | null;
  status: 'verified' | 'unavailable' | 'unresolved' | 'existing';
  strategy: 'rss' | 'sitemap' | 'html' | 'api' | 'existing' | 'none';
  listingUrl: string | null;
  articleCount: number;
  detail: string;
  samples: { url: string; title: string; publishedAt: string | null; bodyLength: number }[];
  checkedAt: string;
}

export const crawlLabels = {
  verified: '已驗證可抓取',
  unavailable: '暫無法抓取',
  unresolved: '尚待確認網址',
  existing: '既有爬蟲，待驗證',
  pending: '尚未驗證',
};
export type CrawlStatus = keyof typeof crawlLabels;

export function safeWebsiteUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// The catalog records source-name aliases explicitly, including entries whose
// historical spreadsheet rows lack a domain. Never fill the historical field.
export function resolveCatalogSource(source: TrafficSource, sources: NewsSource[]) {
  const byName = sources.find((entry) =>
    [entry.name, ...entry.referenceNames, ...(historicalNames[entry.media] ?? [])].some(
      (name) => normalizeName(name) === normalizeName(source.name),
    ),
  );
  if (byName || !source.domain) return byName;
  const domain = safeWebsiteUrl(source.domain.includes('://') ? source.domain : `https://${source.domain}`);
  if (!domain) return undefined;
  const identity = (value: string) => normalizeDomain(new URL(value).hostname) + new URL(value).pathname.replace(/\/$/, '');
  const matches = sources.filter((entry) => {
    const url = safeWebsiteUrl(entry.websiteUrl);
    return url && identity(url) === identity(domain);
  });
  // Several brands can share one domain; do not guess between them.
  return matches.length === 1 ? matches[0] : undefined;
}

export function crawlStatusFor(source: NewsSource | undefined, audit: NewsCrawlAudit | undefined): CrawlStatus {
  if (!source?.websiteUrl) return 'unresolved';
  if (!audit || audit.websiteUrl !== source.websiteUrl) return 'pending';
  return audit.status === 'verified' && !audit.samples.length ? 'unavailable' : audit.status;
}

export const trafficSorts = ['traffic', 'growth', 'name', 'rank'] as const;
export type TrafficSort = (typeof trafficSorts)[number];
const normalizeName = (name: string) => name.replaceAll(/\s/g, '').toLowerCase();
const normalizeDomain = (domain: string) =>
  domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\/$/, '');

// Observed names in the 202601 and 202602 reference tabs.
const historicalNames: Record<string, string[]> = { ctitv: ['中天'], ftv: ['民視'] };

// Only explicit reference identities are mapped. A missing match does not mean
// the site does not crawl that outlet, and historical domains are not invented.
export function referenceFor(source: TrafficSource, references: ReferenceSource[]) {
  return references.find((reference) =>
    source.domain
      ? normalizeDomain(source.domain) === normalizeDomain(reference.domain)
      : [reference.name, ...(historicalNames[reference.media] ?? [])].some((name) => normalizeName(source.name) === normalizeName(name)),
  );
}

export function selectTrafficSources(
  sources: TrafficSource[],
  references: ReferenceSource[],
  options: { scope: string; classification: string; query: string; sort: TrafficSort; ascending: boolean },
) {
  const query = options.query.trim().toLowerCase();
  return sources
    .filter((source) => {
      if (options.scope !== 'all' && !referenceFor(source, references)) return false;
      if (options.classification && (source.classification ?? '未標記') !== options.classification) return false;
      return !query || [source.name, source.domain ?? '', source.category].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const x = a[options.sort];
      const y = b[options.sort];
      // Missing data always stays last, including ascending order; zero is data.
      if (x == null || y == null) return x == null && y == null ? a.row - b.row : x == null ? 1 : -1;
      const comparison = typeof x === 'string' ? x.localeCompare(y as string, 'zh-Hant') : x - (y as number);
      return (options.ascending ? comparison : -comparison) || a.row - b.row;
    });
}

export const monthLabel = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(4))} 月`;
export const trafficNumber = (value: number | null) => (value == null ? '—' : value.toLocaleString('zh-TW', { maximumFractionDigits: 7 }));
export const trafficGrowth = (value: number | null) =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}%`;

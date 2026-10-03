import specs from '../../data/crawl-sources.json' with { type: 'json' };
import type { ArticleRules } from './article.ts';
import type { MarkerListSpec } from './html-list.ts';

export interface DiscoverSpec {
  pattern: string;
  minTitle?: number;
  // A news card may wrap its date, category and summary in the same anchor.
  titleSelector?: string;
}
export type SourceOverride = Omit<Partial<SourceSpec>, 'list' | 'article'> & {
  list?: Partial<SourceSpec['list']>;
  article?: Partial<SourceSpec['article']>;
};
export interface SourceSpec {
  media: string;
  group: 'news' | 'hourly' | 'off';
  list: {
    urls: Array<{ cat: string; url: string }>;
    // New reference sites share feed/sitemap/HTML discovery; only pages whose
    // title, body and recent publication date have been verified are indexed.
    autoDiscover?: { homeUrl: string; feedUrls?: string[]; articlePattern?: string; maxArticles?: number };
    userAgent?: string;
    marker?: MarkerListSpec;
    discover?: DiscoverSpec;
    curl?: boolean;
    // Keep only listing URLs whose path (+query) matches: plain sitemaps also
    // list section, author and subscription pages.
    include?: string;
    // First capture group identifies the article when one story is reachable
    // under several URLs (taisounds: /news/content/<category>/<id>).
    articleId?: string;
    // Keep only listing items whose title matches (a YouTube channel feed mixes
    // news clips with shows and live streams).
    titleInclude?: string;
  };
  // Site-name tail to drop from page titles, e.g. " | 聯合新聞網".
  titleSuffix?: string;
  article: ArticleRules & { enabled: boolean; batch: number; delayMs: number; userAgent?: string };
}
type PhpSpec = {
  media: string;
  index: null | {
    runs: Array<Record<string, string>>;
    urls: Array<{ cat: string; url: string }>;
    itemStart: string | null;
    itemEnd: string | null;
    userAgent: string | null;
    markers: Array<{ start: string; end: string; target: string | null }>;
  };
  tag: null | {
    userAgent: string | null;
    markers: Array<{ start: string; end: string | null; target: string | null }>;
    split: string | null;
    sleep: number | null;
  };
};

const FEED_ITEMS = new Set(['<item>', '<url>', '<entry>', '<item']);
export function loadSources(overrides: Record<string, SourceOverride> = {}, groups: Record<string, 'news' | 'hourly'> = {}): SourceSpec[] {
  const out: SourceSpec[] = [];
  for (const [media, raw] of Object.entries(specs as unknown as Record<string, PhpSpec>)) {
    // The PHP spec extractor picked up a stray Chinatimes RSS URL in 26 scripts.
    if (raw.index) raw.index.urls = raw.index.urls.filter((u) => media === 'chinatimes' || !/chinatimes\.com/.test(u.url));
    if (!raw.index) continue;
    const idx = raw.index;
    let marker: MarkerListSpec | undefined;
    if (idx.itemStart && !FEED_ITEMS.has(idx.itemStart)) {
      const find = (t: string) => idx.markers.find((m) => m.target === t);
      const u = find('url'),
        ti = find('title'),
        tm = find('timestamp') ?? find('thetime'),
        im = find('image');
      if (u && ti)
        marker = {
          itemStart: idx.itemStart,
          itemEnd: idx.itemEnd ?? '</',
          url: { start: u.start, end: u.end },
          title: { start: ti.start, end: ti.end },
          ...(tm ? { time: { start: tm.start, end: tm.end } } : {}),
          ...(im ? { image: { start: im.start, end: im.end } } : {}),
        };
    }
    const kw =
      raw.tag?.markers.filter((m) => m.target === 'keywords' && m.end).map((m) => ({ start: m.start, end: m.end as string })) ?? [];
    const spec: SourceSpec = {
      media,
      group: groups[media] ?? 'off',
      list: { urls: idx.urls, ...(idx.userAgent ? { userAgent: idx.userAgent } : {}), ...(marker ? { marker } : {}) },
      article: {
        enabled: !!raw.tag,
        batch: 10,
        delayMs: Math.min(10000, (raw.tag?.sleep ?? 3) * 1000),
        ...(raw.tag?.split && raw.tag.split !== ',' ? { split: raw.tag.split } : {}),
        ...(kw.length ? { keywordMarkers: kw } : {}),
        ...(raw.tag?.userAgent ? { userAgent: raw.tag.userAgent } : {}),
      },
    };
    const o = overrides[media];
    out.push(o ? { ...spec, ...o, list: { ...spec.list, ...(o.list ?? {}) }, article: { ...spec.article, ...(o.article ?? {}) } } : spec);
  }
  for (const [media, o] of Object.entries(overrides))
    if (!out.some((s) => s.media === media) && o.list)
      out.push({ media, group: 'off', article: { enabled: false, batch: 10, delayMs: 3000 }, ...o } as SourceSpec);
  return out;
}

export interface MediaCrawler {
  media: string;
  title: string;
  country: string;
  countryCode: string;
  schedule: string;
  crawler?: {
    methods: string[];
    transport: string | null;
    body: string;
    lastVerifiedMethod: string | null;
    links: Array<{ label: string; url: string }>;
  };
  /** Official 議題／專題 entry points; absent on older API builds. */
  topics?: MediaTopicSources;
}
export type TopicSourceKind = 'topic' | 'feature' | 'auto';
export interface MediaTopicSources {
  sources: Array<{ url: string; kind: TopicSourceKind; items: number; error?: string }>;
  checkedAt: string | null;
  lastSuccessAt: string | null;
  status: string;
  counts: { topic: number; feature: number };
  rulesUrl?: string;
}
export const topicSourceKindLabels: Record<TopicSourceKind, string> = { topic: '議題', feature: '專題', auto: '自動判定' };
export const topicTotal = (row: MediaCrawler) => (row.topics ? row.topics.counts.topic + row.topics.counts.feature : -1);

export const crawlerGroups = [
  { key: 'methods', label: '抓取方式' },
  { key: 'tools', label: '工具' },
  { key: 'content', label: '收錄內容' },
] as const;
export type CrawlerGroup = (typeof crawlerGroups)[number]['key'];
export type CrawlerFilters = Record<CrawlerGroup, string[]>;
export type CrawlerSort = 'title' | CrawlerGroup | 'topics' | 'code';
export const emptyCrawlerFilters = (): CrawlerFilters => ({ methods: [], tools: [], content: [] });

const methodLabels: Record<string, string> = {
  '自動探索 RSS／Sitemap／HTML': '自動探索',
  'RSS／Atom／XML feed': 'RSS／Atom',
  'XML Sitemap': 'Sitemap',
  'HTML 選擇器解析': 'HTML 選擇器',
  'HTML 字串標記解析': 'HTML 字串標記',
  '公開 JSON API': 'JSON API',
  'YouTube Atom 影片列表': 'YouTube Atom',
};

export function crawlerTags(row: MediaCrawler): Record<CrawlerGroup, string[]> {
  const transport = row.crawler?.transport;
  const tools: string[] = [];
  if (transport?.includes('Undici')) tools.push('Undici');
  if (transport?.includes('curl')) tools.push(transport.includes('必要時 curl') ? 'curl（備援）' : 'curl');
  if (transport?.includes('Playwright')) tools.push('Playwright');
  if (transport?.includes('Chromium')) tools.push('Chromium');
  const body = row.crawler?.body;
  return {
    methods: [...new Set((row.crawler?.methods ?? ['尚無資料']).map((method) => methodLabels[method] ?? method))],
    tools: tools.length ? tools : [transport || '未設定'],
    content:
      body === '擷取正文（逐篇驗證）' ? ['正文擷取'] : body === '標題／摘要／影片資料' ? ['標題', '摘要', '影片資料'] : [body || '未設定'],
  };
}

export function selectCrawlers(rows: MediaCrawler[], query: string, filters: CrawlerFilters, sort: CrawlerSort, descending: boolean) {
  const term = query.trim().toLocaleLowerCase();
  const value = (row: MediaCrawler) =>
    sort === 'topics'
      ? String(topicTotal(row) + 1).padStart(6, '0')
      : sort === 'title'
        ? row.title
        : sort === 'code'
          ? (row.crawler?.links.map((link) => link.label).join('、') ?? '')
          : crawlerTags(row)[sort].join('、');
  return rows
    .filter((row) => {
      const tags = crawlerTags(row);
      const text = [
        row.title,
        row.media,
        row.country,
        ...(row.crawler?.methods ?? []),
        row.crawler?.transport,
        row.crawler?.body,
        ...Object.values(tags).flat(),
        ...(row.topics?.sources.map((s) => s.url) ?? []),
      ].join(' ');
      return (
        text.toLocaleLowerCase().includes(term) &&
        crawlerGroups.every(({ key }) => !filters[key].length || filters[key].some((tag) => tags[key].includes(tag)))
      );
    })
    .sort((a, b) => {
      const order = value(a).localeCompare(value(b), 'zh-Hant', { numeric: true });
      return (descending ? -order : order) || a.title.localeCompare(b.title, 'zh-Hant') || a.media.localeCompare(b.media);
    });
}

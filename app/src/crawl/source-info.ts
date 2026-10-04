import { readFileSync } from 'node:fs';
import originalSources from '../../data/crawl-sources.json' with { type: 'json' };
import audits from '../../data/news-crawl-audit.json' with { type: 'json' };
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { overrides } from './sources/overrides.ts';
import type { SourceSpec } from './sources.ts';

const repository = 'https://github.com/skyhong2002/tag.observe.tw/blob/main/';
const sourceLines = new Map<string, string[]>();
export function codeLink(label: string, path: string, marker?: string) {
  let line = 0;
  if (marker) {
    try {
      if (!sourceLines.has(path)) sourceLines.set(path, readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8').split('\n'));
      line = sourceLines.get(path)!.findIndex((value) => value.includes(marker)) + 1;
    } catch {
      // A packaged deployment may omit source text; the file link remains valid.
    }
  }
  return { label, url: `${repository}${path}${line > 0 ? `#L${line}` : ''}` };
}

export function crawlerInfo(media: string, spec?: SourceSpec) {
  if (!spec?.list) return { methods: ['未設定爬蟲'], transport: null, body: '未設定', lastVerifiedMethod: null, links: [] };
  const links = [];
  if (Object.hasOwn(overrides, media)) links.push(codeLink('本站設定', 'app/src/crawl/sources/overrides.ts', `  ${media}: {`));
  if (catalog.sources.some((source) => source.media === media))
    links.push(codeLink('來源設定', 'app/data/news-source-catalog.json', `"media": "${media}"`));
  else if (Object.hasOwn(originalSources, media)) links.push(codeLink('原始設定', 'app/data/crawl-sources.json', `"${media}": {`));
  const auto = spec.list.autoDiscover;
  const methods: string[] = [];
  let parser = 'app/src/crawl/pipeline.ts';
  let transport = auto?.transport === 'curl' || spec.list.curl ? 'curl' : 'HTTP（Undici；必要時 curl）';
  if (spec.discovery === 'google_news') {
    methods.push('RSS／Atom', '原站連結解析');
    transport += '；Playwright／Chromium 解析轉址';
    parser = 'app/src/crawl/discovery-google-news.ts';
  } else if (spec.discovery === 'dongtaiwang') {
    methods.push('HTML 連結解析', '原站文章發現');
    parser = 'app/src/crawl/discovery-dongtaiwang.ts';
  } else if (auto) {
    if (['nhk', 'msn', 'pnn'].includes(media)) {
      methods.push('公開 JSON API');
      parser = `app/src/crawl/news-${media}.ts`;
    } else {
      if (auto.apiUrls?.length) methods.push('公開 JSON API');
      if (auto.feedOnly) methods.push('RSS／Atom');
      else if (auto.articleUrls?.length) methods.push('指定文章 HTML');
      else methods.push('自動探索 RSS／Sitemap／HTML');
      parser = 'app/src/crawl/news-discovery.ts';
    }
    if (auto.feedBody === 'full-text') methods.push('Feed 全文');
  } else if (spec.list.discover || spec.list.marker) {
    methods.push(spec.list.marker ? 'HTML 字串標記解析' : 'HTML 選擇器解析');
    parser = 'app/src/crawl/html-list.ts';
  } else {
    for (const { url } of spec.list.urls) {
      if (!url) continue;
      const method = /youtube\.com\/feeds\//.test(url)
        ? 'YouTube Atom 影片列表'
        : /sitemap|site-map/i.test(url)
          ? 'XML Sitemap'
          : 'RSS／Atom／XML feed';
      if (!methods.includes(method)) methods.push(method);
    }
    parser = 'app/src/crawl/feed.ts';
  }
  links.push(codeLink('解析程式', parser));
  links.push(codeLink('下載工具', 'app/src/crawl/fetch.ts'));
  if (spec.article.enabled || auto) links.push(codeLink('內文解析', 'app/src/crawl/article.ts'));
  const proof = audits.results.find((item) => item.media === media && item.status === 'verified' && item.websiteUrl === auto?.homeUrl);
  const labels: Record<string, string> = {
    rss: 'RSS／Atom',
    sitemap: 'XML Sitemap',
    html: 'HTML',
    api: 'JSON API',
    existing: '既有解析器',
  };
  return {
    methods: methods.length ? methods : ['未設定入口'],
    transport,
    body: spec.discovery ? '依原媒體取得正文' : auto || spec.article.enabled ? '擷取正文（逐篇驗證）' : '標題／摘要／影片資料',
    lastVerifiedMethod: proof ? (labels[proof.strategy] ?? null) : null,
    links,
  };
}

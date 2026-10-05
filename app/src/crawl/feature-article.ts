import * as cheerio from 'cheerio';
import { type ArticleRules, extractArticle } from './article.ts';
import { reporterNames } from './byline.ts';
import { dateFromStoryUrl } from './topic-kind.ts';

interface ReporterTopic {
  slug: string;
  title?: string;
  published_date?: string;
  description?: { api_data?: Array<{ type: string; content?: unknown[] }> };
  leading_image?: { resized_targets?: { tablet?: { url?: string } } };
}

/** A feature landing page has its own editorial introduction, separate from linked stories. */
export function extractFeatureArticle(html: string, url: string, rules: ArticleRules = {}) {
  const u = new URL(url);
  const reporter = u.hostname === 'www.twreporter.org' && u.pathname.startsWith('/topics/');
  const detail = extractArticle(html, url, reporter ? { ...rules, jsonTags: undefined } : rules);
  if (u.hostname.replace(/^www\./, '') === 'bannedbook.org' && /^\/bnews\/(?:zh-tw\/)?/.test(u.pathname)) {
    // Reprinted articles start with the original credit and a disclaimer.
    // The site's own "編輯團隊" metadata does not identify the article writer.
    const lead = (detail.body ?? '').normalize('NFKC').trim();
    const author = /^作者\s*[:：]\s*([^,，\n]{1,80}?)(?=\s*(?:來源|来源)\s*[:：]|\s*[,，]\s*文章)/u.exec(lead)?.[1].trim();
    const source = /^(?:作者\s*[:：]\s*[^,，\n]{1,80}?)?(?:來源|来源)\s*[:：]\s*([^,，\n]{1,80})(?=\s*[,，]\s*文章)/u
      .exec(lead)?.[1]
      .trim();
    const people = author ? reporterNames(`文／${author}`) : [];
    if (people.length) detail.authors = people;
    else detail.authors = detail.authors.filter((name) => name !== '編輯團隊' && name !== '编辑团队');
    // An organizational author declaration is the content provider here.
    if (source || (author && !people.length)) detail.provider = source ?? author ?? null;
  }
  if (u.hostname === 'topic.udn.com' && u.pathname.startsWith('/issue/cards/') && !detail.body) {
    const intro = extractArticle(html, url, { ...rules, bodySelector: '.container-content > p.content' });
    if (intro.body) Object.assign(detail, { body: intro.body, bodyStatus: intro.bodyStatus, bodySource: intro.bodySource });
  }
  if (u.hostname === 'topic.udn.com' && u.pathname.startsWith('/event/')) {
    detail.publishedAt ??= dateFromStoryUrl(u.pathname.replace(/\/(\d{4})_(\d{2})(\d{2})$/, '/$1/$2/$3/'));
    const report = extractArticle(html, url, {
      ...rules,
      bodySelector: '#mainbar.article-holder',
      bodyExcludeSelector: '.related, .recommend, .photo-caption',
    });
    if (report.body && report.body.length > (detail.body?.length ?? 0))
      Object.assign(detail, { body: report.body, bodyStatus: report.bodyStatus, bodySource: report.bodySource });
  }
  if (reporter) {
    // The normal news extractor can pick tags from related posts in this state.
    detail.tags = [];
    const $ = cheerio.load(html);
    for (const element of $('script').toArray()) {
      const script = $(element).text().trim();
      if (!script.startsWith('window.__REDUX_STATE__=')) continue;
      try {
        const state = JSON.parse(script.slice('window.__REDUX_STATE__='.length).replace(/;\s*$/, '')) as {
          entities?: { topics?: { byId?: Record<string, ReporterTopic> } };
        };
        const slug = u.pathname.split('/').filter(Boolean).at(-1);
        const topic = Object.values(state.entities?.topics?.byId ?? {}).find((t) => t.slug === slug);
        if (!topic) continue;
        const blocks = topic.description?.api_data ?? [];
        const paragraphs = blocks
          .filter((b) => ['unstyled', 'paragraph', 'header-one', 'header-two', 'blockquote'].includes(b.type))
          .flatMap((b) => (Array.isArray(b.content) ? b.content.filter((s: unknown) => typeof s === 'string') : []));
        const body = paragraphs
          .map((s: string) => cheerio.load(s).text().trim())
          .filter(Boolean)
          .join('\n\n');
        if (body)
          Object.assign(detail, { body, bodyStatus: body.length >= 200 ? 'ok' : 'short', bodySource: 'feature:reporter-description' });
        const date = new Date(topic.published_date ?? '');
        if (Number.isFinite(+date)) detail.publishedAt = date;
        detail.title = topic.title || detail.title;
        detail.image = topic.leading_image?.resized_targets?.tablet?.url || detail.image;
      } catch {
        // A malformed page state must not prevent the ordinary DOM extraction.
      }
    }
  }
  return detail;
}

import type { CompareArticle } from './headline-compare.mts';
import { distinctiveHeadlineParts } from './headline-emphasis.mts';
import type { GroupHeadlinePart } from './headline-group.mts';

export interface EventHeadlineGroup {
  media: string;
  title: string;
  headlines: Array<{ article: CompareArticle; parts: GroupHeadlinePart[] }>;
}

/** Retain every report in the comparison pool, grouped by outlet, newest first. */
export function eventHeadlineGroups(articles: readonly CompareArticle[]): EventHeadlineGroup[] {
  const parts = distinctiveHeadlineParts(articles);
  const groups = new Map<string, EventHeadlineGroup>();
  articles.forEach((article, index) => {
    let group = groups.get(article.media);
    if (!group) {
      group = { media: article.media, title: article.mediaTitle, headlines: [] };
      groups.set(article.media, group);
    }
    group.headlines.push({ article, parts: parts[index] });
  });
  const time = (iso: string) => Date.parse(iso) || 0;
  for (const group of groups.values()) {
    group.headlines.sort((a, b) => time(b.article.publishedAt) - time(a.article.publishedAt) || a.article.id - b.article.id);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant') || a.media.localeCompare(b.media));
}

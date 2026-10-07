import type { NewsSiteRules } from './news-site-rules.ts';

// Public syndication on People's Daily's Taiwan channel. The caller must
// additionally require the intended publisher's visible source credit.
export const ROUND3_LEGACY_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'news.sina.cn',
    path: /^\/(?:gj\/)?\d{4}-\d{2}-\d{2}\/detail-[a-z0-9]+\.d\.html$/,
    bodySelector: '.j_main_art article.art_box > section.art_content',
    titleSelector: '.j_main_art .art_tit_h1',
    providerSelector: '.j_main_art article.art_box > section.art_content > p:first-of-type',
    providerPattern: /^\s*来源[：:]\s*([^\s，。！？：:]{2,30})\s*$/u,
    authorSelector: '.j_main_art article.art_box > section.art_content > p:last-of-type',
    authorPattern: /^记者[：:]\s*([\p{Script=Han}·]{2,12})$/u,
  },
  {
    host: 'news.sina.cn',
    path: /^\/znl\/\d{4}-\d{2}-\d{2}\/detail-[a-z0-9]+\.d\.html$/,
    bodySelector: '.j_main_art article.art_box > section.art_content',
    titleSelector: '.j_main_art .art_tit_h1',
    providerSelector: 'meta[name="author"]',
  },
  {
    host: 'news.sina.com.cn',
    path: /^\/zx\/gj\/\d{4}-\d{2}-\d{2}\/doc-[a-z0-9]+\.shtml$/,
    bodySelector: '#article_content > .article-content-left > #article',
    publishedSelector: '.date-source > .date',
    providerSelector: '.date-source .source',
  },
  {
    host: 'tw.people.com.cn',
    path: /^\/n1\/\d{4}\/\d{4}\/c\d+-\d+\.html$/,
    bodySelector: '.rm_txt > .col-1 > .rm_txt_con',
    titleSelector: '.rm_txt > .col-1 > h1',
    publishedSelector: '.rm_txt > .col-1 > .channel > .col-1-1',
    providerSelector: '.rm_txt > .col-1 > .channel > .col-1-1 > a:first-of-type',
    bodyExcludeSelector: '.rm_txt_con .edit, .rm_txt_con .operate, .rm_txt_con .relate',
  },
];

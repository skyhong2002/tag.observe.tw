import { describe, expect, it } from 'vitest';
import { extractFeatureArticle } from './feature-article.ts';
import { standaloneTopicListing, standaloneTopicPage } from './topic-article.ts';

const url = 'https://topic.udn.com/event/2025_0623';
const paragraphs = [
  '這是一篇人物報導的開頭，敘述受訪者成長與求學的經歷。'.repeat(4),
  '這是同一篇報導後面的章節，繼續敘述受訪者的職場故事。'.repeat(4),
];
const html = `<section id="mainbar" class="article-holder">${paragraphs.map((p) => `<article class="article-item"><div class="container"><p>${p}</p></div></article>`).join('')}</section>`;
describe('single articles in publisher topic indexes', () => {
  it('recognizes single profile cards without treating every event URL or topic name as an article', () => {
    expect(standaloneTopicListing('udn', url, '【優人物】NOBUO主廚')).toBe(true);
    expect(standaloneTopicListing('udn', 'https://topic.udn.com/issue/cards/profiles', '優人物專輯')).toBe(false);
    expect(standaloneTopicListing('udn', url, '多篇新聞專題')).toBe(false);
  });
  it('identifies a chaptered report but preserves actual collections and unknown/empty pages', () => {
    expect(standaloneTopicPage(html, url, 0)).toBe(true);
    expect(standaloneTopicPage(html, url, 5)).toBe(false);
    expect(standaloneTopicPage('<main>載入中</main>', url, 0)).toBe(false);
    expect(standaloneTopicPage(html, 'https://topic.udn.com/issue/cards/topic', 0)).toBe(false);
    expect(standaloneTopicPage(html, 'https://topic.udn.com/event/newmedia_2022-violence', 0)).toBe(false);
  });
  it('collects all chapters of the report and its URL publication date', () => {
    const detail = extractFeatureArticle(html, url);
    expect(detail.body).toContain(paragraphs[0]);
    expect(detail.body).toContain(paragraphs[1]);
    expect(detail.publishedAt?.toISOString()).toBe('2025-06-22T16:00:00.000Z');
  });
});

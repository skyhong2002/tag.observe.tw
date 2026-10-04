import { describe, expect, it } from 'vitest';
import { cleanEventHeadline, clipHeadline, HEADLINE_MAX, headlineTags, selectEventLead } from '../../web/src/lib/event-presentation.mts';

const news = [
  { id: 1, media: 'taipeitimes', title: 'OpenAI cancels release of newest model', image: 'https://example.org/english.jpg' },
  { id: 2, media: 'ettoday', title: 'OpenAI推出新中階AI模型　價格僅旗艦產品1/5', image: 'https://example.org/model.jpg' },
  { id: 3, media: 'nextapple', title: 'OpenAI推全天候AI助理Dots　可串接逾4000款App', image: 'https://example.org/dots.jpg' },
  { id: 4, media: 'newtalk', title: 'AI高層白宮午餐會　川普強調業界應自律監管', image: null },
];
const major = ['那對夫妻', '馬斯克', 'OpenAI'];

describe('shared event presentation', () => {
  it('selects the event-table representative, not the first available image', () => {
    expect(selectEventLead(news, major)).toBe(news[1]);
    const noImage = news.map((n) => ({ ...n, image: n.id === 2 ? null : n.image }));
    expect(selectEventLead(noImage, major)).toBe(noImage[1]);
  });
  it('keeps the headline, source and image from the same article without rewriting it', () => {
    const article = selectEventLead(news, major);
    expect(article).toEqual(news[1]);
    expect(article?.title).toContain('　');
  });
  it('prefers major-tag relevance before brevity and retains the event table prefix rules', () => {
    const articles = [{ title: '快讯其他新聞報導' }, { title: '影音／OpenAI與馬斯克的最新消息｜科技新聞' }];
    expect(selectEventLead(articles, major)).toBe(articles[1]);
    expect(cleanEventHeadline(articles[1].title)).toBe('OpenAI與馬斯克的最新消息');
    expect(selectEventLead([{ title: ' ' }, { title: '短' }], major)).toBeNull();
    expect(selectEventLead([], major)).toBeNull();
  });
  it('does not let a title that runs into its lede win on tag hits', () => {
    const runOn = { title: `OpenAI與馬斯克新消息 【記者／綜合報導】${'那對夫妻'.repeat(15)}` };
    const headline = { title: 'OpenAI推出新中階AI模型' };
    expect(selectEventLead([runOn, headline], major)).toBe(headline);
    expect(selectEventLead([runOn], major)).toBe(runOn);
  });
  it('clips displayed headlines without touching short ones', () => {
    expect(clipHeadline('短標題')).toBe('短標題');
    const long = '字'.repeat(HEADLINE_MAX + 20);
    expect([...clipHeadline(long)]).toHaveLength(HEADLINE_MAX);
    expect(clipHeadline(long).endsWith('…')).toBe(true);
    expect(clipHeadline('字'.repeat(HEADLINE_MAX))).toBe('字'.repeat(HEADLINE_MAX));
  });
  it('does not attach unrelated cluster names to the displayed headline', () => {
    expect(headlineTags(news[1].title, [...major, 'AI', '川普', 'OpenAI'])).toEqual(['OpenAI', 'AI']);
    expect(headlineTags('openai 發布消息', ['OpenAI', 'AI', '馬斯克', ''])).toEqual(['OpenAI']);
    expect(headlineTags('AIRBUS 航班消息', ['AI'])).toEqual([]);
    expect(headlineTags('新消息', major)).toEqual([]);
  });
});

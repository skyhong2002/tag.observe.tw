import { describe, expect, it } from 'vitest';
import { zaobaoSpecials } from './topic-extractors-b2.ts';
import { extractTopics, fetchTopicListings, TOPIC_RULES, topicListings } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const listing = (media: string, url: string) => topicListings(rule(media)).find((l) => l.url === url)!;

describe('technews', () => {
  it('takes topic slugs but not feeds, portals or the index', () => {
    const t = rule('technews');
    for (const href of ['/siph-cpo/', '/share-bike-2020/']) expect(t.pattern.test(href)).toBe(true);
    for (const href of ['/feed/', '/topics/', '/tn-rss/', '/event-portal/', '/2026/03/18/nvidia/']) expect(t.pattern.test(href)).toBe(false);
  });
});

describe('businesstoday', () => {
  it('drops short links whose package now bounces back to the homepage', async () => {
    const home = 'https://www.businesstoday.com.tw/';
    const listing = `<div class="latest__side-slider">
      <a href="https://supr.link/live"><h4>永續城市大調查</h4></a>
      <a href="https://supr.link/dead"><h4>縣市長拼連任</h4></a></div>`;
    const pages: Record<string, { url: string; body: string }> = {
      [home]: { url: home, body: listing },
      'https://supr.link/live': { url: 'https://supr.link/live', body: '<a id="user-click-link" href="https://www.businesstoday.com.tw/bt_topic/2026/city/">go</a>' },
      'https://supr.link/dead': { url: 'https://supr.link/dead', body: '<a id="user-click-link" href="https://www.businesstoday.com.tw/catalog/1">go</a>' },
      'https://www.businesstoday.com.tw/bt_topic/2026/city/': { url: 'https://www.businesstoday.com.tw/bt_topic/2026/city/', body: '' },
      'https://www.businesstoday.com.tw/catalog/1': { url: home, body: '' },
    };
    const result = await fetchTopicListings(rule('businesstoday'), async (url) => ({ ...pages[url], status: 200, contentType: 'text/html', ms: 0 }));
    expect(result.items.map((t) => [t.title, t.url])).toEqual([['永續城市大調查', 'https://www.businesstoday.com.tw/bt_topic/2026/city/']]);
    expect(result.sources[0].error).toMatch(/fell back to the listing/);
  });
});

describe('theinitium', () => {
  it('lets the columns listing declare a series it shares with the auto archive', async () => {
    const card = (slug: string, name: string) => `<article class="border"><h3><a href="/tag/${slug}/">${name}</a></h3></article>`;
    const pages: Record<string, string> = {
      'https://theinitium.com/series/': `<section id="series-latest">${card('2026-iran-war', '2026伊朗戰爭')}</section>`,
      'https://theinitium.com/series/page/2/': `<main>${card('2026-iran-war', '2026伊朗戰爭')}${card('resident-columnist-program', '駐場評論人計劃')}</main>`,
      'https://theinitium.com/column/': `<main>${card('resident-columnist-program', '駐場評論人計劃')}</main>`,
    };
    const result = await fetchTopicListings(rule('theinitium'), async (url) => ({ url, body: pages[url], status: 200, contentType: 'text/html', ms: 0 }));
    expect(result.items.map((t) => [t.url.split('/tag/')[1], t.kind, t.source])).toEqual([
      ['2026-iran-war/', undefined, 'https://theinitium.com/series/'],
      ['resident-columnist-program/', 'topic', 'https://theinitium.com/series/page/2/'],
    ]);
  });
});

describe('zaobao', () => {
  it('declares the permanent /special/ beats 議題 and leaves /specials/ events to auto', () => {
    const html = '<h2><a href="/special/taiwan">台海局势</a></h2><h2><a href="/specials/sgbudget2025">新加坡财政预算案2025</a></h2>';
    expect(zaobaoSpecials(html, rule('zaobao')).map((t) => [t.title, t.kind])).toEqual([
      ['台海局势', 'topic'],
      ['新加坡财政预算案2025', undefined],
    ]);
  });

  it('takes interactive microsites but not the quizzes inside them', () => {
    const graphics = listing('zaobao', 'https://www.zaobao.com.sg/interactive-graphics');
    const card = (href: string, name: string) =>
      `<div class="card"><a class="content-image" aria-label="${name}" href="${href}"></a><div><a href="${href}"><h3>${name}</h3></a></div></div>`;
    const html =
      card('https://interactive.zaobao.com.sg/2026/rare-earth/', '争稀土，得天下？') +
      card('https://interactive.zaobao.com.sg/2026/asian-games-2026/quiz/team-singapore-in-asian-games.html', '亚运知多少') +
      card('https://interactive.zaobao.com.sg/sg-chinese-funfest/2026/quiz-challenge', '文字大比拼');
    expect(extractTopics(html, graphics).map((t) => [t.title, t.url])).toEqual([
      ['争稀土，得天下？', 'https://interactive.zaobao.com.sg/2026/rare-earth/'],
    ]);
  });
});

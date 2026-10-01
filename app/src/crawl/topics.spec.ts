import { describe, expect, it } from 'vitest';
import { extractTopics, ldTopics, nuxtTopics } from './topics.ts';

describe('extractTopics', () => {
  const base = { media: 'x', fallbackImage: '', url: 'https://example.com/topic/', pattern: /\/topic\/\d+/ };

  it('drops tracking parameters and dedupes on the clean URL', () => {
    const html = '<a href="/topic/1?utm_source=a">選舉</a><a href="/topic/1">選舉</a><a href="/topic/2?id=3#x">亞運</a>';
    expect(extractTopics(html, base).map((t) => t.url)).toEqual(['https://example.com/topic/1', 'https://example.com/topic/2?id=3']);
  });

  it('limits links to the scope and takes the cover image selector', () => {
    const html = `<nav><a href="/topic/9">論壇</a></nav>
      <div class="list"><a href="/topic/5"><img src="/mask.png"><img class="cover" data-src="/c.jpg"><h2>川習會</h2></a></div>`;
    const [t, ...rest] = extractTopics(html, { ...base, scope: '.list', image: 'img.cover' });
    expect(rest).toEqual([]);
    expect(t).toMatchObject({ url: 'https://example.com/topic/5', image: 'https://example.com/c.jpg' });
  });

  it('ignores placeholder images', () => {
    const [t] = extractTopics('<a href="/topic/1"><img src="/images-next/loading.gif">亞運捷報</a>', base);
    expect(t.image).toBeNull();
  });

  it("keeps the topic link's own text over a 'more' link's guessed heading", () => {
    const html = `<ul><li><a href="/topic/7">新北少女遭虐</a></li></ul>
      <div class="block"><h3 class="title">三重父逼女兒掛看板遊街</h3><a href="/topic/7">更多</a></div>`;
    expect(extractTopics(html, base).map((t) => t.title)).toEqual(['新北少女遭虐']);
  });
});

describe('embedded topic data', () => {
  it('reads topics from a Nuxt payload', () => {
    const payload = [
      { data: 1 },
      [2, 6],
      { id: 3, title: 4, link: 5, thumbImageUrl: 8 },
      'uuid',
      '選後新政局',
      '/topic/12',
      { id: 7, title: 9, link: 10, imageUrl: 8 },
      'a1',
      'https://img.example.com/c.webp',
      '藍委籲普發石油津貼',
      '/cts/general/1.html',
    ];
    const html = `<a href="/topic/12">nav</a><script type="application/json" id="__NUXT_DATA__">${JSON.stringify(payload)}</script>`;
    expect(nuxtTopics(html, { media: 'x', fallbackImage: '', url: 'https://example.com/topic/', pattern: /\/topic\/\d+/ })).toEqual([
      { url: 'https://example.com/topic/12', title: '選後新政局', image: 'https://img.example.com/c.webp', category: null },
    ]);
  });

  it('takes names from a JSON-LD ItemList and covers from the page', () => {
    const ld = { '@type': 'ItemList', itemListElement: [{ url: 'https://example.com/hotTopic/1', name: '國旅補助' }] };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>
      <div><a href="/hotTopic/1">國旅</a><a href="/hotTopic/1"><img src="/1.jpg"></a><a href="/hotTopic/1">→ 閱讀完整議題</a>
      <a href="/hotTopic/1#topic-link-5">2026-09-30 17:17 某篇新聞</a></div>`;
    expect(ldTopics(html, { media: 'x', fallbackImage: '', url: 'https://example.com/hotTopic', pattern: /\/hotTopic\/\d+$/ })).toEqual([
      { url: 'https://example.com/hotTopic/1', title: '國旅補助', image: 'https://example.com/1.jpg', category: null },
    ]);
  });
});

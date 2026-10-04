import { describe, expect, it } from 'vitest';
import { mirrorTopics } from './topic-extractors-b1.ts';
import { extractTopics, TOPIC_RULES, topicListings } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const listing = (media: string, url: string) => topicListings(rule(media)).find((l) => l.url === url)!;

describe('鏡週刊', () => {
  it('reads the 24 topics in the Next.js data, dropping slugs with stray spaces', () => {
    const topics = [
      { slug: 'trumptariffs', name: '川普關稅風暴', heroImage: { resized: { w800: 'https://img.example/t-w800.jpg' } } },
      { slug: ' forgedevidence', name: '惡檢偽造證據', heroImage: null },
      { slug: 'recall', name: '大罷免全紀錄', heroImage: null, og_image: { resized: { original: 'https://img.example/r.jpg' } } },
    ];
    const html = `<main><a href="/topic/trumptariffs">川普關稅風暴</a></main>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { topics } } })}</script>`;
    expect(mirrorTopics(html, rule('mirror'))).toEqual([
      {
        url: 'https://www.mirrormedia.mg/topic/trumptariffs',
        title: '川普關稅風暴',
        image: 'https://img.example/t-w800.jpg',
        category: null,
      },
      { url: 'https://www.mirrormedia.mg/topic/recall', title: '大罷免全紀錄', image: 'https://img.example/r.jpg', category: null },
    ]);
  });

  it('falls back to the rendered cards without the data', () => {
    const html =
      '<main><a href="/topic/recall"><div class="topic-list-item__ItemTitle-sc">大罷免全紀錄</div></a><a href="/topic/ x">壞連結</a></main>';
    expect(mirrorTopics(html, rule('mirror')).map((t) => t.title)).toEqual(['大罷免全紀錄']);
  });
});

describe('鏡報', () => {
  it('reads the homepage strip as a second 議題 listing', () => {
    const home = listing('mirrordaily', 'https://www.mirrordaily.news/');
    const html = `<a class="flex" href="/topic/kao"><img src="/images-next/loading.gif" alt="topic 首圖"><span class="font-bold">柯文哲二審</span></a>
      <a href="/topic">看所有專題</a><a href="/story/1">新聞</a>`;
    expect(extractTopics(html, home)).toEqual([
      { url: 'https://www.mirrordaily.news/topic/kao', title: '柯文哲二審', image: null, category: null },
    ]);
    expect(home.kind).toBe('topic');
  });
});

import { describe, expect, it } from 'vitest';
import { mirrorTopics } from './topic-extractors-b1.ts';
import { TOPIC_RULES } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;

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

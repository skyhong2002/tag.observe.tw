import { describe, expect, it } from 'vitest';
import { mirrorTopics, twreporterTopics } from './topic-extractors-b1.ts';
import { extractTopics, fetchTopicListings, TOPIC_RULES, topicListings } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const listing = (media: string, url: string) => topicListings(rule(media)).find((l) => l.url === url)!;
const response = (url: string, body: string, status = 200) => ({ url, body, status, contentType: 'text/html', ms: 1 });

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

describe('報導者', () => {
  it('reads topics from its API and pages by offset', async () => {
    const page = (records: object[]) => JSON.stringify({ data: { meta: { total: 3 }, records } });
    const urls: string[] = [];
    const result = await fetchTopicListings(rule('twreporter'), async (url) => {
      urls.push(url);
      const offset = Number(new URL(url).searchParams.get('offset'));
      if (offset === 0)
        return response(
          url,
          page([
            {
              slug: 'age-of-disconnection',
              title: '無人知曉的死亡',
              og_image: { resized_targets: { mobile: { url: 'https://www.twreporter.org/images/a-mobile.jpg' } } },
            },
            { slug: 'english-version', title: 'The Reporter English Edition' },
          ]),
        );
      return response(url, page(offset === 100 ? [{ slug: 'refinery-content', title: '高雄不可承受之「輕」' }] : []));
    });
    expect(urls).toEqual([
      'https://go-api.twreporter.org/v2/topics?offset=0&limit=100',
      'https://go-api.twreporter.org/v2/topics?offset=100&limit=100',
      'https://go-api.twreporter.org/v2/topics?offset=200&limit=100',
    ]);
    expect(result.items.map((t) => [t.url, t.page])).toEqual([
      ['https://www.twreporter.org/topics/age-of-disconnection', 1],
      ['https://www.twreporter.org/topics/english-version', 1],
      ['https://www.twreporter.org/topics/refinery-content', 2],
    ]);
    expect(result.items[0].image).toBe('https://www.twreporter.org/images/a-mobile.jpg');
  });

  it('skips records without a slug or title', () => {
    expect(twreporterTopics(JSON.stringify({ data: { records: [{ slug: '', title: 'x' }, { slug: 'a' }] } }), rule('twreporter'))).toEqual(
      [],
    );
  });
});

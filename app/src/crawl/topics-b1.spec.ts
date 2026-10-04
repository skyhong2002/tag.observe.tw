import { describe, expect, it } from 'vitest';
import type { FetchRequest } from './fetch.ts';
import { cwNavTopics, insideFeatures, mirrorTopics, nownewsTopicGroups, taisoundsTopics, twreporterTopics } from './topic-extractors-b1.ts';
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

describe('CTWANT', () => {
  it('pages the 議題 list and reads the 永續 menu packages as 專題', () => {
    const r = rule('ctwant');
    expect(r.kind).toBe('topic');
    expect(r.paginate?.url(3)).toBe('https://www.ctwant.com/topic/?page=3');
    const nav = listing('ctwant', 'https://www.ctwant.com/');
    const html = `<ul><li class="m-navbar__list__item">
            永續
            <div class="m-navbar__arrow"></div><ul class="m-navbar__subnav"><li><a href="/topic/42/" class="m-navbar__subnav__item"><span>
                    論壇
                  </span></a></li><li><a href="/category/x/">新聞</a></li></ul></li></ul>
      <div class="p-topic__list"><a href="/topic/287/">陳幸妤驚傳婚變</a></div>`;
    expect(extractTopics(html, nav)).toEqual([{ url: 'https://www.ctwant.com/topic/42/', title: '永續論壇', image: null, category: null }]);
    expect(nav.kind).toBe('feature');
  });
});

describe('太報', () => {
  it('reads the HTML first page and the JSON "more" pages, POSTing for the latter', async () => {
    const requests: [string, FetchRequest][] = [];
    const card = (id: number, title: string) => `<li><a href="/special/plan/${id}"><img src="/p${id}.jpg"><h4>${title}</h4></a></li>`;
    const plan = listing('taisounds', 'https://www.taisounds.com/special/planlist');
    const result = await fetchTopicListings({ ...rule('taisounds'), ...plan, listings: [] }, async (url, opts = {}) => {
      requests.push([url, { method: opts.method }]);
      if (url.endsWith('/planlist')) return response(url, `<ul id="ulnewslist">${card(195, '決戰九合一大選')}</ul>`);
      const n = Number(new URL(url).searchParams.get('page'));
      return response(url, JSON.stringify({ htmlString: n === 2 ? card(116, '舊企劃') : '', NomoreData: n > 2 }));
    });
    expect(result.items.map((t) => [t.title, t.kind, t.page])).toEqual([
      ['決戰九合一大選', 'topic', 1],
      ['舊企劃', 'topic', 2],
    ]);
    expect(requests).toEqual([
      ['https://www.taisounds.com/special/planlist', { method: undefined }],
      ['https://www.taisounds.com/more/infinateplan?page=2', { method: 'POST' }],
      ['https://www.taisounds.com/more/infinateplan?page=3', { method: 'POST' }],
    ]);
  });

  it('declares 主題報導 專題', () => {
    expect(rule('taisounds').kind).toBe('feature');
    expect(taisoundsTopics('{"htmlString":"<a href=\\"/special/topic/9\\"><h4>主題</h4></a>"}', rule('taisounds'))[0].url).toBe(
      'https://www.taisounds.com/special/topic/9',
    );
  });
});

describe('上報', () => {
  it('skips hub pages and the menu label, keeping the card name', () => {
    const html = `<a class="dropdown-item" href="/tw/project/project-0041" title="特別企劃">特別企劃</a>
      <a class="nav-link" href="/tw/project/project-0077">名古屋亞運</a>
      <a href="/tw/project/special-plan">特別企劃</a><a href="/tw/project/10th-anniversary-highlights">10週年精選回顧</a>
      <div class="media"><h4><a href="/tw/project/project-0041" class="pic">2026房產價值藍圖</a></h4></div>`;
    expect(extractTopics(html, rule('upmedia')).map((t) => [t.url.split('/').pop(), t.title])).toEqual([
      ['project-0077', '名古屋亞運'],
      ['project-0041', '2026房產價值藍圖'],
    ]);
  });
});

describe('遠見', () => {
  it('keeps four-digit topic IDs and reads 特刊 from /magazine', () => {
    const html =
      '<ul class="info-cards"><li><a href="/topic/2367"><p class="info-cards_title">友善職場</p></a></li><li><a href="/topic/20251230"><p class="info-cards_title">壞</p></a></li></ul>';
    expect(extractTopics(html, rule('gvm')).map((t) => t.url)).toEqual(['https://www.gvm.com.tw/topic/2367']);
    const mag = listing('gvm', 'https://www.gvm.com.tw/magazine');
    const issues = `<a href="https://www.gvm.com.tw/magazine/published/1170" title="紅不讓經濟學"><p>477期</p></a>
      <a href="https://www.gvm.com.tw/magazine/special/1172" title="星雲大師百年光輝"><img data-src="https://imgs.gvm.com.tw/a.jpg"><p>2026 年 03 月特刊</p></a>`;
    expect(extractTopics(issues, mag)).toEqual([
      {
        url: 'https://www.gvm.com.tw/magazine/special/1172',
        title: '星雲大師百年光輝',
        image: 'https://imgs.gvm.com.tw/a.jpg',
        category: null,
      },
    ]);
  });
});

describe('天下', () => {
  it('reads old /special/ packages and marks 廣告專輯 sponsored', async () => {
    const page1 = `<div class="articleGroup"><section class="article"><a href="https://www.cw.com.tw/feature/transformers/2026hoya"></a><h3>HOYA</h3></section>
      <section class="article"><a href="https://www.cw.com.tw/feature/event/2026biomed"></a><h3>生醫</h3></section></div>`;
    const page2 = `<div class="articleGroup"><section class="article"><a href="https://www.cw.com.tw/special/2521"></a><h3>2020要來了</h3></section></div>`;
    const result = await fetchTopicListings({ ...rule('cw'), listings: [] }, async (url) =>
      response(url, url.endsWith('page=2') ? page2 : url.includes('page=') ? '<div class="articleGroup"></div>' : page1),
    );
    expect(result.items.map((t) => [t.title, t.kind, !!t.sponsored])).toEqual([
      ['HOYA', 'feature', true],
      ['生醫', 'feature', false],
      ['2020要來了', 'feature', false],
    ]);
  });

  it('takes the podcast from the menu as a 議題', () => {
    const nav = listing('cw', 'https://www.cw.com.tw/');
    const html = `<a href="https://www.cw.com.tw/feature/topic/CW-podcast">天下Podcast</a>
      <a href="https://www.cw.com.tw/feature/topic/aging-special-jp?utm_source=cw_web">開站專題</a>`;
    expect(cwNavTopics(html, nav).map((t) => [t.url, t.kind])).toEqual([
      ['https://www.cw.com.tw/feature/topic/CW-podcast', 'topic'],
      ['https://www.cw.com.tw/feature/topic/aging-special-jp', undefined],
    ]);
  });
});

describe('Inside', () => {
  it('marks SPONSORED cards and reads the podcast as a 議題', () => {
    const card = (slug: string, title: string, extra = '', label = '自製專題') =>
      `<div class="post_list_item"><a class="post_cover" href="https://www.inside.com.tw/feature/${slug}"><img src="https://img.example/${slug}.jpg">${extra}</a>
        <div class="post_list_item_content"><h3 class="post_title"><a href="https://www.inside.com.tw/feature/${slug}">${title}</a></h3><h4>${label}</h4></div></div>`;
    const html = `<a class="primary_nav_child_item" href="https://www.inside.com.tw/feature/aws-tw">雲端服務趨勢</a>
      <div class="post_list">${card('side-chat', '塞掐 Side Chat：最科技的Podcast節目')}${card(
        'ntpc2025',
        '新北青年進行式',
        '<div class="sponsored_label left top">SPONSORED</div>',
        '贊助專題 Supported By',
      )}${card('energy-crisis', '能源焦慮')}</div>`;
    expect(insideFeatures(html, rule('inside')).map((t) => [t.url.split('/').pop(), t.kind, t.sponsored, t.category])).toEqual([
      ['side-chat', 'topic', false, '自製專題'],
      ['ntpc2025', undefined, true, '贊助專題 Supported By'],
      ['energy-crisis', undefined, false, '自製專題'],
    ]);
  });
});

describe('NOWnews', () => {
  it('reads each 重磅追蹤 series with its first story as the link', () => {
    const html = `<div class="listBlk heavy-topics" id="tg1"><header class="header"><h3 class="title">月餅風暴</h3></header>
      <div class="first"><a href="https://www.nownews.com/news/6874691"><img src="https://media.nownews.com/a.webp"><h3 class="title">月餅風暴1／…</h3></a></div>
      <div class="card"><a href="https://www.nownews.com/news/6874698"><h3 class="title">月餅風暴2／…</h3></a></div></div>
      <div class="listBlk heavy-topics" id="tg2"><header class="header"><h3 class="title">外站</h3></header><a href="https://evil.example/news/1">x</a></div>`;
    expect(nownewsTopicGroups(html, listing('nownews', 'https://www.nownews.com/topicgroup/'))).toEqual([
      { url: 'https://www.nownews.com/news/6874691', title: '月餅風暴', image: 'https://media.nownews.com/a.webp', category: null },
    ]);
  });
});

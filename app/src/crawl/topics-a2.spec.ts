import { describe, expect, it } from 'vitest';
import { extractTopics, fetchTopicListings, TOPIC_RULES, type TopicRule, topicListings } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const listing = (media: string, url: string): TopicRule => topicListings(rule(media)).find((l) => l.url === url)!;
const run = (r: TopicRule, html: string) => (r.extract ?? extractTopics)(html, r);

describe('batch a2 topic rules', () => {
  it('TVBS: homepage chips yield event microsites, not stories or short links', () => {
    const home = listing('tvbs', 'https://news.tvbs.com.tw/');
    const html = `<a href="https://tvbs.to/9lqum4">颱風動態持續更新</a>
      <a href="https://news.tvbs.com.tw/events/asiangames-2026">2026亞運獎牌榜</a>
      <a href="https://news.tvbs.com.tw/exhibition/ai-trends-2026/index.html">看見AI 2026</a>
      <a href="https://news.tvbs.com.tw/life/4003201">單篇</a>`;
    expect(run(home, html).map((t) => t.url)).toEqual([
      'https://news.tvbs.com.tw/events/asiangames-2026',
      'https://news.tvbs.com.tw/exhibition/ai-trends-2026/index.html',
    ]);
    expect(home.kind).toBe('feature');
    expect(topicListings(rule('tvbs')).filter((l) => /\/topics\b/.test(l.url))).toHaveLength(14);
  });

  it('三立: klist feeds are 議題, projects stay auto, carousel titles skip the description', () => {
    const html = `<div class="feature_item"><a href="https://www.setn.com/project/10822" aria-label="島嶼解方">
        <img src="/a.jpg"><div class="feature_title">島嶼解方</div><div class="feature_desc">三立新聞全新調查報導節目</div></a></div>
      <a href="/klist/0/10839"><div class="title">115年國慶大會</div></a>
      <a href="/news/123">單篇</a>`;
    expect(run(rule('setn'), html).map((t) => [t.url, t.title, t.kind])).toEqual([
      ['https://www.setn.com/project/10822', '島嶼解方', undefined],
      ['https://www.setn.com/klist/0/10839', '115年國慶大會', 'topic'],
    ]);
    expect(rule('setn').paginate?.url(2)).toBe('https://www.setn.com/Plist.aspx?p=2');
  });

  it('ETtoday: main feature list plus sidebar promos as 合作; homepage nav microsites', () => {
    const html = `<div class="part_pictxt_2"><div class="box_0"><h3><a href="//www.ettoday.net/feature/地震">地震新聞報導</a></h3></div></div>
      <div id="hot-events"><div class="part_pictxt_1"><div class="box_0">
        <h3><a ref="nofollow" href="https://star.ettoday.net/news/3235768">抽門票</a></h3></div>
        <div class="box_0"><h3><a ref="nofollow" href="https://www.ettoday.net/feature/2021house">買房不踩雷</a></h3></div></div></div>`;
    expect(run(rule('ettoday'), html).map((t) => [t.title, !!t.sponsored])).toEqual([
      ['地震新聞報導', false],
      ['買房不踩雷', true],
    ]);
    const home = listing('ettoday', 'https://www.ettoday.net/');
    const nav = `<div class="nav_1_v4"><ul class="piece">
      <li class="btn style_1"><a href="https://www.ettoday.net/events/election2026/index.php7?utm_source=ettoday_PC">2026大選</a></li>
      <li class="btn style_1"><a href="https://www.ettoday.net/news/news-list.htm">最新</a></li>
      <li class="btn"><a href="https://events.ettoday.net/yummy2023/index.php7">美食</a></li></ul></div>`;
    expect(run(home, nav).map((t) => t.url)).toEqual(['https://www.ettoday.net/events/election2026/index.php7']);
  });

  it("華視: topics carry their listed articles' publish times as story dates", () => {
    const data = [
      { topic: 1, banner: 7 },
      { title: 2, link: 3, thumbImageUrl: 4, articles: 5 },
      '鈔錢部署',
      '/topic/af8ba945-053d-4953-b533-d8af17ea5536',
      'https://www.cts.com.tw/a.webp',
      [6],
      { title: 2, link: 9, publishTime: 10 },
      { title: 8, imageUrl: 4, link: 11 },
      '2026亞運看華視',
      '/cts/money/202609/202609043075126.html',
      '2026-09-04 16:57:00',
      'https://event.cts.com.tw/2026asiangames/',
    ];
    const html = `<script id="__NUXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
    expect(run(rule('cts'), html)).toEqual([
      {
        url: 'https://news.cts.com.tw/topic/af8ba945-053d-4953-b533-d8af17ea5536',
        title: '鈔錢部署',
        image: 'https://www.cts.com.tw/a.webp',
        category: null,
        storyDates: [new Date('2026-09-04T08:57:00Z')],
      },
      { url: 'https://event.cts.com.tw/2026asiangames/', title: '2026亞運看華視', image: 'https://www.cts.com.tw/a.webp', category: null },
    ]);
  });

  it('民視: /index2 microsite links are normalised; filename-alt banners skipped; /topic/ blocks are 議題', () => {
    const html = `<a href="https://topic.ftvnews.com.tw/2026election/index2?utm_source=ftvnews"><img src="/b.jpg" alt="9in1"></a>
      <li><a href="https://topic.ftvnews.com.tw/FormosaTeamVictor2026/index2">名古屋亞運</a></li>
      <div><div class="tw-font-bold">洋流拼萬安</div><a href="/topic/yangliu2026/">更多</a></div>`;
    expect(run(rule('ftv'), html).map((t) => [t.url, t.title, t.kind])).toEqual([
      ['https://topic.ftvnews.com.tw/FormosaTeamVictor2026', '名古屋亞運', undefined],
      ['https://www.ftvnews.com.tw/topic/yangliu2026/', '洋流拼萬安', 'topic'],
    ]);
  });

  it('台視: series names with spaces are encoded instead of dropped', () => {
    const html = `<ul class="project-list"><li><a href ='/Proj/台視60  璀璨年代'><h2>台視60  璀璨非凡</h2></a></li>
      <li><a href='/Proj/熱線追蹤'><h2>【熱線追蹤】</h2></a></li></ul>`;
    expect(run(rule('ttv'), html).map((t) => [t.url, t.title])).toEqual([
      ['https://news.ttv.com.tw/Proj/%E5%8F%B0%E8%A6%9660%20%20%E7%92%80%E7%92%A8%E5%B9%B4%E4%BB%A3', '台視60 璀璨非凡'],
      ['https://news.ttv.com.tw/Proj/%E7%86%B1%E7%B7%9A%E8%BF%BD%E8%B9%A4', '【熱線追蹤】'],
    ]);
  });

  it('中時: album links lose ?ctrack/?chdtv and the space-padded duplicate; brand packages are 合作', async () => {
    const html = `<a href="https://www.chinatimes.com/album/Blackie/20260916003318-262207?chdtv"><h3>黑人</h3></a>
      <a href="https://www.chinatimes.com/album/MemberArticles2026/20260623002017-262201?ctrack=mo_main_search_p01">會員文章專區</a>
      <a href="https://www.chinatimes.com/album/ Trump-Xi-Washington/20260923004085-262203">川習</a>
      <a href="//www.chinatimes.com/album/ctnewyearA/20221220002148-262211">寶島旺旺行</a>
      <a href="//www.chinatimes.com/album/album-star/">專輯</a>`;
    const fetch = async (url: string) => ({ url, status: url.includes('album') ? 200 : 404, body: html, contentType: 'text/html', ms: 1 });
    const { items } = await fetchTopicListings({ ...rule('chinatimes'), paginate: undefined, listings: [] }, fetch);
    expect(items.map((t) => [t.url, !!t.sponsored])).toEqual([
      ['https://www.chinatimes.com/album/Blackie/20260916003318-262207', false],
      ['https://www.chinatimes.com/album/MemberArticles2026/20260623002017-262201', false],
      ['https://www.chinatimes.com/album/ctnewyearA/20221220002148-262211', true],
    ]);
  });

  it('newtalk: every page, the first included, is requested with the layout cookie', async () => {
    const seen: { url: string; cookie?: string }[] = [];
    const fetch = async (url: string, opts: { headers?: Record<string, string> } = {}) => {
      seen.push({ url, cookie: opts.headers?.cookie });
      const n = Number(/\/(\d+)$/.exec(url)?.[1] ?? 1);
      const body = n <= 2 ? `<a href="/news/topics/view/${n}/議題${n}">x</a>` : '';
      return { url, status: n <= 2 ? 200 : 404, body, contentType: 'text/html', ms: 1 };
    };
    const { items, sources } = await fetchTopicListings(rule('newtalk'), fetch);
    expect(items.map((t) => [t.title, t.kind, t.page])).toEqual([
      ['議題1', 'topic', 1],
      ['議題2', 'topic', 2],
    ]);
    expect(sources[0].pages).toBe(2);
    expect(seen.map((s) => s.cookie)).toEqual(Array(3).fill('canary_id=0; canary_version=new'));
  });
});

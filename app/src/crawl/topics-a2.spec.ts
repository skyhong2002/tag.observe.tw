import { describe, expect, it } from 'vitest';
import { extractTopics, TOPIC_RULES, type TopicRule, topicListings } from './topics.ts';

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
});

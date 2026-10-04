import { describe, expect, it } from 'vitest';
import { childSelectorFor, extractTopics, fetchTopicListings, TOPIC_RULES, topicListings } from './topics.ts';

const ruleOf = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const response = (url: string, body: string, status = 200) => ({ url, body, status, contentType: 'text/html', ms: 1 });

describe('CNA 新聞專題', () => {
  const api = 'https://www.cna.com.tw/cna2018api/api/WNewsList';
  const html = `<a href="https://netzero.cna.com.tw/">淨零碳排</a><a href="https://academy.cna.com.tw/">新聞學院</a>
    <ul id="jsMainList"><li><a href="/topic/newstopic/5056.aspx"><img data-src="https://img/5056.jpg"><h2><span>2026九合一選舉</span></h2></a></li>
    <li><a href="https://netzero.cna.com.tw"><h2><span>淨零碳排</span></h2></a></li>
    <li><a href="/news/aipl/202610040066.aspx"><h2><span>一則新聞</span></h2></a></li></ul>`;
  const page = (items: object[], next: string) => JSON.stringify({ Result: 'Y', ResultData: { NextPageIdx: next, Items: items } });

  it('reads the HTML list, then pages through the WNewsList API by POST', async () => {
    const calls: [string, string | undefined, string | undefined][] = [];
    const bodies = [
      html,
      page(
        [
          { PageUrl: 'https://www.cna.com.tw/topic/newstopic/4655.aspx', HeadLine: '川普關稅戰', ImageM: 'https://img/4655.jpg' },
          { PageUrl: 'https://www.cna.com.tw/news/aipl/1.aspx', HeadLine: '新聞' },
          { PageUrl: 'https://other.example/topic/newstopic/1.aspx', HeadLine: '外站' },
        ],
        '3',
      ),
      page([], ''),
    ];
    const result = await fetchTopicListings(ruleOf('cna'), async (url, opts) => {
      if (url.endsWith('.json')) return response(url, '{"NewsItems":[]}');
      calls.push([url, opts?.method, opts?.body]);
      return response(url, bodies[calls.length - 1]);
    });
    expect(calls.map(([url, method]) => [url, method])).toEqual([
      ['https://www.cna.com.tw/list/newstopic.aspx', undefined],
      [api, 'POST'],
      [api, 'POST'],
    ]);
    expect(JSON.parse(calls[1][2]!)).toEqual({ action: '0', category: 'newstopic', pagesize: '20', pageidx: 2 });
    expect(result.items.map((t) => [t.title, t.url, t.kind, t.page, t.image])).toEqual([
      ['2026九合一選舉', 'https://www.cna.com.tw/topic/newstopic/5056.aspx', 'topic', 1, 'https://img/5056.jpg'],
      ['淨零碳排', 'https://netzero.cna.com.tw/', 'topic', 1, null],
      ['川普關稅戰', 'https://www.cna.com.tw/topic/newstopic/4655.aspx', 'topic', 2, 'https://img/4655.jpg'],
    ]);
    expect(result.sources[0]).toMatchObject({ url: 'https://www.cna.com.tw/list/newstopic.aspx', kind: 'topic', items: 3, pages: 2 });
  });

  it('reads sub-topics on its topic pages', () => {
    expect(childSelectorFor('cna', 'https://www.cna.com.tw/topic/newstopic/5056.aspx')).toBe('.definKind h2 a');
    expect(childSelectorFor('cna', 'https://www.cna.com.tw/project/20260430-danjiang-bridge/')).toBeUndefined();
  });
});

describe('PTS', () => {
  it('pages through hotTopic and curation', () => {
    const [hot, curation] = topicListings(ruleOf('pts'));
    expect(hot.paginate?.url(2)).toBe('https://news.pts.org.tw/hotTopic?page=2');
    expect(hot.paginate?.max).toBeGreaterThanOrEqual(49);
    expect(curation.paginate?.url(3)).toBe('https://news.pts.org.tw/curation?page=3');
  });

  it('reads 新聞實驗室 projects and microsites as features, covers from the card', () => {
    const newslab = topicListings(ruleOf('pts'))[2];
    const html = `<nav><a href="/topic">數位敘事</a><a href="https://news.pts.org.tw/member/question/be_a_reporter">成為記者</a></nav>
      <div class="block md:flex"><div><a href="https://news.pts.org.tw/presentation/a"><img src="https://img/a.jpg" alt="甲專題"></a>
        <a href="https://news.pts.org.tw/presentation/a"><h2>甲專題</h2></a></div>
        <div><a href="https://news.pts.org.tw/presentation/b"><img src="https://img/b.jpg" alt="乙專題"></a>
        <a href="https://news.pts.org.tw/presentation/b"><h2>乙專題</h2></a></div></div>
      <div class="border"><div><a href="https://news.pts.org.tw/projects/x/?utm_source=ptsnews"><img src="https://img/x.jpg" alt></a></div>
        <div><a href="https://news.pts.org.tw/projects/x/?utm_source=ptsnews"><h3>丙專題</h3></a></div></div>
      <div class="border"><a href="https://newmedia.pts.org.tw/strike/"><h3>罷工</h3></a></div>
      <div class="border"><a href="https://drunk-drive.pts.org.tw/"><h3>酒駕</h3></a></div>
      <div class="border"><a href="https://news.pts.org.tw/live/62c7a68b"><h3>安倍晉三遇刺</h3></a></div>
      <a href="https://www.youtube.com/@x">YouTube</a><a href="https://news.pts.org.tw/article/1">一則新聞</a>`;
    const items = extractTopics(html, { ...newslab, media: 'pts', fallbackImage: '' });
    expect(items.map((t) => [t.title, t.url, t.image])).toEqual([
      ['甲專題', 'https://news.pts.org.tw/presentation/a', 'https://img/a.jpg'],
      ['乙專題', 'https://news.pts.org.tw/presentation/b', 'https://img/b.jpg'],
      ['丙專題', 'https://news.pts.org.tw/projects/x/', 'https://img/x.jpg'],
      ['罷工', 'https://newmedia.pts.org.tw/strike/', null],
      ['酒駕', 'https://drunk-drive.pts.org.tw/', null],
      ['安倍晉三遇刺', 'https://news.pts.org.tw/live/62c7a68b', null],
    ]);
    expect(newslab.kind).toBe('feature');
  });
});

describe('UDN', () => {
  it('marks topic.udn.com/event/ packages on udn.com/topic/index as features', () => {
    const index = topicListings(ruleOf('udn'))[1];
    const html = `<div class="story-list__news"><a href="https://topic.udn.com/event/2025_0331"><img src="https://img/1.jpg"></a>
      <h3><a href="https://topic.udn.com/event/2025_0331">優人物／李依錫</a></h3></div>
      <div class="story-list__news"><h3><a href="https://topic.udn.com/newstopic/2026AAA">2026 AAA</a></h3></div>`;
    expect(index.extract!(html, { ...index, media: 'udn', fallbackImage: '' }).map((t) => [t.title, t.kind, t.image])).toEqual([
      ['優人物／李依錫', 'feature', 'https://img/1.jpg'],
      ['2026 AAA', undefined, null],
    ]);
  });

  it('reads 新媒體中心 posts by their title attribute', () => {
    const listings = topicListings(ruleOf('udn')).filter((l) => l.url.includes('/newmedia/'));
    expect(listings.map((l) => [l.url, l.kind])).toEqual([
      ['https://udn.com/newmedia/office/issue/', 'feature'],
      ['https://udn.com/newmedia/office/data/', 'feature'],
      ['https://udn.com/newmedia/office/interaction/', 'feature'],
    ]);
    const post = (url: string, title: string, img = url.split('/').filter(Boolean).pop()) => `<div class="page-post">
      <a href="${url}" class="page-post-cover-image" title="${title}">${title}<img data-src="https://img/${img}.jpg" src="https://media.giphy.com/x.gif"></a>
      <a class="page-post-topic" href="https://udn.com/newmedia/office/issue/">議題專題</a>
      <a href="${url}" class="page-post-title" title="${title}">${title}</a>
      <a href="${url}" class="page-post-desc" title="${title}">一段比標題長很多很多很多很多很多很多的摘要文字</a></div>`;
    const html = `<a href="https://vip.udn.com/newmedia/2025/nav">導覽</a><div class="page-posts">
      ${post('https://vip.udn.com/newmedia/2026/rage_on_threads/?utm_source=newmedia', '憤怒演算法', 'rage_on_threads')}
      ${post('https://vip.udn.com/event/newmedia_gambling', '賭債爆炸')}
      ${post('https://udn.com/upf/newmedia/2017_data/caregiver/index.html', '致照顧者')}
      ${post('https://udn.com/newmedia/921/', '921二十年')}
      <a href="https://udn.com/newmedia/office/tag/threads/">Threads</a></div>`;
    expect(extractTopics(html, { ...listings[0], media: 'udn', fallbackImage: '' }).map((t) => [t.title, t.url, t.image])).toEqual([
      ['憤怒演算法', 'https://vip.udn.com/newmedia/2026/rage_on_threads/', 'https://img/rage_on_threads.jpg'],
      ['賭債爆炸', 'https://vip.udn.com/event/newmedia_gambling', 'https://img/newmedia_gambling.jpg'],
      ['致照顧者', 'https://udn.com/upf/newmedia/2017_data/caregiver/index.html', 'https://img/index.html.jpg'],
      ['921二十年', 'https://udn.com/newmedia/921/', 'https://img/921.jpg'],
    ]);
  });
});

describe('LTN', () => {
  it('declares the homepage keyword bar as 議題 and 新聞事件簿 as auto', () => {
    const [home, events] = topicListings(ruleOf('ltn'));
    expect(home.kind).toBe('topic');
    expect(events.kind).toBeUndefined();
  });

  it('reads 專題專區 microsites on election./sports. hosts; yearless columns stay 議題', () => {
    const special = topicListings(ruleOf('ltn'))[2];
    const card = (url: string, title: string) => `<a href="${url}"><img src="https://img/x.jpg" alt="${title}"></a>`;
    const html = `<a href="https://sports.ltn.com.tw/">體育</a><div class="project">
      ${card('https://election.ltn.com.tw/2026/', '2026九合一選舉')}${card('https://sports.ltn.com.tw/wbc2026', '2026世界棒球經典賽')}
      ${card('https://features.ltn.com.tw/AST/2026', '115年大學分科測驗')}${card('https://features.ltn.com.tw/taiwanese', '每日一台語')}
      ${card('https://ec.ltn.com.tw/list/2026', '財經')}</div>`;
    expect(special.extract!(html, { ...special, media: 'ltn', fallbackImage: '' }).map((t) => [t.title, t.url, t.kind])).toEqual([
      ['2026九合一選舉', 'https://election.ltn.com.tw/2026/', undefined],
      ['2026世界棒球經典賽', 'https://sports.ltn.com.tw/wbc2026', undefined],
      ['115年大學分科測驗', 'https://features.ltn.com.tw/AST/2026', undefined],
      ['每日一台語', 'https://features.ltn.com.tw/taiwanese', 'topic'],
    ]);
    expect(special.kind).toBe('feature');
  });
});

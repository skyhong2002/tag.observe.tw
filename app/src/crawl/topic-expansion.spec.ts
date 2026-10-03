import { describe, expect, it } from 'vitest';
import { ettodayDigitalTopics, extractTopics, fetchTopicListings, TOPIC_RULES, topicListings } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const response = (url: string, body: string, status = 200) => ({ url, body, status, contentType: 'text/html', ms: 1 });

describe('expanded official topic indexes', () => {
  it('reads the live ETtoday CSV rather than the stale fallback embedded in its page', () => {
    const r = topicListings(rule('ettoday'))[1];
    const csv =
      '\uFEFF序號,年度,專題名稱,大圖,網址,簡介\r\n' +
      '2601,2026,"第一篇，含逗號",https://features.ettoday.net/one/cover.jpg,https://features.ettoday.net/one/,"跨行\r\n簡介"\r\n' +
      '2602,2026,"第二篇「""引號""」",https://features.ettoday.net/two/clip.mp4,https://features.ettoday.net/two/,描述\r\n' +
      '2603,2026,單篇新聞,,https://www.ettoday.net/news/123.htm,不收\r\n' +
      '2604,2026,外站,,https://evil.example/features.ettoday.net/one/,不收\r\n' +
      '2605,新聞小工具,工具,,https://features.ettoday.net/tool/,不收';
    expect(ettodayDigitalTopics(csv, r)).toEqual([
      { url: 'https://features.ettoday.net/two/', title: '第二篇「"引號"」', image: null, category: null },
      {
        url: 'https://features.ettoday.net/one/',
        title: '第一篇，含逗號',
        image: 'https://features.ettoday.net/one/cover.jpg',
        category: null,
      },
    ]);
  });

  it('reports changed or broken sheet formats instead of silently accepting an empty success', () => {
    const r = topicListings(rule('ettoday'))[1];
    expect(() => ettodayDigitalTopics('<html>Unavailable</html>', r)).toThrow('columns');
    expect(() => ettodayDigitalTopics('序號,年度,專題名稱,網址\n1,2026,"unfinished', r)).toThrow('Unterminated');
  });

  it('reads TNL feature cards but excludes the stories inside those features', () => {
    const html = `<nav><a href="https://www.thenewslens.com/feature/old">導覽</a></nav>
      <div class="item-content"><a href="https://www.thenewslens.com/feature/new"><img src="/cover.jpg" alt="banner_filename"></a>
      <h3><a href="https://www.thenewslens.com/feature/new">新專題</a></h3>
      <h4><a href="https://www.thenewslens.com/feature/new/123">單篇新聞</a></h4></div>`;
    expect(extractTopics(html, rule('tnl'))).toEqual([
      { url: 'https://www.thenewslens.com/feature/new', title: '新專題', image: 'https://www.thenewslens.com/cover.jpg', category: null },
    ]);
  });

  it('collects the TechNews list below its hero, without pulling sidebar news or tags', () => {
    const html = `<div id="content"><li class="carousel-banner_item"><a href="/hero/"><h1>主打專題</h1><p>摘要</p></a></li>
      <div class="column_list_item_wrapper"><h2><a href="/new-series/">最新系列</a></h2>
      <div><a href="/new-series/"><img src="/cover.jpg"></a></div><a href="/new-series/">閱讀更多</a></div>
      <aside><a href="/sidebar/">側欄新聞</a></aside></div><nav><a href="/nav-topic/">導覽</a></nav>`;
    const items = extractTopics(html, rule('technews'));
    expect(items.map((t) => t.title)).toEqual(['主打專題', '最新系列']);
    expect(items[1].image).toBe('https://technews.tw/cover.jpg');
  });

  it('uses Initium curated series cards, not general tags in navigation or article links', () => {
    const html = `<nav><a href="https://theinitium.com/tag/politics/">政治</a></nav>
      <main><div class="border"><a href="https://theinitium.com/tag/series/"><img src="/cover.jpg"></a>
      <h4><a href="https://theinitium.com/tag/series/">調查系列</a></h4><a href="https://theinitium.com/tag/series/">所有文章</a></div>
      <a href="/20261003-story/">文章</a></main>`;
    expect(extractTopics(html, rule('theinitium')).map((t) => t.title)).toEqual(['調查系列']);
  });

  it('distinguishes topic pages from category indexes, pagers and ordinary articles', () => {
    const cases = [
      [
        'chinatimes',
        '<a href="/album/global/">國際專輯</a><a href="/album/event/20261003001234-262203">新聞專輯</a><a href="/realtimenews/20261003001234-260407">新聞</a>',
        ['新聞專輯'],
      ],
      ['ttv', '<a href="/Projs/2">下一頁</a><a href="/Proj/議題"><h2>追蹤專題</h2></a><a href="/news/123">新聞</a>', ['追蹤專題']],
      [
        'ftnn',
        '<a href="/topic_index">專題</a><a href="/topic_page/30"><h3>新專題</h3><p>摘要</p></a><a href="/news/123">新聞</a>',
        ['新專題'],
      ],
      ['tvbs', '<a href="/topics">議題總覽</a><a href="/topics/local/2030">新議題</a><a href="/local/123">新聞</a>', ['新議題']],
    ] as const;
    for (const [media, html, expected] of cases) {
      const source = media === 'tvbs' ? topicListings(rule(media))[1] : rule(media);
      expect(
        extractTopics(html, source).map((t) => t.title),
        media,
      ).toEqual(expected);
    }
  });

  it('resolves official short links and deduplicates their final destinations', async () => {
    const r = rule('businesstoday');
    const html =
      '<div class="latest__side-slider"><a href="https://supr.link/new"><h4>新專題</h4></a><a href="https://www.businesstoday.com.tw/bt_topic/new/"><h4>新專題</h4></a></div>';
    const result = await fetchTopicListings(r, async (url) => {
      if (url === r.url) return response(url, html);
      if (url === 'https://supr.link/new')
        return response(url, '<a id="user-click-link" href="https://www.businesstoday.com.tw/bt_topic/new/?utm_source=home">繼續</a>');
      return response(url, '<h1>專題</h1>');
    });
    expect(result.items.map((t) => t.url)).toEqual(['https://www.businesstoday.com.tw/bt_topic/new/']);
    expect(result.sources.every((s) => !s.error)).toBe(true);
  });

  it('keeps healthy links and reports partial failure when a short link leaves the publisher', async () => {
    const r = rule('businesstoday');
    const fetched: string[] = [];
    const result = await fetchTopicListings(r, async (url) => {
      fetched.push(url);
      return url === r.url
        ? response(
            url,
            '<div class="latest__side-slider"><a href="https://supr.link/bad"><h4>錯誤</h4></a><a href="https://www.businesstoday.com.tw/bt_topic/good/"><h4>專題</h4></a></div>',
          )
        : response(url, '<a id="user-click-link" href="http://127.0.0.1/private">繼續</a>');
    });
    expect(result.items.map((t) => t.title)).toEqual(['專題']);
    expect(result.sources[0].error).toContain('left official outlet');
    expect(fetched).toEqual([r.url, 'https://supr.link/bad']);
  });
});

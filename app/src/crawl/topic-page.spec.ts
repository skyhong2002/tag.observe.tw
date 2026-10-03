import { describe, expect, it } from 'vitest';
import { looksLikeStories, sharedTag, topicPageGroups, topicPageImage } from './topic-page.ts';

describe('topicPageGroups', () => {
  it('groups same-site links by container and drops nav, footer and other sites', () => {
    const html = `<nav><a href="/news/1">nav</a></nav>
      <div class="topic"><ul class="list"><li><a href="/news/10">a</a></li><li><a href="/news/11">b</a></li><li><a href="/news/12">c</a></li></ul></div>
      <div class="side"><ul class="latest"><li><a href="/news/20">x</a></li><li><a href="https://other.example/news/21">y</a></li></ul></div>
      <footer><a href="/about">about</a></footer>`;
    const groups = topicPageGroups(html, 'https://www.example.com.tw/topic/1');
    expect(groups[0].map((s) => s.key)).toEqual(['www.example.com.tw/news/10', 'www.example.com.tw/news/11', 'www.example.com.tw/news/12']);
    const keys = groups.flat().map((s) => s.key);
    expect(keys).not.toContain('www.example.com.tw/news/1');
    expect(keys).not.toContain('other.example/news/21');
  });
  it('keeps story links on the main host of a topic subdomain (topic.udn.com -> udn.com)', () => {
    const html = '<ul class="s"><li><a href="https://udn.com/news/story/6885/9781">教師離職潮延燒</a></li></ul>';
    expect(topicPageGroups(html, 'https://topic.udn.com/newstopic/2026edu')[0][0].key).toBe('udn.com/news/story/6885/9781');
  });
  it('takes the headline from the list item when the link wraps only a date (華視)', () => {
    const html =
      '<ul class="topic-article-grid"><li><h3>鈔錢部署／高股息ETF配息大戰</h3><a href="/cts/money/202609/202609043075126.html">2026-09-04 16:57</a></li></ul>';
    expect(topicPageGroups(html, 'https://news.cts.com.tw/topic/x')[0][0].title).toBe('鈔錢部署／高股息ETF配息大戰2026-09-04 16:57');
  });
});

describe('looksLikeStories', () => {
  it('accepts headline lists, not menus', () => {
    const s = (title: string) => ({ key: title, title });
    expect(looksLikeStories(['高股息ETF配息大戰誰勝出', '台股萬點行情的三個關鍵', '退休金怎麼存才夠用'].map(s))).toBe(true);
    expect(looksLikeStories(['首頁', '政治', '社會', '更多'].map(s))).toBe(false);
  });
});

describe('sharedTag', () => {
  const freq = (t: string) => ({ 中秋節: 400, 財運: 40, 淨零台灣: 6, 再生能源: 20, 行政院: 300, 美股: 90, 高雄: 500, 死亡: 200 })[t];
  it('takes a tag most of the stories share', () => {
    expect(sharedTag([['中秋節', '財運'], ['中秋節'], ['中秋節', '烤肉'], ['財運']], freq)).toBe('中秋節');
    expect(sharedTag([['淨零台灣', '再生能源'], ['淨零台灣']], freq)).toBe('淨零台灣');
  });
  it('returns null when the stories share nothing distinctive', () => {
    // A breaking-news sidebar mistaken for the topic list (太報), or a crime
    // topic whose stories only share places (東森 學弟刺學長).
    expect(sharedTag([['行政院'], ['美股'], ['行政院'], ['台指期'], ['通膨'], ['費半'], ['台積電'], ['大盤']], freq)).toBeNull();
    expect(sharedTag([['高雄', '死亡'], ['新北'], ['高雄'], ['中和', '死亡'], ['市場'], ['刀']], freq)).toBeNull();
  });
  it('needs half of the stories for a broad tag, and for a pair', () => {
    const f = (t: string) => ({ 台股: 736, 台積電: 426, 投資: 111, 醫師: 31, 名古屋亞運: 788 })[t];
    // 華視 鈔錢部署: 台股 in 4 of 12 stories is not the topic.
    const show = [['台股', '台積電'], ['台股'], ['台股', '投資'], ['台股'], ['台積電'], ['台積電'], ['投資'], ['投資'], [], [], [], []];
    expect(sharedTag(show, f)).toBeNull();
    expect(sharedTag([['醫師'], ['醫師'], [], [], []], f)).toBeNull();
    expect(sharedTag([['名古屋亞運'], ['名古屋亞運'], ['名古屋亞運'], []], f)).toBe('名古屋亞運');
  });
  it('ignores tags outside the vocabulary', () => {
    expect(sharedTag([['冷門詞'], ['冷門詞']], freq)).toBeNull();
  });
});

describe('topicPageImage', () => {
  it('resolves the share image against the page and unwraps css url()', () => {
    expect(topicPageImage('<meta property="og:image" content="//cdn.example.com/a.jpg">', 'https://www.example.com/topic/1')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(topicPageImage('<meta property="og:image" content="url(https://cdn.example.com/b.jpg">', 'https://www.example.com/')).toBe(
      'https://cdn.example.com/b.jpg',
    );
    expect(topicPageImage('<meta property="og:image" content="image/FB.jpg">', 'https://topic.example.com/book/')).toBe(
      'https://topic.example.com/book/image/FB.jpg',
    );
  });
  it('returns null without a usable image', () => {
    expect(topicPageImage('<meta property="og:image" content="data:image/png;base64,AAAA">', 'https://www.example.com/')).toBeNull();
    expect(topicPageImage('<title>x</title>', 'https://www.example.com/')).toBeNull();
  });
});

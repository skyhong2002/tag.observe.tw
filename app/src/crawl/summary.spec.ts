import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { parseFeed } from './feed.ts';
import { publisherSummary } from './summary.ts';

const body = '這是新聞正文的事實、訪談及完整說明。'.repeat(30);
describe('publisher summary metadata', () => {
  it('uses INSIDE editorial introduction before its description with appended tags', () => {
    const html = `<meta name="description" content="媒體提供的獨立導讀。#Google,影音 (story-slug)"><meta property="og:description" content="媒體提供的獨立導讀。"><div class="post_introduction">媒體提供的獨立導讀。</div><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', articleBody: body })}</script>`;
    expect(extractArticle(html, 'https://www.inside.com.tw/article/42585-story-slug')).toMatchObject({
      summary: '媒體提供的獨立導讀。',
      summarySource: 'article:selector',
      description: '媒體提供的獨立導讀。#Google,影音 (story-slug)',
      body,
    });
    expect(extractArticle(html, 'https://example.org/article/42585-story-slug')).toMatchObject({
      summary: '媒體提供的獨立導讀。#Google,影音 (story-slug)',
      summarySource: 'meta:description',
    });
    expect(
      extractArticle('<meta property="og:description" content="官方分享摘要">', 'https://www.inside.com.tw/article/42585-story-slug'),
    ).toMatchObject({
      summary: '官方分享摘要',
      summarySource: 'meta:og:description',
    });
  });
  it('prefers PTS editorial summary without changing its separately structured body', () => {
    const html = `<h1>原文標題</h1><meta name="description" content="搜尋引擎摘要"><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', articleBody: body })}</script><div class="post-article"><div class="articleimg">媒體編輯的摘要，與正文分開。</div></div>`;
    const detail = extractArticle(html, 'https://news.pts.org.tw/article/830328');
    expect(detail).toMatchObject({
      summary: '媒體編輯的摘要，與正文分開。',
      summarySource: 'article:selector',
      description: '搜尋引擎摘要',
      body,
    });
  });
  it('does not apply a publisher selector on another host', () => {
    const detail = extractArticle(
      '<meta name="description" content="官方 metadata 摘要"><div class="post-article"><div class="articleimg">圖片說明</div></div>',
      'https://example.org/article/1',
    );
    expect(detail).toMatchObject({ summary: '官方 metadata 摘要', summarySource: 'meta:description' });
  });
  it('uses the matching article abstract instead of a recommendation abstract', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'NewsArticle', url: 'https://example.org/other', abstract: '其他新聞摘要' },
        { '@type': 'NewsArticle', url: 'https://example.org/story', abstract: '本篇新聞摘要', articleBody: body },
      ],
    })}</script>`;
    expect(extractArticle(html, 'https://example.org/story')).toMatchObject({ summary: '本篇新聞摘要', summarySource: 'jsonld:abstract' });
  });
  it('labels description fallback and never synthesizes a summary from body prose', () => {
    expect(
      extractArticle(
        `<meta property="og:description" content="官方分享摘要"><article><p>${body}</p></article>`,
        'https://example.org/story',
      ),
    ).toMatchObject({ summary: '官方分享摘要', summarySource: 'meta:og:description' });
    expect(extractArticle(`<article><p>${body}</p></article>`, 'https://example.org/story')).toMatchObject({
      summary: null,
      summarySource: null,
    });
  });
  it('rejects title duplicates and full-text sized feed descriptions', () => {
    expect(publisherSummary('新聞標題', 'meta:description', '新聞標題').summary).toBeNull();
    expect(publisherSummary('文'.repeat(4001), 'feed:description').summary).toBeNull();
    expect(publisherSummary('摘要 &amp; 說明\n  第二句', 'meta:summary')).toEqual({
      summary: '摘要 & 說明 第二句',
      summarySource: 'meta:summary',
    });
  });
  it('skips verified site slogans and tries the article-specific social description', () => {
    const detail = extractArticle(
      '<meta name="description" content="lai賴傳媒新聞網追求公正、快速的新聞，讓讀者「看新聞就搜賴傳媒新聞網」。"><meta property="og:description" content="渣打銀行發布第4季展望，持續看好台灣股市。">',
      'https://lai-media.net/news_view.php?new_sn=145420',
    );
    expect(detail).toMatchObject({ summary: '渣打銀行發布第4季展望，持續看好台灣股市。', summarySource: 'meta:og:description' });
  });
  it('rejects whitespace-normalized headlines and standalone bylines', () => {
    expect(extractArticle('<h1>新聞　標題</h1><meta name="description" content="新聞 標題">', 'https://example.org/a').summary).toBeNull();
    expect(publisherSummary('【記者林文強/台北報導】', 'meta:description').summary).toBeNull();
    expect(publisherSummary('【大成報記者林瑞明/台北報導】...', 'meta:description').summary).toBeNull();
    expect(publisherSummary('【記者林文強/台北報導】…', 'meta:description').summary).toBeNull();
    expect(publisherSummary('文/ 金融消費中心', 'meta:description').summary).toBeNull();
    expect(publisherSummary('迷音 Miin — Let me in!', 'meta:description').summary).toBeNull();
    expect(publisherSummary('記者林文強報導這項公共政策的影響。', 'meta:description').summary).not.toBeNull();
    expect(publisherSummary('記者王丹荷／綜合報導 韓國樂團宣布再度來臺，將舉辦巡迴演唱會。', 'meta:description').summary).not.toBeNull();
  });
  it('rejects reviewed outlet-only and contributor-only descriptions without discarding prose', () => {
    for (const credit of ['淡江戰略研究所博士生 宋磊', '直轄市政府青年諮詢組織青年委員 風雨聲']) {
      expect(
        extractArticle(
          `<meta name="description" content="觀策站"><meta property="og:description" content="${credit}">`,
          'https://www.viewpointtaiwan.com/commentary/story',
        ),
      ).toMatchObject({ summary: null, summarySource: null });
    }
    expect(publisherSummary('(觀傳媒雲嘉南新聞)【記者 陳惲朋', 'meta:description').summary).toBeNull();
    const prose = '(觀傳媒花東新聞）【記者劉百瑞/台東報導】東海岸攝影學會舉辦聯展，邀請民眾參觀。';
    expect(publisherSummary(prose, 'meta:description').summary).toBe(prose);
    expect(publisherSummary('淡江戰略研究所博士生 宋磊分析區域情勢。', 'meta:description').summary).not.toBeNull();
  });
  it('rejects reviewed video promotion templates while retaining topical descriptions', () => {
    const prefix = '來源: 年代向錢看 , 文章內容並不代表本網立場和觀點。 ';
    const article = (text: string, host = 'www.bannedbook.org') =>
      extractArticle(`<meta property="og:description" content="${text}">`, `https://${host}/bnews/zh-tw/bannedvideo/20261007/2367547.html`);
    for (const text of [
      '【江峰優品】推出 **55 折大優惠**！',
      '#沈伯洋 #趙少康 #國民黨 「年代電視」是完全數位 […]',
      '八炯眼貼小舖連結：:https://baj […]',
    ]) {
      expect(article(prefix + text).summary).toBeNull();
      expect(article(prefix + text, 'example.org').summary).not.toBeNull();
    }
    const topic = prefix + '倒數52天!雙北大戰!藍綠對決!誰能催出關鍵基本盤? […]';
    expect(article(topic).summary).toBe(topic);
  });
  it('skips Bo News site description and preserves the article-specific social excerpt', () => {
    const html =
      '<meta name="description" content="波新聞秉持傳遞正向訊息、提升正向能量、波動良善之心、\n共同關懷弱勢、讓我們的社會更加祥和與美好。"><meta property="og:description" content="波新聞-林冬生/新竹 竹北水圳公園宣布舉辦藝文活動。">';
    expect(extractArticle(html, 'https://www.bo6s.com.tw/news/1')).toMatchObject({
      summary: '波新聞-林冬生/新竹 竹北水圳公園宣布舉辦藝文活動。',
      summarySource: 'meta:og:description',
    });
  });
  it('rejects GRI clipped credits and full-body descriptions while retaining actual excerpts', () => {
    const prose = '草根影響力新視野 王清厚 在 2026 年，地方政策引起討論。';
    const html = `<meta name="description" content="草根影響力新視野 王清厚 在 2026"><meta property="og:description" content="${prose}"><article><div class="post-content">${prose}</div></article>`;
    expect(extractArticle(html, 'https://grinews.com/news/story/').summary).toBeNull();
    expect(
      extractArticle(html.replace(`content="${prose}"`, 'content="地方政策引起討論。"'), 'https://grinews.com/news/story/').summary,
    ).toBe('地方政策引起討論。');
    expect(extractArticle(html, 'https://example.org/story/').summary).not.toBeNull();
  });
  it('rejects YesMedia image-caption descriptions without discarding article summaries', () => {
    const caption = '《圖說》侯友宜市長強調，八年306場行動治理成果，透過里長、區公所';
    const article = (text: string, host = 'www.yesmedia.com.tw') =>
      extractArticle(`<meta property="og:description" content="${text}">`, `https://${host}/story/`);
    expect(article(caption).summary).toBeNull();
    expect(article(caption, 'example.org').summary).toBe(caption);
    const actual = '新北市府推動行動治理，八年受理4401案，92.4%已解列。';
    expect(article(actual).summary).toBe(actual);
    expect(article('市長談到《圖說》的文字與新聞內容。').summary).not.toBeNull();
  });
  it('preserves RSS description and Atom summary provenance without using full Atom content', () => {
    const rss = parseFeed(
      '<rss><channel><item><title>標題</title><link>https://example.org/a</link><description>RSS摘要</description></item></channel></rss>',
    );
    expect(rss.items[0]).toMatchObject({ summary: 'RSS摘要', summarySource: 'feed:description' });
    const atom = parseFeed(
      '<feed><entry><title>標題</title><link href="https://example.org/a"/><summary>Atom摘要</summary><content>全文</content></entry></feed>',
    );
    expect(atom.items[0]).toMatchObject({ summary: 'Atom摘要', summarySource: 'feed:summary' });
    const noSummary = parseFeed(
      '<feed><entry><title>標題</title><link href="https://example.org/a"/><content>全文</content></entry></feed>',
    );
    expect(noSummary.items[0].summary).toBeNull();
  });
});

it('rejects descriptions that start with the actual article photo caption on reviewed partner sites', () => {
  const caption = '住宅發展工程處活動報名連結。（圖/記者廖妙茜翻攝）';
  const page = (description: string, host = 'www.yesmedia.com.tw') =>
    extractArticle(
      `<meta name="description" content="${description}"><article><figcaption>${caption}</figcaption></article>`,
      `https://${host}/story/`,
    );
  expect(page(caption + ' （觀傳媒中彰投新聞）【記者廖妙茜/台中報').summary).toBeNull();
  expect(page(caption, 'example.org').summary).toBe(caption);
  const topic = '活動將於十七日登場，居民可免費報名參加萬聖節闖關市集。';
  expect(page(caption + ' 商傳媒｜王小明／綜合外電報導 ' + topic).summary).toBe(topic);
  expect(page('住宅處將於十七日推出萬聖節活動。').summary).toBe('住宅處將於十七日推出萬聖節活動。');
  expect(page('本文提及照片，' + caption).summary).not.toBeNull();
});

it('rejects exact publisher names and clipped publisher-only credits without rejecting topic text', () => {
  expect(publisherSummary('台灣華報', 'meta:description').summary).toBeNull();
  expect(publisherSummary('【Lai傳媒、記者爆料網', 'meta:description').summary).toBeNull();
  expect(publisherSummary('【Lai傳媒、記者爆料網 金東天／台北報', 'meta:og:description').summary).toBeNull();
  expect(publisherSummary('台灣華報報導地方產業與觀光政策。', 'meta:description').summary).not.toBeNull();
  expect(publisherSummary('【Lai傳媒、記者爆料網 金東天／台北報導】地方政策正式公布。', 'meta:description').summary).not.toBeNull();
});

it('rejects the reviewed Kingtop social-description URL and headline template', () => {
  const html =
    '<meta name="description" content="台灣華報"><meta property="og:description" content="https://www.kingtop.com.tw/南華大學國際學術交流">';
  expect(extractArticle(html, 'https://www.kingtop.com.tw/detail/1').summary).toBeNull();
  expect(extractArticle(html, 'https://example.org/detail/1').summary).not.toBeNull();
  expect(
    extractArticle(
      html.replace('https://www.kingtop.com.tw/南華大學國際學術交流', '南華大學邀請波蘭學者探討民主價值與國際交流。'),
      'https://www.kingtop.com.tw/detail/1',
    ).summary,
  ).not.toBeNull();
});

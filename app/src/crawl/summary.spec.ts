import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { parseFeed } from './feed.ts';
import { publisherSummary } from './summary.ts';

const body = '這是新聞正文的事實、訪談及完整說明。'.repeat(30);
describe('publisher summary metadata', () => {
  it('rejects a 1111 caption-prefixed description cut inside the opening report paragraph', () => {
    const url = 'https://www.1111.com.tw/news/jobns/167722';
    const caption = '證交所公布年度招募計畫。（圖／1111人力銀行）';
    const clipped = '臺灣證券交易所啟動115年新進人員招募甄選，廣徵';
    const report = `${clipped}財會、企劃、法律及資訊專業人才，邀請具備相關能力的求職者加入。`;
    const copy = `<main><div class="yellow-white-bg"><center><img src="cover.jpg"></center><div>${caption}</div><div>${report}</div></div></main>`;
    expect(extractArticle(`<meta name="description" content="${caption} ${clipped}">${copy}`, url).summary).toBeNull();
    const independent = '本次招募提供財會、法律、資訊等多類職缺，歡迎專業人才申請';
    expect(extractArticle(`<meta name="description" content="${caption} ${independent}">${copy}`, url).summary).toBe(independent);
    expect(extractArticle(`<meta name="description" content="${caption} ${clipped}">${copy.replace(report, clipped)}`, url).summary).toBe(
      clipped,
    );
  });
  it('removes only an exact 1111 main image caption from publisher descriptions', () => {
    const url = 'https://www.1111.com.tw/news/jobns/167717';
    const caption = '團隊走進地方街區，以彩色裝置展現文化創意。（圖／大學提供）';
    const prose = '年度地方活動吸引多組團隊參與，師生沿著街道展示歷史與文化作品。';
    const copy = `<main><div class="yellow-white-bg"><center><img src="image.jpg"></center><div><span>${caption}</span></div><div>${prose}</div></div></main>`;
    expect(extractArticle(`<meta name="description" content="${caption} ${prose}">${copy}`, url)).toMatchObject({
      summary: prose,
      summarySource: 'meta:description',
    });
    expect(extractArticle(`<meta name="description" content="${caption}">${copy}`, url).summary).toBeNull();
    expect(
      extractArticle(
        `<meta name="description" content="${caption}">${copy.replace('<center>', '<div>').replace('</center>', '</div>')}`,
        url,
      ).summary,
    ).toBe(caption);
    expect(extractArticle(`<meta name="description" content="${caption}">${copy}`, 'https://example.com/report').summary).toBe(caption);
  });
  it('rejects the exact Nikkei site description while preserving an article description', () => {
    const slogan =
      '日经中文网官方网站。日经中文网是日本经济新闻社的中文财经网站。提供日本、中国、欧美财经金融信息、商务、企业、高科技报道、评论和专栏。';
    expect(publisherSummary(slogan, 'meta:description').summary).toBeNull();
    expect(publisherSummary('日本经济新闻社报道，日本公布最新经济政策。', 'meta:description').summary).not.toBeNull();
  });
  it('rejects TaipeiPost credit-only descriptions without treating article prose as a credit', () => {
    const url = 'https://taipeipost.org/397156/';
    for (const credit of ['編輯/鄭欣宜撰文', '生活中心/綜合報導']) {
      expect(extractArticle(`<meta name="description" content="${credit}">`, url).summary).toBeNull();
    }
    expect(extractArticle('<meta name="description" content="編輯/鄭欣宜撰文，介紹最新展覽與交通安排。">', url).summary).not.toBeNull();
    expect(extractArticle('<meta name="description" content="生活中心/綜合報導">', 'https://example.com/story').summary).not.toBeNull();
  });
  it('uses the Yahoo Japan pickup article description after rejecting a weather service credit', () => {
    const url = 'https://news.yahoo.co.jp/pickup/6596901';
    const summary = '地震が発生しました。今後の情報にご注意ください。各地域の震度はこちら。';
    const html = `<meta name="description" content="(Yahoo!天気・災害)"><meta property="og:description" content="(Yahoo!天気・災害)"><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url, description: summary })}</script>`;
    expect(extractArticle(html, url)).toMatchObject({ summary, summarySource: 'jsonld:description' });
    expect(extractArticle('<meta name="description" content="(Yahoo!天気・災害)">', url).summary).toBeNull();
    expect(extractArticle('<meta name="description" content="(Yahoo!天気・災害)">', 'https://example.com/article').summary).toBe(
      '(Yahoo!天気・災害)',
    );
    expect(extractArticle('<meta name="description" content="台風が接近しています。備えを確認してください。">', url).summarySource).toBe(
      'meta:description',
    );
  });
  it('excludes a matching own-title Taiwan Good News feed credit while preserving its supplied excerpt', () => {
    const title = '地方幼兒園正式啟用';
    const excerpt = '【記者 劉峻文／雲林 報導】為擴充公共化教保服務，地方幼兒園正式啟用。 [...]';
    const credit = `〈${title}〉這篇文章最早發佈於《台灣好報》。`;
    const rss = `<rss><channel><item><title>${title}</title><link>https://newstaiwan.net/?p=487121</link><description><![CDATA[<p>${excerpt}</p><p><a>${title ? `〈${title}〉` : ''}</a>這篇文章最早發佈於<a>《台灣好報》</a>。</p>]]></description></item></channel></rss>`;
    expect(parseFeed(rss).items[0]).toMatchObject({ summary: excerpt, summarySource: 'feed:description' });
    expect(publisherSummary(credit, 'feed:description', title)).toMatchObject({ summary: null, summarySource: null });
    expect(publisherSummary(excerpt + ' ' + credit, 'feed:description', '另一則新聞').summary).toContain(credit);
    expect(publisherSummary(excerpt + ' ' + credit, 'meta:description', title).summary).toContain(credit);
  });
  it('rejects an RSS description containing only its title and a continue-reading link', () => {
    const rss =
      '<rss><channel><item><title>地方活動　正式開幕</title><link>https://886.news/archives/365381</link><description><![CDATA[<p>地方活動　正式開幕</p><a href="https://886.news/archives/365381">繼續閱讀</a>]]></description></item></channel></rss>';
    expect(parseFeed(rss).items[0]).toMatchObject({ summary: null, summarySource: null });
    expect(publisherSummary('地方活動 正式開幕 繼續閱讀', 'feed:description', '地方活動　正式開幕').summary).toBeNull();
    expect(publisherSummary('地方活動正式開幕，主辦單位公布交通安排。繼續閱讀', 'feed:description', '地方活動正式開幕').summary).toBe(
      '地方活動正式開幕，主辦單位公布交通安排。繼續閱讀',
    );
    expect(publisherSummary('地方活動正式開幕繼續閱讀', 'feed:description', '另一篇新聞').summary).not.toBeNull();
  });
  it('rejects the shared FCLNews site promotion while preserving an article-specific fallback', () => {
    const slogan =
      '-台灣新聞雲報提供台灣最中立最公正最即時的各類型新聞報導，包括政治新聞、焦點新聞、社會新聞、國際新聞、地方新聞、娛樂新聞、科技新聞、專訪新聞、政黨新聞、藝文活動、美食推廣、體育賽事等相關新聞報導。歡迎各界好友踴躍贊助推廣。';
    expect(
      extractArticle(
        `<meta name="description" content="${slogan}"><meta property="og:description" content="${slogan}">`,
        'https://www.fclnews.com/230503/',
      ),
    ).toMatchObject({ summary: null, summarySource: null });
    expect(
      extractArticle(
        `<meta name="description" content="${slogan}"><meta property="og:description" content="花蓮藥膳食堂介紹傳統慢火熬煮工法。">`,
        'https://www.fclnews.com/230503/',
      ),
    ).toMatchObject({ summary: '花蓮藥膳食堂介紹傳統慢火熬煮工法。', summarySource: 'meta:og:description' });
  });
  it('removes only the exact Secret China promotion suffix and retains publisher prose', () => {
    const promotion =
      '看中國》是總部設於美國、以復興傳統中華文化為理念的獨立媒體。自2001年起，堅持報導最新社會焦點和傳統文化專題，中文報紙已在北美、歐洲、澳洲、亞洲等17個國家發行。中國新聞,中國大陸新聞,內幕新聞,中文媒體,新聞評論,時事,財經,博談,歷史,文化,養生,娛樂,奇聞。';
    const html = `<meta name="description" content="原站提供的新聞摘要。 新聞 美國 - ${promotion}">`;
    expect(extractArticle(html, 'https://www.secretchina.com/news/b5/2026/10/08/1105806.html')).toMatchObject({
      summary: '原站提供的新聞摘要。',
      summarySource: 'meta:description',
    });
    expect(extractArticle(html, 'https://example.com/news/b5/story').summary).toContain(promotion);
    expect(
      extractArticle(
        '<meta name="description" content="原站報導新聞 美國政策的變化。">',
        'https://www.secretchina.com/news/b5/2026/10/08/1105806.html',
      ).summary,
    ).toBe('原站報導新聞 美國政策的變化。');
  });
  it('rejects a complete Singular report copied into metadata even with captions between paragraphs', () => {
    const paragraphs = [
      '市府宣布交通建設計畫，完整說明政策與執行細節。'.repeat(6),
      '居民提出意見，專家回應可能影響。'.repeat(8),
      '報導最後整理計畫的經費及時程。'.repeat(8),
    ];
    const report = `<div class="td-post-content">${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>`;
    expect(
      extractArticle(
        `<meta name="description" content="${paragraphs.join(' 圖：記者提供。 ')}">${report}`,
        'https://www.scooptw.com/yesmedia/535838/story',
      ).summary,
    ).toBeNull();
    expect(
      extractArticle(`<meta name="description" content="編輯另撰的新聞導讀。">${report}`, 'https://www.scooptw.com/yesmedia/535838/story')
        .summary,
    ).toBe('編輯另撰的新聞導讀。');
    expect(
      extractArticle(`<meta name="description" content="${paragraphs[0]}">${report}`, 'https://www.scooptw.com/yesmedia/535838/story')
        .summary,
    ).toBe(paragraphs[0]);
  });
  it('rejects the Macao Daily copyright description but preserves a real article description', () => {
    const copyright = '澳門日報版權所有 澳門日報電子報由澳門日報出版社出版';
    expect(
      extractArticle(`<meta name="description" content="${copyright}">`, 'https://www.macaodaily.com/html/2026-10/08/content_1938623.htm')
        .summary,
    ).toBeNull();
    expect(
      extractArticle(
        `<meta name="description" content="${copyright}"><meta property="og:description" content="石排灣水廠排泥水處理設施建造工程公開招標。">`,
        'https://www.macaodaily.com/html/2026-10/08/content_1938623.htm',
      ),
    ).toMatchObject({ summary: '石排灣水廠排泥水處理設施建造工程公開招標。', summarySource: 'meta:og:description' });
  });
  it('rejects a Videoland description cut inside a link attribute and tries the next publisher description', () => {
    const url = 'https://news.videoland.com.tw/article/826ab0df-e1d2-41c5-80c3-88eee5062dce.html';
    const broken =
      '<meta name="description" content="聯盟公布規則，詳細辦法請見<a href="https://news.videoland.com.tw/article/example.html">';
    expect(extractArticle(broken, url).summary).toBeNull();
    expect(extractArticle(broken + '<meta property="og:description" content="聯盟公布新的勞資協商規則。">', url).summary).toBe(
      '聯盟公布新的勞資協商規則。',
    );
    expect(extractArticle('<meta name="description" content="聯盟公布新規則，詳細內容稍後公布。">', url).summary).toBe(
      '聯盟公布新規則，詳細內容稍後公布。',
    );
    expect(extractArticle(broken, 'https://example.org/story').summary).toContain('<a href=');
  });
  it('rejects a Youth Daily description copying all long article paragraphs in order', () => {
    const paragraphs = [
      '總統府舉辦光雕展演，完整呈現臺灣日常風景與歷史記憶。'.repeat(5),
      '樂團演奏作品，邀請民眾共度國慶前夕的夜晚。'.repeat(6),
      '主辦單位公布展演時程與場次，民眾可依時間前往觀賞。'.repeat(5),
    ];
    const report = `<article class="PageArticle"><div id="ContentPlaceHolder1_div_Desc">${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div></article>`;
    const html = `<meta property="og:description" content="${paragraphs.join(' ')}">${report}`;
    const url = 'https://www.ydn.com.tw/tw/News/ugC_News_Detail.aspx?ID=647354';
    expect(extractArticle(html, url).summary).toBeNull();
    expect(extractArticle(html, 'https://example.org/story').summary).toBe(paragraphs.join(' '));
    expect(extractArticle(`<meta property="og:description" content="${paragraphs[0]}">${report}`, url).summary).toBe(paragraphs[0]);
    expect(extractArticle(`<meta property="og:description" content="主辦單位將在國慶前夕舉辦光雕展演。">${report}`, url).summary).toBe(
      '主辦單位將在國慶前夕舉辦光雕展演。',
    );
  });
  it('skips reviewed Hakka TV and International World Times site descriptions', () => {
    const hakkatv = '客家電視是屬於全民、以至於全世界客家族群的頻道，亦是為傳播客家文化而存在，定位為「全體客家族群之媒體」。';
    const iw =
      '國際環宇時報International World Times的使命是以公正、客觀的角度報導國內外新聞，幫助讀者深入了解全球範圍內的重大事件與趨勢。其願景是成為全球讀者首選的新聞來源，促進世界各國之間的理解與交流。國際環宇時報以其真實、公正、全面和創新的報導風格，贏得了全球讀者的信賴和支持。';
    expect(
      extractArticle(
        `<meta name="description" content="${hakkatv}"><meta property="og:description" content="${hakkatv}">`,
        'https://www.hakkatv.org.tw/news-detail/1791369130715780',
      ).summary,
    ).toBeNull();
    expect(
      extractArticle(
        `<meta name="description" content="${iw}"><meta property="og:description" content="國際獅子會於屏東舉辦校園反霸凌音樂會。">`,
        'https://www.iw-times.com/news_view.php?new_sn=145424',
      ),
    ).toMatchObject({ summary: '國際獅子會於屏東舉辦校園反霸凌音樂會。', summarySource: 'meta:og:description' });
  });
  it('rejects clipped Good News UI descriptions without removing other publisher prose', () => {
    const value = '新聞熱度：5,596 |閱讀時間：約 2 分鐘|字體調整：A+A- 【記者 朱達志／台東 報導】海洋委員會公布';
    expect(
      extractArticle(`<meta property="og:description" content="${value}">`, 'https://newstaiwan.net/2026/10/07/487096/').summary,
    ).toBeNull();
    expect(
      extractArticle('<meta property="og:description" content="海洋委員會公布新計畫。">', 'https://newstaiwan.net/2026/10/07/487096/')
        .summary,
    ).toBe('海洋委員會公布新計畫。');
    expect(extractArticle(`<meta property="og:description" content="${value}">`, 'https://example.org/story').summary).toBe(value);
  });
  it('rejects the SuperTaste site slogan and a reviewed LifeToutiao image-credit-only description', () => {
    expect(
      extractArticle('<meta name="description" content="在這裡找到你想要的美食">', 'https://supertaste.tvbs.com.tw/infocard/34307').summary,
    ).toBeNull();
    const caption = '<meta name="description" content="(圖取自/台南市政府體育局 校園籃球熱血對抗)">';
    expect(extractArticle(caption, 'https://www.lifetoutiao.news/357315/').summary).toBeNull();
    expect(extractArticle(caption, 'https://example.com/357315/').summary).toBe('(圖取自/台南市政府體育局 校園籃球熱血對抗)');
    expect(
      extractArticle('<meta name="description" content="台南市政府推動校園籃球運動。">', 'https://www.lifetoutiao.news/357315/').summary,
    ).toBe('台南市政府推動校園籃球運動。');
  });
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

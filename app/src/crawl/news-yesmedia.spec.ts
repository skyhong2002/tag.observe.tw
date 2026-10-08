import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';
import { yesMediaArticle } from './news-yesmedia.ts';

const url = 'https://www.yesmedia.com.tw/%E8%87%AA%E5%B7%B1/';
const original = 'https://firenews.com.tw/2026/10/08/%e8%87%aa%e5%b7%b1/';
const title = '自己的新聞';
function page(headline = title) {
  return `<title>${headline} - 是新聞 YesMedia | 網路原生即時新聞</title>
    <link rel="canonical" href="https://www.yesmedia.com.tw/自己/"><meta property="og:url" content="${url}">
    <meta property="og:title" content="${headline} - 是新聞 YesMedia | 網路原生即時新聞"><meta name="author" content="火報">
    <script type="application/ld+json">${JSON.stringify({ '@type': 'Article', headline, url: url.toLowerCase(), mainEntityOfPage: { '@id': url }, author: { '@type': 'Person', name: '編採中心' } })}</script>
    <body class="single-post postid-373485"><div class="the-post-header"><h1 class="post-title">${headline}</h1><a rel="author">編採中心</a></div>
    <article id="post-373485" class="post"><div class="post-content entry-content"><div class="dable-content-wrapper">
    <p>這是該篇報導的正文，敘述與受訪者有關的資訊，保留原文而不以姓名推測作者。</p>
    <p>這篇文章 <a href="${original}">${headline}</a> 最早出現於 <a href="https://firenews.com.tw">火報</a>。</p>
    </div></div></article></body>`;
}
it('cleans only the exact own headline suffix and recognizes the explicit linked first publisher', () => {
  expect(yesMediaArticle(load(page()), url)).toEqual({ title, provider: '火報', originalUrl: original });
  expect(
    yesMediaArticle(
      load(page() + '<meta property="og:url" content="https://www.yesmedia.com.tw/自己/"><meta property="og:title" content="自己的新聞">'),
      url,
    ),
  ).toEqual({
    title,
    provider: '火報',
    originalUrl: original,
  });
  const story = '故事提到 - 是新聞 YesMedia | 網路原生即時新聞';
  expect(yesMediaArticle(load(page(story)), url)?.title).toBe(story);
});
it('requires matching canonical, OG, WordPress ID, sole heading and own structured article identity', () => {
  for (const html of [
    page().replace('href="https://www.yesmedia.com.tw/自己/', 'href="https://www.yesmedia.com.tw/其他/'),
    page().replace('content="' + url, 'content="https://www.yesmedia.com.tw/other/'),
    page().replace('postid-373485', 'postid-373486'),
    page().replace('single-post', 'archive'),
    page().replace('class="post-title">自己的新聞', 'class="post-title">別篇新聞'),
    page() + '<h1>推薦新聞</h1>',
    page() + '<meta property="og:url" content="https://www.yesmedia.com.tw/其他/">',
    page() + '<link rel="canonical" href="https://www.yesmedia.com.tw/其他/">',
    page() + '<meta property="og:title" content="別篇新聞 - 是新聞 YesMedia | 網路原生即時新聞">',
    page().replace('"headline":"自己的新聞"', '"headline":"別篇新聞"'),
    page().replace('"@id":"' + url, '"@id":"https://www.yesmedia.com.tw/other/'),
    page().replace('type="application/ld+json"', 'type="text/plain"'),
    page().replace('<title>自己的新聞 - 是新聞', '<title>改過的標題 - 是新聞'),
  ])
    expect(yesMediaArticle(load(html), url)).toBeNull();
  expect(yesMediaArticle(load(page()), 'https://other.test/自己/')).toBeNull();
  expect(yesMediaArticle(load(page()), 'invalid')).toBeNull();
});
it('does not infer a provider from names, quotes, unrelated footers or a foreign or non-article link', () => {
  for (const html of [
    page().replace('最早出現於', '受訪者提到'),
    page().replace('https://firenews.com.tw/2026/10/08/', 'https://other.test/2026/10/08/'),
    page().replace(original, 'https://firenews.com.tw/'),
    page().replace('href="https://firenews.com.tw"', 'href="https://other.test"'),
    page().replace('這篇文章 <a', '引述：這篇文章 <a'),
    page().replace('這篇文章 <a', '這篇文章 <blockquote><a'),
    page().replace('。</p>\n    </div>', '。</p><p>後續正文</p>\n    </div>'),
    page().replace('dable-content-wrapper', 'unrelated-content'),
  ]) {
    const result = yesMediaArticle(load(html), url);
    expect(result?.title).toBe(title);
    expect(result?.provider).toBeNull();
    expect(result?.originalUrl).toBeNull();
  }
});
it('passes the own title and provider through article cleanup to explicit attribution metadata', () => {
  const parsed = extractArticle(page(), url);
  expect(parsed.title).toBe(title);
  expect(parsed.provider).toBe('火報');
  expect(parsed.authors).toEqual(['編採中心']);
  expect(parsed.body).toContain('這是該篇報導的正文');
  expect(extractAttributions(parsed.body ?? '', 'yesmedia', parsed.provider)).toContainEqual(
    expect.objectContaining({ media: 'firenews', evidence: '內容提供者：火報' }),
  );
});

function creditPage(agency: string, credit: string) {
  return page()
    .replace('content="火報"', `content="${agency}"`)
    .replace(
      '<p>這是該篇報導的正文，敘述與受訪者有關的資訊，保留原文而不以姓名推測作者。</p>',
      `<p>${credit}</p><p>這是該篇報導的正文，受訪者陳大明表示，攝影王小明記錄現場。</p>`,
    );
}
it('recovers own agency reporter credits while separating desk, interview and photography roles', () => {
  for (const [agency, credit, name] of [
    ['商傳媒', '商傳媒｜方承業／綜合外電報導', '方承業'],
    ['商傳媒', '商傳媒｜簡明心／綜合外電報導', '簡明心'],
    ['商傳媒', '商傳媒｜吳承岳／台北報導', '吳承岳'],
    ['觀傳媒', '（觀傳媒中彰投新聞）【記者廖妙茜/台中報導】正文提到受訪者陳大明。', '廖妙茜'],
    ['點傳媒', '【點傳媒／總社長孫崇文報導】 正文提到受訪者陳大明。', '孫崇文'],
  ]) {
    const html = creditPage(agency, credit);
    expect(yesMediaArticle(load(html), url)?.authors).toEqual([name]);
    expect(extractArticle(html, url).authors).toEqual([name]);
  }
});
it('rejects role labels, quoted or later credits, mismatched agencies and photographer slots', () => {
  for (const html of [
    creditPage('商傳媒', '商傳媒｜責任編輯／綜合外電報導'),
    creditPage('商傳媒', '商傳媒｜攝影／台北報導'),
    creditPage('商傳媒', '商傳媒｜編採中心／台北報導'),
    creditPage('商傳媒', '商傳媒｜受訪者／台北報導'),
    creditPage('商傳媒', '商傳媒｜方承業／台北報導（攝影王小明）'),
    creditPage('觀傳媒', '商傳媒｜方承業／台北報導'),
    creditPage('點傳媒', '【點傳媒／攝影孫崇文報導】'),
    creditPage('商傳媒', '「商傳媒｜方承業／台北報導」'),
    creditPage('商傳媒', '<q>商傳媒｜方承業／台北報導</q>'),
    creditPage('商傳媒', '<a href="https://other.test">商傳媒｜方承業／台北報導</a>'),
    creditPage('商傳媒', '一般正文。</p><p>商傳媒｜方承業／台北報導'),
    creditPage('商傳媒', '商傳媒｜方承業／台北報導').replace('rel="author">編採中心', 'rel="author">記者/其他人'),
  ])
    expect(yesMediaArticle(load(html), url)?.authors).toBeUndefined();
});

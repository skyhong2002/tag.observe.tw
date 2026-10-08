import { describe, expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://www.huanqiu.com/article/4TW7ky0QVVt';
const title = '學習故事測試';
const page = (body: string) =>
  `<title>${title}</title><meta property="og:url" content="${url}"><div class="data-container"><article><textarea class="article-aid">4TW7ky0QVVt</textarea><textarea class="article-title">${title}</textarea><textarea class="article-time">1791375721035</textarea><textarea class="article-content">${body.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</textarea></article></div><aside><p>${'推薦內容。'.repeat(100)}</p></aside>`;
describe('own Huanqiu HTML article slots', () => {
  it('reads only the verified own epoch clock, retaining milliseconds', () => {
    const original = page('<article><section><p>原文報導。</p></section></article>');
    expect(extractArticle(original, url).publishedAt?.getTime()).toBe(1791375721035);
    expect(extractArticle(original.replace('article-aid">4TW7ky0QVVt', 'article-aid">OTHER'), url).publishedAt).toBeNull();
    expect(extractArticle(original.replace('article-time">1791375721035', 'article-time">推薦時間'), url).publishedAt).toBeNull();
  });
  it('keeps image-only report credits short without counting tags or recommendations as body', () => {
    const a = extractArticle(
      page(
        '<article><section data-type="rtext"><p><img src="//image.test/long-image-name.jpg"></p><p>制作：彭静</p><p>资料来源：人民日报、新华社、《习近平在正定》等</p></section></article>',
      ),
      url,
    );
    expect(a.body).toBe('制作：彭静\n\n资料来源：人民日报、新华社、《习近平在正定》等');
    expect(a.bodyStatus).toBe('short');
    expect(a.bodySource).toBe('article:huanqiu-html');
    expect(a.authors).toEqual([]);
    expect(extractAttributions(a.body!, 'huanqiu').map((x) => x.media)).toEqual(['people_daily', 'xinhua']);
  });
  it('retains complete text paragraphs while removing embedded navigation and scripts', () => {
    const prose = '這是原文報導，記錄事件經過與受訪者的說明。'.repeat(20);
    const a = extractArticle(
      page(`<article><section><p>${prose}</p><aside><p>推薦內容</p></aside><script>noise()</script></section></article>`),
      url,
    );
    expect(a.body).toBe(prose);
    expect(a.bodyStatus).toBe('ok');
  });
  it('requires own URL, article id, unique slots, title and a dated article identity', () => {
    const original = page('<article><section><p>原文報導。</p></section></article>');
    for (const html of [
      original.replace('article-aid">4TW7ky0QVVt', 'article-aid">OTHER'),
      original.replace('<title>學習故事測試</title>', '<title>別篇文章</title>'),
      original.replace('1791375721035', 'not-time'),
      original.replace(`content="${url}"`, 'content="https://www.huanqiu.com/article/OTHER"'),
    ]) {
      expect(extractArticle(html, url).bodySource).not.toBe('article:huanqiu-html');
    }
    expect(extractArticle(original, url.replace('www.huanqiu.com', 'unreviewed.huanqiu.com')).bodySource).not.toBe('article:huanqiu-html');
  });
});

it('normalizes the complete spaced People Daily author slot only with its own original-source link', () => {
  const original = page('<article><section><p>文化報導。</p></section></article>').replace(
    '</article></div>',
    '<textarea class="article-author">作者：耿 磊 李卓尔</textarea><textarea class="article-source-name">&lt;a href="https://www.peopleapp.com/column/30053296435-500007730096"&gt;人民日报&lt;/a&gt;</textarea></article></div>',
  );
  expect(extractArticle(original, url).authors).toEqual(['耿磊', '李卓尔']);
  for (const html of [
    original.replace('www.peopleapp.com', 'unreviewed.example'),
    original.replace('人民日报', '其他来源'),
    original.replace('作者：耿 磊 李卓尔', '受访者：耿 磊 李卓尔'),
    original.replace('作者：耿 磊 李卓尔', '作者：耿 磊 李卓尔 摄影：王明'),
  ])
    expect(extractArticle(html, url).authors).not.toEqual(['耿磊', '李卓尔']);
});

it('splits explicit own joint reporter roles without merging reporter names into one writer', () => {
  const lead = '【环球时报记者 褚大业 李迅典 环球时报特约记者 严格 任重】' + '這是原文報導的背景和完整敘述。'.repeat(12);
  expect(extractArticle(page(`<article><section><p>${lead}</p></section></article>`), url).authors).toEqual([
    '褚大业',
    '李迅典',
    '严格',
    '任重',
  ]);
});

it('takes the named video reporter while retaining other production roles separately from writers', () => {
  const footer = '<p>统筹：吴炜玲、张紫赟</p><p>编导：杨慕茜</p><p>记者：金剑</p><p>海报：刘旭峰</p><p>新华社音视频部制作</p>';
  expect(extractArticle(page(`<article><section><p>文化報導。</p>${footer}</section></article>`), url).authors).toEqual(['金剑']);
  expect(
    extractArticle(page(`<article><section><p>文化報導。</p>${footer.replace('记者：金剑', '摄影：金剑')}</section></article>`), url)
      .authors,
  ).toEqual([]);
});

it('requires the own complete final writing credit and excludes poster designers or quoted mentions', () => {
  const footer = '<p>文字记者：徐壮、邢拓</p><p>海报设计：马发展</p>';
  expect(extractArticle(page(`<article><section><p>文化報導。</p>${footer}</section></article>`), url).authors).toEqual(['徐壮', '邢拓']);
  expect(
    extractArticle(page(`<article><section><p>受訪者提及文字记者：徐壮、邢拓</p><p>海报设计：马发展</p></section></article>`), url).authors,
  ).toEqual([]);
  expect(extractArticle(page(`<article><section>${footer}<p>後續文章內容。</p></section></article>`), url).authors).toEqual([]);
});

import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://babyou.me/own-story';
const prose = '這是自己報導的完整原文，逐段記錄受訪者說明與事件經過。'.repeat(12);
const caption = '圖／自己標記的圖片說明（供圖者）';
const linked = '另一篇文章標題';
function page(extraProse = '', list: string[] = []) {
  const body = `[caption id="attachment_123" align="center"] ${caption}[/caption]\n\n${prose}${extraProse}\n\n${list.join('\n\n')}\n\n【延伸閱讀】\n\n${linked}`;
  return `<link rel="canonical" href="${url}"><h1>自己的報導標題</h1><meta name="author" content="王小明"><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url, headline: '自己的報導標題', articleBody: body })}</script><div class="elementor-widget-theme-post-content"><div class="elementor-widget-container"><figure class="wp-caption" id="attachment_123"><img src="own.jpg"><figcaption class="wp-caption-text">${caption}</figcaption></figure><p>${prose}</p>${list.length ? '<ul>' + list.map((text) => '<li>' + text + '</li>').join('') + '</ul>' : ''}<p>【延伸閱讀】<br><a href="/other-story">${linked}</a></p></div></div><aside><p>${'旁欄推薦內容'.repeat(80)}</p></aside>`;
}
it('keeps all own prose while excluding corroborated WordPress photo markup and related articles', () => {
  const a = extractArticle(page(), url);
  expect(a.body).toBe(prose);
  expect(a.bodySource).toBe('article:babyou-paragraphs');
  expect(a.authors).toEqual(['王小明']);
});
it('preserves structured prose if it disagrees with DOM rather than losing a substantive paragraph', () => {
  const a = extractArticle(page('另有一段原文不能遺失。'), url);
  expect(a.bodySource).toBe('ld+json');
  expect(a.body).toContain('另有一段原文不能遺失。');
});
it('requires own identity, exact own caption and a complete related tail', () => {
  for (const html of [
    page().replace('<h1>自己的報導標題</h1>', '<h1>另一篇文章</h1>'),
    page().replace('figure class="wp-caption" id="attachment_123"', 'figure class="wp-caption" id="attachment_999"'),
    page().replace('/other-story', 'https://unrelated.test/story'),
    page().replace('</div></div><aside>', '<p>推薦區後仍有原文敘述。</p></div></div><aside>'),
  ])
    expect(extractArticle(html, url).bodySource).not.toBe('article:babyou-paragraphs');
  expect(extractArticle(page(), url.replace('babyou.me', 'unreviewed.test')).bodySource).not.toBe('article:babyou-paragraphs');
});

it('retains the complete own list content instead of losing educational list paragraphs', () => {
  const list = ['歷史中的玻璃：從古文明工藝到現代技術。', '日常中的玻璃：從生活物件理解材料科學。'];
  const a = extractArticle(page('', list), url);
  expect(a.bodySource).toBe('article:babyou-paragraphs');
  for (const text of list) expect(a.body).toContain(text);
  expect(a.body).not.toContain(linked);
  expect(a.body).not.toContain(caption);
});

it('accepts the own related label colon and literal nonbreaking-space entity without treating them as prose', () => {
  const html = page().replaceAll('【延伸閱讀】', '延伸閱讀：').replace('\\n\\n延伸閱讀：', '\\n\\n&nbsp;\\n\\n延伸閱讀：');
  expect(extractArticle(html, url).body).toBe(prose);
});

it('excludes only marked contents navigation whose links all target own headings', () => {
  const heading = '<h2 id="own-section">自己的段落標題</h2>';
  const navigation = '<div id="ez-toc-container"><p>文章目錄</p><a href="#own-section">自己的段落標題</a></div>';
  const html = page('自己的段落標題')
    .replace('<p>【延伸閱讀】', heading + '<p>【延伸閱讀】')
    .replace('<p>' + prose, navigation + '<p>' + prose);
  expect(extractArticle(html, url).bodySource).toBe('article:babyou-paragraphs');
  expect(extractArticle(html, url).body).toBe(prose + '\n\n自己的段落標題');
  expect(extractArticle(html.replace('href="#own-section"', 'href="#absent-heading"'), url).bodySource).toBe('ld+json');
  const encoded = html
    .replaceAll('own-section', '自己的段落')
    .replace('href="#自己的段落"', 'href="#' + encodeURIComponent('自己的段落') + '"')
    .replace('<p>文章目錄</p>', '<p>文章目錄</p><a class="ez-toc-toggle" href="#">Toggle</a>');
  expect(extractArticle(encoded, url).bodySource).toBe('article:babyou-paragraphs');
});

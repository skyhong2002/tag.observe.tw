import { describe, expect, it } from 'vitest';
import {
  articleHref,
  readingExcerpt,
  readingParagraphs,
  readingQuery,
  readingTitle,
  withReadingQuery,
} from '../../web/src/lib/reading.mts';

describe('article reading navigation', () => {
  it('keeps current articles and older snapshots inside the site', () => {
    expect(articleHref({ id: 123, title: '新聞' })).toBe('/article/123/');
    expect(articleHref({ id: null, title: '新聞' })).toBe('/search/?q=%E6%96%B0%E8%81%9E');
  });
  it('preserves the list filters without accepting arbitrary return destinations', () => {
    expect(withReadingQuery('/media/rti/', readingQuery({ q: ' 台積電 ', hours: '72', cursor: '123' })!)).toBe(
      '/media/rti/?hours=72&cursor=123&q=%E5%8F%B0%E7%A9%8D%E9%9B%BB',
    );
    expect(readingQuery({ q: 'x'.repeat(61) })).toBeNull();
    const query = readingQuery({ cursor: ['123', '999'], hours: '72' });
    expect(withReadingQuery('/media/rti/', query!)).toBe('/media/rti/?hours=72&cursor=123');
    expect(withReadingQuery('/media/rti/', readingQuery({})!)).toBe('/media/rti/');
    for (const cursor of ['0', '-1', '1.5', '9007199254740992', 'https://example.com']) {
      expect(readingQuery({ cursor })).toBeNull();
    }
    expect(readingQuery({ hours: '169' })).toBeNull();
  });
  it('moves bracketed sections out of the headline without dropping headline text', () => {
    expect(readingTitle('[國際] 一則新聞')).toEqual({ section: '國際', title: '一則新聞' });
    expect(readingTitle('沒有分類的新聞')).toEqual({ section: null, title: '沒有分類的新聞' });
  });
  it('preserves text and single line breaks while separating paragraphs', () => {
    expect(readingParagraphs(' 第一段\n續行\n\n第二段 <script>\r\n\r\n第三段 ')).toEqual(['第一段\n續行', '第二段 <script>', '第三段']);
  });
});

describe('article previews', () => {
  it('limits long text to 150 Unicode characters and an ellipsis', () => {
    const opening = '新聞😀'.repeat(50);
    expect(readingExcerpt(`${opening}不應顯示的後文`)).toBe(`${opening}...`);
  });
  it('prefers a complete sentence between 100 and 150 characters', () => {
    const sentence = `${'文'.repeat(110)}。`;
    expect(readingExcerpt(sentence + '後'.repeat(100))).toBe(`${sentence}...`);
  });
  it('keeps short summaries with the same continuation marker', () => {
    expect(readingExcerpt(' 簡短摘要。 ')).toBe('簡短摘要。...');
    expect(readingExcerpt('   ')).toBe('');
  });
});

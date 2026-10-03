import { describe, expect, it } from 'vitest';
import { articleHref, readingParagraphs, readingQuery, readingTitle, withReadingQuery } from '../../web/src/lib/reading.mts';

describe('article reading navigation', () => {
  it('keeps current articles and older snapshots inside the site', () => {
    expect(articleHref({ id: 123, title: '新聞' })).toBe('/article/123/');
    expect(articleHref({ id: null, title: '新聞' })).toBe('/search/?q=%E6%96%B0%E8%81%9E');
  });
  it('preserves the list filters without accepting arbitrary return destinations', () => {
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

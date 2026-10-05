import { describe, expect, it } from 'vitest';
import { isOwnMediaTag } from './media-tags.ts';

describe('outlet source labels', () => {
  it.each([
    ['ftnn', ' ＦＴＮＮ 新聞網 '],
    ['ltn', '自由時報電子報'],
    ['setn', '三立新聞網財經中心'],
    ['epochtimes', '台灣大紀元'],
    ['epochtimes', '洛杉磯大紀元'],
    ['bo6s', 'bo6s'],
    ['hk01', 'HK01'],
    ['commonhealth', '康健雜誌'],
    ['businesstoday', '今週刊'],
  ])('recognizes %s source label %s', (media, tag) => {
    expect(isOwnMediaTag(tag, media)).toBe(true);
    expect(isOwnMediaTag(tag, 'worldjournal')).toBe(false);
  });
  it('keeps ambiguous words, programs, unrelated entities and mentions within topics', () => {
    for (const [media, tag] of [
      ['ltn', '自由'],
      ['cw', '天下'],
      ['ftv', '民視八點檔'],
      ['ebc', '東森國際'],
      ['setn', '三立採訪爭議'],
    ])
      expect(isOwnMediaTag(tag, media)).toBe(false);
    expect(isOwnMediaTag('世界新聞網')).toBe(false);
    expect(isOwnMediaTag('世界新聞網', 'unknown')).toBe(false);
  });
});

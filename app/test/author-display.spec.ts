import { describe, expect, it } from 'vitest';
import { authorDisplay } from '../../web/src/lib/author-display.mts';

describe('liveboard reporter labels', () => {
  it.each(['亞太新聞網', '警政時報', '自由時報電子報', '爆料網'])('labels %s as an organizational credit', (credit) => {
    expect(authorDisplay([credit])).toBe(`署名 ${credit}`);
  });
  it('normalizes the UDN translator credit shown in the screenshot', () => {
    expect(authorDisplay(['經濟日報／ 編譯葉亭均／綜合外電'])).toBe('署名 葉亭均');
  });
  it('keeps known people separate from organizational credits', () => {
    expect(authorDisplay(['金東天', '薛秀蓮', '警政時報'])).toBe('署名 金東天、薛秀蓮、警政時報');
  });
  it('keeps the writer and translator in the same credit', () => {
    expect(authorDisplay(['文 / Amy Denney 編譯 / 朱緯'])).toBe('署名 Amy Denney、朱緯');
  });
  it.each([
    [['TVBS新聞網', '高鈺婷'], '署名 高鈺婷、TVBS新聞網'],
    [['網路溫度計', '鄒昀孝'], '署名 鄒昀孝、網路溫度計'],
    [['網路溫度計'], '署名 網路溫度計'],
    [['新唐人電視台'], '署名 新唐人電視台'],
    [['大紀元'], '署名 大紀元'],
    [['陸希'], '署名 陸希'],
  ])('labels the additional screenshot credits %j accurately', (credits, expected) => {
    expect(authorDisplay(credits)).toBe(expected);
  });
  it('does not invent a reporter for missing credits', () => {
    expect(authorDisplay([])).toBe('未署名');
  });
});

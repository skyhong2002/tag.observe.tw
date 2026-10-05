import { describe, expect, it } from 'vitest';
import { campOf, coverageDescription, groupCoverage } from './coverage.ts';

const cats = { blue: ['udn', 'tvbs'], green: ['ltn', 'setn'], news: ['udn', 'tvbs', 'ltn', 'setn', 'cna'] };
const t = (h: number) => new Date(Date.UTC(2025, 7, 13, h));
const row = (id: number, media: string, tags: string[], h = 3, title = `t${id}`) => ({
  id,
  media,
  title,
  url: `https://x/${id}`,
  image: null,
  publishedAt: t(h),
  tags,
});
const window = { from: t(0), to: t(10) };

describe('coverage', () => {
  it('maps media to camps', () => {
    expect(campOf('udn', cats)).toBe('blue');
    expect(campOf('ltn', cats)).toBe('green');
    expect(campOf('cna', cats)).toBe('other');
    expect(campOf('nobody', {})).toBe('other');
  });
  it('groups by outlet, counts camps, sorts newest first', () => {
    const c = groupCoverage(
      [
        row(1, 'udn', ['核三'], 1),
        row(2, 'udn', ['核三', '黃國昌'], 5),
        row(3, 'ltn', ['吳亞昕'], 2),
        row(4, 'cna', ['其他']),
        row(2, 'udn', ['核三'], 5),
      ],
      ['核三', '黃國昌', '吳亞昕'],
      window,
      cats,
    );
    expect(c.articles).toBe(3);
    expect(c.outlets).toBe(2);
    expect(c.byOutlet.map((o) => o.media)).toEqual(['udn', 'ltn']);
    expect(c.byOutlet[0].articles.map((a) => [a.id, a.hits])).toEqual([
      [2, 2],
      [1, 1],
    ]);
    expect(c.camps.map((x) => [x.camp, x.outlets, x.articles])).toEqual([
      ['blue', 1, 2],
      ['green', 1, 1],
      ['other', 0, 0],
    ]);
    expect(c.blindspot).toEqual([]);
    expect(c.from).toBe(window.from.toISOString());
  });
  it('flags a blindspot when only one camp reports', () => {
    const c = groupCoverage([row(1, 'udn', ['核三']), row(2, 'tvbs', ['核三']), row(3, 'cna', ['核三'])], ['核三'], window, cats);
    expect(c.blindspot).toEqual(['green']);
    expect(groupCoverage([row(1, 'ltn', ['核三'])], ['核三'], window, cats).blindspot).toEqual(['blue']);
    expect(groupCoverage([row(1, 'cna', ['核三'])], ['核三'], window, cats).blindspot).toEqual([]);
  });
  it('shows one headline per outlet even when published under two URLs', () => {
    const c = groupCoverage(
      [row(1, 'ltn', ['核三'], 3, '同一標題'), row(2, 'ltn', ['核三'], 3, '同一 標題'), row(3, 'udn', ['核三'], 3, '同一標題')],
      ['核三'],
      window,
      cats,
    );
    expect(c.articles).toBe(2);
    expect(c.byOutlet.map((o) => [o.media, o.articles.length])).toEqual([
      ['ltn', 1],
      ['udn', 1],
    ]);
  });
  it('drops untitled rows and rows without a major tag', () => {
    const c = groupCoverage([row(1, 'udn', ['核三'], 3, ''), row(2, 'udn', ['別的'])], ['核三'], window, cats);
    expect(c.articles).toBe(0);
    expect(c.byOutlet).toEqual([]);
  });
  it('keeps the outlet summary as a short lede, not a repeat of the title', () => {
    const c = groupCoverage(
      [{ ...row(1, 'udn', ['核三']), description: '  核三廠再運轉評估報告今天出爐，\n台電表示將送核安會審查。 ' }],
      ['核三'],
      window,
      cats,
    );
    expect(c.byOutlet[0].articles[0].description).toBe('核三廠再運轉評估報告今天出爐， 台電表示將送核安會審查。');
    expect(coverageDescription('核三再運轉報告出爐！', '核三再運轉報告出爐')).toBeNull();
    expect(coverageDescription('太短了', '標題')).toBeNull();
    expect(coverageDescription(null, '標題')).toBeNull();
    const long = coverageDescription('長'.repeat(300), '標題');
    expect([...(long ?? '')].length).toBe(160);
    expect(long?.endsWith('…')).toBe(true);
  });
});

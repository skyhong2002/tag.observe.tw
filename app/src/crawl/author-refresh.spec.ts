import { describe, expect, it } from 'vitest';
import { refreshedAuthorCredits } from './author-refresh.ts';

describe('reporter refresh preservation', () => {
  const current = { authors: ['王小明'], creator: '王小明', media: 'publisher' };

  it.each(['責任編輯 靳璦', '社論', '友站新聞'])('clears the verified non-author credit %s', (credit) => {
    expect(refreshedAuthorCredits({ ...current, authors: [credit], creator: credit }, [])).toEqual({ authors: [], creator: null });
  });
  it('removes an editor while preserving the known writer when extraction is empty', () => {
    expect(refreshedAuthorCredits({ ...current, authors: ['王小明', '責任編輯 靳璦'] }, [])).toEqual({
      authors: ['王小明'],
      creator: '王小明',
    });
  });

  it('does not clear known reporters on empty extraction', () => {
    expect(refreshedAuthorCredits(current, [])).toBeNull();
  });

  it('does not downgrade a person to a desk or publisher identity', () => {
    for (const organization of ['中央社', 'publisher', '新聞編輯部']) {
      expect(refreshedAuthorCredits(current, [organization])).toBeNull();
      expect(refreshedAuthorCredits({ ...current, authors: [] }, [organization])).toBeNull();
    }
  });

  it('preserves an organization credit when it is the only available identity', () => {
    expect(refreshedAuthorCredits({ ...current, authors: null, creator: null }, ['中央社'])).toEqual({
      authors: ['中央社'],
      creator: '中央社',
    });
  });

  it('replaces stale organization metadata with identified reporters', () => {
    expect(refreshedAuthorCredits({ ...current, authors: ['中央社'], creator: '中央社' }, ['王小明', '陳美美'])).toEqual({
      authors: ['王小明', '陳美美'],
      creator: '王小明、陳美美',
    });
  });

  it('keeps a reporter in preference to mixed organization credits', () => {
    expect(refreshedAuthorCredits(current, ['中央社', '陳美美'])).toEqual({ authors: ['陳美美'], creator: '陳美美' });
  });

  it('synchronizes creator once and skips unchanged credits', () => {
    expect(refreshedAuthorCredits({ ...current, creator: '中央社' }, ['王小明'])).toEqual({
      authors: ['王小明'],
      creator: '王小明',
    });
    expect(refreshedAuthorCredits(current, ['王小明'])).toBeNull();
  });
});

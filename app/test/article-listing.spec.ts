import { describe, expect, it } from 'vitest';
import { matchThread, sectionByTime, taipeiClock } from '../../web/src/lib/article-listing.mts';

describe('article listing', () => {
  const threads = [
    { id: 1, majorTags: ['台股', '台積電', '美股'] },
    { id: 2, majorTags: ['颱風'] },
    { id: 3, majorTags: ['台積電', '輝達'] },
  ];
  it('needs two shared major tags, or the only one', () => {
    expect(matchThread(['台積電'], threads)).toBeNull();
    expect(matchThread(['台積電', '輝達'], threads)?.id).toBe(3);
    expect(matchThread(['台積電', '台股', '輝達'], threads)?.id).toBe(1);
    expect(matchThread(['颱風', '停班停課'], threads)?.id).toBe(2);
    expect(matchThread([], threads)).toBeNull();
    expect(matchThread(['x'], [{ id: 9, majorTags: [] }])).toBeNull();
  });
  it('sections a page by Taipei hour or day, keeping page order', () => {
    const items = ['2026-10-05T08:59:00Z', '2026-10-05T08:01:00Z', '2026-10-05T07:59:00Z', '2026-10-04T15:59:00Z'].map((publishedAt) => ({
      publishedAt,
    }));
    expect(sectionByTime(items, true).map((s) => [s.label, s.items.length])).toEqual([
      ['10/5 16:00', 2],
      ['10/5 15:00', 1],
      ['10/4 23:00', 1],
    ]);
    expect(sectionByTime(items, false).map((s) => [s.label, s.items.length])).toEqual([
      ['10/5（一）', 3],
      ['10/4（日）', 1],
    ]);
  });
  it('prints the Taipei clock time', () => {
    expect(taipeiClock('2026-10-04T16:05:00Z')).toBe('00:05');
  });
});

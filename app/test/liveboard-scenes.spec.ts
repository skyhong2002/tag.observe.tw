import { describe, expect, it } from 'vitest';
import { matchPrev } from '../src/v1/event-feed.ts';
import {
  countSeen,
  headlineDice,
  newestIds,
  newestOf,
  pickReports,
  rankBoard,
  type SceneRow,
  storyNeed,
  TagIndex,
  windowsAt,
} from '../src/v1/liveboard-scenes.ts';

const HOUR = 3600e3;
// 2026-10-15 17:30 in Taipei.
const now = Date.parse('2026-10-15T09:30:00Z');
const w = windowsAt(now);

describe('windowsAt', () => {
  it('starts today at Taipei midnight and the hours back from now', () => {
    expect(new Date(w.today).toISOString()).toBe('2026-10-14T16:00:00.000Z');
    expect(w.hour).toBe(now - HOUR);
    expect(w.previous).toBe(now - 2 * HOUR);
  });
});

describe('countSeen', () => {
  it('counts today by publish time and the two hours by collection time', () => {
    const counts = countSeen(
      [
        // Published this morning, collected just now: today and the last hour.
        { published: now - 8 * HOUR, crawled: now - 10 * 60e3 },
        // Published yesterday, collected 90 minutes ago: the hour before only.
        { published: w.today - HOUR, crawled: now - 1.5 * HOUR },
        // Date not read yet: no day, but it did arrive in the last hour.
        { published: null, crawled: now - 5 * 60e3 },
        // Collected three hours ago: today only.
        { published: now - 3 * HOUR, crawled: now - 3 * HOUR },
      ],
      w,
    );
    expect(counts).toMatchObject({ today: 2, hour: 2, previous: 1 });
    // The trail by collection hour, oldest first: three hours ago, 90 minutes ago, and twice in the last hour.
    expect(counts.hours.slice(-4)).toEqual([0, 1, 1, 2]);
    expect(counts.hours).toHaveLength(12);
  });
});

describe('TagIndex', () => {
  const seen = (h: number) => ({ published: now - h * HOUR, crawled: now - h * HOUR });
  const index = new TagIndex([
    { id: 1, seen: seen(0.5), tag: '台積電' },
    { id: 1, seen: seen(0.5), tag: '魏哲家' },
    { id: 2, seen: seen(1.5), tag: '台積電' },
    { id: 3, seen: seen(3), tag: 'TSMC' },
    { id: 3, seen: seen(3), tag: '魏哲家' },
  ]);
  it('finds articles carrying enough of the tags, case-insensitively', () => {
    expect(index.carrying(['台積電', '魏哲家'], 2)).toEqual([1]);
    expect(index.carrying(['tsmc', '魏哲家'], 2)).toEqual([3]);
    expect(index.carrying(['台積電', 'tsmc']).sort()).toEqual([1, 2, 3]);
  });
  it('counts each article once however many of the tags it carries', () => {
    expect(countSeen(index.seen(index.carrying(['台積電', '魏哲家', 'TSMC'])), w)).toMatchObject({ today: 3, hour: 1, previous: 1 });
  });
  it('asks two major tags of a story, or all of them when it has fewer', () => {
    expect(storyNeed(['台積電', '魏哲家', '法說會'])).toBe(2);
    expect(storyNeed(['油價'])).toBe(1);
  });
});

describe('rankBoard', () => {
  const row = (title: string, today: number, hour: number, media: string | null = null): SceneRow => ({
    key: title,
    title,
    href: '/',
    media,
    mediaTitle: media,
    counts: { today, hour, previous: 0, hours: [] },
  });
  it('keeps rows with articles today, most first, then the busiest hour', () => {
    const ranked = rankBoard([row('甲', 5, 0), row('乙', 0, 0), row('丙', 9, 1), row('丁', 5, 3)], { limit: 3 });
    expect(ranked.map((r) => r.title)).toEqual(['丙', '丁', '甲']);
  });
  it('keeps at most `perMedia` of one outlet', () => {
    const rows = [row('快訊一', 9, 0, 'pchome'), row('快訊二', 8, 0, 'pchome'), row('快訊三', 7, 0, 'pchome'), row('選舉', 6, 0, 'ltn')];
    expect(rankBoard(rows, { perMedia: 2 }).map((r) => r.title)).toEqual(['快訊一', '快訊二', '選舉']);
  });
});

describe('matchPrev', () => {
  it('hands back the previous event, score included', () => {
    const prev = [
      { threadId: 7, rank: 2, score: 31_500_000, major: ['台積電', '法說會'] },
      { threadId: 8, rank: 1, score: 40_000_000, major: ['颱風'] },
    ];
    expect(matchPrev({ threadId: 7, major: [] }, prev)?.score).toBe(31_500_000);
    expect(matchPrev({ threadId: 99, major: ['颱風', '停班'] }, prev)?.rank).toBe(1);
    expect(matchPrev({ threadId: 99, major: ['地震'] }, prev)).toBeNull();
  });
});

describe('pickReports', () => {
  const c = (id: number, media: string, title: string, minutesAgo: number, recent = minutesAgo <= 60) => ({
    id,
    media,
    title,
    date: now - minutesAgo * 60e3,
    recent,
  });
  it('folds copies into the earliest, one outlet before a second, the last hour first', () => {
    const picked = pickReports(
      [
        c(1, 'ctwant', '僑委會專報僅138字', 5),
        c(2, 'ctwant', '葉元之質疑護航', 10),
        c(3, 'ctwant', '羅智強酸：撒檸檬水', 15),
        c(4, 'cna', '僑委會出國報告遭批', 40),
        // The same dispatch run by two outlets, by text…
        c(5, 'udn', '僑委會出國報告遭批（轉載）', 30),
        // …and the same headline once more, spaced and punctuated differently.
        c(6, 'chinatimes', '僑委會 出國報告遭批！', 20),
        c(7, 'ltn', '外交部回應', 200),
      ],
      [{ aId: 4, bId: 5 }],
      10,
    );
    expect(picked).toEqual([
      // CTWANT's newest leads, then each other outlet once (the CNA dispatch with its copies), then CTWANT's others.
      { id: 1, copies: [] },
      { id: 4, copies: [5, 6] },
      { id: 2, copies: [] },
      { id: 3, copies: [] },
      { id: 7, copies: [] },
    ]);
  });
  it('lists a report filed twice by one outlet once, without calling it a copy', () => {
    expect(pickReports([c(1, 'udn', '同一篇', 5), c(2, 'udn', '同一篇', 6)], [], 5)).toEqual([{ id: 2, copies: [] }]);
  });
});

describe('copies by headline', () => {
  it('takes a lightly rewritten headline for the same report, not a different one on the story', () => {
    expect(headlineDice('台股重挫1655點外資賣超創新高！融資減51億', '台股跌1655點外資賣超創新高　融資減51.8億')).toBeGreaterThanOrEqual(
      0.7,
    );
    expect(headlineDice('外資狂倒3,000億元誰在接？台股ETF爆量', '台股重挫1655點外資賣超創新高！融資減51億')).toBeLessThan(0.7);
  });
  it('lets no outlet past two while others wait', () => {
    const titles = ['', '颱風逼近東部', '台股收盤重挫', '立院審預算', '大谷敲安打', '油價下週調漲', '流感疫苗開打'];
    const c = (id: number, media: string) => ({ id, media, title: titles[id], date: now - id * 60e3, recent: true });
    const picked = pickReports([c(1, 'pchome'), c(2, 'pchome'), c(3, 'pchome'), c(4, 'pchome'), c(5, 'udn'), c(6, 'cna')], [], 4);
    // One of each outlet first, then PChome's second; its third and fourth wait for room that never comes.
    expect(picked.map((p) => p.id)).toEqual([1, 5, 6, 2]);
  });
});

describe('newestOf', () => {
  it('names the latest arrival, so a quiet hour still says how long ago', () => {
    const seen = [
      { published: now - 3 * HOUR, crawled: now - 90 * 60e3 },
      { published: now - 5 * HOUR, crawled: now - 4 * HOUR },
    ];
    expect(newestOf(seen, w)).toBe(new Date(now - 90 * 60e3).toISOString());
    expect(newestOf([], w)).toBeNull();
  });
});

describe('newestIds', () => {
  it('keeps the newest few, newest first, nothing from the future', () => {
    const at = (id: number) => ({ published: id === 9 ? now + HOUR : now - id * 60e3, crawled: now - id * 60e3 });
    expect(newestIds([5, 1, 9, 3, 2, 8], at, w, 3)).toEqual([1, 2, 3]);
  });
});

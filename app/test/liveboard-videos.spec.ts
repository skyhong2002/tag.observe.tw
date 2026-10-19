import { describe, expect, it } from 'vitest';
import { boardOf, eventOf, liveRanked, matchVideos, type YoutubeLive, type YoutubeVideo } from '../src/v1/liveboard-videos.ts';

const video = (id: string, title: string, views: number | null, description = ''): YoutubeVideo => ({
  id,
  title,
  description,
  channelTitle: `頻道${id}`,
  thumbnail: null,
  publishedAt: '2026-10-19T03:00:00.000Z',
  views,
});

describe('matchVideos', () => {
  const major = ['法國', '馬克宏', '示威'];

  it('keeps videos holding two of the major tags, the most tags first, then the most viewed', () => {
    const lists = new Map([
      ['法國', [video('a', '法國示威擴大', 900), video('b', '法國美食', 5000), video('c', '馬克宏回應法國示威', 100)]],
      ['馬克宏', [video('c', '馬克宏回應法國示威', 100), video('d', '馬克宏訪台', 3000)]],
      ['示威', [video('a', '法國示威擴大', 900)]],
    ]);
    const got = matchVideos(major, lists);
    expect(got.map((v) => v.id)).toEqual(['c', 'a']);
    expect(got[0].matched).toEqual(['法國', '馬克宏', '示威']);
    expect(got[1].matched).toEqual(['法國', '示威']);
  });

  it('counts a tag named in the description, ignoring case', () => {
    const lists = new Map([['ai', [video('a', 'AI 晶片', 10, '日股今天大漲')]]]);
    expect(matchVideos(['AI', '日股'], lists).map((v) => v.matched)).toEqual([['AI', '日股']]);
  });

  it('needs every tag of an event with one, sorts unknown views last and caps the list', () => {
    const lists = new Map([['颱風', [video('a', '颱風動態', null), video('b', '颱風假', 5), video('c', '颱風路徑', 7)]]]);
    expect(matchVideos(['颱風'], lists, 2).map((v) => v.id)).toEqual(['c', 'b']);
  });

  it('keeps one upload of a broadcast and lets other channels in before a third of one channel', () => {
    const v = (id: string, title: string, views: number, channelTitle: string) => ({ ...video(id, title, views), channelTitle });
    const lists = new Map([
      [
        '颱風',
        [
          v('a', '【直播完整版】颱風今晚登陸 豪雨特報｜甲台', 900, '甲台'),
          v('b', '【直播完整版】颱風今晚登陸 豪雨特報｜乙台', 800, '乙台'),
          v('c', '颱風路徑北修', 700, '甲台'),
          v('d', '颱風假怎麼放', 600, '甲台'),
          v('e', '颱風外圍環流', 100, '丙台'),
        ],
      ],
    ]);
    expect(matchVideos(['颱風'], lists, 3).map((x) => x.id)).toEqual(['a', 'c', 'e']);
    expect(matchVideos(['颱風'], lists).map((x) => x.id)).toEqual(['a', 'c', 'd', 'e']);
  });

  it('links to YouTube when the listing has no URL', () => {
    const lists = new Map([['颱風', [video('x_1', '颱風', 1)]]]);
    expect(matchVideos(['颱風'], lists)[0].url).toBe('https://www.youtube.com/watch?v=x_1');
  });
});

describe('the day and live boards', () => {
  const events = [
    { href: '/eve/1/', major: ['法國', '馬克宏', '示威'] },
    { href: null, major: ['颱風'] },
  ];

  it('names the first event whose major tags a video holds', () => {
    expect(eventOf(video('a', '馬克宏回應法國示威', 1), events)).toEqual({ event: events[0], matched: ['法國', '馬克宏', '示威'] });
    expect(eventOf(video('b', '法國美食', 1), events)).toBeNull();
    expect(eventOf(video('c', '週末天氣', 1, '颱風外圍環流'), events)?.event.major).toEqual(['颱風']);
  });

  it('ranks live streams by viewers now, drops those without, and keeps one of a simulcast', () => {
    const live = (id: string, title: string, viewers: number | null, channelTitle: string): YoutubeLive => ({
      ...video(id, title, 0),
      channelTitle,
      currentViewers: viewers,
      todayPeak: viewers,
      startedAt: '2026-10-19T12:00:00.000Z',
      trend: [{ time: '2026-10-19T12:10:00.000Z', value: 5 }],
    });
    const rows = [
      live('a', '1019【Live】東森世界日報／颱風持續增強', 400, '東森新聞'),
      live('b', '少康戰情室', 41000, 'TVBS'),
      live('c', '1019【Live】東森世界日報／颱風持續增強', 300, '57爆新聞'),
      live('d', '彩券開獎', null, '彩券'),
    ];
    const board = boardOf(liveRanked(rows), events, (r) => ({
      live: { viewers: r.currentViewers ?? 0, peak: null, startedAt: null, trend: [] },
    }));
    expect(board.map((v) => v.id)).toEqual(['b', 'a']);
    expect(board[1].event?.major).toEqual(['颱風']);
    expect(board[1].live?.viewers).toBe(400);
  });
});

import { describe, expect, it } from 'vitest';
import { byUpdate, classifyTopic, dateFromStoryUrl, firstRunEnd, storyDate, topicStatus, topicUpdatedAt } from './topic-kind.ts';

const now = new Date('2026-10-04T00:00:00Z');
const daysAgo = (n: number) => new Date(+now - n * 86400e3);

describe('classifyTopic', () => {
  it('calls a page without stories a feature', () => {
    expect(classifyTopic({ storyDates: [], grew: false, now })).toEqual({ kind: 'feature', status: 'active' });
  });

  it('calls a short, long-finished burst of stories a feature', () => {
    expect(classifyTopic({ storyDates: [daysAgo(200), daysAgo(190), daysAgo(185)], grew: false, now }).kind).toBe('feature');
  });

  it('keeps a recent burst a topic until it has been quiet for a month', () => {
    expect(classifyTopic({ storyDates: [daysAgo(20), daysAgo(10)], grew: false, now })).toEqual({ kind: 'topic', status: 'active' });
  });

  it('calls a long span of stories a topic, ended after 90 quiet days', () => {
    expect(classifyTopic({ storyDates: [daysAgo(400), daysAgo(5)], grew: false, now })).toEqual({ kind: 'topic', status: 'active' });
    expect(classifyTopic({ storyDates: [daysAgo(400), daysAgo(120)], grew: false, now })).toEqual({ kind: 'topic', status: 'ended' });
  });

  it('treats observed growth as a topic whatever the span', () => {
    expect(classifyTopic({ storyDates: [daysAgo(200), daysAgo(195)], grew: true, now })).toEqual({ kind: 'topic', status: 'ended' });
    expect(classifyTopic({ storyDates: [daysAgo(40), daysAgo(35)], grew: true, now })).toEqual({ kind: 'topic', status: 'active' });
  });

  it('derives 已停更 only for topics', () => {
    expect(topicStatus('topic', daysAgo(91), now)).toBe('ended');
    expect(topicStatus('topic', daysAgo(89), now)).toBe('active');
    expect(topicStatus('feature', daysAgo(400), now)).toBe('active');
    expect(topicStatus('topic', null, now)).toBe('active');
  });
});

describe('dateFromStoryUrl', () => {
  // Dates are Taipei midnight: 16:00 UTC the day before.
  const day = (url: string) => dateFromStoryUrl(url, now)?.toISOString() ?? null;
  const nov28 = '2024-11-27T16:00:00.000Z';

  it('reads slash and dash dates', () => {
    expect(day('https://www.example.com/2024/11/28/story')).toBe(nov28);
    expect(day('newtalk.tw/news/view/2024-11-28/945123')).toBe(nov28);
  });

  it('reads YYYYMMDD runs inside path segments', () => {
    expect(day('www.ettoday.net/news/20241128/2871234.htm')).toBe(nov28);
    expect(day('www.cna.com.tw/news/aipl/202411280123.aspx')).toBe(nov28);
    expect(day('www.chinatimes.com/realtimenews/20241128001234-260407')).toBe(nov28);
    expect(day('www.cna.com.tw#202411280123')).toBe(nov28);
  });

  it('rejects a day that has not begun in Taipei', () => {
    const at = new Date('2026-10-04T12:59:00Z'); // 20:59 on 10/4 in Taipei
    expect(dateFromStoryUrl('news.pchome.com.tw/politics/idn/20261005/index-79113908610361224001.html', at)).toBeNull();
    expect(dateFromStoryUrl('news.pchome.com.tw/living/focusnews/20261004/index-1.html', at)?.toISOString()).toBe('2026-10-03T16:00:00.000Z');
  });

  it('reads ROC dates in 台視 story IDs', () => {
    expect(day('news.ttv.com.tw/news/11311280002400W')).toBe(nov28);
  });

  it('ignores numeric IDs that are not dates', () => {
    expect(day('news.ltn.com.tw/news/politics/breakingnews/4871234')).toBeNull();
    expect(day('udn.com/news/story/6656/83920112')).toBeNull();
    expect(day('www.setn.com/News.aspx?NewsID=1567890')).toBeNull();
    expect(day('example.com/news/20991231')).toBeNull();
  });
});

describe('topicUpdatedAt', () => {
  const seen = daysAgo(2);
  it('is the newest story when known, backlog or not', () => {
    expect(topicUpdatedAt({ storyLastAt: daysAgo(400), firstSeen: seen, backlog: false })).toEqual(daysAgo(400));
    expect(topicUpdatedAt({ storyLastAt: daysAgo(1), firstSeen: seen, backlog: true })).toEqual(daysAgo(1));
  });
  it('falls back to the first sighting, unknown for backlog', () => {
    expect(topicUpdatedAt({ storyLastAt: null, firstSeen: seen, backlog: false })).toEqual(seen);
    expect(topicUpdatedAt({ storyLastAt: null, firstSeen: seen, backlog: true })).toBeNull();
  });
});

describe('firstRunEnd', () => {
  it('ends the 15-minute bucket of the first run', () => {
    expect(firstRunEnd(new Date('2026-09-28T13:34:09Z'))).toEqual(new Date('2026-09-28T13:45:00Z'));
    expect(firstRunEnd(new Date('2026-09-28T13:45:00Z'))).toEqual(new Date('2026-09-28T14:00:00Z'));
  });
});

describe('byUpdate', () => {
  const t = (id: string, updatedAt: string | null, time = '2026-10-01T00:00:00Z') => ({ id, updatedAt, time });
  it('puts the most recently updated first and unknown last', () => {
    const items = [t('1', null), t('2', '2026-09-01T00:00:00Z'), t('3', '2026-10-03T00:00:00Z'), t('4', null, '2026-10-02T00:00:00Z')];
    expect(items.sort(byUpdate).map((i) => i.id)).toEqual(['3', '2', '4', '1']);
  });
  it('breaks ties by newest first sighting, then id', () => {
    const day = '2026-10-03T16:00:00Z';
    const items = [t('9', day, '2026-10-01T00:00:00Z'), t('7', day, '2026-10-02T00:00:00Z'), t('8', day, '2026-10-02T00:00:00Z')];
    expect(items.sort(byUpdate).map((i) => i.id)).toEqual(['7', '8', '9']);
  });
});

describe('storyDate', () => {
  const crawled = new Date('2026-09-30T01:00:00Z');
  it('prefers our crawled copy, then the date the topic page shows, then the URL', () => {
    const story = { key: 'www.ettoday.net/news/20260910/3235173.htm', date: '2026-09-11T02:00:00.000Z' };
    expect(storyDate(story, crawled, now)).toBe(crawled);
    expect(storyDate(story, undefined, now)?.toISOString()).toBe('2026-09-11T02:00:00.000Z');
    expect(storyDate({ key: story.key }, null, now)?.toISOString()).toBe('2026-09-09T16:00:00.000Z');
    expect(storyDate({ key: 'news.pts.org.tw/article/808692' }, null, now)).toBeNull();
    expect(storyDate({ key: 'news.pts.org.tw/article/808692', date: 'garbage' }, null, now)).toBeNull();
  });
});

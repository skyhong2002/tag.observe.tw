import { describe, expect, it } from 'vitest';
import { classifyTopic, dateFromStoryUrl, topicStatus } from './topic-kind.ts';

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

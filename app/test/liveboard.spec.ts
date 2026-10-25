import { describe, expect, it } from 'vitest';
import {
  bucketByCamp,
  groupStories,
  type LiveArticle,
  liveArticle,
  type PairRow,
  parseLiveQuery,
  pickTopics,
  readableText,
} from '../src/v1/liveboard.ts';
import { jobSchedules, nextCron, nextRun } from '../src/v1/liveboard-activity.ts';

const article = (id: number, minute: number, media = `m${id}`, title = `標題${id}`): LiveArticle => ({
  id,
  media,
  mediaTitle: media,
  camp: 'other',
  title,
  url: `https://example.com/${id}`,
  image: null,
  publishedAt: new Date(Date.UTC(2026, 9, 5, 0, minute)).toISOString(),
  datePending: false,
  tags: [],
  text: null,
  authors: [],
});
const pair = (aId: number, bId: number, score: number, computedMinute = 0): PairRow => ({
  aId,
  bId,
  score,
  containment: score,
  kind: score === 1 ? 'identical' : 'high',
  evidence: '共同段落',
  computedAt: new Date(Date.UTC(2026, 9, 5, 1, computedMinute)),
});
describe('liveboard API shaping', () => {
  it('keeps explicit citation evidence separate from stored author credits', () => {
    const date = new Date('2026-10-06T00:00:00Z');
    const result = liveArticle({
      id: 1,
      media: 'pchome',
      title: '新聞',
      url: 'https://example.com/',
      image: null,
      publishedAt: date,
      crawledAt: date,
      fetchedAt: date,
      tags: [],
      authors: ['中央社'],
      attributions: [{ media: 'afp', name: '法新社', country: '法國', countryCode: 'FR', kind: 'explicit', evidence: '法新社報導' }],
    });
    expect(result.authors).toEqual(['中央社']);
    expect(result.attributions).toEqual([expect.objectContaining({ media: 'afp', evidence: '法新社報導', kind: 'explicit' })]);
    expect(liveArticle({ ...result, publishedAt: date, crawledAt: date, fetchedAt: date, attributions: undefined }).attributions).toEqual(
      [],
    );
  });
  it('joins pairs into stories led by the earliest article', () => {
    const byId = new Map([article(1, 30), article(2, 0), article(3, 45), article(4, 50)].map((a) => [a.id, a]));
    const [story] = groupStories([pair(1, 2, 0.9), pair(1, 3, 0.6), pair(2, 4, 1, 5)], byId);
    expect(story.lead.id).toBe(2);
    expect(story.computedAt).toBe('2026-10-05T01:05:00.000Z');
    // 4 and 1 copy the lead directly; 3 only matches follower 1.
    expect(story.followers.map((f) => [f.article.id, f.direct, f.gapMinutes])).toEqual([
      [4, true, 50],
      [1, true, 30],
      [3, false, 45],
    ]);
  });
  it('keeps separate stories apart and skips pairs with unknown articles', () => {
    const byId = new Map([article(1, 0), article(2, 1), article(3, 2), article(4, 3)].map((a) => [a.id, a]));
    expect(groupStories([pair(1, 2, 0.8), pair(3, 4, 0.8), pair(4, 99, 0.9)], byId)).toHaveLength(2);
  });
  it('buckets counts per camp and drops rows outside the window', () => {
    const end = Date.UTC(2026, 9, 5, 2);
    const rows = [
      { media: 'x', at: end - 3600e3, n: 2 },
      { media: 'x', at: end - 1, n: 1 },
      { media: 'x', at: end, n: 5 },
    ];
    const buckets = bucketByCamp(rows, end, 3600e3, 2);
    expect(buckets.map((b) => b.other)).toEqual([0, 3]);
    expect(buckets[0].t).toBe('2026-10-05T00:00:00.000Z');
  });
  it('validates cursors', () => {
    expect(parseLiveQuery({})).toEqual({ after: null, pairsAfter: null, readAfter: null });
    expect(parseLiveQuery({ readAfter: 'x' })).toEqual({ error: 'bad readAfter' });
    expect(parseLiveQuery({ after: '12' })).toMatchObject({ after: 12 });
    expect(parseLiveQuery({ after: '-1' })).toEqual({ error: 'bad after' });
    expect(parseLiveQuery({ pairsAfter: 'soon' })).toEqual({ error: 'bad pairsAfter' });
  });
});

describe('liveboard worker schedule', () => {
  // 2026-10-05 23:01 in Taipei.
  const now = Date.UTC(2026, 9, 5, 15, 1);
  it('finds the next cron minute in Taipei time', () => {
    expect(new Date(nextCron('4,34 * * * *', now)!).toISOString()).toBe('2026-10-05T15:04:00.000Z');
    expect(new Date(nextCron('15 4 * * *', now)!).toISOString()).toBe('2026-10-05T20:15:00.000Z');
    // Monday 05:30 Taipei; 10-05 is a Monday, so the next is a week later.
    expect(new Date(nextCron('30 5 * * 1', now)!).toISOString()).toBe('2026-10-11T21:30:00.000Z');
    expect(new Date(nextCron('*/15 * * * *', now)!).toISOString()).toBe('2026-10-05T15:15:00.000Z');
  });
  it('runs `every` schedules on multiples of the period and honours env overrides', () => {
    const schedules = jobSchedules({ CRAWL_NEWS_MINUTES: '5', CRAWL_ENABLED: '1' });
    const news = schedules.find((s) => s.job === 'crawl-news')!;
    expect(new Date(nextRun(news, now)!).toISOString()).toBe('2026-10-05T15:05:00.000Z');
    // A recorded start carries BullMQ's offset forward.
    expect(new Date(nextRun(news, now, now - 3 * 60e3 - 20e3)!).toISOString()).toBe('2026-10-05T15:02:40.000Z');
    expect(jobSchedules({ CRAWL_ENABLED: '0' }).some((s) => s.job.startsWith('crawl-') && s.job !== 'crawl-health')).toBe(false);
    expect(jobSchedules({}).some((s) => s.job === 'analytics')).toBe(false);
  });
});

describe('liveboard topics', () => {
  it('keeps at most two updates per outlet, newest first', () => {
    const t = (media: string, minute: number) => ({ media, at: new Date(Date.UTC(2026, 9, 5, 0, minute)).toISOString() });
    expect(pickTopics([t('a', 1), t('a', 3), t('a', 2), t('b', 0)]).map((x) => `${x.media}${x.at.slice(14, 16)}`)).toEqual([
      'a03',
      'a02',
      'b00',
    ]);
  });
});

describe('liveboard readable text', () => {
  it('keeps prose paragraphs and drops page chrome', () => {
    const chrome = '美利達\n\nOEM\n\n2026-10-05 16:11\n\n上一篇\n\n美伊戰火影響出口 豐興與台鋼鋼筋新價漲300元、後市看旺採購潮湧現';
    expect(readableText(chrome, 600)).toBeNull();
    const body =
      '記者王凱暄／綜合報導\n\n由於伺服器、高速交換器帶動高階銅箔基板需求大增，外資點名看好後續營運動能。\n  外資指出，台燿成長動能主要集中於伺服器、高速交換器。';
    expect(readableText(body, 600)).toBe(
      '由於伺服器、高速交換器帶動高階銅箔基板需求大增，外資點名看好後續營運動能。\n外資指出，台燿成長動能主要集中於伺服器、高速交換器。',
    );
    expect([...readableText(body, 10)!].length).toBe(10);
    expect(readableText(null, 10)).toBeNull();
  });
});

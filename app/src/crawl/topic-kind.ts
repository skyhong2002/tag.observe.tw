import type { TopicKind } from './topics.ts';

// 議題 vs 專題 by behaviour, not by what the outlet calls the page: a topic
// keeps gaining stories; a feature is a package published in one go.
const DAY = 86400e3;
export const FEATURE_SPAN_DAYS = 21;
export const FEATURE_QUIET_DAYS = 30;
export const ENDED_DAYS = 90;

export type TopicStatus = 'active' | 'ended';

export function classifyTopic({ storyDates, grew, now }: { storyDates: Date[]; grew: boolean; now: Date }): {
  kind: TopicKind;
  status: TopicStatus;
} {
  const times = storyDates.map((d) => +d).filter((t) => Number.isFinite(t));
  if (!times.length) return grew ? { kind: 'topic', status: 'active' } : { kind: 'feature', status: 'active' };
  const first = Math.min(...times);
  const last = Math.max(...times);
  const status = topicStatus('topic', new Date(last), now);
  // Observed growth is proof of a running topic, however short its span so far.
  if (grew) return { kind: 'topic', status };
  if (last - first <= FEATURE_SPAN_DAYS * DAY && +now - last > FEATURE_QUIET_DAYS * DAY) return { kind: 'feature', status: 'active' };
  return { kind: 'topic', status };
}

/** 已停更: a topic whose newest story is over 90 days old. Derived at read time. */
export function topicStatus(kind: string, storyLastAt: Date | null, now: Date): TopicStatus {
  return kind === 'topic' && storyLastAt && +now - +storyLastAt > ENDED_DAYS * DAY ? 'ended' : 'active';
}

// Taipei midnight of a calendar date, or null when it is not a real date.
function taipeiDate(y: number, m: number, d: number, now: Date): Date | null {
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, m - 1, d) - 8 * 3600e3;
  const check = new Date(t + 8 * 3600e3);
  if (check.getUTCMonth() !== m - 1 || t > +now + DAY) return null;
  return new Date(t);
}

/**
 * The publish date embedded in a story URL or url_key, for stories we never
 * crawled: /2024/11/28/, /2024-11-28/, an 8/12/14-digit run starting with
 * YYYYMMDD (ETtoday /news/20241128/…, CNA /news/aipl/202411280123.aspx), or
 * 台視's ROC-dated IDs (11311280002400W = 民國113年11月28日).
 */
export function dateFromStoryUrl(url: string, now = new Date()): Date | null {
  let m = /\/((?:19|20)\d{2})\/(\d{1,2})\/(\d{1,2})(?:[/?#.]|$)/.exec(url);
  if (m) return taipeiDate(+m[1], +m[2], +m[3], now);
  m = /(?:^|[/#=_-])((?:19|20)\d{2})-(\d{2})-(\d{2})(?:[/?#.]|$)/.exec(url);
  if (m) return taipeiDate(+m[1], +m[2], +m[3], now);
  for (const run of url.matchAll(/(?:^|[^\d])(\d{8}|\d{12}|\d{14})(?=[^\d]|$)/g)) {
    const date = taipeiDate(+run[1].slice(0, 4), +run[1].slice(4, 6), +run[1].slice(6, 8), now);
    if (date) return date;
  }
  m = /(?:^|[/#=])(1[0-2]\d)(\d{2})(\d{2})\d{6,8}[A-Z](?:[/?#.]|$)/.exec(url);
  if (m) return taipeiDate(+m[1] + 1911, +m[2], +m[3], now);
  return null;
}

import type { FeedTopic, TopicMedia } from './pages';
import { updatedAtOf } from './topic-update.mts';

export interface HomeTopicsSummary {
  outlets: number;
  today: number;
  latest: FeedTopic[];
}
export function summarizeHomeTopics(data: { media: TopicMedia[]; feed?: FeedTopic[] } | null, now = Date.now()): HomeTopicsSummary | null {
  if (!data || !Array.isArray(data.media) || (data.feed !== undefined && !Array.isArray(data.feed))) return null;
  const feed = (data.feed ?? []).filter((t) => t && typeof t.title === 'string' && t.title && updatedAtOf(t));
  return {
    outlets: data.media.length,
    today: feed.filter((t) => now - Date.parse(updatedAtOf(t) ?? '') < 86400e3).length,
    latest: feed.filter((t, i) => feed.findIndex((u) => u.media === t.media) === i).slice(0, 5),
  };
}
export async function fetchHomeTopics(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<HomeTopicsSummary> {
  const res = await fetcher('/api/v1/topics?limit=120&kind=topic', {
    cache: 'no-store',
    signal,
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw Error('Topics temporarily unavailable');
  let result: HomeTopicsSummary | null;
  try {
    result = summarizeHomeTopics(await res.json());
  } catch {
    throw Error('Invalid topics response');
  }
  if (!result) throw Error('Invalid topics response');
  return result;
}

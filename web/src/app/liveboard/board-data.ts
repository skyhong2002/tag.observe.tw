import { API_ORIGIN, fetchMedia } from '@/lib/api';
import { readEvents, readFeed } from '@/lib/liveboard-view.mts';

async function get(path: string) {
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function loadBoard() {
  const [feed, events, media] = await Promise.all([
    get('/api/v1/liveboard'),
    get('/api/v1/events?limit=12'),
    fetchMedia().catch(() => ({})),
  ]);
  return { initialFeed: readFeed(feed), initialEvents: readEvents(events), media: media ?? {} };
}

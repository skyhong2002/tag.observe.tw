import { API_ORIGIN } from './api';
import type { EventsSnapshot } from './pages';

/** Retry cold-start failures outside the data cache and React request memoization. */
export async function fetchEventSnapshot(limit: number, at?: string): Promise<EventsSnapshot | null> {
  const url = `${API_ORIGIN}/api/v1/events?limit=${limit}${at ? `&at=${encodeURIComponent(at)}` : ''}`;
  let empty: EventsSnapshot | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const response = await fetch(url, {
        ...(attempt ? { cache: 'no-store' as const } : { next: { revalidate: 120 } }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        if (response.status < 500 && response.status !== 408 && response.status !== 429) return null;
        continue;
      }
      const data = (await response.json()) as EventsSnapshot;
      if (!Array.isArray(data.events)) continue;
      if (data.events.length || at) return data;
      // A cached empty current snapshot should not hide newly available events.
      empty = data;
    } catch {
      // Connection resets, timeouts and interrupted JSON bodies are retryable too.
    }
  }
  return empty;
}

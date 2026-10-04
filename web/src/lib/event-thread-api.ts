import { API_ORIGIN } from './api';

// One event thread's API resources. The /eve/[id]/ page and its footer notes
// (@notes/eve/[id]) request the same URLs with the same options, so each is
// fetched once per render.

export const threadUrl = (id: string) => `${API_ORIGIN}/api/v1/events/threads/${encodeURIComponent(id)}`;

/** The thread (`''`), its `/coverage` or its `/series`; null when the API says no. */
export async function fetchThreadPart<T>(id: string, part: '' | '/coverage' | '/series'): Promise<T | null> {
  const res = await fetch(`${threadUrl(id)}${part}`, { next: { revalidate: part === '/series' ? 300 : 120 } });
  return res.ok ? ((await res.json()) as T) : null;
}

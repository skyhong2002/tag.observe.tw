import { API_ORIGIN } from './api';

// One event thread's API resources. The /eve/[id]/ page and its footer notes
// (@notes/eve/[id]) request the same URLs with the same options, so each is
// fetched once per render.

export const threadUrl = (id: string) => `${API_ORIGIN}/api/v1/events/threads/${encodeURIComponent(id)}`;

/**
 * The thread (`''`), its `/coverage` or its `/series`; null when the API says
 * there is no such thread (404, or 400 for an id that cannot be one). Any other failure of the thread itself throws,
 * so the page shows its error boundary (with a retry) instead of a 404 that
 * would tell the reader the event does not exist. Coverage and series are
 * optional extras: they fall back to null.
 */
export async function fetchThreadPart<T>(id: string, part: '' | '/coverage' | '/series'): Promise<T | null> {
  const res = await fetch(`${threadUrl(id)}${part}`, { next: { revalidate: part === '/series' ? 300 : 120 } });
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404 || res.status === 400 || part !== '') return null;
  throw new Error(`/api/v1/events/threads/${id} -> ${res.status}`);
}

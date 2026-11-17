import { API_ORIGIN } from './api';
import { sharedFetch } from './shared-fetch.mts';

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
  const url = `${threadUrl(id)}${part}`;
  const revalidate = part === '/series' ? 300 : 120;
  const load = async () => {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new ThreadStatus(res.status);
    return (await res.json()) as T;
  };
  try {
    // Coverage can exceed Next's 2 MB data-cache limit; renders share one
    // parsed copy instead (lib/shared-fetch.mts). Treat it as read-only.
    return await (part === '/coverage' ? sharedFetch(url, revalidate * 1000, load) : load());
  } catch (error) {
    if (!(error instanceof ThreadStatus)) throw error;
    if (error.status === 404 || error.status === 400 || part !== '') return null;
    throw new Error(`/api/v1/events/threads/${id} -> ${error.status}`);
  }
}

class ThreadStatus extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

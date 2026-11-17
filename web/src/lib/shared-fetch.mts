// Next's data cache refuses responses over 2 MB (similarity, event coverage,
// topic stories), so every render fetched and parsed its own copy. Under a
// crawler burst that kept dozens of these copies alive at once, and tag-web ran
// out of heap (#36). This keeps one parsed copy per URL in this process: renders
// that arrive together wait on the same request, and later ones reuse it until
// it is `ttlMs` old. Failures are not kept. Callers must treat the value as
// read-only, because it is shared between requests.

interface Entry {
  value: Promise<unknown>;
  expires: number;
}

export interface SharedFetch {
  <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

// A parsed 2–3 MB response can hold 10–20 MB of heap, so keep only a few.
export function createSharedFetch(maxEntries = 8, now: () => number = Date.now): SharedFetch {
  const entries = new Map<string, Entry>();
  const shared = (<T,>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => {
    const found = entries.get(key);
    if (found && found.expires > now()) return found.value as Promise<T>;
    for (const [other, entry] of entries) if (entry.expires <= now()) entries.delete(other);
    // Still loading: expires stays open until the load settles.
    const entry: Entry = { value: load(), expires: Number.POSITIVE_INFINITY };
    entries.set(key, entry);
    entry.value.then(
      () => {
        if (entries.get(key) === entry) entry.expires = now() + ttlMs;
      },
      () => {
        if (entries.get(key) === entry) entries.delete(key);
      },
    );
    // Oldest first: Map keeps insertion order.
    for (const oldest of entries.keys()) {
      if (entries.size <= maxEntries) break;
      entries.delete(oldest);
    }
    return entry.value as Promise<T>;
  }) as SharedFetch;
  shared.clear = () => entries.clear();
  return shared;
}

export const sharedFetch = createSharedFetch();

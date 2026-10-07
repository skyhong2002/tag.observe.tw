export const READER_KEY = 'tag-reader-presence';
const MAX_AGE = 24 * 60 * 60 * 1000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/** Shared by tabs, rotated daily; no fallback that would count each tab separately. */
export function readerId(storage: Pick<Storage, 'getItem' | 'setItem'>, uuid: () => string, now = Date.now()): string | null {
  try {
    const raw = storage.getItem(READER_KEY);
    let saved: { id?: string; expires?: number } | null = null;
    try {
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      /* Replace corrupt state. */
    }
    if (
      saved &&
      typeof saved.id === 'string' &&
      UUID.test(saved.id) &&
      typeof saved.expires === 'number' &&
      saved.expires > now &&
      saved.expires <= now + MAX_AGE
    )
      return saved.id;
    const id = uuid();
    storage.setItem(READER_KEY, JSON.stringify({ id, expires: now + MAX_AGE }));
    return id;
  } catch {
    return null;
  }
}

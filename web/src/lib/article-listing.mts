// Pure helpers for the 最新文章 listing: which of the period's main event
// threads an article belongs to, and the hour or day sections of a page.

const TPE = 8 * 3600e3;

/** The heaviest thread whose major tags the article carries: two shared tags,
 *  or the only one when a thread has a single major tag. Threads come
 *  heaviest first, so the first match wins. */
export function matchThread<T extends { majorTags: readonly string[] }>(tags: readonly string[], threads: readonly T[]): T | null {
  if (tags.length === 0) return null;
  const mine = new Set(tags);
  for (const t of threads) {
    const shared = t.majorTags.filter((tag) => mine.has(tag)).length;
    if (shared >= Math.min(2, t.majorTags.length) && shared > 0) return t;
  }
  return null;
}

export interface TimeSection<T> {
  key: string;
  label: string;
  items: T[];
}

/** Consecutive articles of one Taipei hour (a one-day listing) or one Taipei
 *  day (longer ones), in page order. */
export function sectionByTime<T extends { publishedAt: string }>(items: readonly T[], byHour: boolean): TimeSection<T>[] {
  const out: TimeSection<T>[] = [];
  for (const item of items) {
    const d = new Date(Date.parse(item.publishedAt) + TPE);
    const day = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    const key = byHour ? d.toISOString().slice(0, 13) : d.toISOString().slice(0, 10);
    const label = byHour ? `${day} ${String(d.getUTCHours()).padStart(2, '0')}:00` : `${day}（${'日一二三四五六'[d.getUTCDay()]}）`;
    const last = out.at(-1);
    if (last?.key === key) last.items.push(item);
    else out.push({ key, label, items: [item] });
  }
  return out;
}

/** HH:MM in Taipei; the section header already says which hour or day. */
export function taipeiClock(iso: string): string {
  const d = new Date(Date.parse(iso) + TPE);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

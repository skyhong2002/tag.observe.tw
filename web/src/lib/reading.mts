export type ReadingParams = { cursor?: string | string[]; hours?: string | string[]; q?: string | string[] };

// Older event snapshots may predate stored article IDs. Keep those links on
// the site's search page instead of unexpectedly navigating to the publisher.
export function articleHref(article: { id?: number | null; title: string }): string {
  return article.id && Number.isSafeInteger(article.id) && article.id > 0
    ? `/article/${article.id}/`
    : `/search/?${new URLSearchParams({ q: article.title.slice(0, 60) })}`;
}

/** Keep only the list's own filters, including when returning from an article. */
export function readingQuery(params: ReadingParams): URLSearchParams | null {
  const query = new URLSearchParams();
  for (const key of ['hours', 'cursor'] as const) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined) continue;
    if (!/^[1-9]\d{0,15}$/.test(value) || !Number.isSafeInteger(Number(value))) return null;
    if (key === 'hours' && Number(value) > 168) return null;
    query.set(key, value);
  }
  const keyword = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim();
  if (keyword && keyword.length > 60) return null;
  if (keyword) query.set('q', keyword);
  return query;
}

export function withReadingQuery(path: string, query: URLSearchParams): string {
  return query.size ? `${path}?${query}` : path;
}

export function readingTitle(title: string): { section: string | null; title: string } {
  const match = /^\[([^\]]{1,20})\]\s*([\s\S]+)$/.exec(title);
  return match ? { section: match[1], title: match[2] } : { section: null, title: title || '未提供標題' };
}

export function readingParagraphs(body: string): string[] {
  return body
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean);
}

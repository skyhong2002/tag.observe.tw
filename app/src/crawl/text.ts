const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  copy: '©',
};
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
export const stripTags = (s: string): string => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '');
/** PHP-style slice: text between the first `start` (after `from`) and the following `end`; '' when absent. */
export function between(text: string, start: string, end: string, from = 0, max = Number.POSITIVE_INFINITY): string {
  const a = text.indexOf(start, from);
  if (a < 0) return '';
  const b = a + start.length;
  const c = text.indexOf(end, b);
  if (c < 0) return text.slice(b, b + Math.min(max, 100000));
  return text.slice(b, Math.min(c, b + max));
}
export function normalizeTag(t: string): string {
  return decodeEntities(stripTags(t)).replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
}
export function tagsToLegacy(tags: string[]): string {
  return tags.map((t) => `[${t}]`).join('');
}
export function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

// Dedup key for article URLs: scheme-less, lowercase host, default port and
// fragment dropped, tracking parameters removed, trailing slash ignored. Query
// strings that identify the article (e.g. detail.php?sn=1) are kept.
const TRACKING = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|yclid|igshid|mc_cid|mc_eid|_ga|spm|rec)$/i;
export function urlKey(raw: string, articleId?: string): string {
  try {
    const u = new URL(raw);
    const id = articleId ? new RegExp(articleId).exec(u.pathname + u.search)?.[1] : undefined;
    if (id) return `${u.hostname.toLowerCase()}#${id}`.slice(0, 512);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    const port = u.port && u.port !== '80' && u.port !== '443' ? `:${u.port}` : '';
    const search = u.searchParams.toString();
    return (u.hostname.toLowerCase() + port + u.pathname.replace(/\/+$/, '') + (search ? `?${search}` : '')).slice(0, 512);
  } catch {
    return raw.slice(0, 512);
  }
}

// Drops tracking parameters (and the fragment) but keeps the URL otherwise intact.
export function stripTracking(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return raw;
  }
}

export function stripTitleSuffix(title: string, suffix: string | undefined): string {
  return suffix ? title.replace(new RegExp(`(?:${suffix})\\s*$`), '').trim() : title;
}

// After a vote, an upload or an admin's choice changes a tag's picture, the
// gateway asks the web server to rebuild the home page (its cloud draws the
// pictures) and the tag's page at once, instead of waiting out their caches
// (docs/tag-pictures.md). The web server only listens on localhost and the
// gateway refuses /internal/ from outside, so only the gateway reaches it.
// Fire and forget: a failure only means the old caches run out as before.

export const REVALIDATE_PATH = '/internal/revalidate/';

export function tagPaths(tag: string) {
  return ['/', `/tag/${tag}`, `/tag/${encodeURIComponent(tag)}`];
}

export function refreshPages(uiOrigin: string | null, tag: string, fetchImpl: typeof fetch = fetch) {
  if (!uiOrigin) return;
  fetchImpl(`${uiOrigin}${REVALIDATE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paths: tagPaths(tag) }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

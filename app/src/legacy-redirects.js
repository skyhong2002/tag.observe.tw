// Old tag.analysis.tw URL shapes (Apache rewrite rules) mapped onto the new
// site. The old site keeps running on its own domain; here old links land on
// the closest new page instead of being proxied to it.

export const API_REPLACEMENTS = {
  '/api/tag.php': '/api/v1/ranking',
  '/api/tag_burst.php': '/api/v1/ranking?order=burst',
  '/api/show_index.php': '/api/v1/ranking?order=score',
  '/api/show_history.php': '/api/v1/tags/{tag}/series',
  '/api/social.php': null,
  '/api/social_rank.php': null,
  '/api/news.php': '/api/v1/media/{media}',
  '/api/news_data.php': '/api/v1/tags/{tag}/articles',
  '/api/media.php': '/api/v1/media',
  '/api/favicon.php': '/api/v1/media',
  '/api/events.php': '/api/v1/events',
  '/api/group.php': null,
  '/api/youtube.php': null,
  '/api/facebook_id.php': null,
  '/api/queue.php': null,
};

const seg = (s) => encodeURIComponent(safeDecode(s));
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** @returns {null | { status: 301, location: string } | { status: 410, body: object }} */
export function legacyRoute(rawUrl) {
  const q = rawUrl.indexOf('?');
  const path = q < 0 ? rawUrl : rawUrl.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : rawUrl.slice(q + 1));
  // Next's generated share images are current routes, not old tag subpages.
  // Route groups add a hash suffix; the query string is only a cache version.
  if (/^\/(?:tag\/[^/]+|eve\/[1-9]\d*)\/opengraph-image(?:-[a-z0-9]+)?\/?$/.test(path)) return null;
  let m;
  if (path.startsWith('/api/') && path.endsWith('.php')) {
    const replacement = Object.hasOwn(API_REPLACEMENTS, path) ? API_REPLACEMENTS[path] : null;
    return {
      status: 410,
      body: {
        error: 'gone',
        message: 'The legacy PHP API is not served on tag.observe.tw. The original remains at https://tag.analysis.tw' + path,
        replacement,
        docs: 'https://tag.observe.tw/api/',
      },
    };
  }
  if (path === '/index.php' || path === '/index.html')
    return { status: 301, location: params.get('type') ? `/ranking/?category=${encodeURIComponent(params.get('type'))}` : '/' };
  if (path === '/tag.php' && params.get('tag')) return { status: 301, location: `/tag/${encodeURIComponent(params.get('tag'))}/` };
  if ((m = /^\/cat\/([^/]+)\/tag\/([^/]+)(\/.*)?$/.exec(path))) return { status: 301, location: `/tag/${seg(m[2])}/` };
  // Legacy hourly archive (/event/2026-09-28/08/) maps onto the new one.
  if ((m = /^(?:\/cat\/[^/]+)?\/event\/(\d{4}-\d{2}-\d{2})(?:\/(\d{1,2}))?\/?$/.exec(path))) {
    if (!m[2]) return { status: 301, location: `/event/archive/?day=${m[1]}` };
    const at = new Date(Date.parse(`${m[1]}T${m[2].padStart(2, '0')}:00:00+08:00`));
    if (!Number.isNaN(at.getTime())) return { status: 301, location: `/event/?at=${encodeURIComponent(at.toISOString())}` };
  }
  if ((m = /^\/cat\/([^/]+)\/event(\/.*)?$/.exec(path))) return { status: 301, location: '/event/' };
  if ((m = /^\/cat\/([^/]+)\/.+$/.exec(path))) return { status: 301, location: `/ranking/?category=${seg(m[1])}` };
  if ((m = /^\/tag\/([^/]+)\/.+$/.exec(path))) return { status: 301, location: `/tag/${seg(m[1])}/` };
  if (
    path === '/event.php' ||
    path === '/events.php' ||
    path === '/eve.php' ||
    /^\/events\//.test(path) ||
    (/^\/event\/.+/.test(path) && !/^\/event\/archive\/?$/.test(path)) ||
    /^\/eve\/[^/]*[^\d/][^/]*\/?/.test(path)
  )
    return { status: 301, location: '/event/' };
  if (path === '/topic/media.php' || path === '/topic/index.php') {
    const media = params.get('media');
    return { status: 301, location: media && /^[a-z]+$/.test(media) ? `/topic/${media}/` : '/topic/' };
  }
  // The article archive is a current UI route, not a legacy media subpage.
  if (/^\/media\/[^/]+\/articles\/?$/.test(path)) return null;
  if ((m = /^\/news\/([a-z0-9_]+)\/.*$/.exec(path)) || (m = /^\/media\/([a-z0-9_]+)\/.+$/.exec(path)))
    return { status: 301, location: `/media/${m[1]}/` };
  if (path === '/news_media.php' && params.get('media'))
    return { status: 301, location: `/media/${encodeURIComponent(params.get('media'))}/` };
  return null;
}

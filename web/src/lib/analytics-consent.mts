// Who sends GA data, decided before the Google tag is mounted (SiteAnalytics):
// only production tag.observe.tw, never automation, never a browser whose owner
// chose 不計入統計 on /observe/opt-out/. Dependency-free for the root test suite.

export const GA_ID = 'G-D1E1CZSX7L';
export const OPT_OUT_KEY = 'tag-analytics-opt-out';
/** Fired on window when this browser's choice changes (same tab; other tabs get `storage`). */
export const OPT_OUT_EVENT = 'tag-analytics-opt-out-change';

export type AnalyticsBlock = 'environment' | 'automation' | 'opt-out' | 'privacy' | 'page' | null;

interface Env {
  production: boolean;
  hostname: string;
  webdriver: boolean | undefined;
  userAgent: string;
  optedOut: boolean;
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  pathname?: string;
  search?: string;
}

// Headless browsers and auditing tools that may not set navigator.webdriver.
const AUTOMATION_UA = /HeadlessChrome|Chrome-Lighthouse|Lighthouse|PTST|Playwright|Puppeteer|Cypress|Selenium|bot\b|crawler|spider/i;

/** Why GA must stay off for this page load, or null when it may run. */
export function analyticsBlock(env: Env): AnalyticsBlock {
  if (!env.production || env.hostname !== 'tag.observe.tw') return 'environment';
  if (env.webdriver === true || AUTOMATION_UA.test(env.userAgent)) return 'automation';
  if (env.optedOut) return 'opt-out';
  if (env.doNotTrack === '1' || env.doNotTrack === 'yes' || env.globalPrivacyControl) return 'privacy';
  if (env.pathname && !publicPage(env.pathname + (env.search ?? ''), 'https://tag.observe.tw')) return 'page';
  return null;
}

/** A visible wall board remains in use even without clicks or navigation. */
export function shouldReportLiveboardActivity(pathname: string, visibility: string, optedOut: boolean): boolean {
  return /^\/liveboard\/?$/.test(pathname) && visibility === 'visible' && !optedOut;
}

/** Storage can throw (disabled, sandboxed); an unreadable choice counts as not opted out. */
export function readOptOut(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return storage?.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOptOut(storage: Pick<Storage, 'setItem' | 'removeItem'>, optedOut: boolean) {
  if (optedOut) storage.setItem(OPT_OUT_KEY, '1');
  else storage.removeItem(OPT_OUT_KEY);
}

/**
 * select_content target for a same-site link: an event's numeric thread id or a
 * tag's text (public site content, GA caps values at 100 characters). Anything
 * else (query strings, other paths, odd characters) sends no content_id.
 */
export function selectContentTarget(pathname: string): { content_type: 'event' | 'tag'; content_id?: string } | null {
  const event = /^\/eve\/([^/]+)/.exec(pathname);
  if (event) return /^[1-9]\d{0,15}$/.test(event[1]) ? { content_type: 'event', content_id: event[1] } : { content_type: 'event' };
  const tag = /^\/tag\/([^/]+)/.exec(pathname);
  if (!tag) return null;
  let text: string;
  try {
    text = decodeURIComponent(tag[1]).normalize('NFC').trim();
  } catch {
    return { content_type: 'tag' };
  }
  const safe = text.length > 0 && text.length <= 100 && !/[\p{Cc}\p{Cf}<>"'`\\/]/u.test(text) && !/^https?:|@/i.test(text);
  return safe ? { content_type: 'tag', content_id: text } : { content_type: 'tag' };
}

export interface PublicPage {
  type: string;
  path: string;
}
// Unknown and functional routes fail closed. No query parameters are measured:
// even a benign filter can become GA history's full previous URL on a later hit.
const PUBLIC_PATHS = new Set([
  '/',
  '/article',
  '/byline',
  '/journalist',
  '/media',
  '/media/traffic',
  '/media/crawlers',
  '/media/sources',
  '/feature',
  '/crawlers',
  '/crawlers/traffic',
  '/event',
  '/event/archive',
  '/topic',
  '/ranking',
  '/observe',
  '/method',
  '/readers',
  '/group',
  '/writing',
  '/writing/titles',
  '/api',
  '/api/status',
  '/similarity',
  '/similarity/reposts',
  '/similarity/sources',
  '/similarity/about',
  '/similarity/daily',
  '/liveboard',
  '/liveboard/setting',
  '/liveboard/settings',
]);
export function publicPage(href: string, origin: string): PublicPage | null {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin || url.search || href.split('#')[0].includes('?')) return null;
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (!PUBLIC_PATHS.has(path)) {
      const numeric = /^\/(article|eve|group)\/[1-9]\d{0,15}(?:\/headlines)?$/.test(path);
      const outlet = /^\/(media|feature|topic)\/[a-z0-9_-]{1,100}(?:\/(?:articles|references|[1-9]\d{0,15}))?$/.test(path);
      const named = /^\/(tag|journalist|byline|cat)\/([^/]+)(?:\/picture)?$/.exec(path);
      const safeName = named && selectContentTarget('/tag/' + named[2])?.content_id;
      if (!numeric && !outlet && !safeName) return null;
    }
    return { type: path.split('/')[1] || 'home', path: url.pathname };
  } catch {
    return null;
  }
}
export function pageFields(origin: string, page: PublicPage, referrer: string) {
  let from = '';
  try {
    const url = new URL(referrer);
    if (/^https?:$/.test(url.protocol)) from = url.origin;
  } catch {}
  return { page_location: origin + page.path, page_title: page.type === 'liveboard' ? '即時看板' : '新文易數', page_referrer: from };
}
export function classifyClick(href: string, kind: string | undefined, origin: string, source_page_type: string) {
  try {
    const url = new URL(href, origin);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (kind === 'open_original' && url.origin !== origin)
      return { name: 'open_original', params: { source_page_type, link_domain: url.hostname } };
    if (url.origin !== origin) return null;
    if (url.pathname.startsWith('/feeds/')) return { name: 'rss_click', params: { source_page_type } };
    if (!publicPage(url.href, origin)) return null;
    const target = selectContentTarget(url.pathname);
    return target ? { name: 'select_content', params: { source_page_type, ...target } } : null;
  } catch {
    return null;
  }
}

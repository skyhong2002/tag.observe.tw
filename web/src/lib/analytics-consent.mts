// Who sends GA data, decided before the Google tag is mounted (SiteAnalytics):
// only production tag.observe.tw, never automation, never a browser whose owner
// chose 不計入統計 on /observe/opt-out/. Dependency-free for the root test suite.

export const GA_ID = 'G-D1E1CZSX7L';
export const OPT_OUT_KEY = 'tag-analytics-opt-out';
/** Fired on window when this browser's choice changes (same tab; other tabs get `storage`). */
export const OPT_OUT_EVENT = 'tag-analytics-opt-out-change';

export type AnalyticsBlock = 'environment' | 'automation' | 'kiosk' | 'opt-out' | null;

interface Env {
  production: boolean;
  hostname: string;
  webdriver: boolean | undefined;
  userAgent: string;
  optedOut: boolean;
  pathname?: string;
}

// Unattended screens (/liveboard/ on a wall tablet) are not readers, and the
// board itself shows GA's live visitor count.
const KIOSK_PATH = /^\/liveboard(\/|$)/;

// Headless browsers and auditing tools that may not set navigator.webdriver.
const AUTOMATION_UA = /HeadlessChrome|Chrome-Lighthouse|Lighthouse|PTST|Playwright|Puppeteer|Cypress|Selenium|bot\b|crawler|spider/i;

/** Why GA must stay off for this page load, or null when it may run. */
export function analyticsBlock(env: Env): AnalyticsBlock {
  if (!env.production || env.hostname !== 'tag.observe.tw') return 'environment';
  if (env.webdriver === true || AUTOMATION_UA.test(env.userAgent)) return 'automation';
  if (env.pathname && KIOSK_PATH.test(env.pathname)) return 'kiosk';
  if (env.optedOut) return 'opt-out';
  return null;
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

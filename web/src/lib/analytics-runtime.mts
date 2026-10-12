// The browser side of GA4 on tag.observe.tw, written against injected
// globals so the test suite can drive it (SiteAnalytics passes the real ones).
//
// Page views: the one `config` sends the landing page_view; later SPA and
// back/forward views are GA enhanced measurement's history events. This code
// never sends page_view or config again. It only keeps what those hits may
// say safe, synchronously, before the URL changes: history.pushState/
// replaceState are wrapped (and popstate captured) before gtag.js loads, so
// each navigation first updates `ga-disable-<ID>` and the global page fields
// (`set`: canonical origin + public path, fixed title, origin-only referrer).
// The script itself is inserted on the first public page.
//
// Privacy taint: once `config` has been sent, the first navigation to a
// private, query, noindex or unparsable URL turns hits off for the rest of
// the document, even back on public pages. Seen in production: GA enhanced
// measurement's history events overwrite page_referrer with the previous full
// URL whatever `set` or `config` say, so /articles/?q=x -> back -> /articles/
// sent dr=...?q=x. A pure mock cannot reproduce Google's engine; this is the
// conservative rule. Navigations while no instance is mounted (StrictMode
// remount) count the same way when the URL moved. A new full page load starts
// clean (document.referrer is cut to its origin); nothing reloads by itself.
// A document that never sent `config` may still start on its first public
// page: Google saw none of its history.
//
// Custom events are only handed to gtag once gtag.js has loaded; until then
// they wait here, and any suppression (opt-out, private or query page,
// taint) discards them, so nothing queued on an eligible page replays later.
import {
  classifyClick,
  GA_ID,
  OPT_OUT_EVENT,
  OPT_OUT_KEY,
  type PublicPage,
  pageFields,
  publicPage,
  readOptOut,
} from './analytics-consent.mts';

type Listener = (event: Event) => void;
interface Target {
  addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: Listener, options?: boolean | EventListenerOptions): void;
}
type HistoryMethod = (data: unknown, unused: string, url?: string | URL | null) => void;
interface HistoryLike {
  pushState: HistoryMethod;
  replaceState: HistoryMethod;
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface AnalyticsDeps {
  id: string;
  /** location.origin */
  origin: string;
  /** The current location.href. */
  href: () => string;
  /** document.referrer at load. */
  referrer: string;
  history: HistoryLike;
  /** window: listeners plus the `ga-disable-<ID>`, dataLayer and state slots. */
  win: Target & Record<string, unknown>;
  /** document: click delegation. */
  doc: Target;
  /** May return null or throw when storage is unavailable. */
  localStorage: () => StorageLike | null;
  /** Inserts the gtag.js script element; `onload` runs once it has executed. */
  loadScript: (src: string, onload: () => void) => void;
  /** Environment, automation, DNT/GPC and current opt-out guards. */
  allowed: () => boolean;
  /**
   * Whether the server-rendered document carries a robots noindex. Checked
   * for the landing document only (after a client navigation the metadata
   * still describes the previous page); an extra guard, not the main one.
   */
  noindex: () => boolean;
}

type Navigate = (url: string | URL) => void;
interface Hooks {
  handler: Navigate | null;
  push: HistoryMethod | null;
  replace: HistoryMethod | null;
  /** The wrappers and the popstate watcher stay for the document. */
  popstate: boolean;
}
interface State {
  configured: boolean;
  loaded: boolean;
  optedOut: boolean;
  /** The landing URL (no fragment) when its document was noindex. */
  noindexPage: string | null;
  landingChecked: boolean;
  /** The last URL (no fragment) seen by any instance. */
  current: string | null;
  /** Configured, then on a non-measurable URL: off for this document. */
  tainted: boolean;
  onLoad: (() => void) | null;
  hooks: Hooks;
}

const STATE = '__tagAnalytics';

const withoutHash = (href: string, base: string) => new URL(href, base).href.replace(/#.*$/, '');

/** A navigation no instance judged: after `config`, any move taints. */
function unobserved(state: State, href: string, base: string) {
  if (!state.configured || state.tainted) return;
  let url: string | null = null;
  try {
    url = withoutHash(href, base);
  } catch {}
  if (url !== state.current) state.tainted = true;
}

/** Installs the guards and listeners (idempotent per window); returns their cleanup. */
export function installAnalytics(deps: AnalyticsDeps): () => void {
  const { id, origin, win } = deps;
  const disableKey = `ga-disable-${id}`;
  win[STATE] ??= {
    configured: false,
    loaded: false,
    optedOut: false,
    noindexPage: null,
    landingChecked: false,
    current: null,
    tainted: false,
    onLoad: null,
    hooks: { handler: null, push: null, replace: null, popstate: false },
  } satisfies State;
  win.dataLayer ??= [];
  const state = win[STATE] as State;
  const dataLayer = win.dataLayer as unknown[];
  // gtag.js reads Arguments objects, not arrays.
  function gtag(..._args: unknown[]) {
    // biome-ignore lint/complexity/noArguments: the documented gtag shape.
    dataLayer.push(arguments);
  }
  const storage = (pick: () => StorageLike | null) => {
    try {
      return pick();
    } catch {
      return null;
    }
  };
  let disposed = false;
  let page: PublicPage | null = null;
  let current = '';
  /** Custom events from eligible pages, waiting for gtag.js. */
  let pending: Array<[string, Record<string, unknown>?]> = [];
  // Off until this page is known to be public.
  win[disableKey] = true;

  /** Opting out is final for this document. */
  const optedOut = () => {
    if (!state.optedOut && readOptOut(storage(deps.localStorage)) !== false) state.optedOut = true;
    return state.optedOut;
  };
  const disable = () => {
    page = null;
    pending = [];
    win[disableKey] = true;
  };
  /** Leaving for a URL that is not measured: after `config`, for good. */
  const leave = () => {
    if (state.configured) state.tainted = true;
    disable();
  };
  const eligible = () =>
    deps.allowed() && !disposed && page !== null && state.configured && !state.tainted && win[disableKey] === false && !optedOut();

  const emit = (name: string, params?: Record<string, unknown>) => {
    gtag('event', name, { ...params, ...pageFields(origin, page!, origin) });
  };
  const send = (name: string, params?: Record<string, unknown>) => {
    if (!eligible()) return;
    if (state.loaded) emit(name, params);
    else pending.push([name, params]);
  };

  const loaded = () => {
    if (!eligible()) return disable();
    const queued = pending;
    pending = [];
    for (const [name, params] of queued) emit(name, params);
  };
  state.onLoad = loaded;

  /** Called with the URL about to be (or just) shown, before GA can see it. */
  const apply = (href: string) => {
    let next: string;
    try {
      next = new URL(href, deps.href()).href;
    } catch {
      return leave();
    }
    const url = withoutHash(next, next);
    if (url === current) return;
    const referrer = current ? origin : deps.referrer;
    current = url;
    state.current = url;
    if (!state.landingChecked) {
      state.landingChecked = true;
      let noindex = true;
      try {
        noindex = deps.noindex();
      } catch {}
      if (noindex && publicPage(next, origin)?.type !== 'liveboard') state.noindexPage = url;
    }
    const found = !deps.allowed() || optedOut() || url === state.noindexPage ? null : publicPage(next, origin);
    if (!found) return leave();
    if (state.tainted) return disable();
    page = found;
    if (!state.configured) gtag('js', new Date());
    // Page fields go through `set` only, before `config`: values passed to
    // `config` would shadow later updates for history page_views.
    gtag('set', pageFields(origin, found, referrer));
    win[disableKey] = false;
    if (!state.configured) {
      state.configured = true;
      gtag('config', id);
      deps.loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, () => {
        state.loaded = true;
        state.onLoad?.();
      });
    }
  };

  const navigate: Navigate = (url) => {
    try {
      apply(String(url));
    } catch {
      leave();
    }
  };
  const hooks = state.hooks;
  hooks.handler = navigate;
  const wrap = (original: HistoryMethod): HistoryMethod => {
    const wrapper = function (this: unknown, _data: unknown, _unused: string, url?: string | URL | null) {
      // A state-only call (no URL) keeps the page.
      if (url !== undefined && url !== null) {
        if (hooks.handler) hooks.handler(url);
        else unobserved(state, String(url), deps.href());
      }
      // biome-ignore lint/complexity/noArguments: pass the call through unchanged.
      return original.apply(this, arguments as unknown as Parameters<HistoryMethod>);
    };
    return wrapper;
  };
  // Installed once per document and never removed: a later mount only needs
  // the new handler.
  if (!hooks.push) deps.history.pushState = hooks.push = wrap(deps.history.pushState);
  if (!hooks.replace) deps.history.replaceState = hooks.replace = wrap(deps.history.replaceState);

  if (!hooks.popstate) {
    hooks.popstate = true;
    const popstate = () => (hooks.handler ? hooks.handler(deps.href()) : unobserved(state, deps.href(), deps.href()));
    deps.win.addEventListener('popstate', popstate, true);
  }
  const choice = (event: Event) => {
    // `storage` with key null is another tab's localStorage.clear(): re-read.
    const key = (event as StorageEvent).key;
    if (event.type === 'storage' && key !== OPT_OUT_KEY && key !== null) return;
    if (!deps.allowed() || optedOut()) {
      state.tainted = state.configured;
      disable();
    }
  };
  const click = (event: Event) => {
    const mouse = event as MouseEvent;
    if (mouse.type === 'auxclick' && mouse.button !== 1) return;
    const target = mouse.target as Element | null;
    // Word-cloud links live inside SVG, lists use HTML anchors.
    const anchor = typeof target?.closest === 'function' ? target.closest('a[href]') : null;
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || !page) return;
    const found = classifyClick(href, anchor.getAttribute('data-analytics') ?? undefined, origin, page.type);
    if (!found) return;
    if (found.name === 'rss_click') send('rss_click');
    else send(found.name, found.params);
  };
  const installed = () => send('app_installed');

  deps.win.addEventListener(OPT_OUT_EVENT, choice);
  deps.win.addEventListener('storage', choice);
  deps.win.addEventListener('appinstalled', installed);
  deps.doc.addEventListener('click', click, true);
  deps.doc.addEventListener('auxclick', click, true);
  // Mounted again on another URL: navigations in between went unjudged.
  unobserved(state, deps.href(), deps.href());
  navigate(deps.href());
  win.__tagAnalyticsSend = send;

  return () => {
    disposed = true;
    if (win.__tagAnalyticsSend === send) win.__tagAnalyticsSend = undefined;
    deps.win.removeEventListener(OPT_OUT_EVENT, choice);
    deps.win.removeEventListener('storage', choice);
    deps.win.removeEventListener('appinstalled', installed);
    deps.doc.removeEventListener('click', click, true);
    deps.doc.removeEventListener('auxclick', click, true);
    // Unguarded until the next mount: hits stay off.
    disable();
    if (hooks.handler === navigate) hooks.handler = null;
    if (state.onLoad === loaded) state.onLoad = null;
    // The history wrappers stay, like the popstate watcher: unmounted
    // navigations must still taint, whether or not gtag.js has loaded.
  };
}

/** All delayed metrics and custom events use the same live privacy guard. */
export function sendAnalyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;
  if (win[`ga-disable-${GA_ID}`] !== false) return;
  (win.__tagAnalyticsSend as ((name: string, params?: Record<string, unknown>) => void) | undefined)?.(name, params);
}

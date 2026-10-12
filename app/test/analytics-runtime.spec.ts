import { describe, expect, it } from 'vitest';
import { analyticsBlock, GA_ID, OPT_OUT_EVENT, pageFields, publicPage } from '../../web/src/lib/analytics-consent.mts';
import { type AnalyticsDeps, installAnalytics } from '../../web/src/lib/analytics-runtime.mts';

const origin = 'https://tag.observe.tw';
function fixture(path = '/', noindex = false) {
  let href = origin + path;
  let allowed = true;
  let optedOut = false;
  let onload = () => {};
  let scripts = 0;
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const doc = new EventTarget();
  const before: unknown[] = [];
  const history = {
    pushState(_data: unknown, _unused: string, url?: string | URL | null) {
      before.push(win[`ga-disable-${GA_ID}`]);
      if (url != null) href = new URL(url, href).href;
    },
    replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
      before.push(win[`ga-disable-${GA_ID}`]);
      if (url != null) href = new URL(url, href).href;
    },
  };
  const deps: AnalyticsDeps = {
    id: GA_ID,
    origin,
    href: () => href,
    referrer: origin + '/search?q=PRIVATE',
    history,
    win,
    doc,
    localStorage: () => ({ getItem: () => (optedOut ? '1' : null), setItem() {}, removeItem() {} }),
    allowed: () => allowed,
    noindex: () => noindex,
    loadScript: (_src, loaded) => {
      scripts++;
      onload = loaded;
    },
  };
  let cleanup = installAnalytics(deps);
  const commands = () => (win.dataLayer as IArguments[]).map((args) => Array.from(args));
  return {
    win,
    history,
    before,
    commands,
    load: () => onload(),
    scripts: () => scripts,
    blocked: () => win[`ga-disable-${GA_ID}`],
    events: () => commands().filter((c) => c[0] === 'event'),
    send: () =>
      (win.__tagAnalyticsSend as ((name: string, params: Record<string, string>) => void) | undefined)?.('liveboard_activity', {
        page_location: 'https://bad/?secret=PRIVATE',
      }),
    back: (path: string) => {
      href = origin + path;
      win.dispatchEvent(new Event('popstate'));
    },
    optOut: () => {
      optedOut = true;
      win.dispatchEvent(new Event(OPT_OUT_EVENT));
    },
    deny: () => {
      allowed = false;
      win.dispatchEvent(new Event(OPT_OUT_EVENT));
    },
    remount: () => {
      cleanup();
      cleanup = installAnalytics(deps);
    },
    stop: () => cleanup(),
  };
}

describe('GA page privacy', () => {
  it.each([
    '/admin',
    '/admin/media/',
    '/login/',
    '/me',
    '/my/reading/',
    '/observe/opt-out/',
    '/search',
    '/article/query',
    '/article?q=PRIVATE',
    '/?query=PRIVATE',
    '/?credit=PRIVATE',
    '/?category=news',
    '/unknown/PRIVATE',
  ])('does not load Google or send events on landing %s', (path) => {
    const f = fixture(path);
    f.send();
    f.load();
    expect(f.scripts()).toBe(0);
    expect(f.blocked()).toBe(true);
    expect(f.commands()).toEqual([]);
    f.stop();
  });
  it('configures exactly once across public navigation, back and StrictMode remount', () => {
    const f = fixture();
    f.load();
    f.history.pushState({}, '', '/ranking/');
    f.history.replaceState({}, '', '/liveboard/setting/');
    f.back('/ranking/');
    f.remount();
    expect(f.commands().filter((c) => c[0] === 'config')).toHaveLength(1);
    expect(f.commands().filter((c) => c[1] === 'page_view')).toHaveLength(0);
    expect(f.before).toEqual([false, false]);
    expect(f.scripts()).toBe(1);
    expect(
      f
        .commands()
        .filter((c) => c[0] === 'set')
        .map((c) => c[1]),
    ).toContainEqual({ page_location: origin + '/liveboard/setting/', page_title: '即時看板', page_referrer: origin });
    expect(JSON.stringify(f.commands())).not.toContain('PRIVATE');
    f.stop();
  });
  it.each(['/admin/media/', '/my/', '/search?q=PRIVATE', '/article?q=PRIVATE'])(
    'disables before navigation to %s and stays off after returning',
    (path) => {
      const f = fixture('/ranking/');
      f.load();
      f.history.pushState({}, '', path);
      expect(f.before).toEqual([true]);
      f.send();
      f.back('/ranking/');
      f.send();
      f.remount();
      f.send();
      expect(f.events()).toEqual([]);
      expect(f.blocked()).toBe(true);
      expect(JSON.stringify(f.commands())).not.toContain('PRIVATE');
      f.stop();
    },
  );
  it('can start once after a private landing without exposing its referrer', () => {
    const f = fixture('/search?q=PRIVATE');
    f.history.pushState({}, '', '/ranking/');
    f.load();
    f.send();
    expect(f.scripts()).toBe(1);
    expect(f.events()).toHaveLength(1);
    expect(JSON.stringify(f.commands())).not.toContain('PRIVATE');
    expect(f.events()[0][2]).toMatchObject({ page_location: origin + '/ranking/', page_referrer: origin });
    f.stop();
  });
  it('drops queued events when navigation becomes private before Google loads', () => {
    const f = fixture('/liveboard/');
    f.send();
    f.history.replaceState({}, '', '/login');
    f.load();
    expect(f.events()).toEqual([]);
    f.stop();
  });
  it('honors opt-out and DNT/GPC changes for delayed events', () => {
    for (const deny of ['optOut', 'deny'] as const) {
      const f = fixture();
      f.load();
      f[deny]();
      f.send();
      expect(f.blocked()).toBe(true);
      expect(f.events()).toEqual([]);
      f.stop();
    }
    const env = { production: true, hostname: 'tag.observe.tw', userAgent: 'Mozilla/5.0', webdriver: false, optedOut: false };
    expect(analyticsBlock({ ...env, doNotTrack: '1' })).toBe('privacy');
    expect(analyticsBlock({ ...env, globalPrivacyControl: true })).toBe('privacy');
    expect(analyticsBlock({ ...env, pathname: '/article', search: '?q=PRIVATE' })).toBe('page');
  });
  it('does not resume after unmounted private navigation', () => {
    const f = fixture();
    f.stop();
    f.history.pushState({}, '', '/my/');
    f.history.pushState({}, '', '/');
    f.remount();
    expect(f.blocked()).toBe(true);
    f.stop();
  });
  it('uses fixed liveboard title even on the noindex settings landing', () => {
    const f = fixture('/liveboard/setting/', true);
    expect(f.scripts()).toBe(1);
    expect(f.commands().find((c) => c[0] === 'set')?.[1]).toMatchObject({ page_title: '即時看板' });
    f.stop();
  });
  it('keeps only public path and origin referrer, never page text, queries or fragment', () => {
    const page = publicPage('/ranking/#PRIVATE', origin)!;
    expect(pageFields(origin, page, origin + '/login?credit=PRIVATE#PRIVATE')).toEqual({
      page_location: origin + '/ranking/',
      page_referrer: origin,
      page_title: '新文易數',
    });
    expect(publicPage('/tag/%3Cscript%3E', origin)).toBeNull();
  });
});

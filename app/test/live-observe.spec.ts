import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { dashboardReturn, registerAccountCors } from '../src/auth/account-cors.ts';
import { safeNext } from '../src/auth/google-login.ts';
import { type DashboardDocument, type DashboardStore, parseDashboardSettings, registerLiveObserve } from '../src/reader/live-observe.ts';

const settings = {
  mode: 'simple',
  theme: 'system',
  density: 'comfortable',
  order: 'balanced',
  timeRange: 'all',
  delta: 'rank',
  palette: 'semantic',
  cloudStyle: 'cloud',
  background: 'paper',
  cardTiming: 'original',
  history: 4,
  step: 4,
  hold: 12,
  words: 32,
  scale: 100,
  interval: 6,
  progress: true,
  legend: true,
  statsPanel: true,
  autoplay: true,
  pictures: true,
  summaries: true,
  ticker: true,
  clock: true,
  undated: true,
  reducedMotion: false,
  sources: ['tag', 'blog', 'youtube', 'traffic'],
  lenses: ['all', 'traffic-dns', 'traffic-tech'],
  fullCards: ['events', 'traffic'],
  accent: '#c2410c',
  query: '',
  exclude: '',
  publishers: [],
};
const origin = 'https://live.observe.tw';
async function setup() {
  const docs = new Map<number, DashboardDocument>();
  const store: DashboardStore = {
    async read(userId) {
      return { document: docs.get(userId) ?? null, legacy: { mode: 'simple' } };
    },
    async write(userId, revision, document) {
      const current = docs.get(userId) ?? null;
      if ((current?.revision ?? null) !== revision) return { saved: false, document: current };
      docs.set(userId, document);
      return { saved: true, document };
    },
  };
  const app = Fastify();
  registerAccountCors(app);
  registerLiveObserve(
    app,
    store,
    async (request) =>
      request.headers.cookie === 'user=1'
        ? { id: 1, email: 'test@example.com', name: '測試', picture: null, role: 'reader' }
        : request.headers.cookie === 'user=2'
          ? { id: 2, email: 'other@example.com', name: null, picture: null, role: 'reader' }
          : null,
    'https://tag.observe.tw',
  );
  await app.ready();
  return app;
}

describe('live dashboard accounts', () => {
  it('validates every advanced setting and rejects unknown/unbounded values', () => {
    expect(parseDashboardSettings(settings)).toEqual(settings);
    for (const patch of [
      { sources: [] },
      { lenses: ['unknown'] },
      { hold: 121 },
      { theme: 'pink' },
      { publishers: ['x'.repeat(161)] },
      { extra: true },
      { accent: 'url(evil)' },
      { query: 'x'.repeat(101) },
    ])
      expect(typeof parseDashboardSettings({ ...settings, ...patch })).toBe('string');
    expect(parseDashboardSettings({ ...settings, fullCards: [] })).toEqual({ ...settings, fullCards: [] });
  });
  it('restricts OAuth returns to the dashboard and settings page', () => {
    for (const value of ['https://live.observe.tw/', 'https://live.observe.tw/liveboard/setting/?config=1&scale=120'])
      expect(safeNext(value)).toBe(value);
    for (const value of [
      'https://live.observe.tw.evil.test/',
      'http://live.observe.tw/',
      'https://evil.test/',
      'https://live.observe.tw/auth/callback',
      'https://user@live.observe.tw/',
      'https://live.observe.tw/\\evil',
    ])
      expect(dashboardReturn(value)).toBe(null);
    expect(safeNext('/media/cna/')).toBe('/media/cna/');
  });
  it('allows only the approved credentialed CORS surface', async () => {
    const app = await setup();
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/auth/me/live-observe',
      headers: { origin, 'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type' },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(origin);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    expect(
      (
        await app.inject({
          method: 'OPTIONS',
          url: '/auth/me/live-observe',
          headers: { origin: 'https://evil.test', 'access-control-request-method': 'PUT' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'OPTIONS',
          url: '/auth/me/live-observe',
          headers: { origin, 'access-control-request-method': 'DELETE' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'OPTIONS', url: '/auth/me/prefs', headers: { origin, 'access-control-request-method': 'PUT' } })).headers[
        'access-control-allow-origin'
      ],
    ).toBeUndefined();
    await app.close();
  });
  it('requires login and Origin, isolates users, and rejects stale revisions', async () => {
    const app = await setup(),
      url = '/auth/me/live-observe';
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'PUT', url, headers: { cookie: 'user=1' }, payload: { userId: 1, revision: null, settings } }))
        .statusCode,
    ).toBe(403);
    const saved = await app.inject({
      method: 'PUT',
      url,
      headers: { origin, cookie: 'user=1' },
      payload: { userId: 1, revision: null, settings },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().settings).toEqual(settings);
    const other = await app.inject({ url, headers: { origin, cookie: 'user=2' } });
    expect(other.json().settings).toBe(null);
    const changedAccount = await app.inject({
      method: 'PUT',
      url,
      headers: { origin, cookie: 'user=2' },
      payload: { userId: 1, revision: null, settings },
    });
    expect(changedAccount.statusCode).toBe(409);
    expect((await app.inject({ url, headers: { origin, cookie: 'user=2' } })).json().settings).toBe(null);
    const conflict = await app.inject({
      method: 'PUT',
      url,
      headers: { origin, cookie: 'user=1' },
      payload: { userId: 1, revision: null, settings: { ...settings, hold: 30 } },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().revision).toBe(saved.json().revision);
    expect(conflict.json().settings.hold).toBe(12);
    const update = await app.inject({
      method: 'PUT',
      url,
      headers: { origin, cookie: 'user=1' },
      payload: { userId: 1, revision: saved.json().revision, settings: { ...settings, hold: 30 } },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().revision).not.toBe(saved.json().revision);
    await app.close();
  });
});

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client.ts';
import { matchesObservation, observationHref, observationScope } from '../observation-scope.ts';
import { loadObservation, observationCounts, observationEvents, observationWindow, registerObservations } from './observations.ts';

const scope = { ...observationScope('台積電', '台股,美股'), id: 'scope' };
const now = new Date('2026-10-28T05:00:00Z');
describe('saved observation conditions', () => {
  it('canonicalizes conditions without substring or alias guesses', () => {
    const a = observationScope(' 台積電 ', '美股,台股,台股,台積電');
    expect(a).toEqual({ version: 1, anchor: '台積電', any: ['台股', '美股'] });
    expect(observationHref(a)).toBe(observationHref(observationScope('台積電', '台股,美股')));
    expect(matchesObservation(['台積電', '台股'], a)).toBe(true);
    expect(matchesObservation(['台積電'], a)).toBe(false);
    expect(matchesObservation(['台積電子', '台股'], a)).toBe(false);
    expect(matchesObservation(['台積電'], observationScope('台積電', ''))).toBe(true);
  });
  it('rejects malformed, repeated and excessive conditions', () => {
    for (const anchor of ['', ' ', 'x,y', 'x\u0000', '字'.repeat(61), ['台積電']]) expect(() => observationScope(anchor, '')).toThrow();
    expect(() => observationScope('a', '1,2,3,4,5,6')).toThrow();
    expect(() => observationScope('a', ['b'])).toThrow();
  });
});
describe('Taipei date windows and replay', () => {
  it('uses inclusive calendar dates and caps today at now', () => {
    expect(observationWindow({ from: '2026-10-01', to: '2026-10-28', at: '2026-10-02' }, now)).toMatchObject({
      start: new Date('2026-09-30T16:00:00Z'),
      end: new Date('2026-10-02T16:00:00Z'),
    });
    expect(observationWindow({}, now).end).toEqual(now);
    expect(observationWindow({}, now).from).toBe('2026-05-02');
  });
  it('rejects invalid dates, future dates, reversed replay and windows over 366 days', () => {
    for (const q of [
      { to: 'bad' },
      { from: '2026-02-30' },
      { to: '2026-10-29' },
      { from: '2026-10-02', at: '2026-10-01' },
      { from: '2025-10-26', to: '2026-10-28' },
      { at: '2026-10-29' },
    ])
      expect(() => observationWindow(q, now)).toThrow();
    expect(() => observationWindow({ from: '2025-10-28', to: '2026-10-28' }, now)).not.toThrow();
  });
  it('counts distinct article IDs consistently and hides future days and titles', () => {
    const window = observationWindow({ from: '2026-10-01', to: '2026-10-04', at: '2026-10-02' }, now);
    const article = (id: number, media: string, publishedAt: string, tags = ['台積電', '台股']) => ({
      id,
      media,
      publishedAt: new Date(publishedAt),
      tags,
      title: `title ${id}`,
    });
    const r = observationCounts(
      [
        article(1, 'a', '2026-10-01T16:00:00Z'),
        article(1, 'a', '2026-10-01T16:00:00Z'),
        article(2, 'b', '2026-10-02T15:59:59Z'),
        article(3, 'a', '2026-10-02T16:00:00Z'),
        article(4, 'c', '2026-10-01T00:00:00Z', ['台股']),
        article(5, 'd', '2026-09-30T15:59:59Z'),
      ],
      scope,
      window,
    );
    expect(r.totals).toMatchObject({ articles: 2, media: 2 });
    expect(r.days).toEqual([
      { day: '2026-10-01', articles: 0, media: 0 },
      { day: '2026-10-02', articles: 2, media: 2 },
      { day: '2026-10-03', articles: null, media: null },
      { day: '2026-10-04', articles: null, media: null },
    ]);
    expect(r.recent.map((a) => a.id)).toEqual([2, 1]);
    expect(r.outlets.reduce((n, o) => n + o.articles, 0)).toBe(r.totals.articles);
  });
});
describe('independent events across long gaps', () => {
  const thread = (id: number, history: Record<string, Record<string, number>>) => ({
    id,
    history,
    majorTags: [],
    firstTime: new Date('2026-09-01'),
    lastTime: now,
  });
  const threads = [
    thread(1, { '2026-10-01 00:00:00': { 台積電: 3, 台股: 2 } }),
    thread(2, { '2026-10-20 00:00:00': { 台積電: 2, 美股: 1 } }),
    thread(3, { '2026-10-02 00:00:00': { 台積電: 2 }, '2026-10-03 00:00:00': { 台股: 2 } }),
  ];
  it('keeps separate IDs while including recurrence after a 19 day gap', () => {
    const window = observationWindow({ from: '2026-10-01' }, now);
    expect(observationEvents(threads, scope, window.start, window.end).map((e) => e.id)).toEqual([2, 1]);
  });
  it('requires co-occurrence in one snapshot and excludes future event details', () => {
    const window = observationWindow({ from: '2026-10-01', at: '2026-10-10' }, now);
    const r = observationEvents(threads, scope, window.start, window.end);
    expect(r.map((e) => e.id)).toEqual([1]);
    expect(r[0].tags).toEqual(['台積電', '台股']);
  });
});
describe('observation API failure behaviour', () => {
  it('validates requests before DB access and keeps DB errors private', async () => {
    const app = Fastify();
    let calls = 0;
    registerObservations(app, {
      execute: async () => {
        calls++;
        throw Error('secret database connection details');
      },
    } as unknown as Db);
    for (const query of ['anchor=a&anchor=b', 'anchor=a&v=2', 'anchor=a&seed=1', 'seed=oops', 'anchor=a&to=nope']) {
      const r = await app.inject(`/api/v1/observations?${query}`);
      expect(r.statusCode).toBe(400);
    }
    expect(calls).toBe(0);
    for (const query of ['anchor=a', 'seed=1']) {
      const r = await app.inject(`/api/v1/observations?${query}`);
      expect(r.statusCode).toBe(503);
      expect(r.body).not.toContain('secret');
      expect(r.body).not.toContain('totals');
    }
    await app.close();
  });
  it('shares successful queries through a bounded cache', async () => {
    const app = Fastify();
    let calls = 0;
    registerObservations(app, {
      execute: async () => {
        calls++;
        return [[]];
      },
    } as unknown as Db);
    const one = await app.inject('/api/v1/observations?anchor=missing');
    const two = await app.inject('/api/v1/observations?anchor=missing');
    expect(one.statusCode).toBe(200);
    expect(one.json()).toEqual(two.json());
    expect(calls).toBe(3);
    expect(one.json().totals).toEqual({ articles: 0, media: 0, events: 0 });
    expect(one.headers['cache-control']).toBe('public, max-age=60');
    await app.close();
  });
});

describe('database result decoding and query bounds', () => {
  it('decodes raw MariaDB UTC datetimes and picks a matching representative article', async () => {
    const results = [
      [
        { id: 1, title: 'matching headline', media: 'cna', publishedAt: '2026-10-01 16:00:00', tags: JSON.stringify(['台積電', '台股']) },
        { id: 2, title: 'unrelated headline', media: 'cna', publishedAt: '2026-10-01 16:00:00', tags: JSON.stringify(['台積電']) },
      ],
      [{ id: 7, history: JSON.stringify({ '2026-10-02 01:00:00': { 台積電: 3, 台股: 1 } }) }],
      [
        {
          threadId: 7,
          news: JSON.stringify([
            { id: 2, title: 'unrelated headline', media: 'cna' },
            { id: 1, title: 'matching headline', media: 'cna' },
          ]),
        },
      ],
      [{ firstAt: '2026-09-28 13:00:00' }],
    ];
    const db = { execute: async () => [results.shift()] } as unknown as Db;
    const r = await loadObservation(db, scope, observationWindow({ from: '2026-10-01', to: '2026-10-04', at: '2026-10-02' }, now));
    expect(r.days[1]).toEqual({ day: '2026-10-02', articles: 1, media: 1 });
    expect(r.eventHistoryFrom).toBe('2026-09-28T13:00:00.000Z');
    expect(r.events[0].headline).toEqual({ id: 1, title: 'matching headline', media: 'cna' });
    expect(r.recent[0].publishedAt).toBe('2026-10-01T16:00:00.000Z');
  });
  it('rejects an over-limit result instead of publishing truncated totals', async () => {
    const db = { execute: async () => [new Array(25001).fill({})] } as unknown as Db;
    await expect(loadObservation(db, scope, observationWindow({}, now))).rejects.toThrow('observation-article-cap');
  });
  it('limits new queries to two concurrent requests', async () => {
    let started = 0;
    let ready!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db = {
      execute: async () => {
        if (started < 2) {
          started++;
          if (started === 2) ready();
          await blocked;
        }
        return [[]];
      },
    } as unknown as Db;
    const app = Fastify();
    registerObservations(app, db);
    const requests = ['one', 'two'].map((anchor) => app.inject(`/api/v1/observations?anchor=${anchor}`).then((r) => r));
    await bothStarted;
    try {
      expect((await app.inject('/api/v1/observations?anchor=three')).statusCode).toBe(503);
    } finally {
      release();
    }
    expect((await Promise.all(requests)).map((r) => r.statusCode)).toEqual([200, 200]);
    await app.close();
  });
});

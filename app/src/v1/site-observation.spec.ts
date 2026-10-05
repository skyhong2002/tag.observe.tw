import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { publicObservation } from '../../../web/src/lib/observation.mts';
import { registerSiteObservation } from './site-observation.ts';

const snapshot = () => ({
  version: 1,
  updatedAt: '2026-10-05T01:00:00Z',
  content: {
    period: { start: '2026-09-28', end: '2026-10-04' },
    totals: { views: 30, sessions: 4 },
    ranking: [{ path: '/eve/897/', title: '事件標題', views: 12 }],
  },
  search: { period: { start: '2026-09-07', end: '2026-10-04' }, totals: null, daily: [] },
  experience: { status: 'insufficient', metrics: [] },
});
describe('public observation boundary', () => {
  it('projects aggregates and never returns accidental raw or identifying fields', () => {
    const source = snapshot();
    const input = {
      ...source,
      private_key: 'secret',
      raw: { rows: ['raw-data'] },
      content: { ...source.content, clientId: 'private', ranking: [{ ...source.content.ranking[0], users: 3, email: 'private' }] },
    };
    expect(publicObservation(input)).toEqual(source);
  });
  it('rejects unsafe links, invalid counts and small samples', () => {
    for (const path of ['//evil.test/', '/tag/%2fadmin/', '/tag/%2e%2e/', '/eve/1/?email=private']) {
      const input = snapshot();
      input.content.ranking[0].path = path;
      expect(() => publicObservation(input)).toThrow();
    }
    const input = snapshot();
    input.content.ranking[0].views = 9;
    expect(() => publicObservation(input)).toThrow();
    expect(() =>
      publicObservation({ ...snapshot(), experience: { status: 'ready', metrics: [{ name: 'LCP', samples: 29, goodPercent: 90 }] } }),
    ).toThrow();
  });
  it('serves missing/corrupt files as unavailable without disclosing internal errors, and recovers after atomic refresh', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'observation-'));
    const file = join(dir, 'public.json');
    const app = Fastify();
    registerSiteObservation(app, file);
    try {
      const get = () => app.inject('/api/v1/site-observation');
      expect((await get()).json()).toEqual({ snapshot: null });
      await writeFile(file, '{private malformed');
      expect((await get()).json()).toEqual({ snapshot: null });
      await writeFile(file, JSON.stringify(snapshot()));
      const response = await get();
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=60');
      expect(response.json()).toEqual({ snapshot: snapshot() });
    } finally {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

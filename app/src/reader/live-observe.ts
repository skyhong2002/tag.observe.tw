import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { LIVE_OBSERVE_ORIGIN } from '../auth/account-cors.ts';
import type { SessionUser } from '../auth/google-login.ts';

const enums: Record<string, readonly string[]> = {
  mode: ['full', 'simple', 'reading'],
  theme: ['system', 'light', 'dark'],
  density: ['comfortable', 'compact'],
  order: ['balanced', 'newest'],
  timeRange: ['all', '1h', '6h', '24h', '7d'],
  delta: ['off', 'rank', 'value'],
  palette: ['semantic', 'source', 'mono'],
  cloudStyle: ['cloud', 'list', 'bubbles'],
  background: ['paper', 'plain', 'grid'],
  cardTiming: ['original', 'fixed'],
};
const numbers: Record<string, readonly [number, number]> = {
  history: [0, 8],
  step: [3, 30],
  hold: [5, 120],
  words: [12, 80],
  scale: [60, 160],
};
const bools = ['progress', 'legend', 'statsPanel', 'autoplay', 'pictures', 'summaries', 'ticker', 'clock', 'undated', 'reducedMotion'];
const arrays: Record<string, readonly string[]> = {
  sources: ['tag', 'blog', 'youtube', 'traffic'],
  lenses: [
    'all',
    'growth',
    'blue',
    'day',
    'green',
    'burst',
    'alt',
    'tech',
    'finance',
    'camps',
    'events',
    'videos',
    'videos-day',
    'videos-live',
    'threads',
    'media',
    'categories',
    'groups',
    'blog',
    'youtube',
    'traffic',
    'traffic-growth',
    'traffic-search',
    'traffic-ai',
    'traffic-dns',
    'traffic-tags',
    'traffic-tech',
  ],
  fullCards: ['events', 'headlines', 'compare', 'topics', 'news', 'videos', 'traffic'],
};
export type DashboardSettings = Record<string, string | number | boolean | string[]>;
export type DashboardDocument = { version: 1; settings: DashboardSettings; revision: string; updatedAt: string };
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Complete, bounded settings; unknown fields fail rather than disappearing on sync. */
export function parseDashboardSettings(value: unknown): DashboardSettings | string {
  if (!record(value)) return 'settings must be an object';
  const required = [
    ...Object.keys(enums),
    ...Object.keys(numbers),
    ...bools,
    ...Object.keys(arrays),
    'interval',
    'accent',
    'query',
    'exclude',
    'publishers',
  ];
  if (Object.keys(value).some((key) => !required.includes(key))) return 'unknown settings field';
  const out: DashboardSettings = {};
  for (const key of required) {
    const v = value[key];
    if (enums[key]) {
      if (typeof v !== 'string' || !enums[key].includes(v)) return `invalid ${key}`;
    } else if (numbers[key]) {
      const [min, max] = numbers[key];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return `invalid ${key}`;
    } else if (bools.includes(key)) {
      if (typeof v !== 'boolean') return `invalid ${key}`;
    } else if (arrays[key]) {
      if (
        !Array.isArray(v) ||
        (key !== 'fullCards' && !v.length) ||
        v.length > arrays[key].length ||
        !v.every((x) => typeof x === 'string' && arrays[key].includes(x)) ||
        new Set(v).size !== v.length
      )
        return `invalid ${key}`;
    } else if (key === 'interval') {
      if (![1, 2, 3, 6, 12, 24].includes(v as number)) return 'invalid interval';
    } else if (key === 'accent') {
      if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) return 'invalid accent';
    } else if (key === 'query' || key === 'exclude') {
      if (typeof v !== 'string' || [...v].length > (key === 'query' ? 100 : 500)) return `invalid ${key}`;
    } else if (key === 'publishers') {
      if (!Array.isArray(v) || v.length > 100 || !v.every((x) => typeof x === 'string' && x.trim() && [...x].length <= 160))
        return 'invalid publishers';
    }
    out[key] = Array.isArray(v) ? ([...v] as string[]) : (v as string | number | boolean);
  }
  return out;
}

export interface DashboardStore {
  read(userId: number): Promise<{ document: DashboardDocument | null; legacy: unknown }>;
  write(
    userId: number,
    revision: string | null,
    document: DashboardDocument,
  ): Promise<{ saved: boolean; document: DashboardDocument | null }>;
}

export function registerLiveObserve(
  app: FastifyInstance,
  store: DashboardStore,
  currentUser: (request: import('fastify').FastifyRequest) => Promise<SessionUser | null>,
  origin: string,
) {
  const response = (document: DashboardDocument | null, legacy?: unknown) => ({
    settings: document?.settings ?? null,
    revision: document?.revision ?? null,
    updatedAt: document?.updatedAt ?? null,
    ...(legacy ? { legacy } : {}),
  });
  app.get('/auth/me/live-observe', async (request, reply) => {
    reply.header('cache-control', 'private, no-store');
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: 'sign in first' });
    const data = await store.read(user.id);
    return response(data.document, data.document ? null : data.legacy);
  });
  app.put<{ Body: { revision?: unknown; settings?: unknown; userId?: unknown } }>(
    '/auth/me/live-observe',
    { bodyLimit: 128 * 1024 },
    async (request, reply) => {
      reply.header('cache-control', 'private, no-store');
      if (![origin, LIVE_OBSERVE_ORIGIN].includes(String(request.headers.origin)))
        return reply.code(403).send({ error: 'origin not allowed' });
      const user = await currentUser(request);
      if (!user) return reply.code(401).send({ error: 'sign in first' });
      const body = request.body;
      if (!record(body) || body.userId !== user.id) return reply.code(409).send({ error: 'account changed; reload session' });
      if (
        !record(body) ||
        Object.keys(body).some((k) => !['settings', 'revision', 'userId'].includes(k)) ||
        !(body.revision === null || (typeof body.revision === 'string' && /^[0-9a-f-]{36}$/.test(body.revision)))
      )
        return reply.code(400).send({ error: 'revision is required' });
      const settings = parseDashboardSettings(body.settings);
      if (typeof settings === 'string') return reply.code(400).send({ error: settings });
      const document: DashboardDocument = { version: 1, settings, revision: randomUUID(), updatedAt: new Date().toISOString() };
      const result = await store.write(user.id, body.revision as string | null, document);
      if (!result.saved) return reply.code(409).send({ error: 'settings changed on another device', ...response(result.document) });
      return response(document);
    },
  );
}

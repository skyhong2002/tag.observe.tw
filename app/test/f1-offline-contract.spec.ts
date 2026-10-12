import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { renderApiMarkdown } from '../../tools/gen-api-docs.ts';
import { buildApp } from '../src/app.js';
import { publicRelations, relationKey, tagId, validSemanticTag } from '../src/tag-groups/semantic.ts';
import { buildOpenApi, ENDPOINTS } from '../src/v1/openapi.ts';
import { registerSemanticRelations } from '../src/v1/tag-relations.ts';

// Install only the mock-backed relation route before buildApp boots Fastify.
// The instance, injection engine and gateway hooks remain their real implementations.
const construction = vi.hoisted(() => ({ register: null as ((app: FastifyInstance) => void) | null }));
vi.mock('fastify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fastify')>();
  return {
    ...actual,
    default: (options: FastifyServerOptions) => {
      const app = actual.default(options);
      construction.register?.(app);
      return app;
    },
  };
});

function objectFields(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected schema object');
  return value as Record<string, unknown>;
}

// Promise-like query builders only: no application startup, pool, socket or Redis.
function mockDb(batches: unknown[][]) {
  let calls = 0;
  return {
    db: {
      select() {
        const rows = batches[calls++];
        if (!rows) throw Error('Unexpected query');
        const query = {
          from() {
            return query;
          },
          where() {
            return query;
          },
          orderBy() {
            return query;
          },
          limit() {
            return query;
          },
          // biome-ignore lint/suspicious/noThenProperty: intentionally emulate the awaited Drizzle query builder.
          then(resolve: (rows: unknown[]) => unknown) {
            return Promise.resolve(rows).then(resolve);
          },
        };
        return query;
      },
    } as never,
    calls: () => calls,
  };
}
const row = (id: number, type = 'related', target = '乙') => ({
  id,
  tag: '甲',
  target,
  type,
  groupId: null,
  source: 'submission',
  at: new Date('2026-10-01T00:00:00Z'),
  email: 'private@example.test',
  reason: 'private reason',
});

describe('F1 offline public contracts', () => {
  it('preserves byte-exact identities and only symmetric edge types', () => {
    expect(tagId('AI')).not.toBe(tagId('ai'));
    for (const type of ['related', 'alias'] as const) expect(relationKey('甲', type, '乙')).toBe(relationKey('乙', type, '甲'));
    expect(relationKey('甲', 'is-a', '乙')).not.toBe(relationKey('乙', 'is-a', '甲'));
    expect(relationKey('甲', 'is-a', 'group:811')).not.toBe(relationKey('甲', 'is-a', { groupId: 811 }));
    expect(validSemanticTag('𠀀'.repeat(60))).toBe(true);
    for (const label of ['', ' 甲', '甲\n', '𠀀'.repeat(61)]) expect(validSemanticTag(label)).toBe(false);
  });
  it('projects approved rows without private fields and does not query co-occurrence', async () => {
    const mock = mockDb([[], [], [row(1), row(2, 'alias')]]);
    const result = await publicRelations(mock.db, '甲');
    expect(result.relations.map((r) => r.type)).toEqual(['related', 'alias']);
    expect(result.relations[0]).toMatchObject({
      id: 'relation:1',
      target: { id: tagId('乙') },
      source: 'submission',
      sourceDetail: 'submission',
      status: 'approved',
    });
    expect(JSON.stringify(result)).not.toMatch(/private|email|reason/);
    expect(mock.calls()).toBe(3);
  });
  it('signals truncation after the 200th new edge', async () => {
    const mock = mockDb([[], [], Array.from({ length: 201 }, (_, i) => row(i + 1))]);
    const result = await publicRelations(mock.db, '甲');
    expect(result.relations).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });
  it('uses existing group IDs and excludes topic membership', async () => {
    const mock = mockDb([
      [
        { id: 1, kind: 'group', label: '父', parentId: null },
        { id: 2, kind: 'group', label: '子', parentId: 1 },
        { id: 3, kind: 'topic', label: '議題', parentId: null },
      ],
      [
        { tag: '甲', groupId: 2, source: 'admin' },
        { tag: '甲', groupId: 3, source: 'admin' },
      ],
      [],
    ]);
    const result = await publicRelations(mock.db, '甲');
    expect(result.relations.map((r) => r.target.id)).toEqual(['group:2', 'group:1']);
    expect(result.relations[1]).toMatchObject({ inherited: true, depth: 2, createdAt: null });
  });
  it('runs the real relation route and gateway cache guard through injection only', async () => {
    const mock = mockDb(Array.from({ length: 9 }, () => [[], [], [row(1)]]).flat());
    // No tagDbUrl, injected db, login or job queue: buildApp opens no resources.
    construction.register = (app) => registerSemanticRelations(app, mock.db);
    const app = await buildApp({ uiOrigin: 'https://unused.invalid', rateLimit: false });
    construction.register = null;
    try {
      const path = `/api/v1/tags/${encodeURIComponent('甲')}/relations`;
      const anonymous = await app.inject(path);
      expect(anonymous.statusCode).toBe(200);
      expect(anonymous.headers['cache-control']).toBe('public, max-age=60');
      const schema = ENDPOINTS.find((e) => e.path === '/api/v1/tags/{tag}/relations')!.response;
      const body = anonymous.json();
      const properties = objectFields(objectFields(schema).properties);
      const relationItems = objectFields(objectFields(properties.relations).items);
      expect(Object.keys(body).sort()).toEqual(Object.keys(properties).sort());
      expect(Object.keys(body.relations[0]).sort()).toEqual(Object.keys(objectFields(relationItems.properties)).sort());
      expect(body.relations[0].type).toBe('related');
      expect(body.relations[0].status).toBe('approved');
      for (const header of ['cookie', 'authorization', 'x-service-token', 'x-api-key']) {
        for (const value of ['invalid-fixture', '']) {
          const response = await app.inject({ url: path, headers: { [header]: value } });
          expect(response.statusCode).toBe(200);
          expect(response.headers['cache-control']).toBe('private, no-store');
        }
      }
      const invalid = await app.inject(`/api/v1/tags/${encodeURIComponent(' 甲')}/relations`);
      expect(invalid.statusCode).toBe(400);
      expect(invalid.headers['cache-control']).toBe('no-store');
      // All nine valid batches were consumed: the next DB query rejects locally.
      const failed = await app.inject(path);
      expect(failed.statusCode).toBe(500);
      expect(failed.headers['cache-control']).toBe('no-store');
      const missing = await app.inject('/api/v1/no-such-f1-route');
      expect(missing.statusCode).toBe(404);
      expect(missing.headers['cache-control']).toBe('no-store');
      expect(invalid.json()).toHaveProperty('error');
    } finally {
      await app.close();
    }
  });
  it('keeps generated docs and relation schema consistent', () => {
    expect(readFileSync(new URL('../../docs/api.md', import.meta.url), 'utf8')).toBe(renderApiMarkdown());
    const endpoint = ENDPOINTS.find((e) => e.path === '/api/v1/tags/{tag}/relations');
    expect(endpoint?.errors).toEqual({ '400': '標籤格式不正確' });
    const spec = buildOpenApi();
    expect(spec.paths).toHaveProperty('/api/v1/tags/{tag}/relations');
    expect(JSON.stringify(endpoint?.response)).toContain('approved');
  });
});

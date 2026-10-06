import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { registerSimilarity } from './similarity.ts';

vi.mock('../similarity/store.ts', async (original) => ({
  ...(await original<typeof import('../similarity/store.ts')>()),
  loadIndexView: vi.fn(async () => ({})),
  loadEvidence: vi.fn(async (_db, _view, filter) => ({ filter })),
}));

describe('similarity evidence relation query', () => {
  it('forwards source classification from the HTTP query and rejects unknown categories', async () => {
    const app = Fastify();
    registerSimilarity(app, {} as Db);
    try {
      for (const relation of ['attributed', 'same-byline', 'unattributed']) {
        const response = await app.inject(`/api/v1/similarity/evidence?hours=24&mode=similarity&relation=${relation}`);
        expect(response.statusCode).toBe(200);
        expect(response.json().filter.relation).toBe(relation);
      }
      expect((await app.inject('/api/v1/similarity/evidence?relation=invalid')).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

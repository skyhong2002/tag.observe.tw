import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { registerPageApis } from './pages.ts';

vi.mock('../jobs/topic-stories.ts', async (original) => ({
  ...(await original<object>()),
  resolveTopicStories: async () => [
    { key: 'example.com/old', id: 42, url: 'https://example.com/old', title: 'Old story', date: '2001-01-01T00:00:00.000Z' },
  ],
}));

describe('topic story index endpoint', () => {
  it('returns actual membership for either kind, including old articles', async () => {
    for (const kind of ['topic', 'feature']) {
      const app = Fastify();
      const db = {
        select: () => ({
          from: () => ({
            where: async () => [
              {
                id: 1,
                media: 'cna',
                kind,
                title: 'Collection',
                url: 'https://example.com/collection',
                pageStories: [],
                pageCheckedAt: new Date('2026-01-01'),
              },
            ],
          }),
        }),
      } as unknown as Db;
      registerPageApis(app, db);
      try {
        const response = await app.inject('/api/v1/topics/1/stories');
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ id: '1', kind, total: 1, stories: [{ id: 42, date: '2001-01-01T00:00:00.000Z' }] });
        for (const id of ['0', '-1', 'nope', '9007199254740992'])
          expect((await app.inject(`/api/v1/topics/${id}/stories`)).statusCode).toBe(400);
      } finally {
        await app.close();
      }
    }
  });
  it('returns 404 for unknown collections', async () => {
    const app = Fastify();
    registerPageApis(app, { select: () => ({ from: () => ({ where: async () => [] }) }) } as unknown as Db);
    try {
      expect((await app.inject('/api/v1/topics/123/stories')).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

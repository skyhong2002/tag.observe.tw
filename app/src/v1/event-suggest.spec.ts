import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { rankThreadSuggestions, registerEventSuggest } from './event-suggest.ts';

const day = (n: number) => new Date(Date.UTC(2026, 9, 11 - n));

describe('event thread suggestions', () => {
  it('ranks main-keyword hits first, then the newer thread, then the bigger one', () => {
    const rows = [
      { id: 1, majorTags: ['國慶', '賴清德'], allTags: ['國慶', '賴清德', '韓國瑜'], maxScore: 50, lastTime: day(0) },
      { id: 2, majorTags: ['颱風'], allTags: ['颱風', '國慶連假'], maxScore: 90, lastTime: day(1) },
      { id: 3, majorTags: ['國慶煙火'], allTags: ['國慶煙火'], maxScore: 20, lastTime: day(2) },
      { id: 5, majorTags: ['國慶升旗'], allTags: ['國慶升旗'], maxScore: 80, lastTime: day(2) },
      { id: 4, majorTags: ['台積電'], allTags: ['台積電'], maxScore: 99, lastTime: day(0) },
    ];
    expect(rankThreadSuggestions(rows, '國慶', 10).map((row) => row.id)).toEqual([1, 5, 3, 2]);
    expect(rankThreadSuggestions(rows, '韓國瑜', 10)).toEqual([{ id: 1, tags: ['國慶', '賴清德'], lastTime: day(0).toISOString() }]);
    expect(rankThreadSuggestions(rows, ' ', 10)).toEqual([]);
  });
  it('answers an empty query without touching the database', async () => {
    const select = vi.fn();
    const app = Fastify();
    registerEventSuggest(app, { select } as unknown as Db);
    try {
      expect((await app.inject('/api/v1/events/threads/suggest?q=')).json()).toEqual({ q: '', days: 14, threads: [] });
      expect(select).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

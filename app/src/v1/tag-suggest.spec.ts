import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { countTags, rankTagSuggestions, registerTagSuggest } from './tag-suggest.ts';

describe('tag suggestions', () => {
  it('counts each article once and drops one-off, sentence-long and noise tags', () => {
    const rows = [
      { tags: ['台積電', '台積電', '政治', '台積電有60億到128億美元資本支出將用在封裝'] },
      { tags: ['台積電', '政治', '台積電有60億到128億美元資本支出將用在封裝'] },
      { tags: ['台積電ADR'] },
      { tags: null },
    ];
    expect(countTags(rows)).toEqual([{ tag: '台積電', articles: 2 }]);
  });
  it('puts prefix matches first, then the most-tagged keyword', () => {
    const rows = [
      { tag: '美國台積電', articles: 900 },
      { tag: '台積電法說會', articles: 20 },
      { tag: '台積電', articles: 500 },
      { tag: '台積電ADR', articles: 40 },
      { tag: '聯電', articles: 999 },
    ];
    expect(rankTagSuggestions(rows, '台積', 10).map((row) => row.tag)).toEqual(['台積電', '台積電ADR', '台積電法說會', '美國台積電']);
    expect(rankTagSuggestions(rows, 'adr', 10).map((row) => row.tag)).toEqual(['台積電ADR']);
    expect(rankTagSuggestions(rows, '  ', 10)).toEqual([]);
  });
  it('answers an empty query without touching the database', async () => {
    const select = vi.fn();
    const app = Fastify();
    registerTagSuggest(app, { select } as unknown as Db);
    try {
      const response = await app.inject('/api/v1/tags/suggest?q=');
      expect(response.json()).toEqual({ q: '', days: 14, tags: [] });
      expect(select).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

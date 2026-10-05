import type { SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { indexTopicStories, mergeTopicStories, resolveTopicStories, storyUrl } from './topic-stories.ts';

const { runIndex } = vi.hoisted(() => ({ runIndex: vi.fn(async () => ({ inserted: 1 })) }));
vi.mock('../crawl/pipeline.ts', () => ({ runIndex }));

function database(rows: object[]) {
  const where = vi.fn(async (_condition: SQL) => rows);
  return { db: { select: () => ({ from: () => ({ where }) }) } as unknown as Db, where };
}
const old = { key: 'example.com/old', title: 'Old story', date: '2001-01-01T00:00:00.000Z' };

describe('publisher topic membership', () => {
  it('keeps historical members across rotating lists and refreshes known links', () => {
    expect(
      mergeTopicStories(
        [old],
        [
          { ...old, url: 'https://example.com/old' },
          { key: 'example.com/new', title: 'New' },
        ],
      ),
    ).toEqual([
      { ...old, url: 'https://example.com/old' },
      { key: 'example.com/new', title: 'New' },
    ]);
    expect(mergeTopicStories([old], [])).toEqual([old]);
  });
  it('recovers path keys but never invents ID-only URLs or accepts script URLs', () => {
    expect(storyUrl(old)).toBe('https://example.com/old');
    expect(storyUrl({ key: 'example.com#123', title: '' })).toBeNull();
    expect(storyUrl({ ...old, url: 'javascript:alert(1)' })).toBeNull();
    expect(storyUrl({ ...old, url: 'https://example.com/path?a=2' })).toBe('https://example.com/path?a=2');
  });
  it('resolves old and unindexed members without title/tag inference or a date cutoff', async () => {
    const { db, where } = database([
      { key: old.key, id: 42, url: 'http://example.com/old', title: 'Publisher title', date: new Date(old.date), crawledAt: new Date() },
    ]);
    const stories = await resolveTopicStories(db, 'twreporter', [
      old,
      old,
      { key: 'example.com/new', title: 'Not indexed', date: '2020-01-01T00:00:00.000Z' },
      { key: 'example.com#999', title: 'Unknown link' },
    ]);
    expect(stories.map((s) => s.id)).toEqual([null, 42, null]);
    expect(stories[1]).toMatchObject({ title: 'Publisher title', url: 'http://example.com/old', date: old.date });
    expect(stories[0].url).toBe('https://example.com/new');
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.params).toContain('reporter');
    expect(query.sql).not.toContain('published_at');
  });
  it('returns original article summaries, images and tags for the shared news list', async () => {
    const { db } = database([
      {
        key: old.key,
        id: 42,
        url: 'https://example.com/old',
        title: '報導',
        date: new Date(old.date),
        crawledAt: new Date(),
        description: '原文摘要',
        image: 'https://example.com/image.jpg',
        tags: ['原文標籤'],
        authors: ['記者'],
      },
    ]);
    expect((await resolveTopicStories(db, 'cna', [old]))[0]).toMatchObject({
      description: '原文摘要',
      image: 'https://example.com/image.jpg',
      tags: ['原文標籤'],
      authors: ['記者'],
    });
  });
  it('enqueues missing dated and undated members without adding collection tags', async () => {
    runIndex.mockClear();
    const { db } = database([]);
    expect(await indexTopicStories(db, 'cna', [old, { key: 'example.com/new', title: 'New' }])).toBe(1);
    const listed = (runIndex.mock.calls[0] as unknown as [Db, unknown, { listed: { items: object[] } }])[2].listed;
    expect(listed.items).toEqual([
      { url: 'https://example.com/old', title: old.title, publishedAt: new Date(old.date) },
      { url: 'https://example.com/new', title: 'New', publishedAt: null },
    ]);
  });
});

describe('article collection backlinks', () => {
  it('matches exact publisher membership, supports aliases and multiple collections, and excludes tag-only matches', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const { collectionsForArticle } = await import('./topic-stories.ts');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('CREATE TABLE topics (id INTEGER, media TEXT, title TEXT, kind TEXT, page_keys TEXT)');
    sqlite.function('JSON_EXTRACT', (value, _path) => JSON.stringify(JSON.parse(String(value)).map((s: { key: string }) => s.key)));
    sqlite.function('JSON_CONTAINS', (value, key) => Number(JSON.parse(String(value)).includes(JSON.parse(String(key)))));
    const insert = sqlite.prepare('INSERT INTO topics VALUES (?, ?, ?, ?, ?)');
    for (const [id, media, kind, key] of [
      [1, 'twreporter', 'topic', 'example.com#123'],
      [2, 'twreporter', 'feature', 'example.com#123'],
      [3, 'twreporter', 'topic', 'example.com#1234'],
      [4, 'cna', 'topic', 'example.com#123'],
    ])
      insert.run(id, media, '相同標題', kind, JSON.stringify([{ key }]));
    sqlite.exec(
      "ALTER TABLE topics ADD COLUMN url TEXT; INSERT INTO topics VALUES (5, 'twreporter', '專題正文', 'feature', '[]', 'https://example.com/feature')",
    );
    const db = {
      select: () => ({
        from: () => ({
          where: async (predicate: SQL) => {
            const compiled = new MySqlDialect().sqlToQuery(predicate);
            return sqlite
              .prepare(`SELECT id, media, title, kind, url FROM topics WHERE ${compiled.sql}`)
              .all(...(compiled.params as string[]));
          },
        }),
      }),
    } as unknown as Db;
    try {
      expect((await collectionsForArticle(db, 'reporter', 'example.com#123')).map((c) => [c.id, c.kind])).toEqual([
        ['1', 'topic'],
        ['2', 'feature'],
      ]);
      expect(await collectionsForArticle(db, 'reporter', 'missing')).toEqual([]);
      expect((await collectionsForArticle(db, 'reporter', 'missing', 'https://example.com/feature')).map((c) => [c.id, c.self])).toEqual([
        ['5', true],
      ]);
      expect((await collectionsForArticle(db, 'reporter', 'example.com#123')).map((c) => c.self)).toEqual([undefined, undefined]);
    } finally {
      sqlite.close();
    }
  });
});

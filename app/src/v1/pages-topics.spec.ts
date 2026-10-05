import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { TOPIC_RULES } from '../crawl/topics.ts';
import type { Db } from '../db/client.ts';
import { registerPageApis } from './pages.ts';

const fixtures = vi.hoisted(() => {
  const row = (id: number, media: string, kind: string, title: string, ended = false) => ({
    id,
    media,
    kind,
    title,
    url: `https://example.com/${id}`,
    image: null,
    backlog: false,
    sponsored: false,
    parentId: null,
    firstSeen: new Date(),
    storyFirstAt: new Date(),
    storyLastAt: ended ? new Date('2000-01-01') : new Date(),
    storyCount: 2,
  });
  return [
    row(1, 'cna', 'topic', '共同 主題限定 跨類型單筆'),
    row(5, 'cna', 'topic', '共同 主題限定'),
    row(2, 'udn', 'feature', '共同 專題限定 跨類型單筆'),
    row(3, 'cna', 'feature', '共同 專題限定'),
    row(4, 'udn', 'topic', '停更', true),
  ];
});
vi.mock('../jobs/topics-job.ts', () => ({
  firstRunPerMedia: async () => ({}),
  topicSourceChecks: async () => ({}),
  topicCountPerMedia: async () => ({ cna: { topic: 2, feature: 1 }, udn: { topic: 1, feature: 1 } }),
  allTopLevelTopics: async () => fixtures,
  latestTopicPerMedia: async (_db: unknown, _limit: number, kind: string) =>
    Object.fromEntries(TOPIC_RULES.map(({ media }) => [media, fixtures.filter((row) => row.media === media && row.kind === kind)])),
  latestTopics: async () => [],
  topicChildrenOf: async () => [],
}));
vi.mock('../jobs/topic-related.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../jobs/topic-related.ts')>()),
  topicTagger: async () => (title: string) => title.split(' '),
  topicCoverage: async () => new Map(),
}));

async function request(query: string) {
  const app = Fastify();
  registerPageApis(app, {} as Db);
  try {
    const res = await app.inject(`/api/v1/topics${query}`);
    expect(res.statusCode).toBe(200);
    return res.json();
  } finally {
    await app.close();
  }
}

describe('topic and feature API separation', () => {
  it.each(['topic', 'feature'])('scopes the %s keyword ranking and media counts before limiting', async (kind) => {
    const data = await request(`?kind=${kind}`);
    expect(data.feed.every((item: { kind: string }) => item.kind === kind)).toBe(true);
    expect(data.tags.find((tag: { tag: string }) => tag.tag === '共同')).toEqual({
      tag: '共同',
      media: kind === 'topic' ? 1 : 2,
      topic: kind === 'topic' ? 2 : 0,
      feature: kind === 'feature' ? 2 : 0,
    });
    expect(data.tags.map((tag: { tag: string }) => tag.tag)).not.toContain(kind === 'topic' ? '專題限定' : '主題限定');
    expect(data.tags.map((tag: { tag: string }) => tag.tag)).not.toContain('停更');
    expect(data.tags.map((tag: { tag: string }) => tag.tag)).not.toContain('跨類型單筆');
  });

  it.each(['tag=共同', 'q=共同', 'tag=共同&q=專題限定'])('applies kind to %s, totals and the result limit', async (filter) => {
    const feature = await request(`?kind=feature&${filter}&limit=1`);
    expect(feature).toMatchObject({ kind: 'feature', total: 2, mediaCount: 2, counts: { topic: 0, feature: 2 } });
    expect(feature.topics).toHaveLength(1);
    expect(feature.topics[0].kind).toBe('feature');
    const topic = await request(`?${filter}`);
    expect(topic.kind).toBe('topic');
    expect(topic.counts.feature).toBe(0);
    expect(topic.topics.every((item: { kind: string }) => item.kind === 'topic')).toBe(true);
    expect(topic.total).toBe(filter.includes('專題限定') ? 0 : 2);
  });

  it('retains ended topics in topic searches without leaking them into features', async () => {
    expect((await request('?kind=topic&q=停更')).topics).toMatchObject([{ kind: 'topic', status: 'ended' }]);
    expect((await request('?kind=feature&q=停更')).topics).toEqual([]);
  });
});

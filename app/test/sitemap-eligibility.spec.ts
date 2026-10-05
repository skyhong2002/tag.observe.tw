import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db/client.ts';
import { sitemapUrls } from '../src/feeds.ts';

vi.mock('../src/jobs/topics-job.ts', () => ({
  topicCountPerMedia: async () => ({ cna: { topic: 3, feature: 0 }, eld: { topic: 0, feature: 2 } }),
}));

describe('sitemap eligibility', () => {
  it('includes analysis pages and only outlets with content of the requested kind', async () => {
    const query = { from: () => query, where: () => query, orderBy: () => query, limit: async () => [] };
    const db = { select: () => query } as unknown as Db;
    const urls = (await sitemapUrls(db)).map((entry) => entry.loc);
    expect(urls).toEqual(
      expect.arrayContaining(['/similarity/', '/similarity/daily/', '/similarity/about/', '/topic/cna/', '/feature/eld/']),
    );
    expect(urls).not.toContain('/topic/eld/');
    expect(urls).not.toContain('/feature/cna/');
    expect(urls).not.toContain('/topic/wyc/');
  });
});

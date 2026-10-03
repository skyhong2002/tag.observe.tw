import { describe, expect, it } from 'vitest';
import { type ContentRow, computeSimilarity } from './compute.ts';
import { computeSimilarityAsync } from './compute-async.ts';

const body = Array.from({ length: 70 }, (_, i) => `第${i}項採訪紀錄指出地方建設需要公開審查與居民參與討論`).join('。');
const rows: ContentRow[] = ['cna', 'udn'].map((media, i) => ({
  id: i + 1,
  media,
  title: '新聞',
  url: 'https://example.com',
  publishedAt: new Date('2026-10-03T00:00:00Z'),
  body,
  bodyStatus: 'ok',
  authors: [],
  creator: null,
  attributions: [],
}));
describe('similarity background computation', () => {
  it('preserves exact matching results while letting the event loop continue', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 5);
    try {
      const result = await computeSimilarityAsync(rows, 0.65);
      expect(result.pairs).toEqual(computeSimilarity(rows).pairs);
      expect(result.edges).toHaveLength(1);
      expect(ticks).toBeGreaterThan(0);
    } finally {
      clearInterval(timer);
    }
  });
  it('releases a failed worker so the next queued request can succeed', async () => {
    const bad = rows.map((row) => ({ ...row, publishedAt: new Date(Number.NaN) }));
    const failed = expect(computeSimilarityAsync(bad, 0.65)).rejects.toThrow();
    const valid = computeSimilarityAsync(rows, 0.65);
    await failed;
    expect((await valid).pairs).toHaveLength(1);
  });
});

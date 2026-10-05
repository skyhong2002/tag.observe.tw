import { describe, expect, it, vi } from 'vitest';
import { eventThreadHeadline } from '../../web/src/lib/event-presentation.mts';
import { articleIndexable, publicArticleContent } from '../../web/src/lib/seo.mts';
import { sparklineRuns } from '../../web/src/lib/sparkline.mts';

describe('small chart geometry', () => {
  it('preserves null gaps and finite coordinates for flat and empty data', () => {
    expect(sparklineRuns([null, null])).toEqual([]);
    expect(sparklineRuns([0, 0])).toEqual([
      [
        [2, 30],
        [94, 30],
      ],
    ]);
    expect(sparklineRuns([2, null, 4])).toHaveLength(2);
    expect(sparklineRuns([NaN, Infinity])).toEqual([]);
  });
  it('places rank one above worse ranks, and higher counts above lower counts', () => {
    const [rank] = sparklineRuns([1, 10], true);
    expect(rank[0][1]).toBeLessThan(rank[1][1]);
    const [counts] = sparklineRuns([1, 10]);
    expect(counts[0][1]).toBeGreaterThan(counts[1][1]);
  });
});

describe('content freshness', () => {
  it('expires a cached excerpt at its deadline without mutating the stored response', () => {
    const deadline = Date.parse('2026-10-05T04:00:00Z');
    const stored = { status: 'ok', body: '舊節錄', chars: 3, expiresAt: new Date(deadline).toISOString() };
    expect(publicArticleContent(stored, deadline - 1).body).toBe('舊節錄');
    expect(publicArticleContent(stored, deadline)).toMatchObject({ body: null, chars: 0, status: 'expired' });
    expect(stored.body).toBe('舊節錄');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(deadline);
      expect(articleIndexable(stored, null, null)).toBe(false);
      expect(articleIndexable(stored, { events: [{}], otherMedia: [] }, null)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('uses current representative headlines, falling back to tags for an empty thread', () => {
    const thread = { majorTags: ['台灣'] };
    const old = { thread, hours: [{ major: ['台灣'], news: [{ title: '台灣新聞事件舊標題' }] }] };
    const updated = { ...old, hours: [{ major: ['台灣'], news: [{ title: '台灣新聞事件更新標題' }] }] };
    expect(eventThreadHeadline(old)).toBe('台灣新聞事件舊標題');
    expect(eventThreadHeadline(updated)).toBe('台灣新聞事件更新標題');
    expect(eventThreadHeadline({ thread, hours: [] })).toBe('台灣');
  });
});

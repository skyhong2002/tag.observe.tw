import { describe, expect, it } from 'vitest';
import disabledSpec from '../../data/crawl-disabled.json' with { type: 'json' };
import { disabled, sourcesInGroup } from './registry.ts';

describe('registry', () => {
  it('includes accelerated outlets exactly once in the news group and preserves the article dispatcher inputs', () => {
    const fast = sourcesInGroup('news');
    const slow = sourcesInGroup('hourly');
    for (const media of ['news_pchome', 'ntdtv_tw']) {
      expect(fast.filter((source) => source.media === media)).toHaveLength(1);
      expect(slow.some((source) => source.media === media)).toBe(false);
    }
    const all = [...fast, ...slow].map((source) => source.media);
    expect(new Set(all).size).toBe(all.length);
  });
  it('never schedules sources listed in crawl-disabled.json', () => {
    const scheduled = new Set([...sourcesInGroup('news'), ...sourcesInGroup('hourly')].map((s) => s.media));
    for (const media of disabledSpec.media) expect(scheduled.has(media), media).toBe(false);
    expect(disabled().has('cti')).toBe(true);
    expect(scheduled.has('ctitv')).toBe(true);
  });
});

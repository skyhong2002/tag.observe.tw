import { describe, expect, it } from 'vitest';
import disabledSpec from '../../data/crawl-disabled.json' with { type: 'json' };
import { disabled, sourcesInGroup } from './registry.ts';

describe('registry', () => {
  it('never schedules sources listed in crawl-disabled.json', () => {
    const scheduled = new Set([...sourcesInGroup('news'), ...sourcesInGroup('hourly')].map((s) => s.media));
    for (const media of disabledSpec.media) expect(scheduled.has(media), media).toBe(false);
    expect(disabled().has('cti')).toBe(true);
    expect(scheduled.has('ctitv')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { TOPIC_RULES } from './topics.ts';

const rule = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;

describe('technews', () => {
  it('takes topic slugs but not feeds, portals or the index', () => {
    const t = rule('technews');
    for (const href of ['/siph-cpo/', '/share-bike-2020/']) expect(t.pattern.test(href)).toBe(true);
    for (const href of ['/feed/', '/topics/', '/tn-rss/', '/event-portal/', '/2026/03/18/nvidia/']) expect(t.pattern.test(href)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { tagFlowHours } from './tag-flow.ts';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 7, h, m));

describe('tag flow', () => {
  it('counts the company a keyword keeps per hour, once per report, without noise', () => {
    const rows = [
      { id: 1, media: 'udn', publishedAt: at(3, 10), tags: ['沈伯洋', '蔣萬安', '台灣', '2026年'] },
      { id: 1, media: 'udn', publishedAt: at(3, 10), tags: ['沈伯洋', '蔣萬安'] },
      { id: 2, media: 'ltn', publishedAt: at(3, 40), tags: ['沈伯洋', '蔣萬安', '蔣萬安', '毒品'] },
      { id: 3, media: 'ltn', publishedAt: at(5, 0), tags: ['沈伯洋', '毒品'] },
      { id: 4, media: 'cna', publishedAt: at(5, 30), tags: ['沈伯洋', '毒品', '政治'] },
    ];
    expect(tagFlowHours('沈伯洋', rows)).toEqual([
      { t: at(3).toISOString(), count: 2, tags: [['蔣萬安', 2]] },
      { t: at(5).toISOString(), count: 2, tags: [['毒品', 2]] },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { qualifyTags } from './tag-stats-job.ts';

describe('qualifyTags (chart.php levels)', () => {
  const rows = [
    { media: 'a', tags: ['x', 'y'] },
    { media: 'a', tags: ['x'] },
    { media: 'a', tags: ['x'] },
    { media: 'b', tags: ['x', 'y'] },
    { media: 'b', tags: ['x'] },
    { media: 'c', tags: ['x', 'z'] },
  ];
  it('news: level2 needs >=2 media with >=2 mentions; level3 also >=1 media with >=3 and >=3 media', () => {
    const { level2, level3 } = qualifyTags(rows, 'news');
    expect(level2).toEqual([['x', 6]]);
    expect(level3).toEqual([['x', 6]]);
  });
  it('other categories relax to >=2 media (level2) and one media with >=2 (level3)', () => {
    const { level2, level3 } = qualifyTags(rows, '3c');
    expect(level2.map(([t]) => t).sort()).toEqual(['x', 'y']);
    expect(level3.map(([t]) => t)).toEqual(['x']);
  });
});

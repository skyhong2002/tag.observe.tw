import { expect, it } from 'vitest';
import type { LegacyCandidate } from './import.ts';
import { reviewIdentityGroups } from './identity-review.ts';

const row = (id: string, overrides = {}) => ({
  article: { media: 'cna', url:'https://example.tw/1', urlKey:'1', title:'相同標題', publishedAt:'2024-01-01T00:00:00Z', crawledAt:id, description:'摘要', tags:['新聞'], ...overrides },
}) as unknown as LegacyCandidate;

it('allows binary-equivalent rows with different collection clocks', () => {
  const result = reviewIdentityGroups([row('1'),row('2')],[[0,1]]);
  expect(result.conflicts.size).toBe(0);
  expect([...result.equivalent]).toEqual([[0,0],[1,0]]);
});

it('retains collation, metadata and content conflicts across transitive identity groups', () => {
  for(const change of [{url:'https://example.tw/ONE'},{title:'不同標題'},{publishedAt:'2024-01-02T00:00:00Z'},{description:'不同摘要'},{tags:['另一標籤']}]) {
    const result = reviewIdentityGroups([row('1'),row('2'),row('3',change)],[[0,1],[1,2]]);
    expect([...result.conflicts].sort()).toEqual([0,1,2]);
    expect(result.equivalent.size).toBe(0);
  }
});

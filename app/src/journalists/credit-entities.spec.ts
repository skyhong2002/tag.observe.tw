import { afterEach, describe, expect, it } from 'vitest';
import { aggregateCredits, bylineParams } from '../v1/bylines.ts';
import { creditEntities } from './credit-entities.ts';
import { setRequestedExclusions } from './names.ts';

afterEach(() => setRequestedExclusions([]));
describe('structured news credits', () => {
  it('keeps the department, author and explicitly credited editor separate', () => {
    const entries = creditEntities(['政治中心／記者王小明', '責任編輯：陳美玲'], 'udn');
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'desk:udn:政治中心', kind: 'desk', roles: [] }),
        expect.objectContaining({ key: 'person:王小明', kind: 'person', roles: ['記者'] }),
        expect.objectContaining({ key: 'person:陳美玲', kind: 'person', roles: ['責任編輯'] }),
      ]),
    );
    expect(creditEntities(['政治中心'], 'ltn')[0].key).not.toBe(entries[0].key);
  });
  it('recognizes institutions before applying the name-shape heuristic', () => {
    expect(creditEntities(['中央商情'], 'news_pchome')[0].kind).toBe('organization');
    expect(creditEntities(['中央社', 'CNA'], 'udn')).toHaveLength(1);
    expect(creditEntities(['中央社'], 'udn')[0]).toMatchObject({ organization: 'cna', key: 'organization:cna' });
    expect(creditEntities(['記者王小明台北7日電'], 'cna')[0]).toMatchObject({ name: '王小明', kind: 'person' });
  });
  it('does not recreate an excluded person as an unknown credit', () => {
    setRequestedExclusions(['王小明']);
    expect(creditEntities(['記者王小明', '政治中心'], 'udn')).toEqual([expect.objectContaining({ kind: 'desk' })]);
  });
  it('retains uncertainty instead of inventing a reporter or a role', () => {
    expect(creditEntities(['AI觀點2026'], 'udn')[0]).toMatchObject({ kind: 'unknown', roles: [], key: 'unknown:udn:AI觀點2026' });
    expect(creditEntities(['王小明'], 'udn')[0].roles).toEqual([]);
  });
  it('counts a shared article once per entity, with separate publication outlets', () => {
    const date = new Date('2026-10-07T00:00:00Z');
    const data = aggregateCredits([
      { id: 1, media: 'udn', publishedAt: date, authors: ['王小明', '王小明', '政治中心'], creator: null },
      { id: 2, media: 'ltn', publishedAt: date, authors: ['王小明', '政治中心'], creator: null },
    ]);
    const person = data.summaries.find((entry) => entry.kind === 'person');
    expect(person?.articles).toBe(2);
    expect(person?.outlets).toHaveLength(2);
    expect(data.summaries.filter((entry) => entry.kind === 'desk')).toHaveLength(2);
    expect(data.credited).toBe(2);
  });
  it('rejects unbounded windows and invalid filters', () => {
    expect(bylineParams({ hours: '721' })).toBeNull();
    expect(bylineParams({ page: '-1' })).toBeNull();
    expect(bylineParams({ kind: 'reporter' })).toBeNull();
    expect(bylineParams({ media: '../udn' })).toBeNull();
  });
});

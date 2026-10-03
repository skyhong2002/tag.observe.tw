import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/journalist-exclusions.json', () => ({ default: { note: '', names: ['王小明', 'Una  Wang'] } }));

const { isExcludedJournalist, journalistNames, personNames } = await import('./names.ts');

describe('journalist exclusions', () => {
  it('drops excluded people from bylines but keeps everyone else', () => {
    expect(personNames('記者王小明、李大華／台北報導')).toEqual(['李大華']);
    expect(journalistNames(['王小明', 'Una Wang', '張瀞文'])).toEqual(['張瀞文']);
  });
  it('matches on the normalized page key', () => {
    expect(isExcludedJournalist('王小明')).toBe(true);
    expect(isExcludedJournalist('Una Wang')).toBe(true);
    expect(isExcludedJournalist('una wang')).toBe(false);
    expect(isExcludedJournalist('張瀞文')).toBe(false);
  });
});

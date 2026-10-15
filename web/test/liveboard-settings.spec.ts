import { describe, expect, it } from 'vitest';
import { DEFAULTS, LENSES, normalizeSettings } from '../src/app/liveboard/settings.ts';

// The account keeps at most this many lens keys (LIVEBOARD_LENSES_MAX in app/src/reader/validate.ts).
const SAVED_MAX = 24;

describe('liveboard lenses', () => {
  it('default to every lens that exists, within what the account keeps', () => {
    expect(DEFAULTS.lenses.length).toBeLessThanOrEqual(SAVED_MAX);
    expect(LENSES.length).toBeLessThanOrEqual(SAVED_MAX);
    for (const key of DEFAULTS.lenses) {
      expect(LENSES.some((l) => l.key === key)).toBe(true);
      expect(key).toMatch(/^[a-z0-9-]{1,20}$/);
    }
  });
  it('keep a saved list that predates the scenes as it was', () => {
    const saved = normalizeSettings({ lenses: ['growth', 'blue'] });
    expect(saved.lenses).toEqual(['growth', 'blue']);
  });
});

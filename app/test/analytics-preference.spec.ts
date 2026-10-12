import { describe, expect, it } from 'vitest';
import { OPT_OUT_KEY, readOptOut, writeOptOut } from '../../web/src/lib/analytics-consent.mts';
import { reconcileAnalyticsPreference } from '../../web/src/lib/analytics-preference.mts';

describe('account analytics preference sync', () => {
  it('reproduces the old delayed account opt-in clearing a browser opt-out, then keeps the new policy private', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
    writeOptOut(storage, true);
    // The previous PrefsSync unconditionally applied saved=false here.
    writeOptOut(storage, false);
    expect(storage.getItem(OPT_OUT_KEY)).toBe(null);
    writeOptOut(storage, true);
    const choice = reconcileAnalyticsPreference(readOptOut(storage), false, false);
    if (choice.apply !== undefined) writeOptOut(storage, choice.apply);
    expect(storage.getItem(OPT_OUT_KEY)).toBe('1');
    expect(choice).toEqual({ upload: true });
    // A navigation/remount repeats the merge without clearing the local deny.
    expect(reconcileAnalyticsPreference(readOptOut(storage), false, false)).toEqual({ upload: true });
  });
  it('lets an account opt-out strengthen a fresh browser, and copies an unset preference once', () => {
    expect(reconcileAnalyticsPreference(false, true, false)).toEqual({ apply: true });
    expect(reconcileAnalyticsPreference(false, undefined, false)).toEqual({ upload: false });
    expect(reconcileAnalyticsPreference(true, undefined, false)).toEqual({ upload: true });
    expect(reconcileAnalyticsPreference(true, true, false)).toEqual({});
    expect(reconcileAnalyticsPreference(false, false, false)).toEqual({});
  });
  it.each([true, false])('does not override an explicit newer choice %s with an in-flight account response', (local) => {
    expect(reconcileAnalyticsPreference(local, !local, true)).toEqual({});
    expect(reconcileAnalyticsPreference(local, undefined, true)).toEqual({});
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('reader preference store across navigation and delayed requests', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());
  it('returns the most recently saved preference to a remounted consumer', async () => {
    let saved = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/auth/me') return Response.json({ enabled: true, user: { id: 701, role: 'reader' } });
        if (init?.method === 'PUT') saved = JSON.parse(String(init.body)).analyticsOptOut;
        return Response.json({ prefs: { analyticsOptOut: saved } });
      }),
    );
    const { prefs, savePrefs } = await import('../src/lib/reader.ts');
    expect(await prefs.get()).toEqual({ analyticsOptOut: true });
    await savePrefs({ analyticsOptOut: false });
    expect(await prefs.get()).toEqual({ analyticsOptOut: false });
  });
  it('does not overwrite a newer PUT with a late initial GET', async () => {
    let resolveGet!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/auth/me') return Response.json({ enabled: true, user: { id: 701, role: 'reader' } });
        if (init?.method === 'PUT') return Response.json({ prefs: { analyticsOptOut: false } });
        return new Promise<Response>((resolve) => {
          resolveGet = resolve;
        });
      }),
    );
    const { prefs, savePrefs } = await import('../src/lib/reader.ts');
    const initial = prefs.get();
    await vi.waitFor(() => expect(resolveGet).toBeTypeOf('function'));
    await savePrefs({ analyticsOptOut: false });
    resolveGet(Response.json({ prefs: { analyticsOptOut: true } }));
    expect(await initial).toEqual({ analyticsOptOut: false });
    expect(await prefs.get()).toEqual({ analyticsOptOut: false });
  });
  it('keeps the explicit-choice marker when a preference component remounts', async () => {
    const a = await import('../src/lib/analytics-preference.mts');
    expect(a.analyticsChoiceWasExplicit()).toBe(false);
    a.rememberAnalyticsChoice();
    const remount = await import('../src/lib/analytics-preference.mts');
    expect(remount.analyticsChoiceWasExplicit()).toBe(true);
    expect(remount.reconcileAnalyticsPreference(false, true, remount.analyticsChoiceWasExplicit())).toEqual({});
  });
});

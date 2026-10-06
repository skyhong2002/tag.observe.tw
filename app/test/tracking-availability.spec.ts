import { describe, expect, it, vi } from 'vitest';
import { analyticsBlock } from '../../web/src/lib/analytics-consent.mts';
import { trackingAvailable } from '../../web/src/lib/tracking-availability.mts';

const reader = { production: true, hostname: 'tag.observe.tw', webdriver: false, userAgent: 'Mozilla/5.0', optedOut: false };

describe('privacy requests', () => {
  it('excludes Do Not Track and GPC without excluding an ordinary browser', () => {
    expect(analyticsBlock(reader)).toBeNull();
    expect(analyticsBlock({ ...reader, doNotTrack: '1' })).toBe('privacy');
    expect(analyticsBlock({ ...reader, doNotTrack: 'yes' })).toBe('privacy');
    expect(analyticsBlock({ ...reader, globalPrivacyControl: true })).toBe('privacy');
    expect(analyticsBlock({ ...reader, doNotTrack: '0', globalPrivacyControl: false })).toBeNull();
  });
});

describe('tracking availability', () => {
  it('never probes when excluded, the Google script is blocked, or the check was cancelled', async () => {
    const request = vi.fn<typeof fetch>();
    expect(await trackingAvailable(false, true, request, new AbortController().signal)).toBe(false);
    expect(await trackingAvailable(true, false, request, new AbortController().signal)).toBe(false);
    expect(await trackingAvailable(true, true, request, AbortSignal.abort())).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it('stays unconfirmed on DNS/network/adblock failure, with no fallback host', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await trackingAvailable(true, true, request, new AbortController().signal)).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('accepts an accessible endpoint without sending a GA event or identity', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue({ type: 'opaque', ok: false } as Response);
    const signal = new AbortController().signal;
    expect(await trackingAvailable(true, true, request, signal)).toBe(true);
    expect(request).toHaveBeenCalledWith('https://www.google-analytics.com/g/collect', {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal,
    });
  });
  it('does not accept a visible failure response or a late response after cancellation', async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    expect(await trackingAvailable(true, true, request, controller.signal)).toBe(false);
    request.mockImplementation(async () => {
      controller.abort();
      return { type: 'opaque' } as Response;
    });
    expect(await trackingAvailable(true, true, request, controller.signal)).toBe(false);
  });
});

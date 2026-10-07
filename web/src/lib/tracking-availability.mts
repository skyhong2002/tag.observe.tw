/** A failed/blocked tag or collection endpoint must never be bypassed by first-party heartbeats. */
export async function trackingAvailable(allowed: boolean, tagReady: boolean, request: typeof fetch, signal: AbortSignal): Promise<boolean> {
  if (!allowed || !tagReady || signal.aborted) return false;
  try {
    // No measurement ID, client ID, event, cookies or referrer: this is not a GA hit.
    // Use the normal collection host, with no proxy or alternative-host fallback.
    const response = await request('https://www.google-analytics.com/g/collect', {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal,
    });
    return !signal.aborted && (response.type === 'opaque' || response.ok);
  } catch {
    return false;
  }
}

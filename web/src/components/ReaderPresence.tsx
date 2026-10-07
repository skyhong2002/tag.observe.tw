'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { analyticsBlock, GA_ID, OPT_OUT_EVENT, OPT_OUT_KEY, readOptOut } from '@/lib/analytics-consent.mts';
import { READER_KEY, readerId } from '@/lib/reader-presence.mts';
import { trackingAvailable } from '@/lib/tracking-availability.mts';

type Presence = { count: number | null; status: string; counted: boolean };
const Context = createContext<Presence>({ count: null, status: '正在確認連線', counted: false });
export const useReaderPresence = () => useContext(Context);

export default function ReaderPresence({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Presence>({ count: null, status: '正在確認連線', counted: false });
  useEffect(() => {
    let stopped = false;
    let version = 0;
    let reportedId: string | null = null;
    let controller: AbortController | null = null;
    const update = async () => {
      const current = ++version;
      controller?.abort();
      const pending = new AbortController();
      controller = pending;
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        /* Report why this browser is excluded. */
      }
      const block = analyticsBlock({
        production: process.env.NODE_ENV === 'production',
        hostname: location.hostname,
        webdriver: navigator.webdriver,
        doNotTrack: navigator.doNotTrack,
        globalPrivacyControl: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
        userAgent: navigator.userAgent,
        optedOut: readOptOut(storage),
      });
      const visible = document.visibilityState === 'visible';
      setState((s) => ({ ...s, counted: false, status: visible ? '正在確認追蹤' : '背景頁面暫停計入' }));
      if (!visible) return;
      const timeout = setTimeout(() => pending.abort(), 8000);
      let status = '追蹤未確認，未計入';
      try {
        const trackingWindow = window as unknown as Record<string, unknown>;
        const tags = trackingWindow.google_tag_manager as Record<string, unknown> | undefined;
        const available = await trackingAvailable(
          !block && !trackingWindow[`ga-disable-${GA_ID}`],
          Boolean(tags?.[GA_ID]),
          fetch,
          pending.signal,
        );
        if (stopped || current !== version) return;
        const id = available && storage ? readerId(storage, () => crypto.randomUUID()) : null;
        status =
          block === 'opt-out'
            ? '你已選擇不計入'
            : block === 'privacy'
              ? '瀏覽器要求不要追蹤，未計入'
              : block === 'automation'
                ? '自動化瀏覽不計入'
                : block === 'environment'
                  ? '預覽瀏覽不計入'
                  : !available
                    ? '追蹤未確認，未計入'
                    : !id
                      ? '無法儲存匿名識別碼，未計入'
                      : '連線未確認';
        // Remove an existing membership when tracking becomes blocked, including after a reload.
        // Reading a saved ID does not create a new one for an excluded browser.
        let previousId = reportedId;
        if (!previousId && storage) {
          try {
            previousId = JSON.parse(storage.getItem(READER_KEY) ?? 'null')?.id ?? null;
          } catch {}
        }
        const leave = !id && typeof previousId === 'string' && /^[a-f0-9-]{36}$/.test(previousId) ? previousId : null;
        const res = await fetch('/api/v1/reader-presence', {
          method: id || leave ? 'POST' : 'GET',
          cache: 'no-store',
          signal: pending.signal,
          ...(id || leave
            ? {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: id ?? leave, ...(leave ? { leave: true } : {}) }),
              }
            : {}),
        });
        if (!res.ok) throw Error('presence unavailable');
        const result = await res.json();
        if (!Number.isSafeInteger(result.activeReaders) || result.activeReaders < 0) throw Error('invalid count');
        if (stopped || current !== version) return;
        reportedId = id;
        setState({ count: result.activeReaders, status: id ? '包含你的瀏覽器' : status, counted: Boolean(id) });
      } catch {
        if (!stopped && current === version) setState({ count: null, status, counted: false });
      } finally {
        clearTimeout(timeout);
      }
    };
    const refresh = () => {
      void update();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === OPT_OUT_KEY || event.key === null) refresh();
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    const startup = setTimeout(refresh, 3000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener(OPT_OUT_EVENT, refresh);
    window.addEventListener('storage', storageChanged);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      clearTimeout(startup);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener(OPT_OUT_EVENT, refresh);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

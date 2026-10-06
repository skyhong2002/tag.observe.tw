'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { analyticsBlock, OPT_OUT_EVENT, OPT_OUT_KEY, readOptOut } from '@/lib/analytics-consent.mts';
import { readerId } from '@/lib/reader-presence.mts';

type Presence = { count: number | null; status: string };
const Context = createContext<Presence>({ count: null, status: '正在確認連線' });
export const useReaderPresence = () => useContext(Context);

export default function ReaderPresence({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Presence>({ count: null, status: '正在確認連線' });
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
        userAgent: navigator.userAgent,
        optedOut: readOptOut(storage),
      });
      const visible = document.visibilityState === 'visible';
      let id: string | null = null;
      if (!block && visible && storage) id = readerId(storage, () => crypto.randomUUID());
      const status =
        block === 'opt-out'
          ? '你已選擇不計入'
          : block === 'automation'
            ? '自動化瀏覽不計入'
            : block === 'environment'
              ? '預覽瀏覽不計入'
              : !visible
                ? '背景頁面暫停計入'
                : !id
                  ? '無法儲存匿名識別碼，未計入'
                  : '包含你的瀏覽器';
      // Opt-out applies to every tab. Hiding one tab must not remove other visible tabs.
      const leave = block === 'opt-out' ? reportedId : null;
      setState((s) => ({ ...s, status: id ? '正在確認連線' : status }));
      if (!visible && !leave) return;
      const timeout = setTimeout(() => pending.abort(), 8000);
      try {
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
        setState({ count: result.activeReaders, status });
      } catch {
        if (!stopped && current === version) setState({ count: null, status: block ? status : '連線未確認' });
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
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener(OPT_OUT_EVENT, refresh);
    window.addEventListener('storage', storageChanged);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener(OPT_OUT_EVENT, refresh);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

'use client';

import { useEffect } from 'react';
import { OPT_OUT_EVENT, OPT_OUT_KEY, readOptOut, writeOptOut } from '@/lib/analytics-consent.mts';
import { reconcileAnalyticsPreference } from '@/lib/analytics-preference.mts';
import { prefs, savePrefs } from '@/lib/reader';

// Carries a signed-in reader's theme and analytics choice between devices
// (app/src/reader/routes.ts). The account supplies theme; privacy sync never
// clears an existing browser opt-out. Renders nothing.
export default function PrefsSync() {
  useEffect(() => {
    let disposed = false;
    let choiceChanged = false;
    const onChoice = (event: Event) => {
      if (event.type !== 'storage' || (event as StorageEvent).key === OPT_OUT_KEY || (event as StorageEvent).key === null)
        choiceChanged = true;
    };
    window.addEventListener(OPT_OUT_EVENT, onChoice);
    window.addEventListener('storage', onChoice);
    prefs
      .get()
      .then((saved) => {
        if (disposed || !saved) return;
        let storage: Storage | null = null;
        try {
          storage = window.localStorage;
        } catch {
          return;
        }
        const upload: { theme?: 'light' | 'dark' | null; analyticsOptOut?: boolean } = {};
        if ('theme' in saved) {
          const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          if (saved.theme) storage.setItem('theme', saved.theme);
          else storage.removeItem('theme');
          document.documentElement.dataset.theme = saved.theme ?? system;
        } else {
          const local = storage.getItem('theme');
          upload.theme = local === 'dark' || local === 'light' ? local : null;
        }
        const privacy = reconcileAnalyticsPreference(readOptOut(storage), saved.analyticsOptOut, choiceChanged);
        if (privacy.apply !== undefined) {
          writeOptOut(storage, privacy.apply);
          window.dispatchEvent(new Event(OPT_OUT_EVENT));
        }
        if (privacy.upload !== undefined) upload.analyticsOptOut = privacy.upload;
        if (Object.keys(upload).length) return savePrefs(upload);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      window.removeEventListener(OPT_OUT_EVENT, onChoice);
      window.removeEventListener('storage', onChoice);
    };
  }, []);
  return null;
}

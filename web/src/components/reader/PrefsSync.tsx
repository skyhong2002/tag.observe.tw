'use client';

import { useEffect } from 'react';
import { OPT_OUT_EVENT, readOptOut, writeOptOut } from '@/lib/analytics-consent.mts';
import { prefs, savePrefs } from '@/lib/reader';

// Carries a signed-in reader's theme and analytics choice between devices
// (app/src/reader/routes.ts). The account wins once it has a value; before
// that, this browser's current choice is copied up. Renders nothing.
export default function PrefsSync() {
  useEffect(() => {
    prefs
      .get()
      .then((saved) => {
        if (!saved) return;
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
        if (saved.analyticsOptOut !== undefined) {
          if (saved.analyticsOptOut !== readOptOut(storage)) {
            writeOptOut(storage, saved.analyticsOptOut);
            window.dispatchEvent(new Event(OPT_OUT_EVENT));
          }
        } else upload.analyticsOptOut = readOptOut(storage);
        if (Object.keys(upload).length) return savePrefs(upload);
      })
      .catch(() => {});
  }, []);
  return null;
}

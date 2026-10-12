'use client';

import { useEffect, useState } from 'react';
import { prefs as readerPrefs, savePrefs } from '@/lib/reader';
import { loadSession } from '@/lib/session';
import { DEFAULTS, type LiveboardSettings, normalizeSettings } from './settings';

// Where the liveboard settings live in the browser (see settings.ts).
const STORAGE_KEY = 'tag.liveboard.settings';

export function storedSettings(): LiveboardSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function store(settings: LiveboardSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/** The account's settings when signed in and saved there, else null. */
async function accountSettings(): Promise<LiveboardSettings | null> {
  const saved = await readerPrefs.get().catch(() => null);
  return saved?.liveboard ? normalizeSettings(saved.liveboard) : null;
}

/**
 * The saved settings: this device's copy at once, then the account's when
 * signed in (which also refreshes the device's copy). null until mounted.
 */
export function useSavedSettings() {
  const [settings, setSettings] = useState<LiveboardSettings | null>(null);
  useEffect(() => {
    let live = true;
    setSettings(storedSettings() ?? DEFAULTS);
    accountSettings().then((account) => {
      if (!live || !account) return;
      store(account);
      setSettings(account);
    });
    return () => {
      live = false;
    };
  }, []);
  return settings;
}

/** Saves on this device, and to the account when signed in. Says where it went. */
export async function saveSettings(settings: LiveboardSettings): Promise<'account' | 'device'> {
  store(settings);
  if (!(await loadSession()).user) return 'device';
  await savePrefs({ liveboard: { ...settings } });
  return 'account';
}

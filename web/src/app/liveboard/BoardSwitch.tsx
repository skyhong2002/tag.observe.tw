'use client';

import type { ComponentProps } from 'react';
import LiveBoard from './LiveBoard';
import SimpleBoard from './SimpleBoard';
import { DEFAULTS, settingsFromQuery } from './settings';
import { useSavedSettings } from './useSettings';

// Shows the full or the simple board: the query's choice, else the saved
// setting (this device's copy at once, the account's when it arrives), else
// the simple one.
export default function BoardSwitch({
  query,
  forced,
  full,
  simple,
}: {
  query: Record<string, string>;
  /** The board the query names; the page only loaded that one. */
  forced: 'full' | 'simple' | null;
  full: ComponentProps<typeof LiveBoard> | null;
  simple: Omit<ComponentProps<typeof SimpleBoard>, 'settings'> | null;
}) {
  const saved = useSavedSettings();
  if (forced === 'full' && full) return <LiveBoard {...full} />;
  // A blank screen for the moment it takes to read the saved setting.
  if (!saved) return <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950" />;
  const settings = settingsFromQuery(query, saved ?? DEFAULTS);
  if (settings.mode === 'simple' && simple) return <SimpleBoard {...simple} settings={settings} />;
  return full ? <LiveBoard {...full} /> : null;
}

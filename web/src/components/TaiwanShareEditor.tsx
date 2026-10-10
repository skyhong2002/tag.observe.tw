'use client';

import { useRef, useState } from 'react';
import { percent, type TaiwanShare, type TaiwanShareOverride } from '@/lib/traffic-comparison.mts';

// Admins correct an outlet's Taiwan share from the /media/traffic/ table
// (PUT /auth/admin/media/:media/taiwan-share, app/src/media-traffic/taiwan-share.ts).
// The gateway enforces admin access; this button is only shown to admins.

const field = 'mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700';
const button = 'min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700';

export default function TaiwanShareEditor({
  media,
  name,
  share,
  onSaved,
}: {
  media: string;
  name: string;
  share: TaiwanShare;
  onSaved: (override: TaiwanShareOverride | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const override = share && 'override' in share ? share.override : undefined;
  const similarweb = share && 'override' in share ? share.similarweb : share;
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => {
    setValue(override ? String(Math.round(override.share * 10_000) / 100) : '');
    setNote(override?.note ?? '');
    setError('');
    dialog.current?.showModal();
  };
  const save = async (next: number | null) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/auth/admin/media/${encodeURIComponent(media)}/taiwan-share`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ share: next, note }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(body.error ?? `HTTP ${response.status}`);
      onSaved(body.override ?? null);
      dialog.current?.close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 && parsed <= 100 && note.trim() !== '';

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`修正${name}的台灣占比`}
        title="修正台灣占比"
        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-brand-700 dark:hover:bg-zinc-800 dark:hover:text-brand-400"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" strokeLinejoin="round" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm font-normal whitespace-normal text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save(parsed / 100);
          }}
        >
          <h2 className="text-base font-semibold">{name}的台灣占比</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Similarweb：
            {similarweb == null
              ? '無資料'
              : 'share' in similarweb
                ? percent(similarweb.share)
                : `不在前五大國家，低於 ${percent(similarweb.below)}`}
            。修正值會取代所有月份的 Similarweb 數字，台灣讀者估算也跟著改。
          </p>
          <label className="mt-3 block">
            台灣占比（%）
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="100"
              step="0.01"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="mt-3 block">
            理由
            <textarea
              required
              maxLength={255}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：msn.com 是全球網域，改用 MSN 台灣版的估計"
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {override && (
              <button type="button" disabled={saving} onClick={() => save(null)} className={`${button} mr-auto`}>
                改回 Similarweb
              </button>
            )}
            <button type="button" onClick={() => dialog.current?.close()} className={button}>
              取消
            </button>
            <button
              type="submit"
              disabled={!valid || saving}
              className="min-h-9 rounded-full bg-brand-700 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-brand-600"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

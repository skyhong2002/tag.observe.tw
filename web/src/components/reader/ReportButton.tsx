'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { readerFetch } from '@/lib/reader';
import { loginHref, useSession } from '@/lib/session';
import { pill, pillOff } from './FollowButton';

// 回報錯誤 on an article: wrong tags (with the list it should have), byline,
// outlet, or anything else. Admins review reports at /admin/
// (POST /auth/me/reports, app/src/reader/routes.ts).

const KINDS = [
  { key: 'tags', label: '標籤不對' },
  { key: 'byline', label: '署名或記者不對' },
  { key: 'media', label: '媒體或來源歸屬不對' },
  { key: 'other', label: '其他問題' },
] as const;
const field = 'mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700';
const button = 'min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700';

export default function ReportButton({ articleId, tags }: { articleId: number; tags: string[] }) {
  const session = useSession();
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]['key']>('tags');
  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  if (!session?.enabled) return null;
  if (!session.user)
    return (
      <a href={loginHref(path)} className={`${pill} ${pillOff}`} title="登入後回報這篇的錯誤">
        回報錯誤
      </a>
    );
  const open = () => {
    setKind('tags');
    setTagText(tags.join('、'));
    setMessage('');
    setError('');
    setState('idle');
    dialog.current?.showModal();
  };
  const suggested = tagText
    .split(/[、,，\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const valid = kind === 'tags' ? suggested.length > 0 : message.trim() !== '';
  const send = async () => {
    setState('sending');
    setError('');
    try {
      await readerFetch('/auth/me/reports', {
        method: 'POST',
        body: { articleId, kind, message, ...(kind === 'tags' ? { tags: suggested } : {}) },
      });
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  };
  return (
    <>
      <button type="button" onClick={open} className={`${pill} ${pillOff}`}>
        回報錯誤
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {state === 'sent' ? (
          <div>
            <h2 className="text-base font-semibold">謝謝回報</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">管理員看過後會處理，結果可以在「我的設定」的回報紀錄查看。</p>
            <div className="mt-4 flex justify-end">
              <button type="button" className={button} onClick={() => dialog.current?.close()}>
                關閉
              </button>
            </div>
          </div>
        ) : (
          <form
            method="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) send();
            }}
          >
            <h2 className="text-base font-semibold">回報這篇的錯誤</h2>
            <fieldset className="mt-3">
              <legend className="sr-only">問題類型</legend>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <label key={k.key} className="flex items-center gap-1.5">
                    <input type="radio" name="kind" checked={kind === k.key} onChange={() => setKind(k.key)} />
                    {k.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {kind === 'tags' && (
              <label className="mt-3 block">
                這篇應該有的標籤（用頓號或逗號分開）
                <textarea rows={3} value={tagText} onChange={(e) => setTagText(e.target.value)} className={field} />
              </label>
            )}
            <label className="mt-3 block">
              {kind === 'tags' ? '補充說明（選填）' : '哪裡不對？'}
              <textarea
                rows={3}
                maxLength={1000}
                required={kind !== 'tags'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={field}
              />
            </label>
            {error && <p className="mt-2 text-red-700 dark:text-red-400">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={button} onClick={() => dialog.current?.close()}>
                取消
              </button>
              <button
                type="submit"
                disabled={!valid || state === 'sending'}
                className={`${button} bg-brand-700 text-white dark:bg-brand-600`}
              >
                {state === 'sending' ? '送出中…' : '送出'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

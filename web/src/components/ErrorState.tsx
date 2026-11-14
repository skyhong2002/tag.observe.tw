'use client';

import Link from 'next/link';
import { useEffect, useTransition } from 'react';

/** The props Next passes to an error.tsx boundary. */
export interface ErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

const button =
  'inline-flex min-h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-80';
const secondary =
  'inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm text-zinc-900 hover:border-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-brand-400';

/**
 * Body of every error.tsx: what failed, a retry that renders the segment again
 * (re-fetching its data), and a way out. Server errors reach the browser as a
 * generic message with a digest; the digest is shown so a report can be matched
 * to the server log.
 */
export default function ErrorState({
  error,
  retry,
  title = '這個頁面暫時無法載入',
  back = { href: '/', label: '回首頁' },
}: ErrorProps & { title?: string; back?: { href: string; label: string } }) {
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="max-w-2xl space-y-5 py-6">
      {/* Under a loading.tsx the response has already started as 200, so this is
          what keeps a transient failure out of the index (React hoists it to head). */}
      <meta name="robots" content="noindex" />
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">暫時無法取得資料</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">資料來源暫時沒有回應，多半幾秒後就會恢復。可以重試一次，或先看其他頁面。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={pending} onClick={() => startTransition(() => retry())}>
          {pending ? '重新載入中…' : '重新載入'}
        </button>
        <Link href={back.href} className={secondary}>
          {back.label}
        </Link>
      </div>
      {error.digest && (
        <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          一直無法載入的話，歡迎到頁尾的「聯絡與移除請求」告訴我們，附上這串編號能更快找到原因：
          <code className="ml-1 font-mono tabular-nums">{error.digest}</code>
        </p>
      )}
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { loginHref, useSession } from '@/lib/session';

export const note = 'mt-4 text-sm text-zinc-600 dark:text-zinc-400';
export const card = 'rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900';
export const button =
  'inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700';
export const primary =
  'inline-flex min-h-9 items-center rounded-full bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 dark:bg-brand-600';
export const field = 'rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900';

// The /my/ pages need a signed-in reader; the gateway enforces it (/auth/me/*),
// this only explains what to do instead of showing empty pages.
export default function ReaderGate({ next, children }: { next: string; children: ReactNode }) {
  const session = useSession();
  if (!session) return <p className={note}>載入中…</p>;
  if (!session.enabled) return <p className={note}>登入功能尚未開放。</p>;
  if (!session.user)
    return (
      <div className={note}>
        <p>
          用 Google 帳號
          <a href={loginHref(next)} className="mx-1 text-brand-700 underline dark:text-brand-400">
            登入
          </a>
          後，可以：
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>追蹤標籤、媒體、記者與事件，集中在「我的動態」，也能用私人 RSS 訂閱</li>
          <li>收藏文章與事件，加上自己的註記</li>
          <li>在不同裝置同步深淺色與統計設定</li>
          <li>自願開啟閱讀報告，看自己讀的媒體與陣營分布</li>
          <li>申請個人 API 金鑰，取得較高的請求額度</li>
          <li>回報標籤、署名或媒體歸屬的錯誤</li>
        </ul>
      </div>
    );
  return children;
}

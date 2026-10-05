'use client';

import { type ReactNode, useState } from 'react';
export default function CompactArticleList({
  children,
  count,
  order = '依收錄順序',
}: {
  children: ReactNode;
  count: number;
  order?: string;
}) {
  const [summaries, setSummaries] = useState(false);
  return (
    <div data-summaries={summaries} className="group/list">
      <div className="flex items-center justify-between border-b border-zinc-200 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>
          本頁 {count} 篇 · {order}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 py-1.5">
          <input
            type="checkbox"
            checked={summaries}
            onChange={(event) => setSummaries(event.target.checked)}
            className="accent-orange-700"
          />
          顯示摘要
        </label>
      </div>
      {children}
    </div>
  );
}

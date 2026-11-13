import type { Metadata } from 'next';
import MyTabs from './MyTabs';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4">
      <h1 className="text-2xl font-semibold tracking-tight">我的新文易數</h1>
      <MyTabs />
      {/* Lists of follows and saves read best at a column width, with their buttons near the names;
          wide screens put a short guide to the reader pages beside them. */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,48rem)_17rem] lg:items-start lg:gap-10">
        <div className="min-w-0">{children}</div>
        <aside className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 lg:mt-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">這幾頁怎麼用</h2>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="font-medium">我的動態</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">你追蹤的標籤、媒體、記者與事件最近的報導。</dd>
            </div>
            <div>
              <dt className="font-medium">追蹤清單</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">在標籤、媒體、記者或事件頁按「追蹤」就會出現在這裡。</dd>
            </div>
            <div>
              <dt className="font-medium">收藏</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">文章與事件按「收藏」後可以加註記，只有你看得到。</dd>
            </div>
            <div>
              <dt className="font-medium">設定</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">私人 RSS、閱讀紀錄、深淺色與個人 API 金鑰。</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

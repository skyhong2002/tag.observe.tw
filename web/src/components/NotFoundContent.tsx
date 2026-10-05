import Link from 'next/link';

const ENTRIES = [
  { href: '/', label: '首頁', note: '今天的新聞總覽' },
  { href: '/article/', label: '最新文章', note: '所有媒體的文章，由新到舊' },
  { href: '/event/', label: '事件表', note: '各家媒體正在報導的事件' },
  { href: '/ranking/', label: '關鍵字排行', note: '每小時升溫的新聞關鍵字' },
  { href: '/topic/', label: '議題表', note: '媒體持續更新的議題' },
  { href: '/feature/', label: '專題', note: '媒體一次性的新聞包' },
];

/** Body of the 404 page, shared by the root and (site) not-found files. */
export default function NotFoundContent() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-500">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">找不到這個頁面</h1>
        <p className="text-zinc-600 dark:text-zinc-400">網址可能打錯了，或這個頁面已經不存在。可以搜尋新聞，或從下面的入口繼續瀏覽。</p>
      </div>
      <form action="/search/" className="flex gap-2">
        <input
          name="q"
          maxLength={60}
          placeholder="搜尋標題、摘要與標籤"
          aria-label="搜尋標題、摘要與標籤"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          搜尋
        </button>
      </form>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ENTRIES.map(({ href, label, note }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-xl border border-zinc-300 bg-white p-4 hover:border-brand-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
            >
              <span className="font-medium">{label} →</span>
              <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

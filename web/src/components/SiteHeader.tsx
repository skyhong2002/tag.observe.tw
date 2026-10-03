import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import Wordmark from './Wordmark';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-300 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:flex-nowrap">
        <Link href="/" className="shrink-0" aria-label="新文易數 首頁">
          <Wordmark className="h-6 w-auto" />
        </Link>
        <div className="ml-auto sm:order-last">
          <ThemeToggle />
        </div>
        <nav className="flex w-full min-w-0 gap-1 overflow-x-auto whitespace-nowrap text-sm sm:w-auto" aria-label="主要導覽">
          <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            首頁
          </Link>
          <Link href="/ranking/" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            排行榜
          </Link>
          <Link href="/similarity/" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            內文相似度
          </Link>
          <a href="/event/" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            事件表
          </a>
          <a href="/topic/" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            議題表
          </a>
          <a href="/media/" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            媒體
          </a>
        </nav>
      </div>
    </header>
  );
}

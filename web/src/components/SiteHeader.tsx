import Link from 'next/link';
import SiteNavigation from './SiteNavigation';
import ThemeToggle from './ThemeToggle';
import Wordmark from './Wordmark';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-300 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 lg:flex-nowrap">
        <Link href="/" className="shrink-0" aria-label="新文易數 首頁">
          <Wordmark className="h-6 w-auto" />
        </Link>
        <div className="ml-auto lg:order-last">
          <ThemeToggle />
        </div>
        <SiteNavigation />
      </div>
    </header>
  );
}

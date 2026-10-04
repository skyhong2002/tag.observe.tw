import Link from 'next/link';
import SiteNavigation from './SiteNavigation';
import SiteSearch from './SiteSearch';
import ThemeToggle from './ThemeToggle';
import Wordmark from './Wordmark';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-300 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 lg:gap-3">
        <Link href="/" className="shrink-0" aria-label="新文易數 首頁">
          <Wordmark className="h-6 w-auto" />
        </Link>
        <div className="order-3 lg:order-none">
          <SiteNavigation />
        </div>
        <div className="order-last w-full lg:order-none lg:ml-auto lg:w-44">
          <SiteSearch />
        </div>
        <div className="ml-auto shrink-0 lg:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

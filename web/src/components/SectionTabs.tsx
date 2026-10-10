import Link from 'next/link';

export default function SectionTabs({
  label,
  tabs,
  className = '',
  variant = 'page',
}: {
  label: string;
  tabs: Array<{ href: string; label: string; current?: boolean }>;
  className?: string;
  variant?: 'page' | 'footer';
}) {
  return (
    <nav
      aria-label={label}
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-lg p-1 ${variant === 'footer' ? 'bg-zinc-200 text-xs dark:bg-zinc-950' : 'bg-zinc-100 text-sm dark:bg-zinc-900'} ${className}`}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? 'page' : undefined}
          className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md ${variant === 'footer' ? 'px-2' : 'px-3'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${tab.current ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

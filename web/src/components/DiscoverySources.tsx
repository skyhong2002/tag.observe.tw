import Link from 'next/link';
import type { DiscoverySource } from '@/lib/article-content';
import SourceLink from './SourceLink';

export default function DiscoverySources({ sources }: { sources?: DiscoverySource[] }) {
  if (!sources?.length) return null;
  return (
    <nav aria-label="文章發現來源" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
      {sources.map((source) => (
        <span key={source.media} className="inline-flex items-center gap-1">
          由{' '}
          <Link href={`/media/${encodeURIComponent(source.media)}/`} className="text-brand-700 hover:underline dark:text-brand-400">
            {source.title}
          </Link>{' '}
          發現
          <SourceLink url={source.url} label={`${source.title}發現頁`} iconOnly className="!min-h-6 px-1" />
        </span>
      ))}
    </nav>
  );
}

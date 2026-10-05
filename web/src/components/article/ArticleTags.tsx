import Link from 'next/link';
import type { ArticleRelated } from '@/lib/related';

export default function ArticleTags({ data, tags }: { data: ArticleRelated | null; tags: string[] }) {
  const entries = data?.tags ?? tags.map((tag) => ({ tag, articles: 0, media: 0 }));
  if (!entries.length) return null;
  return (
    <nav aria-label="文章關鍵字" className="mt-5">
      <ul className="flex flex-wrap gap-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.tag}>
            <Link
              href={`/tag/${encodeURIComponent(entry.tag)}/`}
              className="inline-block rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-600 hover:text-brand-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-brand-400"
            >
              #{entry.tag}
              {entry.articles > 1 && (
                <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                  {entry.media} 家 · {entry.articles} 篇
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

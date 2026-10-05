import Link from 'next/link';
import { notFound } from 'next/navigation';
import { kindNoun, topicMediaHref } from '@/components/TopicCard';
import { fetchTopicStories, type TopicKind } from '@/lib/pages';

export default async function TopicStoriesView({ media, id, kind }: { media: string; id: string; kind: TopicKind }) {
  const data = await fetchTopicStories(id);
  if (!data || data.media !== media || data.kind !== kind) notFound();
  const noun = kindNoun(kind);
  return (
    <div className="space-y-5">
      <nav aria-label="breadcrumb" className="flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href={`/${kind}/`} className="hover:underline">
          {noun}
        </Link>
        <span>/</span>
        <Link href={topicMediaHref(media, kind)} className="hover:underline">
          {data.mediaTitle}
        </Link>
        <span>/ 新聞索引</span>
      </nav>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {data.mediaTitle}在此{noun}頁列出的新聞，目前已發現 {data.total} 篇，依報導日期由新到舊排列。
        </p>
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 hover:underline dark:text-brand-300">
          原站{noun} ↗
        </a>
      </div>
      {data.stories.length ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.stories.map((story) => (
            <li key={story.key} className="space-y-1 py-3">
              {story.id ? (
                <Link href={`/article/${story.id}/`} className="font-medium hover:underline">
                  {story.title}
                </Link>
              ) : story.url ? (
                <a href={story.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  {story.title} ↗
                </a>
              ) : (
                <span className="font-medium">{story.title}</span>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{story.date ? new Date(story.date).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) : '報導日期不明'}</span>
                {story.id && story.url && (
                  <a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    原文 ↗
                  </a>
                )}
                {!story.id && <span>{story.url ? '尚未收錄全文' : '原文連結待更新'}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">尚未取得這個{noun}的新聞清單，可先前往原站查看。</p>
      )}
      <p className="text-xs text-zinc-500">
        新聞清單累計本站從原站頁面發現的文章，不限報導日期；原站分頁或動態載入的文章可能尚未完整取得。
        {data.checkedAt && ` 最近檢查：${new Date(data.checkedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}。`}
      </p>
    </div>
  );
}

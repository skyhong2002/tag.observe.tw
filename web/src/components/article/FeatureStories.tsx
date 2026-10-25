import ArticleListItem from '@/components/ArticleListItem';
import CompactArticleList from '@/components/CompactArticleList';
import type { TopicStoryIndex } from '@/lib/pages';

/** The stories the outlet lists on its 專題 page: the feature's own reading list. */
export default function FeatureStories({ data }: { data: TopicStoryIndex }) {
  if (!data.stories.length) return null;
  return (
    <section aria-labelledby="feature-stories-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="feature-stories-heading" className="text-base font-semibold">
          專題相關新聞
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">原站專題頁列出 {data.total} 篇，依報導日期由新到舊排列。</p>
      </div>
      <CompactArticleList count={data.stories.length} order="依報導日期">
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.stories.map((story) => (
            <ArticleListItem
              key={story.key}
              article={{ ...story, publishedAt: story.date }}
              href={story.id ? `/article/${story.id}/` : story.url}
            />
          ))}
        </ul>
      </CompactArticleList>
      {data.checkedAt && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          最近檢查：{new Date(data.checkedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}。
        </p>
      )}
    </section>
  );
}

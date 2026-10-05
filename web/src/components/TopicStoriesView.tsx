import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleBody from '@/components/ArticleBody';
import ArticleImage from '@/components/ArticleImage';
import { kindNoun, topicMediaHref } from '@/components/TopicCard';
import { CONTENT_STATUS } from '@/lib/article-content';
import { fetchFeatureContent, fetchTopicStories, type TopicKind } from '@/lib/pages';

export default async function TopicStoriesView({ media, id, kind }: { media: string; id: string; kind: TopicKind }) {
  const data = await fetchTopicStories(id);
  if (!data || data.media !== media || data.kind !== kind) notFound();
  const noun = kindNoun(kind);
  const content = kind === 'feature' && data.articleId ? await fetchFeatureContent(data.articleId) : null;
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
        <span>/ {noun}</span>
      </nav>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 hover:underline dark:text-brand-300">
          原站{noun} ↗
        </a>
      </div>
      {kind === 'feature' && (
        <section aria-label="專題內容" className="mx-auto max-w-[44rem] space-y-5">
          <ArticleImage src={content?.article.image ?? data.image} title={data.title} mediaTitle={data.mediaTitle} sourceUrl={data.url} />
          {content?.content.body ? (
            <ArticleBody body={content.content.body} sourceUrl={data.url} />
          ) : (
            <>
              {content?.article.description && (
                <div>
                  <h2 className="mb-2 text-sm text-zinc-500">專題摘要</h2>
                  <p className="whitespace-pre-wrap text-base leading-8">{content.article.description}</p>
                </div>
              )}
              <p className="text-sm text-zinc-500">
                {content ? CONTENT_STATUS[content.content.status].detail : '專題內文尚待擷取，可先前往原站閱讀。'}
              </p>
            </>
          )}
        </section>
      )}
      {(data.stories.length > 0 || kind === 'topic') && (
        <div className="space-y-1 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h2 className="font-semibold">{kind === 'feature' ? '專題相關新聞' : '議題新聞'}</h2>
          <p className="text-sm text-zinc-500">原站清單中已發現 {data.total} 篇，依報導日期由新到舊排列。</p>
        </div>
      )}
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
      ) : kind === 'topic' ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">尚未取得這個{noun}的新聞清單，可先前往原站查看。</p>
      ) : null}
      <p className="text-xs text-zinc-500">
        新聞清單累計本站從原站頁面發現的文章，不限報導日期；原站分頁或動態載入的文章可能尚未完整取得。
        {data.checkedAt && ` 最近檢查：${new Date(data.checkedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}。`}
      </p>
    </div>
  );
}

import Link from 'next/link';
import ArticleBody from '@/components/ArticleBody';
import ArticleImage from '@/components/ArticleImage';
import AuthorCredits from '@/components/AuthorCredits';
import DiscoverySources from '@/components/DiscoverySources';
import MediaHoverLink from '@/components/MediaHoverLink';
import MethodLink from '@/components/MethodLink';
import SourceLink from '@/components/SourceLink';
import { kindNoun, topicHref } from '@/components/TopicCard';
import { taipei } from '@/lib/api';
import { CONTENT_STATUS, type StoredContent } from '@/lib/article-content';
import type { TopicKind } from '@/lib/pages';
import { readingTitle } from '@/lib/reading.mts';
import type { ArticleRelated as Related } from '@/lib/related';
import { publicArticleContent } from '@/lib/seo.mts';
import type { ArticleSimilarity } from '@/lib/similarity';
import ArticleRelated from './ArticleRelated';
import ArticleSimilar from './ArticleSimilar';
import ArticleTags from './ArticleTags';

/**
 * One article, as read at /article/[id]/ and at /feature/[media]/[id]/: a 專題
 * is an article whose page lists other stories, so both render the same way.
 */
export default function ArticleView({
  content: { article, content: storedContent },
  related,
  similar,
  back,
  section,
  self,
  extra,
}: {
  content: StoredContent;
  related: Related | null;
  similar: ArticleSimilarity | null;
  /** The list this page was opened from. */
  back: { href: string; label: string };
  /** Replaces the section parsed from the title (e.g. 專題). */
  section?: string;
  /** The collection this page is, left out of 所屬議題與專題. */
  self?: { kind: TopicKind; id: string };
  /** Page-specific sections placed before 延伸閱讀. */
  extra?: React.ReactNode;
}) {
  const content = publicArticleContent(storedContent);
  const state =
    content.source === 'publisher:excerpt' && content.status !== 'expired'
      ? { label: '原站僅提供摘要', detail: '這個來源提供的是節錄內容，本站未將其收錄為完整正文。' }
      : CONTENT_STATUS[content.status];
  const headline = readingTitle(article.title);
  const sectionLabel = section ?? headline.section;
  const collections = (article.collections ?? []).filter((c) => !(self && c.kind === self.kind && c.id === self.id));
  return (
    <article className="mx-auto max-w-[44rem] pb-10 pt-1 sm:pt-4">
      <nav aria-label="文章導覽" className="mb-8 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href={back.href}
          className="inline-flex min-h-9 items-center text-zinc-600 hover:text-brand-700 dark:text-zinc-400 dark:hover:text-brand-400"
        >
          ← {back.label}
        </Link>
      </nav>
      <header className="mb-7">
        <p className="mb-4 flex flex-wrap items-center gap-3 text-xs font-medium tracking-wide text-brand-700 dark:text-brand-400">
          <MediaHoverLink media={article.media} className="hover:underline">
            {article.mediaTitle}
          </MediaHoverLink>
          {sectionLabel && (
            <>
              <span aria-hidden="true">/</span>
              <span>{sectionLabel}</span>
            </>
          )}
        </p>
        <h1 className="break-words text-[1.75rem] font-semibold leading-[1.5] tracking-tight sm:text-[2.25rem]">{headline.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <AuthorCredits credits={article.authors} />
          <time dateTime={article.publishedDate ?? article.publishedAt}>{article.publishedDate ?? taipei(article.publishedAt)}</time>
          {content.body && <span className="text-xs">全文約 {content.chars.toLocaleString('zh-TW')} 字</span>}
        </div>
        <div className="mt-3">
          <DiscoverySources sources={article.discoverySources} />
        </div>
        {collections.length > 0 && (
          <nav aria-label="所屬議題與專題" className="mt-5 space-y-2 text-sm">
            {(['topic', 'feature'] as const).map((kind) => {
              const ofKind = collections.filter((c) => c.kind === kind);
              return ofKind.length ? (
                <div key={kind} className="flex gap-3">
                  <span className="shrink-0 text-zinc-500">{kindNoun(kind)}</span>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {ofKind.map((collection) => (
                      <li key={collection.id}>
                        <Link
                          href={topicHref(collection.media, collection.id, kind)}
                          className="text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {collection.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
          </nav>
        )}
        <ArticleTags data={related} tags={article.tags} />
      </header>
      <ArticleImage src={article.image} title={headline.title} mediaTitle={article.mediaTitle} />
      {content.body ? (
        <>
          {content.status !== 'ok' && (
            <p className="mb-6 border-l-2 border-amber-500 pl-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{state.detail}</p>
          )}
          <ArticleBody body={content.body} sourceUrl={article.url} />
        </>
      ) : article.description ? (
        <ArticleBody body={article.description} sourceUrl={article.url} label="文章摘要" />
      ) : (
        <section className="my-8 rounded-lg bg-zinc-50 p-6 dark:bg-zinc-900" aria-label="內文狀態">
          <h2 className="font-medium">{state.label}</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{state.detail}</p>
          <div className="mt-4">
            <SourceLink url={article.url} label="原站文章" showUrl />
          </div>
        </section>
      )}
      <footer className="mt-12 space-y-7 border-t border-zinc-200 pt-7 dark:border-zinc-800">
        {extra}
        {content.attributions.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">文中引用來源</h2>
            <ul className="space-y-3 text-sm">
              {content.attributions.map((source) => (
                <li key={source.media} className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
                  <p className="font-medium">
                    {source.name}
                    <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">{source.country}</span>
                  </p>
                  <p className="mt-1 break-words leading-7 text-zinc-600 dark:text-zinc-400">{source.evidence}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              <MethodLink />
            </p>
          </section>
        )}
        <ArticleRelated
          data={related}
          mediaTitle={article.mediaTitle}
          similar={<ArticleSimilar data={similar} publishedAt={article.publishedAt} />}
        />
      </footer>
    </article>
  );
}

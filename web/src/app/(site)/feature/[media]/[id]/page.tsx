import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ArticleView from '@/components/article/ArticleView';
import FeatureStories from '@/components/article/FeatureStories';
import { topicMediaHref } from '@/components/TopicCard';
import TopicStoriesView from '@/components/TopicStoriesView';
import { articleIndexable, articleMetadata } from '@/lib/article-metadata';
import { fetchFeatureContent, fetchTopicStories } from '@/lib/pages';
import { fetchArticleRelated } from '@/lib/related';
import { pageMetadata } from '@/lib/seo.mts';
import { fetchArticleSimilarity } from '@/lib/similarity';

export const revalidate = 300;
type Params = { params: Promise<{ media: string; id: string }> };

// A 專題 is an article whose page lists other stories: it is read with the
// article layout, its stories listed before 延伸閱讀. The feature's own article
// row is indexed by the topics job; until then the plain story list stands in.
async function featureArticle(media: string, id: string) {
  const data = await fetchTopicStories(id);
  if (!data || data.media !== media) notFound();
  if (data.kind === 'article' && data.articleId) permanentRedirect(`/article/${data.articleId}/`);
  if (data.kind !== 'feature') notFound();
  const content = data.articleId ? await fetchFeatureContent(data.articleId) : null;
  return { data, content };
}

const featurePath = (media: string, id: string) => `/feature/${encodeURIComponent(media)}/${encodeURIComponent(id)}/`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { media, id } = await params;
  const { data, content } = await featureArticle(media, id);
  const path = featurePath(media, id);
  if (!content) return pageMetadata(path, `${data.title}｜專題`, '閱讀專題內容、圖片及相關新聞。');
  const [related, similar] =
    data.stories.length || articleIndexable(content.content, null, null)
      ? [null, null]
      : await Promise.all([fetchArticleRelated(content.article.id), fetchArticleSimilarity(content.article.id)]);
  return articleMetadata(content, {
    path,
    titleSuffix: `${data.mediaTitle}專題`,
    indexable: data.stories.length > 0 || articleIndexable(content.content, related, similar),
  });
}

export default async function Page({ params }: Params) {
  const { media, id } = await params;
  const { data, content } = await featureArticle(media, id);
  if (!content) return <TopicStoriesView media={media} id={id} kind="feature" />;
  const [related, similar] = await Promise.all([fetchArticleRelated(content.article.id), fetchArticleSimilarity(content.article.id)]);
  return (
    <ArticleView
      content={content}
      related={related}
      similar={similar}
      back={{ href: topicMediaHref(media, 'feature'), label: `${data.mediaTitle}專題` }}
      section="專題"
      self={{ kind: 'feature', id: data.id }}
      extra={<FeatureStories data={data} />}
    />
  );
}

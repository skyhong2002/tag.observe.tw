import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import TopicStoriesView from '@/components/TopicStoriesView';
import { fetchTopicStories } from '@/lib/pages';
import { pageMetadata } from '@/lib/seo.mts';
export const revalidate = 300;
type Params = { params: Promise<{ media: string; id: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { media, id } = await params;
  const data = await fetchTopicStories(id);
  if (data?.media === media && data.kind === 'article' && data.articleId) permanentRedirect(`/article/${data.articleId}/`);
  return pageMetadata(
    `/feature/${encodeURIComponent(media)}/${encodeURIComponent(id)}/`,
    `${data?.title ?? '專題'}｜專題`,
    '閱讀專題內容、圖片及相關新聞。',
  );
}
export default async function Page({ params }: Params) {
  return <TopicStoriesView {...(await params)} kind="feature" />;
}

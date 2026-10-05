import type { Metadata } from 'next';
import TopicStoriesView from '@/components/TopicStoriesView';
import { fetchTopicStories } from '@/lib/pages';
import { pageMetadata } from '@/lib/seo.mts';
export const revalidate = 300;
type Params = { params: Promise<{ media: string; id: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { media, id } = await params;
  const data = await fetchTopicStories(id);
  return pageMetadata(
    `/topic/${encodeURIComponent(media)}/${encodeURIComponent(id)}/`,
    `${data?.title ?? '新聞'}｜新聞索引`,
    '查看媒體在此議題或專題頁列出的新聞。',
  );
}
export default async function Page({ params }: Params) {
  return <TopicStoriesView {...(await params)} kind="topic" />;
}

import type { Metadata } from 'next';
import TopicMediaView, { topicMediaTitle } from '@/components/TopicMediaView';
import { pageMetadata } from '@/lib/seo.mts';
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ media: string }> }): Promise<Metadata> {
  const { media } = await params;
  const title = await topicMediaTitle(media, 'topic');
  return pageMetadata(`/topic/${encodeURIComponent(media)}/`, title, `瀏覽${title}，查看原站議題入口、相關報導與更新情況。`);
}

export default async function TopicMediaPage({ params }: { params: Promise<{ media: string }> }) {
  return <TopicMediaView media={(await params).media} kind="topic" />;
}

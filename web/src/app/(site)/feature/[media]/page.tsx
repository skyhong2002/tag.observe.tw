import type { Metadata } from 'next';
import TopicMediaView, { topicMediaTitle } from '@/components/TopicMediaView';
import { pageMetadata } from '@/lib/seo';
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ media: string }> }): Promise<Metadata> {
  const { media } = await params;
  const title = await topicMediaTitle(media, 'feature');
  return pageMetadata(`/feature/${encodeURIComponent(media)}/`, title, `瀏覽${title}，查看原站專題入口、相關報導與更新情況。`);
}

export default async function FeatureMediaPage({ params }: { params: Promise<{ media: string }> }) {
  return <TopicMediaView media={(await params).media} kind="feature" />;
}

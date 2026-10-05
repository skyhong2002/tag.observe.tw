import type { Metadata } from 'next';
import TopicMediaView, { topicMediaMetadata } from '@/components/TopicMediaView';
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ media: string }> }): Promise<Metadata> {
  const { media } = await params;
  return topicMediaMetadata(media, 'feature');
}

export default async function FeatureMediaPage({ params }: { params: Promise<{ media: string }> }) {
  return <TopicMediaView media={(await params).media} kind="feature" />;
}

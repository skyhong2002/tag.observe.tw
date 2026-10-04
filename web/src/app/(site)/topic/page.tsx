import TopicIndex, { type TopicIndexParams } from '@/components/TopicIndex';
import { pageMetadata } from '@/lib/seo';
export const revalidate = 300;
export const metadata = pageMetadata(
  '/topic/',
  '議題表',
  '整理各新聞媒體持續更新的議題入口與相關報導，依更新時間探索近期受到關注的新聞議題。',
);

export default async function TopicPage({ searchParams }: { searchParams: Promise<TopicIndexParams> }) {
  return <TopicIndex kind="topic" searchParams={await searchParams} />;
}

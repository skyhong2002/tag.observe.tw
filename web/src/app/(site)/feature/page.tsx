import TopicIndex, { type TopicIndexParams } from '@/components/TopicIndex';
import { pageMetadata } from '@/lib/seo';
export const revalidate = 300;
export const metadata = pageMetadata('/feature/', '專題', '彙整各新聞媒體的專題報導與新聞包，從不同媒體的策展與深入報導理解新聞背景。');

export default async function FeaturePage({ searchParams }: { searchParams: Promise<TopicIndexParams> }) {
  return <TopicIndex kind="feature" searchParams={await searchParams} />;
}

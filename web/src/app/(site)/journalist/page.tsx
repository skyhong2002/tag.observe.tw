import BylineTabs from '@/components/BylineTabs';
import { INDEX_HOURS } from '@/lib/journalists';
import { pageMetadata } from '@/lib/seo.mts';
import JournalistOverview from './JournalistOverview';

export const revalidate = 120;
export const metadata = pageMetadata('/journalist/', '記者', '新聞記者的報導篇數與跨媒體相似報導統計。', true);
export default async function JournalistIndexPage({ searchParams }: { searchParams: Promise<{ hours?: string }> }) {
  const query = await searchParams;
  const hours = (INDEX_HOURS as readonly number[]).includes(Number(query.hours)) ? Number(query.hours) : 48;
  return (
    <div className="space-y-4 pb-4">
      <BylineTabs current="person" hours={hours} />
      <JournalistOverview hours={hours} />
    </div>
  );
}

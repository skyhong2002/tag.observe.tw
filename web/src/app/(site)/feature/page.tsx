import TopicIndex from '@/components/TopicIndex';
export const revalidate = 300;
export const metadata = { title: '專題' };

export default async function FeaturePage({ searchParams }: { searchParams: Promise<{ coverage?: string; backlog?: string }> }) {
  return <TopicIndex kind="feature" searchParams={await searchParams} />;
}

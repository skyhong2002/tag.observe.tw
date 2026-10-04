import TopicIndex from '@/components/TopicIndex';
export const revalidate = 300;
export const metadata = { title: '議題表' };

export default async function TopicPage({ searchParams }: { searchParams: Promise<{ coverage?: string; backlog?: string }> }) {
  return <TopicIndex kind="topic" searchParams={await searchParams} />;
}

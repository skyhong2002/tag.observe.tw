import { type TopicIndexParams, TopicNotes } from '@/components/TopicIndex';

export const revalidate = 300;

// Same requests as the topic page, so the fetches are shared within a render.
export default async function TopicPageNotes({ searchParams }: { searchParams: Promise<TopicIndexParams> }) {
  return <TopicNotes kind="topic" searchParams={await searchParams} />;
}

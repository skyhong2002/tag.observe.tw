import { type TopicIndexParams, TopicNotes } from '@/components/TopicIndex';

export const revalidate = 300;

// Same requests as the feature page, so the fetches are shared within a render.
export default async function FeaturePageNotes({ searchParams }: { searchParams: Promise<TopicIndexParams> }) {
  return <TopicNotes kind="feature" searchParams={await searchParams} />;
}

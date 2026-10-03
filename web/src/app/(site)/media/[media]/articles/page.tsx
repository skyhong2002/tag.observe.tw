import { notFound, redirect } from 'next/navigation';
import { type ReadingParams, readingQuery, withReadingQuery } from '@/lib/reading.mts';

// Keep existing bookmarks and pagination while offering one media article list.
export default async function MediaArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ media: string }>;
  searchParams: Promise<ReadingParams>;
}) {
  const { media } = await params;
  const query = readingQuery(await searchParams);
  if (!query) notFound();
  redirect(withReadingQuery(`/media/${encodeURIComponent(media)}/`, query));
}

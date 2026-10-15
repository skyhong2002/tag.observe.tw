import type { Metadata } from 'next';
import Link from 'next/link';
import { decodeRouteParam } from '@/lib/seo.mts';
import RelationVote from './RelationVote';

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const tag = decodeRouteParam((await params).tag);
  return { title: `${tag}的關係`, robots: { index: false } };
}

// Readers vote on a tag's relations or propose one, like the picture vote next
// door (/tag/<tag>/picture/); the tag page only lists what they established.
export default async function TagRelationsPage({ params }: { params: Promise<{ tag: string }> }) {
  const tag = decodeRouteParam((await params).tag);
  return (
    <div className="max-w-2xl py-4">
      <p className="text-sm">
        <Link href={`/tag/${encodeURIComponent(tag)}/`} className="text-brand-700 underline dark:text-brand-400">
          #{tag}
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">{tag}的關係</h1>
      <RelationVote tag={tag} />
    </div>
  );
}

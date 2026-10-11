import type { Metadata } from 'next';
import Link from 'next/link';
import { decodeRouteParam } from '@/lib/seo.mts';
import PictureVote from './PictureVote';

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const tag = decodeRouteParam((await params).tag);
  return { title: `${tag}的圖`, robots: { index: false } };
}

// Signed-in readers vote for a tag's picture or upload one (docs/tag-pictures.md);
// how pictures are found and chosen is in the footer's 資料來源與計算方式.
export default async function TagPicturePage({ params }: { params: Promise<{ tag: string }> }) {
  const tag = decodeRouteParam((await params).tag);
  return (
    <div className="py-4">
      <p className="text-sm">
        <Link href={`/tag/${encodeURIComponent(tag)}/`} className="text-brand-700 underline dark:text-brand-400">
          #{tag}
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">{tag}的圖</h1>
      <PictureVote tag={tag} />
    </div>
  );
}

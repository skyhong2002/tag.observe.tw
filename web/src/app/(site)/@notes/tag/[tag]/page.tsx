import { MediaCardMethod, RankingMethod, TagMethod } from '@/components/MethodNotes';
import { RankingBasisText } from '@/components/RankingBasisNote';
import { methodHeading } from '@/components/SiteFooter';
import { fetchMedia, fetchTagSeries } from '@/lib/api';
import { decodeRouteParam } from '@/lib/seo.mts';
import { tagHours } from '@/lib/tag-query';

export const revalidate = 60;

// Same requests as the tag page, so the fetches are shared within a render.
export default async function TagNotes({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ hours?: string }>;
}) {
  const tag = decodeRouteParam((await params).tag);
  const hours = tagHours(await searchParams);
  const [series, media] = await Promise.all([fetchTagSeries(tag, 'all', hours).catch(() => null), fetchMedia().catch(() => null)]);
  return (
    <>
      <TagMethod basisCount={series?.basis.media.length} hours={hours} />
      {series && media && (
        <>
          <h3 className={methodHeading}>本頁圖表：固定基準 {series.basis.media.length} 家媒體</h3>
          <RankingBasisText basis={series.basis} media={media} chart />
        </>
      )}
      <RankingMethod />
      <MediaCardMethod />
    </>
  );
}

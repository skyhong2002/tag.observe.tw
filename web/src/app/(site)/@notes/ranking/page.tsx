import { RankingBasisText } from '@/components/RankingBasisNote';
import { methodHeading } from '@/components/SiteFooter';
import { fetchMedia, fetchRanking } from '@/lib/api';
import { type RankingSearch, rankingQuery } from '@/lib/ranking-query.mts';

export const revalidate = 60;

// Same request as the ranking page, so the fetch is shared within a render.
export default async function RankingNotes({ searchParams }: { searchParams: Promise<RankingSearch> }) {
  const { category, order, gate, limit } = rankingQuery(await searchParams);
  const [media, ranking] = await Promise.all([
    fetchMedia(),
    fetchRanking(category, order, limit, true, true, { gate, signals: true }).catch(() => null),
  ]);
  if (!ranking) return null;
  return (
    <>
      <h3 className={methodHeading}>本頁排行：固定基準 {ranking.snapshot.basis.media.length} 家媒體</h3>
      <RankingBasisText basis={ranking.snapshot.basis} media={media} />
    </>
  );
}

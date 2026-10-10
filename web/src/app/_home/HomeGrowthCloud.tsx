import RankingWordCloud from '@/components/RankingWordCloud';
import { fetchRanking } from '@/lib/api';

// The ranking page's 正在發酵 cloud for all outlets without a media gate
// (/ranking/?category=all&order=growth&gate=all), above the home page's events.
export const HOME_CLOUD_HREF = '/ranking/?category=all&order=growth&gate=all';

export default async function HomeGrowthCloud() {
  const cloud = await fetchRanking('all', 'growth', 500, false, false, { gate: 'all' }).catch(() => null);
  if (!cloud?.entries.length) return null;
  return (
    <RankingWordCloud
      mode="growth"
      column
      terms={cloud.entries.map((e) => ({
        tag: e.tag,
        score: e.normalized,
        burst: e.burst,
        growth: e.signals?.growth ?? null,
        count: e.count,
        media: Object.keys(e.media).length,
        isNew: e.new,
      }))}
    />
  );
}

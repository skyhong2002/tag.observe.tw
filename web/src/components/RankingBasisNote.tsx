import MediaHoverLink from '@/components/MediaHoverLink';
import { type MediaInfo, type RankingBasis, taipei } from '@/lib/api';

/** The fixed media list behind a ranking or a keyword chart, for the footer's
 *  資料來源與計算方式 (@notes/ranking, @notes/tag/[tag]). `chart` adds what only
 *  the keyword page's hourly chart needs. */
export function RankingBasisText({ basis, media, chart = false }: { basis: RankingBasis; media: MediaInfo; chart?: boolean }) {
  return (
    <>
      <p>
        整段期間使用同一批媒體與固定分母。基準媒體自 {taipei(basis.coverageFrom)} 起收錄，累積滿 24 小時才
        {chart ? '顯示平均與分數；橫軸標示小時起點，歷史不足處留白' : '提供分數與排行'}；新來源待下一版基準再納入排行。
      </p>
      <p>篇數反映本站已收錄報導；來源故障或補抓仍可能影響數量。</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {basis.media.map((m) => (
          <li key={m}>
            <MediaHoverLink media={m} className="hover:underline">
              {media[m]?.title ?? m}
            </MediaHoverLink>
          </li>
        ))}
      </ul>
    </>
  );
}

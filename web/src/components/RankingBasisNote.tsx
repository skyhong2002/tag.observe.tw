import MediaHoverLink from '@/components/MediaHoverLink';
import { type MediaInfo, type RankingBasis, taipei } from '@/lib/api';

export default function RankingBasisNote({ basis, media }: { basis: RankingBasis; media: MediaInfo }) {
  return (
    <details className="text-xs text-zinc-600 dark:text-zinc-400">
      <summary className="cursor-pointer">固定基準 {basis.media.length} 家媒體 · 名單與資料範圍</summary>
      <p className="mt-2">
        整段期間使用同一批媒體與固定分母。基準媒體自 {taipei(basis.coverageFrom)} 起收錄，累積滿 24
        小時才顯示平均與分數；橫軸標示小時起點。歷史不足處留白，新來源待下一版基準再納入排行。
      </p>
      <p className="mt-1">篇數反映本站已收錄報導；來源故障或補抓仍可能影響數量。</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {basis.media.map((m) => (
          <li key={m}>
            <MediaHoverLink media={m} className="hover:underline">
              {media[m]?.title ?? m}
            </MediaHoverLink>
          </li>
        ))}
      </ul>
    </details>
  );
}

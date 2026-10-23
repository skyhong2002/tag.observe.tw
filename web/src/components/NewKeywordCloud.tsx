import WordCloud from '@/components/WordCloud';
import { type NewKeyword, taipeiDate } from '@/lib/api';

// Keywords first seen recently (/ranking/new/), sized by their articles so far.
// Ones still reported in the last 24 hours take the site's accent; hovering or
// focusing a word opens a card with its dates and outlets, clicking goes to the tag page.
export default function NewKeywordCloud({ keywords, now }: { keywords: NewKeyword[]; now: number }) {
  if (!keywords.length) return null;
  const fill = Math.min(1, keywords.length / 250);
  const live = (k: NewKeyword) => k.lastAt !== null && now - Date.parse(k.lastAt) < 86_400_000;
  return (
    <WordCloud
      compact={{
        width: 340,
        height: Math.round(Math.min(340, 240 + 100 * fill)),
        sizes: { min: 11 - 2 * fill, max: 26 + 8 * fill, floor: 9, budget: 1, curve: 0.9 + 0.7 * fill, words: 300 },
      }}
      wide={{
        width: 1120,
        height: Math.round(220 + 220 * fill),
        sizes: { min: 14 - 4 * fill, max: 40 + 16 * fill, floor: 10, budget: 0.7, curve: 0.8 + 0.7 * fill, words: 300 },
      }}
      compactClassName="w-full"
      label="新出現的關鍵字文字雲"
      title="新出現的關鍵字文字雲"
      words={keywords.map((k) => {
        const outlets = Object.keys(k.media ?? {}).length;
        const rows: Array<[string, string]> = [
          ['首次出現', taipeiDate(k.firstAt)],
          ['篇數', `${k.articleCount} 篇 · ${outlets} 家媒體`],
          ['單日高峰', k.peakDay ? `${k.peakDay}（${k.peakCount} 篇）` : '計算中'],
          ['最近出現', k.lastAt ? taipeiDate(k.lastAt) : '—'],
        ];
        return {
          label: k.tag,
          count: k.articleCount,
          href: `/tag/${encodeURIComponent(k.tag)}`,
          ariaLabel: `${k.tag}，首次出現 ${taipeiDate(k.firstAt)}，${k.articleCount} 篇，${outlets} 家媒體`,
          tone: live(k) ? ('brand' as const) : ('strong' as const),
          card: { rows },
        };
      })}
    />
  );
}

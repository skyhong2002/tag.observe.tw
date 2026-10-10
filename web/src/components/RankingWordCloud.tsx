import WordCloud from '@/components/WordCloud';

// The ranking's keywords, sized by the selected score or growth measure.
// Rising keywords (爆發力 above 分數) take the site's accent like in the table;
// hovering or focusing a word opens a card with its numbers, and clicking goes
// to the tag page.

export interface RankingCloudTerm {
  tag: string;
  score: number;
  burst: number | null;
  growth?: number | null;
  count: number;
  media: number;
  isNew: boolean;
}

const rising = (t: RankingCloudTerm) => t.burst !== null && t.burst > t.score;

export default function RankingWordCloud({
  terms,
  mode = 'score',
  column = false,
}: {
  terms: RankingCloudTerm[];
  mode?: 'score' | 'growth';
  /** Lay out for the home page's ~760px column rather than the full page width. */
  column?: boolean;
}) {
  if (!terms.length) return null;
  // Smaller candidate sets need less canvas and a gentler size curve. The
  // dense 500-term profile stays the same in both modes.
  const fill = Math.min(1, terms.length / 250);
  // On a phone every cloud is at most square so the content below stays near the top.
  const compact = {
    width: 340,
    height: Math.round(Math.min(340, 240 + 100 * fill)),
    sizes: { min: 11 - 2 * fill, max: 26 + 8 * fill, floor: 9, budget: 1, curve: 0.9 + 0.7 * fill, words: 500 },
  };
  const wide = column
    ? {
        width: 760,
        height: Math.round(220 + 200 * fill),
        sizes: { min: 13 - 3 * fill, max: 40 + 10 * fill, floor: 10, budget: 0.8, curve: 0.8 + 0.7 * fill, words: 500 },
      }
    : {
        width: 1120,
        height: Math.round(220 + 220 * fill),
        sizes: { min: 14 - 4 * fill, max: 40 + 16 * fill, floor: 10, budget: 0.7, curve: 0.8 + 0.7 * fill, words: 500 },
      };
  // Bare on the page background, without a panel or caption.
  return (
    <WordCloud
      compact={compact}
      wide={wide}
      compactClassName="w-full"
      label="關鍵字文字雲"
      title="關鍵字文字雲"
      words={terms.map((t) => ({
        label: t.tag,
        count: mode === 'growth' ? (t.growth ?? 0) : t.score,
        href: `/tag/${encodeURIComponent(t.tag)}`,
        ariaLabel: `${t.tag}，${mode === 'growth' ? `升溫量 ${t.growth?.toFixed(1) ?? '—'}` : `分數 ${t.score.toFixed(1)}`}，${t.count} 篇`,
        tone: rising(t) ? 'brand' : 'strong',
        card: {
          badge: t.isNew ? { text: '新上榜', tone: 'soft' } : undefined,
          rows: [
            ...(mode === 'growth' ? [['升溫量', `+${t.growth?.toFixed(1) ?? '—'}`] as [string, string]] : []),
            ['分數', t.score.toFixed(1)],
            ['爆發力', t.burst?.toFixed(1) ?? '—'],
            ['篇數', `${t.count} 篇 · ${t.media} 家媒體`],
          ],
        },
      }))}
    />
  );
}

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
  /** Lay out for the home page: a bare ~760px-column cloud without panel or caption, square at most on phones. */
  column?: boolean;
}) {
  if (!terms.length) return null;
  // Smaller candidate sets need less canvas and a gentler size curve. The
  // dense 500-term profile stays the same in both modes.
  const fill = Math.min(1, terms.length / 250);
  // On a phone the home page's cloud is at most square so its events stay near the top.
  const compact = column
    ? {
        width: 340,
        height: Math.round(Math.min(340, 280 + 120 * fill)),
        sizes: { min: 11 - 2 * fill, max: 34 + 10 * fill, floor: 9, budget: 1, curve: 0.9 + 0.7 * fill, words: 500 },
      }
    : {
        width: 340,
        height: Math.round(520 + 300 * fill),
        sizes: { min: 12 - 3 * fill, max: 48 + 28 * fill, floor: 9, budget: 1, curve: 0.9 + 0.7 * fill, words: 500 },
      };
  const wide = column
    ? {
        width: 760,
        height: Math.round(300 + 300 * fill),
        sizes: { min: 14 - 3 * fill, max: 56 + 16 * fill, floor: 10, budget: 0.8, curve: 0.8 + 0.7 * fill, words: 500 },
      }
    : {
        width: 1120,
        height: Math.round(280 + 360 * fill),
        sizes: { min: 16 - 6 * fill, max: 64 + 24 * fill, floor: 10, budget: 0.7, curve: 0.8 + 0.7 * fill, words: 500 },
      };
  const cloud = (
    <WordCloud
      compact={compact}
      wide={wide}
      compactClassName={column ? 'w-full' : 'mx-auto w-full max-w-[420px]'}
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
  if (column) return cloud;
  return (
    <section aria-label="關鍵字文字雲" className="rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
        {mode === 'growth' ? '升溫文字雲' : '熱門文字雲'}
        {' · '}
        {terms.length} 個候選詞
      </p>
      {cloud}
    </section>
  );
}

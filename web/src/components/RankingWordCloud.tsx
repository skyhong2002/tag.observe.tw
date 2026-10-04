import WordCloud from '@/components/WordCloud';

// The ranking's keywords as a word cloud sized by score: the site's largest
// cloud. Rising keywords (爆發力 above 分數) take the site's accent like in the table;
// hovering or focusing a word opens a card with its numbers, and clicking goes
// to the tag page.

export interface RankingCloudTerm {
  tag: string;
  score: number;
  burst: number | null;
  count: number;
  media: number;
  isNew: boolean;
}

// A steep size curve keeps the long tail small, so the top keywords stay large
// and both canvases keep a similar spread (about 5–6× from the smallest to the
// largest word). The phone canvas is tall to hold that spread.
const compact = { width: 340, height: 820, sizes: { min: 9, max: 76, floor: 9, budget: 1, curve: 1.6, words: 500 } };
const wide = { width: 1120, height: 640, sizes: { min: 10, max: 88, floor: 10, budget: 0.7, curve: 1.5, words: 500 } };

const rising = (t: RankingCloudTerm) => t.burst !== null && t.burst > t.score;

export default function RankingWordCloud({ terms }: { terms: RankingCloudTerm[] }) {
  if (!terms.length) return null;
  return (
    <section aria-label="關鍵字文字雲" className="rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <WordCloud
        compact={compact}
        wide={wide}
        compactClassName="mx-auto w-full max-w-[420px]"
        label="關鍵字文字雲，字越大分數越高"
        title="關鍵字文字雲；字越大，分數越高；橘字為正在升溫的關鍵字"
        words={terms.map((t) => ({
          label: t.tag,
          count: t.score,
          href: `/tag/${encodeURIComponent(t.tag)}`,
          ariaLabel: `${t.tag}，分數 ${t.score.toFixed(1)}，${t.count} 篇`,
          tone: rising(t) ? 'brand' : 'strong',
          card: {
            badge: t.isNew ? { text: '新上榜', tone: 'soft' } : rising(t) ? { text: '升溫中', tone: 'soft' } : undefined,
            rows: [
              ['分數', t.score.toFixed(1)],
              ['爆發力', t.burst?.toFixed(1) ?? '—'],
              ['篇數', `${t.count} 篇 · ${t.media} 家媒體`],
            ],
            hint: '點選查看關鍵字頁 →',
          },
        }))}
      />
    </section>
  );
}

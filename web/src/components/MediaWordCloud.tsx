import WordCloud, { type CloudTone } from '@/components/WordCloud';
import type { CloudTerm } from '@/lib/word-cloud.mts';

export interface MediaKeywords {
  media: string;
  hours: number;
  from: string;
  to: string;
  sampledArticles: number;
  capped: boolean;
  terms: CloudTerm[];
}
const tones: CloudTone[] = ['brand', 'strong', 'stone'];
// A compact canvas for the sidebar or narrow screens, and a wide one for the
// article column: more room and a larger size range keep frequent and rare
// terms visibly apart (the rarest few may not fit; the list below has them all).
const compact = { width: 300, height: 230, sizes: { min: 12, max: 29 } };
const wide = { width: 760, height: 400, sizes: { min: 13, max: 76, budget: 0.7 } };
export default function MediaWordCloud({
  data,
  media,
  hours,
  layout = 'sidebar',
}: {
  data: MediaKeywords | null;
  media: string;
  hours: number;
  /** `wide` fills the article column on md+ screens and keeps the compact canvas below that. */
  layout?: 'sidebar' | 'wide';
}) {
  const terms = data?.terms ?? [];
  const href = (label: string) => `/media/${encodeURIComponent(media)}/?${new URLSearchParams({ hours: String(hours), q: label })}`;
  const cloud = terms.length ? (
    <WordCloud
      compact={compact}
      wide={layout === 'wide' ? wide : undefined}
      compactClassName="mx-auto my-1 w-full max-w-[360px]"
      label="點選關鍵字篩選本站報導"
      title="報導關鍵字文字雲；字越大，出現在越多篇報導"
      words={terms.map((t, index) => ({
        label: t.label,
        count: t.count,
        href: href(t.label),
        ariaLabel: `${t.label}，${t.count} 篇報導`,
        tone: tones[index % tones.length],
        card: { rows: [['報導', `${t.count} 篇`]], hint: '點選篩選本站報導 →' },
      }))}
    />
  ) : null;
  return (
    <section aria-label="報導文字雲" className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">報導關鍵字</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">近 {hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小時`}</span>
      </div>
      {cloud ? (
        <div className="my-1">{cloud}</div>
      ) : (
        <p className="py-6 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          {data ? '這段時間尚無足夠的關鍵字。' : '關鍵字暫時無法取得，文章仍可正常瀏覽。'}
        </p>
      )}
    </section>
  );
}

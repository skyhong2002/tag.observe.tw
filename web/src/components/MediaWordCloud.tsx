import WordCloud from '@/components/WordCloud';
import type { CloudTerm } from '@/lib/word-cloud.mts';

/** A keyword with its share here and at the outlet's peers (null until the API has compared). */
export interface MediaKeywordTerm extends CloudTerm {
  share?: number;
  peerShare?: number | null;
  distinctive?: boolean;
}

export interface MediaKeywords {
  media: string;
  hours: number;
  from: string;
  to: string;
  sampledArticles: number;
  capped: boolean;
  /** Same-category ranking baseline outlets the shares were compared with; null while uncomputed. */
  comparison?: { group: string; articles: number; media: number } | null;
  terms: MediaKeywordTerm[];
}
const percent = (value: number) => `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
// A compact canvas for the sidebar or narrow screens, and a wide one for the
// article column: more room and a larger size range keep frequent and rare
// terms visibly apart (the rarest few may not fit; the list below has them all).
const compact = { width: 340, height: 220, sizes: { min: 11, max: 26 } };
const wide = { width: 800, height: 280, sizes: { min: 13, max: 44, budget: 0.7 } };
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
      compactClassName="my-1 w-full"
      label="點選關鍵字篩選本站報導"
      title="報導關鍵字文字雲"
      words={terms.map((t) => ({
        label: t.label,
        count: t.count,
        href: href(t.label),
        ariaLabel: `${t.label}，${t.count} 篇報導${t.distinctive ? '，本站特別常報導' : ''}`,
        // Orange marks keywords this outlet covers far more than its peers.
        tone: t.distinctive ? 'brand' : 'strong',
        card: {
          badge: t.distinctive ? { text: '本站特別常報導', tone: 'soft' } : undefined,
          rows: [
            ['報導', `${t.count} 篇`],
            ...(t.share !== undefined && t.peerShare != null
              ? [['本站比例', percent(t.share)] as [string, string], ['同類媒體', percent(t.peerShare)] as [string, string]]
              : []),
          ],
        },
      }))}
    />
  ) : null;
  return (
    <section aria-label="報導文字雲">
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

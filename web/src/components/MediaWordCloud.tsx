import Link from 'next/link';
import { type CloudTerm, layoutWordCloud } from '@/lib/word-cloud.mts';

export interface MediaKeywords {
  media: string;
  hours: number;
  from: string;
  to: string;
  sampledArticles: number;
  capped: boolean;
  terms: CloudTerm[];
}
const colors = ['fill-brand-700 dark:fill-brand-400', 'fill-zinc-800 dark:fill-zinc-200', 'fill-stone-600 dark:fill-stone-400'];
// A compact canvas for the sidebar or narrow screens, and a wide one for the
// article column: more room and a larger size range keep frequent and rare
// terms visibly apart (the rarest few may not fit; the list below has them all).
const canvases = {
  compact: { width: 300, height: 230, sizes: { min: 12, max: 29 } },
  wide: { width: 760, height: 400, sizes: { min: 13, max: 76, budget: 0.7 } },
};
function Cloud({
  terms,
  canvas,
  href,
  className,
}: {
  terms: CloudTerm[];
  canvas: keyof typeof canvases;
  href: (label: string) => string;
  className: string;
}) {
  const { width, height, sizes } = canvases[canvas];
  const words = layoutWordCloud(terms, width, height, sizes);
  if (!words.length) return null;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-label="點選關鍵字篩選本站報導" className={className}>
      <title>報導關鍵字文字雲；字越大，出現在越多篇報導</title>
      {words.map((word, index) => (
        <a key={word.label} href={href(word.label)} aria-label={`${word.label}，${word.count} 篇報導`} className="group outline-none">
          <title>{`${word.label} · ${word.count} 篇報導`}</title>
          <rect
            x={word.x - 1}
            y={word.y - 1}
            width={word.width + 2}
            height={word.height + 2}
            rx="3"
            className="fill-transparent group-hover:fill-zinc-100 group-focus:fill-zinc-100 dark:group-hover:fill-zinc-800 dark:group-focus:fill-zinc-800"
          />
          <text
            x={word.x + 2}
            y={word.y + word.fontSize * 1.25}
            fontSize={word.fontSize}
            fontWeight="600"
            textLength={word.width - 4}
            lengthAdjust="spacingAndGlyphs"
            className={colors[index % colors.length]}
          >
            {word.label}
          </text>
        </a>
      ))}
    </svg>
  );
}
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
  const words = layoutWordCloud(terms, canvases.compact.width, canvases.compact.height, canvases.compact.sizes);
  const href = (label: string) => `/media/${encodeURIComponent(media)}/?${new URLSearchParams({ hours: String(hours), q: label })}`;
  return (
    <section aria-label="報導文字雲" className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">報導關鍵字</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">近 {hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小時`}</span>
      </div>
      {words.length ? (
        layout === 'wide' ? (
          <>
            <Cloud terms={terms} canvas="compact" href={href} className="mx-auto my-1 w-full max-w-[360px] md:hidden" />
            <Cloud terms={terms} canvas="wide" href={href} className="my-1 hidden w-full md:block" />
          </>
        ) : (
          <Cloud terms={terms} canvas="compact" href={href} className="mx-auto my-1 w-full max-w-[360px]" />
        )
      ) : (
        <p className="py-6 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          {data ? '這段時間尚無足夠的關鍵字。' : '關鍵字暫時無法取得，文章仍可正常瀏覽。'}
        </p>
      )}
      {data && (
        <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
          {data.capped ? '取最新 ' : '統計 '}
          {data.sampledArticles.toLocaleString('zh-TW')} 篇 · 每篇每詞計一次
          <br />
          標籤＋標題關鍵詞，排除新聞分類詞。
        </p>
      )}
      {!!data?.terms.length && (
        <details className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer py-1">查看詞頻列表</summary>
          <ul className={`mt-2 grid gap-x-3 gap-y-1 ${layout === 'wide' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-2'}`}>
            {data.terms.map((term) => (
              <li key={term.label}>
                <Link href={href(term.label)} className="flex justify-between gap-2 py-1 hover:text-brand-700 dark:hover:text-brand-400">
                  <span className="truncate">{term.label}</span>
                  <span className="tabular-nums">{term.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

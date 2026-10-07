import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MethodLink from '@/components/MethodLink';
import { type MediaPartner, mediaRelations } from '@/lib/media-relations.mts';
import type { SimilarityData } from '@/lib/similarity';

const number = (value: number) => value.toLocaleString('zh-TW');
const SHOWN = 8;
// Same hues as the news graph: orange for shared story groups, violet for explicit citations.
const segments: Array<{ key: Exclude<keyof MediaPartner, 'id' | 'name' | 'external' | 'total'>; label: string; className: string }> = [
  { key: 'similar', label: '直接文字比對', className: 'bg-orange-500 dark:bg-orange-400' },
  { key: 'cites', label: '引用對方', className: 'bg-violet-500 dark:bg-violet-400' },
  { key: 'citedBy', label: '被對方引用', className: 'bg-violet-200 dark:bg-violet-800' },
];

function PartnerRow({ partner, max }: { partner: MediaPartner; max: number }) {
  const breakdown = segments
    .filter(({ key }) => partner[key] > 0)
    .map(({ key, label }) => `${label} ${number(partner[key])} 筆`)
    .join(' · ');
  return (
    <li className="py-1.5">
      <div className="flex items-center justify-between gap-2 leading-5">
        <MediaHoverLink media={partner.id} className="min-w-0 truncate hover:text-brand-700 dark:hover:text-brand-400" title={partner.name}>
          <span className="truncate">{partner.name}</span>
        </MediaHoverLink>
        <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
          {number(partner.total)}
          <span className="ml-0.5 text-[10px] text-zinc-500">筆關係</span>
        </span>
      </div>
      <div
        role="img"
        aria-label={breakdown}
        title={breakdown}
        className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
      >
        {segments.map(({ key, className }) =>
          partner[key] > 0 ? <span key={key} className={className} style={{ width: `${(partner[key] / max) * 100}%` }} /> : null,
        )}
      </div>
    </li>
  );
}

/** How one outlet relates to the others in the period: the per-outlet view of the news graph. */
export default function MediaRelations({ data, media, hours }: { data: SimilarityData | null; media: string; hours: number }) {
  const relations = data ? mediaRelations(data, media) : null;
  const node = relations?.node ?? null;
  const partners = relations?.partners ?? [];
  const max = Math.max(1, ...partners.map((partner) => partner.total));
  const graphHref = `/similarity/?${new URLSearchParams({ hours: String(hours), view: 'evidence', node: media })}`;
  const period = hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小時`;
  const stats = [
    { label: '引用其他媒體', value: node?.outgoing ?? 0 },
    { label: '被其他媒體引用', value: node?.incoming ?? 0 },
    { label: '同署名跨站', value: node?.sameByline ?? 0 },
    { label: '已註明來源', value: node?.attributed ?? 0 },
    { label: '未辨識稿源', value: node?.unattributed ?? 0 },
  ];
  return (
    <section aria-label="與其他媒體的關係" className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">媒體關係</h2>
        <span className="text-zinc-500 dark:text-zinc-400">近 {period}</span>
      </div>
      {!data ? (
        <p className="py-6 leading-6 text-zinc-500 dark:text-zinc-400">媒體關係暫時無法取得，文章仍可正常瀏覽。</p>
      ) : (
        <>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {node ? `已比對 ${number(node.articles)} 篇內文` : '這段時間沒有已比對的內文'}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
            {stats.map((item) => (
              <div key={item.label} className="rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-950">
                <dd className="text-lg font-semibold tabular-nums">{number(item.value)}</dd>
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.label}</dt>
              </div>
            ))}
          </dl>
          {partners.length ? (
            <>
              <h3 className="mt-4 flex items-baseline justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>主要關係對象</span>
                <span className="font-normal">{partners.length} 家</span>
              </h3>
              <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                {partners.slice(0, SHOWN).map((partner) => (
                  <PartnerRow key={partner.id} partner={partner} max={max} />
                ))}
              </ul>
              {partners.length > SHOWN && (
                <details className="group">
                  <summary className="cursor-pointer list-none py-1.5 text-brand-700 hover:underline dark:text-brand-400">
                    <span className="group-open:hidden">其餘 {partners.length - SHOWN} 家 ↓</span>
                    <span className="hidden group-open:inline">收合 ↑</span>
                  </summary>
                  <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                    {partners.slice(SHOWN).map((partner) => (
                      <PartnerRow key={partner.id} partner={partner} max={max} />
                    ))}
                  </ul>
                </details>
              )}
              <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
                {segments.map(({ key, label, className }) => (
                  <span key={key} className="inline-flex items-center gap-1">
                    <i aria-hidden="true" className={`inline-block h-1.5 w-2.5 rounded-sm ${className}`} />
                    {label}
                  </span>
                ))}
              </p>
            </>
          ) : (
            <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
              這段時間沒有與其他媒體內文相近或互相引用的報導。
              <MethodLink />
            </p>
          )}
        </>
      )}
      <Link
        href={graphHref}
        className="mt-3 block border-t border-zinc-200 pt-2.5 text-brand-700 hover:underline dark:border-zinc-800 dark:text-brand-400"
      >
        在新聞關係圖查看 →
      </Link>
    </section>
  );
}

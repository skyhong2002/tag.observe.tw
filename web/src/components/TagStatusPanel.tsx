import Link from 'next/link';
import { type TagStatus, taipei, taipeiHour } from '@/lib/api';

// The ranking row for this tag, expanded: what the 關鍵字 table shows in one
// line, plus co-occurring tags and long-term history. Rendered above the chart.
export default function TagStatusPanel({ status }: { status: TagStatus }) {
  const r = status.ranking;
  const delta = r && r.rank24h !== null ? r.rank24h - r.rank : null;
  const change = !r
    ? null
    : r.new
      ? { text: '新', tone: 'text-rose-600', title: '24 小時前不在榜上' }
      : delta === null
        ? { text: '—', tone: 'text-zinc-400', title: '沒有可比較的 24 小時前快照' }
        : delta > 0
          ? { text: `▲${delta}`, tone: 'text-rose-600', title: `分數名次 ${r.rank}，24 小時前第 ${r.rank24h} 名` }
          : delta < 0
            ? { text: `▼${-delta}`, tone: 'text-sky-600', title: `分數名次 ${r.rank}，24 小時前第 ${r.rank24h} 名` }
            : { text: '＝', tone: 'text-zinc-400', title: `分數名次 ${r.rank}，與 24 小時前相同` };
  const tiles: Array<{ label: string; value: string; tone?: string; title?: string }> = r
    ? [
        { label: '名次', value: `#${r.position}`, title: '新聞媒體排行榜，依爆發力' },
        {
          label: '爆發力',
          value: r.burst?.toFixed(1) ?? '—',
          tone: r.burst !== null && r.burst > r.normalized ? 'text-rose-600' : undefined,
          title: '相對 3／6／12／24／48 小時前的變化',
        },
        { label: '分數', value: r.normalized.toFixed(1), title: '媒體加權分數' },
        { label: '變動', value: change!.text, tone: change!.tone, title: change!.title },
        { label: '24 小時篇數', value: r.count.toLocaleString('zh-TW') },
        { label: '報導媒體', value: `${r.mediaCount}／${r.basisMediaCount} 家`, title: '基準媒體中有報導的家數' },
      ]
    : [];
  return (
    <section
      aria-label="關鍵字狀態"
      className="space-y-3 rounded-xl border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {r ? (
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {tiles.map((t) => (
            <div key={t.label} title={t.title}>
              <dt className="text-xs text-zinc-500">{t.label}</dt>
              <dd className={`text-lg font-semibold tabular-nums ${t.tone ?? ''}`}>{t.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-zinc-600">目前不在新聞媒體排行榜上。</p>
      )}
      {status.related.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-zinc-500">一起出現</span>
          {status.related.map((x) => (
            <Link
              key={x.tag}
              href={`/tag/${encodeURIComponent(x.tag)}`}
              title={`${x.count} 篇同時提到（${Math.round(x.share * 100)}%）`}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-800 hover:bg-brand-50 hover:text-brand-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-brand-400"
            >
              {x.tag}
              <span className="ml-1 text-xs text-zinc-500">{x.count}</span>
            </Link>
          ))}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        {r && `${taipeiHour(r.hourStart)} 時段的新聞媒體排行榜`}
        {r && status.history && ' · '}
        {status.history &&
          `首次上榜 ${taipei(status.history.firstHour)} · 高峰 ${taipei(status.history.maxHour)}（${status.history.maxCount} 篇／小時）`}
        {(r || status.history) && ' · '}
        <Link href="/ranking/?category=news#method" className="hover:underline">
          指標定義
        </Link>
      </p>
    </section>
  );
}

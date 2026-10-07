import Link from 'next/link';
import { notFound } from 'next/navigation';
import { periodLabel } from '@/app/(site)/similarity/format';
import { similarityPeriod, similarityThreshold } from '@/app/(site)/similarity/query';
import AuthorCredits from '@/components/AuthorCredits';
import SectionTabs from '@/components/SectionTabs';
import SourceLink from '@/components/SourceLink';
import { API_ORIGIN, taipei } from '@/lib/api';
import { attributionRole } from '@/lib/author-display.mts';
import { mediaNames } from '@/lib/media-names.mts';
import { fetchSimilarity, periodQuery, type SimilarityEvidence } from '@/lib/similarity';
import { outletIdentity } from '../../../app/src/similarity/attribution';

/** One institution, whether directly collected or only found in citation evidence. */
export default async function SourceProfile({ media, query }: { media: string; query: Record<string, string | undefined> }) {
  const period = similarityPeriod(query),
    threshold = similarityThreshold(query);
  const params = periodQuery(period, threshold);
  const data = await fetchSimilarity(period, threshold).catch(() => null);
  const node = data?.nodes.find((entry) => entry.id === media);
  if (data && !node && !mediaNames[media]) notFound();
  const name = node?.name ?? mediaNames[media]?.name ?? outletIdentity(media).name;
  const direction = query.direction === 'outgoing' ? 'outgoing' : 'incoming';
  const page = /^\d+$/.test(query.page ?? '') ? Number(query.page) : 0;
  const evidenceQuery = new URLSearchParams(params);
  evidenceQuery.set('mode', 'citation');
  evidenceQuery.set('node', media);
  evidenceQuery.set('direction', direction);
  evidenceQuery.set('page', String(page));
  let evidence: SimilarityEvidence | null = null;
  if (node) {
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/similarity/evidence?${evidenceQuery}`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) evidence = (await response.json()) as SimilarityEvidence;
    } catch {
      /* Keep the profile readable when evidence cannot be fetched. */
    }
  }
  const graph = new URLSearchParams(evidenceQuery);
  graph.set('view', 'evidence');
  graph.set('limit', '0');
  const base = `/media/${encodeURIComponent(media)}/references/`;
  const href = (nextDirection: string, nextPage = 0) =>
    `${base}?${new URLSearchParams({ ...Object.fromEntries(params), direction: nextDirection, page: String(nextPage) })}`;
  const edges =
    data?.edges.filter((edge) => edge.kind === 'citation' && (direction === 'incoming' ? edge.target === media : edge.source === media)) ??
    [];
  const partners = edges
    .map((edge) => ({ id: direction === 'incoming' ? edge.source : edge.target, count: edge.count }))
    .sort((a, b) => b.count - a.count);
  const hours = data?.hours ?? 168;
  return (
    <div className="space-y-5 pb-8">
      <nav aria-label="麵包屑" className="text-xs text-zinc-500">
        <Link href={`/similarity/sources/?${params}`} className="hover:underline">
          關係圖 · 來源排行
        </Link>
        <span className="mx-2">/</span>
        {name}
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-sm text-zinc-500">
          {node?.country ?? outletIdentity(media).country} ·{' '}
          {node?.external ? '本期僅有來源／引用資料，未收錄可比對內文' : '刊登媒體與新聞來源'}
          {data && ` · ${periodLabel(data)}`}
        </p>
      </header>
      <SectionTabs
        label="機構資料"
        tabs={[
          ...(!node?.external
            ? [
                { href: `/media/${encodeURIComponent(media)}/?hours=${hours}`, label: '收錄文章' },
                { href: `/byline/?media=${encodeURIComponent(media)}&hours=${hours}`, label: '相關署名' },
              ]
            : []),
          { href: `${base}?${params}`, label: '來源／引用關係', current: true },
        ]}
      />
      {!data ? (
        <p role="status" className="py-8 text-zinc-500">
          暫時無法取得來源／引用關係，請稍後重新整理。
        </p>
      ) : (
        <>
          <dl className="grid max-w-2xl grid-cols-2 gap-3">
            {[
              { label: '被註明來源／引用', value: node?.incoming ?? 0 },
              { label: '註明其他來源／引用', value: node?.outgoing ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <dt className="text-xs text-zinc-500">{item.label}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {item.value.toLocaleString('zh-TW')} <span className="text-xs font-normal text-zinc-500">篇</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={href('incoming')}
              aria-current={direction === 'incoming' ? 'page' : undefined}
              className={`rounded-lg border px-4 py-2 ${direction === 'incoming' ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-zinc-300 dark:border-zinc-700'}`}
            >
              哪些文章註明{name}
            </Link>
            <Link
              href={href('outgoing')}
              aria-current={direction === 'outgoing' ? 'page' : undefined}
              className={`rounded-lg border px-4 py-2 ${direction === 'outgoing' ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-zinc-300 dark:border-zinc-700'}`}
            >
              {name}註明誰
            </Link>
          </div>
          {partners.length > 0 && (
            <section className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-medium">{direction === 'incoming' ? '註明這個來源的媒體' : '明示來源或引用'}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {partners.map((partner) => (
                  <Link
                    key={partner.id}
                    href={`/media/${encodeURIComponent(partner.id)}/references/?${params}`}
                    className="text-brand-700 hover:underline dark:text-brand-400"
                  >
                    {data.nodes.find((entry) => entry.id === partner.id)?.name ?? partner.id}{' '}
                    <span className="text-zinc-500">{partner.count} 篇</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <Link
            href={`/similarity/?${graph}#graph-browser`}
            className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
          >
            在關係圖查看同一期間與來源／引用方向 →
          </Link>
          {node && !evidence ? (
            <p role="status" className="py-8 text-zinc-500">
              來源／引用文章暫時無法取得，請稍後重新整理。
            </p>
          ) : (
            <>
              <p role="status" className="text-xs text-zinc-500">
                {evidence?.total.toLocaleString('zh-TW') ?? 0} 則來源／引用 · 依文章刊登時間排序
              </p>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {evidence?.items
                  .filter((item) => item.kind === 'citation')
                  .map((item) => {
                    if (item.kind !== 'citation') return null;
                    const article = evidence.articles[String(item.articleId)];
                    if (!article) return null;
                    return (
                      <li key={item.key} className="space-y-2 py-4">
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                          <Link
                            href={`/media/${encodeURIComponent(article.media)}/?hours=${hours}`}
                            className="text-brand-700 hover:underline dark:text-brand-400"
                          >
                            {article.mediaTitle}
                          </Link>
                          <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>
                          <AuthorCredits
                            credits={article.authors}
                            media={article.media}
                            attributions={article.attributions}
                            hours={hours}
                          />
                        </div>
                        <h2 className="font-medium leading-7">
                          <Link href={`/article/${article.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                            {article.title}
                          </Link>
                        </h2>
                        <p className="text-xs font-medium text-violet-700 dark:text-violet-400">
                          {attributionRole(item.source)} {item.source.name}
                        </p>
                        <blockquote className="border-l-2 border-violet-300 pl-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                          {item.source.evidence}
                        </blockquote>
                        <SourceLink url={article.url} className="!min-h-6 !text-xs" />
                      </li>
                    );
                  })}
              </ul>
              {!evidence?.items.length && <p className="py-8 text-zinc-500">這段期間沒有此方向的來源／引用。</p>}
              {evidence && (
                <nav aria-label="來源／引用文章分頁" className="flex justify-between text-sm">
                  {page > 0 ? (
                    <Link href={href(direction, page - 1)} className="py-2 text-brand-700 dark:text-brand-400">
                      ← 上一頁
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="py-2 text-zinc-500">第 {page + 1} 頁</span>
                  {(page + 1) * evidence.pageSize < evidence.total ? (
                    <Link href={href(direction, page + 1)} className="py-2 text-brand-700 dark:text-brand-400">
                      下一頁 →
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

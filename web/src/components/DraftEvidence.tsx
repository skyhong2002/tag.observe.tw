import type { DraftEvidence as Evidence } from '@/lib/api';

export default function DraftEvidence({ data, singleLine = false }: { data?: Evidence | null; singleLine?: boolean }) {
  if (!data?.articles) return null;
  const compared = Math.round((data.analyzed / data.articles) * 100);
  return (
    <p
      className={`${singleLine ? 'whitespace-nowrap' : 'mt-1'} text-xs leading-5 text-zinc-600 dark:text-zinc-400`}
      title={`內文相似度至少 ${Math.round(data.threshold * 100)}%；只計本時段與基準媒體內的報導。相似群不等於轉載或獨立稿源；未比對的報導仍可能相似。`}
    >
      {data.similarArticles
        ? singleLine
          ? `${data.similarArticles} 篇相似・${data.groups} 組`
          : `${data.similarArticles} 篇內文高度相似，分成 ${data.groups} 組`
        : data.analyzed
          ? '已比對的報導沒有高度相似'
          : '相似度待比對'}
      {/* How much was compared, as a share: 1238／1311 篇 read as two unrelated counts. */}
      <span className="ml-1.5">{singleLine ? `（比對 ${compared}%）` : `（已比對 ${compared}% 的報導）`}</span>
    </p>
  );
}

import type { DraftEvidence as Evidence } from '@/lib/api';

export default function DraftEvidence({ data, singleLine = false }: { data?: Evidence | null; singleLine?: boolean }) {
  if (!data?.articles) return null;
  return (
    <p
      className={`${singleLine ? 'whitespace-nowrap' : 'mt-1'} text-[11px] leading-5 text-zinc-500`}
      title={`內文相似度至少 ${Math.round(data.threshold * 100)}%；只計本時段與基準媒體內的報導。相似群不等於轉載或獨立稿源；未比對的報導仍可能相似。`}
    >
      {data.similarArticles
        ? `相似 ${data.similarArticles} 篇 · ${data.groups} 群`
        : data.analyzed
          ? '已比對稿件未見高度相似'
          : '相似度待比對'}
      <span className="ml-1.5">
        （已比對 {data.analyzed}／{data.articles} 篇）
      </span>
    </p>
  );
}

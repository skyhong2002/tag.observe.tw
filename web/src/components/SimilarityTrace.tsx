'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SimilarityArticle, SimilarityPair } from '@/lib/similarity';
import { pairChronology, publicationGap, type SimilarityTraceIndex, traceEarlierArticles } from '@/lib/similarity-trace.mts';

const time = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '發布時間未取得';
};
function TraceArticle({ article }: { article: SimilarityArticle }) {
  return (
    <div className="space-y-1">
      <p className="text-zinc-500">
        {article.mediaTitle} · {time(article.publishedAt)}（台北）
      </p>
      <Link href={`/article/${article.id}/`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
        {article.title}
      </Link>
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
        原文 ↗
      </a>
    </div>
  );
}

export default function SimilarityTrace({ pair, index }: { pair: SimilarityPair; index: SimilarityTraceIndex }) {
  const order = pairChronology(pair);
  const [anchor, setAnchor] = useState(order.status === 'ordered' ? order.later.id : pair.a.id);
  const [candidate, setCandidate] = useState<number | null>(null);
  const start = anchor === pair.a.id ? pair.a : pair.b;
  const candidates = useMemo(() => traceEarlierArticles(start, index), [start, index]);
  const selected = candidates.find((item) => item.article.id === candidate) ?? candidates[0];
  const steps = selected ? [...selected.steps].reverse() : [];
  const earliest = candidates[0]?.article.publishedAt;
  const earliestCount = candidates.filter((item) => Date.parse(item.article.publishedAt) === Date.parse(earliest ?? '')).length;
  return (
    <div className="space-y-4 rounded-lg bg-zinc-50 p-3 text-xs leading-6 dark:bg-zinc-950/60" data-testid="similarity-source-trace">
      <label className="block">
        追查起點
        <select
          value={anchor}
          onChange={(event) => {
            setAnchor(Number(event.target.value));
            setCandidate(null);
          }}
          className="mt-1 block w-full rounded border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {[pair.a, pair.b].map((article) => (
            <option key={article.id} value={article.id}>
              {article.mediaTitle}：{article.title}
            </option>
          ))}
        </select>
      </label>
      <p className="text-zinc-500">
        沿已測得的相似配對，逐步往較早的報導追查。範圍包含本期已回傳的全部媒體配對，不受上方媒體篩選限制；超出期間、尚未擷取或未回傳的配對無法追查。先刊登不代表原創或被抄襲。
      </p>
      {selected ? (
        <>
          <label className="block">
            找到 {candidates.length} 篇較早報導 · 由早到晚
            <select
              value={selected.article.id}
              onChange={(event) => setCandidate(Number(event.target.value))}
              className="mt-1 block w-full rounded border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {candidates.map(({ article, steps }) => (
                <option key={article.id} value={article.id}>
                  {article.mediaTitle} · {time(article.publishedAt)} · {steps.length === 1 ? '直接相似' : `${steps.length} 步間接關聯`} ·{' '}
                  {article.title}
                </option>
              ))}
            </select>
          </label>
          <p className="font-medium">
            {Date.parse(selected.article.publishedAt) === Date.parse(earliest!)
              ? `這條追查路徑中最早的已收錄報導${earliestCount > 1 ? `（${earliestCount} 篇同時）` : ''}`
              : '選取的較早報導'}{' '}
            · 尚無法確認原始來源
          </p>
          {steps.length > 1 && (
            <p className="text-zinc-500">以下為間接關聯路徑，每一步各自有相似證據；不代表首尾文章直接相似，也不是已證實的轉載鏈。</p>
          )}
          <ol className="space-y-4 border-l-2 border-orange-300 pl-3">
            {steps.map((step) => (
              <li key={step.pair.id}>
                <TraceArticle article={step.earlier} />
                <p className="mt-2 text-orange-700 dark:text-orange-400">
                  ↓ {publicationGap(Date.parse(step.later.publishedAt) - Date.parse(step.earlier.publishedAt))}後 · 與下一篇相似度{' '}
                  {(step.pair.score * 100).toFixed(1)}%
                </p>
                {step.later.attributions.some((source) => source.media === step.earlier.media) && (
                  <p className="text-violet-700 dark:text-violet-400">
                    下一篇明示引用 {step.earlier.mediaTitle}（僅確認媒體，未確認此篇原文）
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer">檢視這一步的共同段落</summary>
                  <p className="break-words text-zinc-500">{step.pair.evidence}</p>
                </details>
              </li>
            ))}
            <li>
              <TraceArticle article={start} />
              <p className="text-zinc-500">追查起點</p>
            </li>
          </ol>
        </>
      ) : (
        <p>目前回傳的配對中沒有可沿時間往前追查的報導。這不代表這篇就是原創；同時發布或時間不明的配對無法判定先後。</p>
      )}
    </div>
  );
}

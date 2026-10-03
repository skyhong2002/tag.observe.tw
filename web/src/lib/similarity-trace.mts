import type { SimilarityArticle, SimilarityPair } from '../../../app/src/similarity/types.ts';

export function pairChronology(pair: Pick<SimilarityPair, 'a' | 'b'>) {
  const a = Date.parse(pair.a.publishedAt),
    b = Date.parse(pair.b.publishedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { status: 'unknown' as const };
  if (a === b) return { status: 'same' as const };
  return {
    status: 'ordered' as const,
    earlier: a < b ? pair.a : pair.b,
    later: a < b ? pair.b : pair.a,
    gap: Math.abs(a - b),
  };
}

export function publicationGap(milliseconds: number): string {
  if (milliseconds < 60_000) return '不到 1 分鐘';
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時${minutes % 60 ? ` ${minutes % 60} 分鐘` : ''}`;
  return `${Math.floor(hours / 24)} 天${hours % 24 ? ` ${hours % 24} 小時` : ''}`;
}

export function chronologySummary(pair: Pick<SimilarityPair, 'a' | 'b'>): string {
  const order = pairChronology(pair);
  return order.status === 'ordered'
    ? `發布順序：${order.earlier.mediaTitle} → ${order.later.mediaTitle} · 相差 ${publicationGap(order.gap)}（非引用方向）`
    : order.status === 'same'
      ? '發布時間相同，無法判定先後'
      : '發布時間不足，無法判定先後';
}

export type TraceStep = { earlier: SimilarityArticle; later: SimilarityArticle; pair: SimilarityPair };
export type SimilarityTraceIndex = Map<number, TraceStep[]>;

/** Only a measured pair with strictly earlier timestamps forms a backwards step.
 * A→B and B→C never imply that A's text matches C or that either copied the other.
 */
export function buildSimilarityTraceIndex(pairs: SimilarityPair[]): SimilarityTraceIndex {
  const index: SimilarityTraceIndex = new Map();
  for (const pair of pairs) {
    const order = pairChronology(pair);
    if (order.status !== 'ordered') continue;
    const list = index.get(order.later.id) ?? [];
    list.push({ earlier: order.earlier, later: order.later, pair });
    index.set(order.later.id, list);
  }
  for (const list of index.values()) list.sort((a, b) => b.pair.score - a.pair.score || a.earlier.id - b.earlier.id);
  return index;
}

export function traceEarlierArticles(start: SimilarityArticle, index: SimilarityTraceIndex) {
  const paths = new Map<number, TraceStep[]>([[start.id, []]]);
  const queue = [start.id];
  const candidates: { article: SimilarityArticle; steps: TraceStep[] }[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const step of index.get(id) ?? []) {
      if (paths.has(step.earlier.id)) continue;
      const steps = [...paths.get(id)!, step];
      paths.set(step.earlier.id, steps);
      queue.push(step.earlier.id);
      candidates.push({ article: step.earlier, steps });
    }
  }
  candidates.sort((a, b) => Date.parse(a.article.publishedAt) - Date.parse(b.article.publishedAt) || a.article.id - b.article.id);
  return candidates;
}

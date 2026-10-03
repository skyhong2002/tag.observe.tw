import type { SimilarityData, SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';
import { type GraphSelection, graphEvidence } from './graph-evidence.mts';
import { graphEvidenceScope } from './graph-filters.mts';
import { type MediaCamps, nodeArticleCounts } from './media-graph.mts';
import { chronologySummary } from './similarity-trace.mts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const number = (value: number) => value.toLocaleString('zh-TW');

/** Escaped, read-only hover summaries. Clicks continue to use the inline browser. */
export function createGraphTooltip(data: SimilarityData, nodes: SimilarityNode[], camps: MediaCamps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const scope = graphEvidenceScope(data, nodes);
  const counts = nodeArticleCounts(scope);
  const name = (id: string) => escapeHtml(byId.get(id)?.name ?? id);
  return (selection: GraphSelection, edges: SimilarityEdge[]) => {
    if (!selection) return '';
    let heading: string;
    let summary: string;
    if ('node' in selection) {
      const node = byId.get(selection.node);
      if (!node) return '';
      const count = counts.get(node.id);
      const camp = camps[node.id] === 'blue' ? ' · 藍營傾向' : camps[node.id] === 'green' ? ' · 綠營傾向' : '';
      heading = `<b>${name(node.id)}</b> · ${escapeHtml(node.country)}${camp}`;
      summary = `${node.external ? '僅作為引用來源，未收錄本期內文' : `本期納入分析：<b>${number(node.articles)} 篇</b>`}<br/>圖上媒體間：引用 ${number(count?.outgoing ?? 0)} 篇 · 被引用 ${number(count?.incoming ?? 0)} 篇 · 內文相近 ${number(count?.similar ?? 0)} 篇`;
      const related = edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      summary += related.length
        ? `<br/>${related.map((edge) => `${name(edge.source)} ${edge.kind === 'citation' ? '→' : '↔'} ${name(edge.target)}：${number(edge.count)} ${edge.kind === 'citation' ? '篇引用' : '組相似'}`).join('<br/>')}`
        : '<br/>目前篩選與關係模式下沒有連線';
    } else {
      const edge = selection.edge;
      heading = `<b>${name(edge.source)} ${edge.kind === 'citation' ? '→' : '↔'} ${name(edge.target)}</b>`;
      summary =
        edge.kind === 'citation'
          ? `${number(edge.count)} 篇文章明示引用 · 箭頭指向引用來源`
          : `${number(edge.count)} 組相似內文${edge.score === null ? '' : ` · 最高相似度 ${(edge.score * 100).toFixed(1)}%`}`;
    }
    const mode = edges.length && edges.every((edge) => edge.kind === edges[0].kind) ? edges[0].kind : 'all';
    const articles = graphEvidence(scope, selection, mode, '', 'all')
      .slice(0, 2)
      .map((item) =>
        item.kind === 'citation'
          ? `${item.citation.article.mediaTitle}：${item.citation.article.title}`
          : `${item.pair.a.mediaTitle} ↔ ${item.pair.b.mediaTitle}：${item.pair.a.title} · ${chronologySummary(item.pair)}`,
      );
    return `<div role="tooltip">${heading}<div style="margin-top:6px">${summary}</div>${articles.length ? `<div style="margin-top:8px">${articles.map((title) => `<div style="margin-top:4px">• ${escapeHtml(title)}</div>`).join('')}</div>` : ''}<div style="margin-top:8px;opacity:.65">點選固定高亮，詳細文章在圖下方</div></div>`;
  };
}

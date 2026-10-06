import type { SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';
import type { GraphSelection } from './graph-evidence.mts';
import { type MediaCamps, nodeArticleCounts } from './media-graph.mts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const number = (value: number) => value.toLocaleString('zh-TW');

/** Escaped, read-only hover summaries. Clicks continue to use the inline browser. */
export function createGraphTooltip(nodes: SimilarityNode[], camps: MediaCamps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const counts = nodeArticleCounts(nodes);
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
      summary = `${node.external ? '僅作為來源／引用對象，未收錄本期內文' : `本期納入分析：<b>${number(node.articles)} 篇</b>`}<br/>本期全部關係：引用 ${number(count?.outgoing ?? 0)} 篇 · 被採用／引用 ${number(count?.incoming ?? 0)} 篇 · 來源已註明 ${number(node.attributed ?? 0)} 篇 · 同署名跨站 ${number(node.sameByline ?? 0)} 篇 · 未辨識稿源 ${number(node.unattributed ?? 0)} 篇 · 較早刊登 ${number(count?.earliest ?? 0)} 篇 · 較晚刊登 ${number(count?.later ?? 0)} 篇`;
      const related = edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      summary += related.length
        ? `<br/>${related.map((edge) => `${name(edge.target)} ${edge.kind === 'citation' ? '→' : '↔'} ${name(edge.source)}：${number(edge.count)} ${edge.kind === 'citation' ? '篇來源／引用' : '組直接比對'}`).join('<br/>')}`
        : '<br/>目前篩選與關係模式下沒有連線';
    } else {
      const edge = selection.edge;
      heading = `<b>${name(edge.target)} ${edge.kind === 'citation' ? '→' : '↔'} ${name(edge.source)}</b>`;
      summary =
        edge.kind === 'citation'
          ? `${number(edge.count)} 篇文章來源／引用`
          : `${number(edge.count)} 組直接比對 · 已註明來源 ${number(edge.attributed ?? 0)} · 同署名 ${number(edge.sameByline ?? 0)} · 未辨識稿源 ${number(edge.unattributed ?? 0)}${edge.score === null ? '' : ` · 最高相似度 ${(edge.score * 100).toFixed(1)}%`}`;
    }
    return `<div role="tooltip">${heading}<div style="margin-top:6px">${summary}</div></div>`;
  };
}

import type { SimilarityEdge } from '../../../app/src/similarity/types.ts';

export const edgeHasArrow = (edge: SimilarityEdge) => edge.kind === 'citation' || edge.directed === true;
export const edgeCategory = (edge: SimilarityEdge) => (edge.kind === 'citation' ? 'attributed' : (edge.relation ?? 'unattributed'));
export function edgeColor(edge: SimilarityEdge, dark: boolean) {
  const category = edgeCategory(edge);
  return category === 'same-byline'
    ? dark
      ? '#2dd4bf'
      : '#0d9488'
    : category === 'attributed'
      ? dark
        ? '#a78bfa'
        : '#8b5cf6'
      : dark
        ? '#fb923c'
        : '#ea580c';
}
export function edgeLabel(edge: SimilarityEdge) {
  const category = edgeCategory(edge);
  return category === 'same-byline' ? '同署名跨站' : category === 'attributed' ? '引用／明示來源' : '未辨識稿源（箭頭僅表示刊登先後）';
}

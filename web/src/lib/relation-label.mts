import type { PairRelationInfo } from '../../../app/src/similarity/types.ts';

export function relationLabel(relation?: PairRelationInfo) {
  if (!relation) return '內文相近';
  if (relation.sharedAuthors.length) return '同署名跨站刊登';
  if (relation.kind === 'attributed') return relation.commonSources.length ? '共同明示來源' : '已註明來源／引用';
  return '未辨識稿源';
}

export function relationDetails(relation: PairRelationInfo | undefined, aName: string, bName: string) {
  if (!relation) return '';
  return [
    relation.sharedAuthors.length ? `同署名：${relation.sharedAuthors.join('、')}` : '',
    relation.aCitesB ? `${aName}註明${relation.aCreditRole ?? '引用'}${bName}` : '',
    relation.bCitesA ? `${bName}註明${relation.bCreditRole ?? '引用'}${aName}` : '',
    relation.commonSources.length ? `共同明示來源：${relation.commonSources.map((source) => source.name).join('、')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

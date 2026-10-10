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

/**
 * One plain sentence for an origin card: what the later article did with the
 * earlier one, plus the row labels. "原稿／轉載" only when a shared byline or
 * the later article's own source credit says so; otherwise just the order.
 */
export function originSummary(
  relation: PairRelationInfo | undefined,
  pair: { a: { id: number } } | null,
  article: { id: number; mediaTitle: string },
  source: { mediaTitle: string },
): { sentence: string; roles: [string, string] } {
  const later = article.mediaTitle,
    earlier = source.mediaTitle;
  if (!relation || !pair) return { sentence: '內文相近', roles: ['較早', '較晚'] };
  const laterIsA = pair.a.id === article.id;
  const credits = laterIsA ? relation.aCitesB : relation.bCitesA,
    credited = laterIsA ? relation.bCitesA : relation.aCitesB;
  const role = (laterIsA ? relation.aCreditRole : relation.bCreditRole) ?? '引用',
    reverseRole = (laterIsA ? relation.bCreditRole : relation.aCreditRole) ?? '引用';
  const copied = relation.sharedAuthors.length > 0 || (credits && role === '來源');
  const parts = [
    relation.sharedAuthors.length
      ? `${later} 轉載 ${earlier}`
      : credits
        ? `${later} 註明${role} ${earlier}`
        : relation.commonSources.length
          ? `兩篇都註明來源：${relation.commonSources.map((s) => s.name).join('、')}`
          : relation.kind === 'unattributed'
            ? '內文相近，未註明來源'
            : '內文相近',
    relation.sharedAuthors.length ? `同一記者：${relation.sharedAuthors.join('、')}` : '',
    relation.sharedAuthors.length && credits ? `並註明${role}` : '',
    credited ? `${earlier} 註明${reverseRole} ${later}` : '',
  ];
  return { sentence: parts.filter(Boolean).join(' · '), roles: copied ? ['原稿', '轉載'] : ['較早', '較晚'] };
}

/** How much later `later` appeared: 同時, 晚 12 分鐘, 晚 3 小時, 晚 2 天. */
export function delayLabel(earlierIso: string, laterIso: string): string {
  const minutes = Math.round((Date.parse(laterIso) - Date.parse(earlierIso)) / 60_000);
  if (!Number.isFinite(minutes)) return '';
  if (Math.abs(minutes) < 1) return '同時';
  const sign = minutes > 0 ? '晚' : '早';
  const m = Math.abs(minutes);
  if (m < 60) return `${sign} ${m} 分鐘`;
  if (m < 48 * 60) return `${sign} ${Math.round(m / 60)} 小時`;
  return `${sign} ${Math.round(m / 1440)} 天`;
}

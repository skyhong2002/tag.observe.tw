import { eventHeadlineGroups } from './event-headline-groups.mts';
import { type CompareArticle, type HeadlineCamp, headlineSimilarity } from './headline-compare.mts';
import { distinctiveHeadlineParts } from './headline-emphasis.mts';

export const COMPARISON_CAMPS: HeadlineCamp[] = ['blue', 'green', 'other'];

/** Select wording variety within the current development, not political extremity.
 * Keep each outlet to one pick and skip near-identical titles across columns.
 */
export function eventHeadlinePicks(articles: readonly CompareArticle[], focus: string, perCamp = 3) {
  const ranked = articles.map((article) => ({ article, relevance: headlineSimilarity(article.title, focus) }));
  const best = Math.max(0, ...ranked.map((r) => r.relevance));
  const floor = Math.max(0.12, best * 0.25);
  const candidates = ranked.filter((r) => r.relevance >= floor);
  const picks: CompareArticle[] = [];
  const usedMedia = new Set<string>();
  for (let round = 0; round < perCamp; round++) {
    for (const camp of COMPARISON_CAMPS) {
      const eligible = candidates.filter(({ article }) => article.camp === camp && !usedMedia.has(article.media));
      const scored = eligible
        .map((row) => {
          const overlap = Math.max(0, ...picks.map((p) => headlineSimilarity(p.title, row.article.title)));
          return { ...row, overlap, score: row.relevance * 0.65 + (1 - overlap) * 0.35 };
        })
        .filter((row) => row.overlap < 0.72)
        .sort((a, b) => b.score - a.score || b.article.publishedAt.localeCompare(a.article.publishedAt) || a.article.id - b.article.id);
      if (scored[0]) {
        picks.push(scored[0].article);
        usedMedia.add(scored[0].article.media);
      }
    }
  }
  const allParts = distinctiveHeadlineParts(articles);
  const partsById = new Map(articles.map((article, index) => [article.id, allParts[index]]));
  return COMPARISON_CAMPS.map((camp) => ({
    camp,
    picks: picks.flatMap((article) => (article.camp === camp ? [{ article, parts: partsById.get(article.id)! }] : [])),
  }));
}

/** Every outlet stays visible; the compact picks lead, then each remaining
 * outlet contributes its closest headline. Only additional reports are folded.
 */
export function eventMediaColumns(articles: readonly CompareArticle[], focus: string) {
  const groups = eventHeadlineGroups(articles);
  const columns = eventHeadlinePicks(articles, focus);
  return columns.map(({ camp, picks }) => {
    const ranks = new Map(picks.map((pick, index) => [pick.article.media, index]));
    const pickedIds = new Map(picks.map((pick) => [pick.article.media, pick.article.id]));
    const media = groups
      .filter((group) => group.headlines[0]?.article.camp === camp)
      .map((group) => {
        const ranked = [...group.headlines].sort(
          (a, b) =>
            headlineSimilarity(b.article.title, focus) - headlineSimilarity(a.article.title, focus) ||
            b.article.publishedAt.localeCompare(a.article.publishedAt) ||
            a.article.id - b.article.id,
        );
        const lead = group.headlines.find((row) => row.article.id === pickedIds.get(group.media)) ?? ranked[0];
        return { media: group.media, lead, remaining: group.headlines.filter((row) => row.article.id !== lead.article.id) };
      })
      .sort(
        (a, b) =>
          (ranks.get(a.media) ?? Infinity) - (ranks.get(b.media) ?? Infinity) ||
          headlineSimilarity(b.lead.article.title, focus) - headlineSimilarity(a.lead.article.title, focus) ||
          a.media.localeCompare(b.media),
      );
    return { camp, media };
  });
}

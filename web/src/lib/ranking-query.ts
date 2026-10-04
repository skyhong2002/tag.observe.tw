// /ranking/ query parameters, shared by the page and its footer notes so both make the same request.
export type RankingSearch = { category?: string; order?: string; limit?: string; sort?: string; dir?: string };

export function rankingQuery(sp: RankingSearch) {
  return {
    category: sp.category ?? 'all',
    order: sp.order === 'score' ? ('score' as const) : ('burst' as const),
    limit: Math.min(200, Math.max(10, Number(sp.limit) || 50)),
  };
}

// Shared with the page, footer notes and API contract tests.
export type RankingSearch = { category?: string; order?: string; gate?: string; limit?: string; sort?: string; dir?: string };

export function rankingQuery(sp: RankingSearch) {
  const order = sp.order === 'growth' ? 'growth' : sp.order === 'score' ? 'score' : 'burst';
  return {
    category: sp.category ?? 'all',
    order,
    gate: sp.gate === 'early' || sp.gate === 'broad' ? sp.gate : 'all',
    limit: Math.min(200, Math.max(10, Math.floor(Number(sp.limit) || 50))),
  } as const;
}

// A new category or mode starts unrestricted. Sorting and expanding the same
// view retain its explicit gate; burst/score are both the popular mode.
export function rankingHref(
  current: ReturnType<typeof rankingQuery> & Pick<RankingSearch, 'sort' | 'dir'>,
  patch: Partial<RankingSearch> = {},
) {
  const changingView =
    (patch.category !== undefined && patch.category !== current.category) ||
    (patch.order !== undefined && (patch.order === 'growth') !== (current.order === 'growth'));
  const params = {
    ...current,
    limit: current.limit === 50 ? undefined : String(current.limit),
    ...(changingView ? { gate: 'all' } : {}),
    ...patch,
  };
  const query = new URLSearchParams(Object.entries(params).filter((kv): kv is [string, string] => kv[1] !== undefined));
  return `/ranking/?${query}`;
}

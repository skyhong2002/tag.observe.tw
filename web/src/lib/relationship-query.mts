export const GRAPH_QUERY_KEYS = [
  'hours',
  'from',
  'to',
  'threshold',
  'view',
  'node',
  'mode',
  'direction',
  'limit',
  'camp',
  'tag',
  'edgeKind',
  'edgeRelation',
  'edgeDirected',
  'relation',
  'source',
  'target',
  'q',
  'page',
  'showAll',
  'minScore',
  'maxScore',
  'bylines',
  'gap',
  'minGroup',
  'sort',
] as const;
export function relationshipQuery(input: URLSearchParams | Record<string, string | undefined>): URLSearchParams {
  const source =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(Object.entries(input).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const result = new URLSearchParams();
  for (const key of GRAPH_QUERY_KEYS) {
    const value = source.get(key);
    if (value !== null) result.set(key, value);
  }
  return result;
}
export function graphHref(input: Record<string, string | number | undefined>, path = '/similarity/') {
  const params = new URLSearchParams(
    Object.entries(input)
      .filter((entry) => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return `${path}${params.size ? `?${params}` : ''}`;
}
export function readGraphState(params: URLSearchParams): {
  limit: number;
  camp: 'all' | 'blue' | 'green' | 'other';
  tag: string;
  mode: 'all' | 'similarity' | 'citation';
  relation: 'all' | 'attributed' | 'same-byline' | 'unattributed';
  direction: 'all' | 'incoming' | 'outgoing';
  page: number;
  q: string;
  showAll: boolean;
  /** 新聞對照 finer filters; scores are whole percents in the URL. */
  minScore: number | null;
  maxScore: number | null;
  bylines: 'all' | 'both' | 'missing' | 'none';
  gap: 'all' | 'same' | 'hour' | 'later';
  minGroup: number;
  sort: 'latest' | 'score';
} {
  const limit = Number(params.get('limit') ?? 30);
  const relation = params.get('relation');
  const mode = params.get('mode'),
    direction = params.get('direction'),
    camp = params.get('camp'),
    page = Number(params.get('page') ?? 0);
  return {
    limit: [0, 10, 20, 30, 50, 100].includes(limit) ? limit : 30,
    camp: camp === 'blue' || camp === 'green' || camp === 'other' ? camp : ('all' as const),
    tag: params.get('tag') ?? '',
    relation: relation === 'attributed' || relation === 'same-byline' || relation === 'unattributed' ? relation : 'all',
    mode: mode === 'similarity' || mode === 'citation' ? mode : ('all' as const),
    direction: direction === 'incoming' || direction === 'outgoing' ? direction : ('all' as const),
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    q: (params.get('q') ?? '').slice(0, 120),
    showAll: params.get('showAll') === '1',
    minScore: percent(params.get('minScore')),
    maxScore: percent(params.get('maxScore')),
    bylines: oneOf(params.get('bylines'), ['both', 'missing', 'none'] as const) ?? 'all',
    gap: oneOf(params.get('gap'), ['same', 'hour', 'later'] as const) ?? 'all',
    minGroup: [3, 5, 10].includes(Number(params.get('minGroup'))) ? Number(params.get('minGroup')) : 0,
    sort: params.get('sort') === 'score' ? 'score' : 'latest',
  };
}

const percent = (value: string | null) => {
  const number = value === null || value === '' ? Number.NaN : Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : null;
};
const oneOf = <T extends string>(value: string | null, options: readonly T[]) => (options.includes(value as T) ? (value as T) : undefined);

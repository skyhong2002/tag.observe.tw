import type { SimilarityArticle, SimilarityData, SimilarityEdge, SimilarityPair } from '../../../app/src/similarity/types.ts';

export interface StoryGroup {
  id: string;
  source: SimilarityArticle | null;
  articles: SimilarityArticle[];
  pairs: SimilarityPair[];
  tiedFirst: number;
}
export interface StoryOrigin {
  id: string;
  article: SimilarityArticle;
  source: SimilarityArticle;
  group: StoryGroup;
  directPair: SimilarityPair | null;
}
export type OriginData = SimilarityData & { origins?: StoryOrigin[]; groups?: StoryGroup[] };

const timestamp = (article: SimilarityArticle) => {
  const value = Date.parse(article.publishedAt);
  return Number.isFinite(value) ? value : Infinity;
};
const pairKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/** Group the complete returned sample BEFORE media filtering. Every member
 * points to the same earliest article, even without a direct root/member pair.
 * Scores and excerpts remain attached to measured pairs, never invented edges.
 */
export function groupStoryOrigins(pairs: SimilarityPair[], threshold: number) {
  const parents = new Map<number, number>();
  const articles = new Map<number, SimilarityArticle>();
  const measured = new Map<string, SimilarityPair>();
  const find = (id: number): number => {
    let root = id;
    while (parents.get(root) !== root) root = parents.get(root)!;
    while (id !== root) {
      const next = parents.get(id)!;
      parents.set(id, root);
      id = next;
    }
    return root;
  };
  for (const pair of pairs) {
    if (!Number.isFinite(pair.score) || pair.score < threshold || pair.a.id === pair.b.id) continue;
    for (const article of [pair.a, pair.b]) {
      if (!parents.has(article.id)) parents.set(article.id, article.id);
      articles.set(article.id, article);
    }
    const a = find(pair.a.id),
      b = find(pair.b.id);
    parents.set(Math.max(a, b), Math.min(a, b));
    const key = pairKey(pair.a.id, pair.b.id);
    if (!measured.has(key) || measured.get(key)!.score < pair.score) measured.set(key, pair);
  }
  const components = new Map<number, SimilarityArticle[]>();
  for (const article of articles.values()) {
    const root = find(article.id);
    const group = components.get(root) ?? [];
    group.push(article);
    components.set(root, group);
  }
  const byRoot = new Map<number, StoryGroup>();
  for (const [root, members] of components) {
    members.sort((a, b) => timestamp(a) - timestamp(b) || a.id - b.id);
    const source = Number.isFinite(timestamp(members[0])) ? members[0] : null;
    byRoot.set(root, {
      id: `story:${root}`,
      source,
      articles: members,
      pairs: [],
      tiedFirst: source ? members.filter((article) => timestamp(article) === timestamp(source)).length : 0,
    });
  }
  for (const pair of measured.values()) byRoot.get(find(pair.a.id))!.pairs.push(pair);
  const groups = [...byRoot.values()].sort((a, b) => a.id.localeCompare(b.id));
  const origins: StoryOrigin[] = [];
  for (const group of groups) {
    group.pairs.sort((a, b) => a.id.localeCompare(b.id));
    if (!group.source) continue;
    for (const article of group.articles) {
      if (article.id === group.source.id) continue;
      origins.push({
        id: `${group.id}:${article.id}`,
        article,
        source: group.source,
        group,
        directPair: measured.get(pairKey(article.id, group.source.id)) ?? null,
      });
    }
  }
  return { groups, origins };
}

export function withStoryOrigins(data: SimilarityData): OriginData & { origins: StoryOrigin[]; groups: StoryGroup[] } {
  const { groups, origins } = groupStoryOrigins(data.pairs, data.threshold);
  const aggregate = new Map<string, SimilarityEdge>();
  for (const origin of origins) {
    if (origin.article.media === origin.source.media) continue; // No media self-loops.
    const key = `${origin.article.media}:${origin.source.media}`;
    const edge = aggregate.get(key) ?? {
      source: origin.article.media,
      target: origin.source.media,
      kind: 'similarity',
      count: 0,
      score: null,
    };
    edge.count++;
    if (origin.directPair) edge.score = Math.max(edge.score ?? 0, origin.directPair.score);
    aggregate.set(key, edge);
  }
  return { ...data, groups, origins, edges: [...data.edges.filter((edge) => edge.kind === 'citation'), ...aggregate.values()] };
}

import { normalizeAuthorCredits } from '../crawl/byline.ts';
import type { Attribution } from './attribution.ts';
import { normalizeAttributions, outletIdentity } from './attribution.ts';
import type { SimilarityArticle, SimilarityEdge, SimilarityNode, SimilarityPair } from './types.ts';

export const METHOD = 'body-shingle-v1';
export const MIN_BODY = 200;
export const MAX_ARTICLES = 10_000;
export const MAX_PAIRS = 2_000;
export interface ContentRow {
  id: number;
  media: string;
  title: string;
  url: string;
  publishedAt: Date;
  body: string | null;
  bodyStatus: string | null;
  authors: string[] | null;
  creator: string | null;
  attributions: Attribution[] | null;
}
export function normalizeBody(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}
function shingles(text: string) {
  const result = new Set<string>();
  for (let i = 0; i <= text.length - 5; i++) result.add(text.slice(i, i + 5));
  return result;
}
export function publicArticle(row: ContentRow): SimilarityArticle {
  const identity = outletIdentity(row.media);
  return {
    id: row.id,
    media: row.media,
    mediaTitle: identity.name,
    country: identity.country,
    countryCode: identity.countryCode,
    title: row.title,
    url: row.url,
    publishedAt: row.publishedAt.toISOString(),
    authors: normalizeAuthorCredits(row.authors?.length ? row.authors : row.creator ? [row.creator] : []),
    bodyLength: normalizeBody(row.body ?? '').length,
    attributions: normalizeAttributions(row.attributions ?? [], row.media),
  };
}
// A bounded excerpt, never the whole article. Only consecutive matching text
// supplies evidence; scattered common vocabulary is not a matching passage.
function sharedPassage(a: string, b: string): string {
  for (const size of [100, 60, 30, 20]) {
    for (let i = 0; i <= a.length - size; i += 5) {
      const segment = a.slice(i, i + size);
      if (b.includes(segment)) return segment;
    }
  }
  return '';
}
/**
 * With `focus`, only focus rows enter the index: every row is compared against
 * the focus articles, but candidates are never compared with each other. Pass
 * focus rows first so later candidates can see them.
 */
export function computeSimilarity(rows: ContentRow[], threshold = 0.65, focus?: Set<number>) {
  const usable: Array<{ row: ContentRow; text: string; size: number }> = [];
  // Keep only the current article's shingle set. Single-document postings are
  // inline numbers, avoiding millions of one-element arrays for larger samples.
  const index = new Map<string, number | number[]>();
  const pairs: SimilarityPair[] = [];
  let matches = 0;
  const rankPairs = (a: SimilarityPair, b: SimilarityPair) =>
    b.score - a.score || b.sharedShingles - a.sharedShingles || a.id.localeCompare(b.id);
  const publicArticles = new Map<number, SimilarityArticle>();
  const article = (row: ContentRow) => {
    if (!publicArticles.has(row.id)) publicArticles.set(row.id, publicArticle(row));
    return publicArticles.get(row.id)!;
  };
  for (const row of rows) {
    if (row.bodyStatus !== 'ok') continue;
    const text = normalizeBody(row.body ?? '');
    if (text.length < MIN_BODY) continue;
    const grams = shingles(text);
    if (grams.size < 100) continue;
    const current = { row, text, size: grams.size };
    const i = usable.length;
    usable.push(current);
    const candidates = new Map<number, number>();
    for (const gram of grams) {
      const posting = index.get(gram);
      if (posting === undefined) continue;
      for (const j of typeof posting === 'number' ? [posting] : posting) {
        if (current.row.media !== usable[j].row.media) candidates.set(j, (candidates.get(j) ?? 0) + 1);
      }
    }
    for (const [j, shared] of candidates) {
      if (shared < 100) continue;
      const other = usable[j];
      const score = (2 * shared) / (current.size + other.size);
      if (score < threshold) continue;
      const evidence = sharedPassage(current.text, other.text);
      if (!evidence) continue;
      const [a, b] = [current.row, other.row].sort((x, y) => x.id - y.id);
      matches++;
      pairs.push({
        id: `${a.id}-${b.id}`,
        a: article(a),
        b: article(b),
        score,
        containment: shared / Math.min(current.size, other.size),
        sharedShingles: shared,
        kind: current.text === other.text ? 'identical' : 'high',
        evidence,
      });
      if (pairs.length >= MAX_PAIRS * 2) {
        pairs.sort(rankPairs);
        pairs.length = MAX_PAIRS;
      }
    }
    if (focus && !focus.has(row.id)) continue;
    for (const gram of grams) {
      const posting = index.get(gram);
      if (posting === undefined) index.set(gram, i);
      else if (typeof posting === 'number') index.set(gram, [posting, i]);
      else posting.push(i);
    }
  }
  pairs.sort(rankPairs);
  return { pairs: pairs.slice(0, MAX_PAIRS), pairsTruncated: matches > MAX_PAIRS, analyzed: usable.length };
}
export function buildGraph(rows: ContentRow[], pairs: SimilarityPair[]) {
  const nodes = new Map<string, SimilarityNode>();
  const edges = new Map<string, SimilarityEdge>();
  const citations: Array<{ article: SimilarityArticle; source: Attribution }> = [];
  function node(media: string, external = false) {
    if (!nodes.has(media)) {
      const o = outletIdentity(media);
      nodes.set(media, { id: media, name: o.name, country: o.country, countryCode: o.countryCode, articles: 0, external });
    }
    if (!external) (nodes.get(media) as SimilarityNode).external = false;
    return nodes.get(media) as SimilarityNode;
  }
  for (const row of rows) node(row.media).articles++;
  for (const pair of pairs) {
    const [source, target] = [pair.a.media, pair.b.media].sort();
    const key = `similarity:${source}:${target}`;
    const edge = edges.get(key) ?? { source, target, kind: 'similarity', count: 0, score: 0 };
    edge.count++;
    edge.score = Math.max(edge.score ?? 0, pair.score);
    edges.set(key, edge);
  }
  for (const row of rows) {
    const seen = new Set<string>();
    const article = publicArticle(row);
    for (const source of article.attributions) {
      if (source.media === row.media || seen.has(source.media)) continue;
      seen.add(source.media);
      node(source.media, true);
      citations.push({ article, source });
      const key = `citation:${row.media}:${source.media}`;
      const edge = edges.get(key) ?? { source: row.media, target: source.media, kind: 'citation', count: 0, score: null };
      edge.count++;
      edges.set(key, edge);
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], citations };
}

import type { Attribution } from './attribution.ts';
import { outletIdentity } from './attribution.ts';
import type { SimilarityArticle, SimilarityEdge, SimilarityNode, SimilarityPair } from './types.ts';

export const METHOD = 'body-shingle-v1';
export const MIN_BODY = 200;
export const MAX_ARTICLES = 1200;
export const MAX_PAIRS = 200;
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
    authors: row.authors?.length ? row.authors : row.creator ? [row.creator] : [],
    bodyLength: normalizeBody(row.body ?? '').length,
    attributions: row.attributions ?? [],
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
export function computeSimilarity(rows: ContentRow[], threshold = 0.65) {
  const usable = rows
    .filter((r) => r.bodyStatus === 'ok' && normalizeBody(r.body ?? '').length >= MIN_BODY)
    .map((row) => {
      const text = normalizeBody(row.body ?? '');
      return { row, text, grams: shingles(text) };
    })
    .filter((r) => r.grams.size >= 100);
  const index = new Map<string, number[]>();
  const pairs: SimilarityPair[] = [];
  for (let i = 0; i < usable.length; i++) {
    const current = usable[i];
    const candidates = new Map<number, number>();
    for (const gram of current.grams) {
      for (const j of index.get(gram) ?? []) {
        if (current.row.media !== usable[j].row.media) candidates.set(j, (candidates.get(j) ?? 0) + 1);
      }
    }
    for (const [j, shared] of candidates) {
      if (shared < 100) continue;
      const other = usable[j];
      const score = (2 * shared) / (current.grams.size + other.grams.size);
      if (score < threshold) continue;
      const evidence = sharedPassage(current.text, other.text);
      if (!evidence) continue;
      const [a, b] = [current.row, other.row].sort((x, y) => x.id - y.id);
      pairs.push({
        id: `${a.id}-${b.id}`,
        a: publicArticle(a),
        b: publicArticle(b),
        score,
        containment: shared / Math.min(current.grams.size, other.grams.size),
        sharedShingles: shared,
        kind: current.text === other.text ? 'identical' : 'high',
        evidence,
      });
    }
    for (const gram of current.grams) {
      const posting = index.get(gram);
      if (posting) posting.push(i);
      else index.set(gram, [i]);
    }
  }
  pairs.sort((a, b) => b.score - a.score || b.sharedShingles - a.sharedShingles || a.id.localeCompare(b.id));
  return { pairs: pairs.slice(0, MAX_PAIRS), pairsTruncated: pairs.length > MAX_PAIRS, analyzed: usable.length };
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
    for (const source of row.attributions ?? []) {
      if (source.media === row.media || seen.has(source.media)) continue;
      seen.add(source.media);
      node(source.media, true);
      citations.push({ article: publicArticle(row), source });
      const key = `citation:${row.media}:${source.media}`;
      const edge = edges.get(key) ?? { source: row.media, target: source.media, kind: 'citation', count: 0, score: null };
      edge.count++;
      edges.set(key, edge);
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], citations };
}

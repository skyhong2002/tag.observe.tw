// Read side of the similarity index (jobs/similarity-job.ts). Everything here
// reads stored pairs and citations; nothing compares bodies per request.
import { and, between, eq, gte, inArray, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articleCitations, articleSketches, articles, similarityPairs } from '../db/schema.ts';
import { type Attribution, outletIdentity } from './attribution.ts';
import { PAIR_WINDOW_MS, publicArticle } from './compute.ts';
import type {
  EvidenceRef,
  SimilarityArticle,
  SimilarityEdge,
  SimilarityEvidence,
  SimilarityNode,
  SimilarityPair,
  StoryGroupData,
} from './types.ts';

export const GROUP_PAIR_LIMIT = 100;
export const EVIDENCE_PAGE_SIZE = 20;
const CHUNK = 1000;
export const WINDOW_DAYS = PAIR_WINDOW_MS / 86400e3;

export interface StoredPair {
  aId: number;
  bId: number;
  aMedia: string;
  bMedia: string;
  aPublished: Date;
  bPublished: Date;
  score: number;
  containment: number;
  shared: number;
  kind: string;
  evidence: string;
}
/** Pairs whose two articles were both published inside [from, to]. */
export async function loadStoredPairs(db: Db, from: Date, to: Date, threshold: number): Promise<StoredPair[]> {
  return db
    .select({
      aId: similarityPairs.aId,
      bId: similarityPairs.bId,
      aMedia: similarityPairs.aMedia,
      bMedia: similarityPairs.bMedia,
      aPublished: similarityPairs.aPublished,
      bPublished: similarityPairs.bPublished,
      score: similarityPairs.score,
      containment: similarityPairs.containment,
      shared: similarityPairs.shared,
      kind: similarityPairs.kind,
      evidence: similarityPairs.evidence,
    })
    .from(similarityPairs)
    .where(
      and(
        between(similarityPairs.lastPublished, from, to),
        gte(similarityPairs.firstPublished, from),
        gte(similarityPairs.score, threshold),
      ),
    );
}

export async function loadArticles(db: Db, ids: Iterable<number>): Promise<Map<number, SimilarityArticle>> {
  const list = [...new Set(ids)];
  const out = new Map<number, SimilarityArticle>();
  for (let i = 0; i < list.length; i += CHUNK) {
    const rows = await db
      .select({
        id: articles.id,
        media: articles.media,
        title: articles.title,
        url: articles.url,
        publishedAt: articles.publishedAt,
        authors: articles.authors,
        creator: articles.creator,
        attributions: articles.attributions,
        chars: sql<number | null>`${articleSketches.chars}`,
      })
      .from(articles)
      .leftJoin(articleSketches, eq(articleSketches.articleId, articles.id))
      .where(inArray(articles.id, list.slice(i, i + CHUNK)));
    for (const row of rows) out.set(row.id, publicArticle({ ...row, chars: Number(row.chars ?? 0) }));
  }
  return out;
}
export function toPair(pair: StoredPair, byId: Map<number, SimilarityArticle>): SimilarityPair | null {
  const a = byId.get(pair.aId),
    b = byId.get(pair.bId);
  if (!a || !b) return null;
  return {
    id: `${pair.aId}-${pair.bId}`,
    a,
    b,
    score: pair.score,
    containment: pair.containment,
    sharedShingles: pair.shared,
    kind: pair.kind === 'identical' ? 'identical' : 'high',
    evidence: pair.evidence,
  };
}

interface Stub {
  id: number;
  media: string;
  at: number;
}
export interface Group {
  id: string;
  source: Stub;
  members: Stub[];
  pairs: StoredPair[];
  tiedFirst: number;
}
export interface Origin {
  id: string;
  article: Stub;
  source: Stub;
  group: Group;
  directPair: StoredPair | null;
}
const pairKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/**
 * Connected components of the pair graph. Every member points to the same
 * earliest article, even without a direct pair with it; scores and excerpts
 * stay on measured pairs. Mirrors the grouping the page used to do in the browser.
 */
export function storyGroups(pairs: StoredPair[]) {
  const parents = new Map<number, number>();
  const stubs = new Map<number, Stub>();
  const measured = new Map<string, StoredPair>();
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
    for (const stub of [
      { id: pair.aId, media: pair.aMedia, at: pair.aPublished.getTime() },
      { id: pair.bId, media: pair.bMedia, at: pair.bPublished.getTime() },
    ]) {
      if (!parents.has(stub.id)) parents.set(stub.id, stub.id);
      stubs.set(stub.id, stub);
    }
    const a = find(pair.aId),
      b = find(pair.bId);
    parents.set(Math.max(a, b), Math.min(a, b));
    measured.set(pairKey(pair.aId, pair.bId), pair);
  }
  const byRoot = new Map<number, Group>();
  for (const stub of stubs.values()) {
    const root = find(stub.id);
    const group = byRoot.get(root) ?? { id: `story:${root}`, source: stub, members: [], pairs: [], tiedFirst: 0 };
    group.members.push(stub);
    byRoot.set(root, group);
  }
  for (const pair of measured.values()) byRoot.get(find(pair.aId))!.pairs.push(pair);
  const groups = [...byRoot.values()].sort((a, b) => a.id.localeCompare(b.id));
  const origins: Origin[] = [];
  for (const group of groups) {
    group.members.sort((a, b) => a.at - b.at || a.id - b.id);
    group.source = group.members[0];
    group.tiedFirst = group.members.filter((m) => m.at === group.source.at).length;
    group.pairs.sort((a, b) => b.score - a.score || a.aId - b.aId || a.bId - b.bId);
    for (const article of group.members) {
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

export interface CitationRow {
  articleId: number;
  media: string;
  source: string;
  publishedAt: Date;
}
/** One period at one threshold: the full pair set, grouped, with graph aggregates. */
export interface IndexView {
  from: Date;
  to: Date;
  threshold: number;
  pairs: StoredPair[];
  groups: Group[];
  origins: Origin[];
  citations: CitationRow[];
  analyzed: Map<string, number>;
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
}
export async function loadIndexView(db: Db, from: Date, to: Date, threshold: number): Promise<IndexView> {
  const [pairs, citations, analyzedRows] = await Promise.all([
    loadStoredPairs(db, from, to, threshold),
    db
      .select({
        articleId: articleCitations.articleId,
        media: articleCitations.media,
        source: articleCitations.source,
        publishedAt: articleCitations.publishedAt,
      })
      .from(articleCitations)
      .where(between(articleCitations.publishedAt, from, to)),
    db
      .select({ media: articleSketches.media, n: sql<number>`COUNT(*)` })
      .from(articleSketches)
      .where(between(articleSketches.publishedAt, from, to))
      .groupBy(articleSketches.media),
  ]);
  const analyzed = new Map(analyzedRows.map((r) => [r.media, Number(r.n)]));
  const { groups, origins } = storyGroups(pairs);

  const edges = new Map<string, SimilarityEdge>();
  const counts = new Map<
    string,
    { similar: Set<number>; earliest: Set<number>; later: Set<number>; outgoing: Set<number>; incoming: Set<number> }
  >();
  const count = (media: string) => {
    if (!counts.has(media))
      counts.set(media, { similar: new Set(), earliest: new Set(), later: new Set(), outgoing: new Set(), incoming: new Set() });
    return counts.get(media)!;
  };
  for (const origin of origins) {
    count(origin.article.media).similar.add(origin.article.id);
    count(origin.article.media).later.add(origin.article.id);
    count(origin.source.media).similar.add(origin.source.id);
    count(origin.source.media).earliest.add(origin.source.id);
    if (origin.article.media === origin.source.media) continue; // No media self-loops.
    const key = `similarity:${origin.article.media}:${origin.source.media}`;
    const edge = edges.get(key) ?? { source: origin.article.media, target: origin.source.media, kind: 'similarity', count: 0, score: null };
    edge.count++;
    if (origin.directPair) edge.score = Math.max(edge.score ?? 0, origin.directPair.score);
    edges.set(key, edge);
  }
  for (const citation of citations) {
    count(citation.media).outgoing.add(citation.articleId);
    count(citation.source).incoming.add(citation.articleId);
    const key = `citation:${citation.media}:${citation.source}`;
    const edge = edges.get(key) ?? { source: citation.media, target: citation.source, kind: 'citation', count: 0, score: null };
    edge.count++;
    edges.set(key, edge);
  }
  const ids = new Set([...analyzed.keys(), ...counts.keys()]);
  const nodes: SimilarityNode[] = [...ids].sort().map((media) => {
    const o = outletIdentity(media);
    const c = counts.get(media);
    return {
      id: media,
      name: o.name,
      country: o.country,
      countryCode: o.countryCode,
      articles: analyzed.get(media) ?? 0,
      external: !analyzed.has(media),
      similar: c?.similar.size ?? 0,
      earliest: c?.earliest.size ?? 0,
      later: c?.later.size ?? 0,
      outgoing: c?.outgoing.size ?? 0,
      incoming: c?.incoming.size ?? 0,
    };
  });
  return { from, to, threshold, pairs, groups, origins, citations, analyzed, nodes, edges: [...edges.values()] };
}

export interface EvidenceFilter {
  mode: 'all' | 'similarity' | 'citation';
  node?: string;
  edge?: { kind: 'similarity' | 'citation'; source: string; target: string };
  /** Citations: outgoing cites another outlet. Similarity: outgoing published later, incoming was the group's earliest. */
  direction: 'all' | 'outgoing' | 'incoming';
  /** Media on screen; relationships need both ends inside. */
  scope?: Set<string>;
  /** Category focus; relationships need one end inside. */
  focus?: Set<string>;
  query: string;
  page: number;
}
type LightItem =
  | { kind: 'origin'; key: string; at: number; origin: Origin }
  | { kind: 'citation'; key: string; at: number; citation: CitationRow };

/** Browse the complete evidence; the selection narrows it, newest first, one page at a time. */
export async function loadEvidence(db: Db, view: IndexView, filter: EvidenceFilter): Promise<SimilarityEvidence> {
  const includes = (source: string, target: string) =>
    (!filter.scope || (filter.scope.has(source) && filter.scope.has(target))) &&
    (!filter.focus || filter.focus.has(source) || filter.focus.has(target));
  const { node, edge, direction } = filter;
  let items: LightItem[] = [];
  if (filter.mode !== 'similarity' && (!edge || edge.kind === 'citation'))
    for (const citation of view.citations) {
      if (!includes(citation.media, citation.source)) continue;
      if (node) {
        const outgoing = direction !== 'incoming' && citation.media === node;
        const incoming = direction !== 'outgoing' && citation.source === node;
        if (!outgoing && !incoming) continue;
      } else if (edge && (citation.media !== edge.source || citation.source !== edge.target)) continue;
      items.push({
        kind: 'citation',
        key: `citation:${citation.articleId}:${citation.source}`,
        at: citation.publishedAt.getTime(),
        citation,
      });
    }
  if (filter.mode !== 'citation' && (!edge || edge.kind === 'similarity'))
    for (const origin of view.origins) {
      const { article, source } = origin;
      if (!includes(article.media, source.media)) continue;
      if (node) {
        const later = article.media === node && (filter.mode !== 'similarity' || direction !== 'incoming');
        const earliest = source.media === node && (filter.mode !== 'similarity' || direction !== 'outgoing');
        if (!later && !earliest) continue;
      } else if (edge && (article.media !== edge.source || source.media !== edge.target)) continue;
      items.push({ kind: 'origin', key: `origin:${origin.id}`, at: article.at, origin });
    }
  const hiddenSources = filter.scope
    ? view.origins.filter((o) => filter.scope!.has(o.article.media) && !filter.scope!.has(o.source.media)).length
    : 0;

  const words = filter.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const known = new Map<number, SimilarityArticle>();
  if (words.length) {
    const ids = items.flatMap((item) =>
      item.kind === 'citation' ? [item.citation.articleId] : [item.origin.article.id, item.origin.source.id],
    );
    for (const [id, article] of await loadArticles(db, ids)) known.set(id, article);
    const matches = (...text: string[]) => {
      const haystack = text.join(' ').toLocaleLowerCase();
      return words.every((word) => haystack.includes(word));
    };
    items = items.filter((item) => {
      if (item.kind === 'citation') {
        const article = known.get(item.citation.articleId);
        const source = article?.attributions.find((a) => a.media === item.citation.source);
        return (
          !!article &&
          matches(article.title, article.mediaTitle, outletIdentity(item.citation.source).name, ...article.authors, source?.evidence ?? '')
        );
      }
      const article = known.get(item.origin.article.id),
        source = known.get(item.origin.source.id);
      if (!article || !source) return false;
      return matches(
        article.title,
        source.title,
        article.mediaTitle,
        source.mediaTitle,
        ...article.authors,
        ...source.authors,
        ...item.origin.group.pairs.map((pair) => pair.evidence),
      );
    });
  }
  items.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
  const pageCount = Math.max(1, Math.ceil(items.length / EVIDENCE_PAGE_SIZE));
  const page = Math.min(filter.page, pageCount - 1);
  const shown = items.slice(page * EVIDENCE_PAGE_SIZE, (page + 1) * EVIDENCE_PAGE_SIZE);

  const groups = new Map<string, Group>();
  const needed = new Set<number>();
  for (const item of shown) {
    if (item.kind === 'citation') needed.add(item.citation.articleId);
    else {
      groups.set(item.origin.group.id, item.origin.group);
      for (const member of item.origin.group.members) needed.add(member.id);
    }
  }
  const missing = [...needed].filter((id) => !known.has(id));
  for (const [id, article] of await loadArticles(db, missing)) known.set(id, article);

  const refs: EvidenceRef[] = [];
  for (const item of shown) {
    if (item.kind === 'citation') {
      const article = known.get(item.citation.articleId);
      const source: Attribution = article?.attributions.find((a) => a.media === item.citation.source) ?? {
        ...outletIdentity(item.citation.source),
        evidence: '',
        kind: 'explicit',
      };
      refs.push({
        kind: 'citation',
        key: item.key,
        publishedAt: new Date(item.at).toISOString(),
        articleId: item.citation.articleId,
        source,
      });
    } else {
      const { origin } = item;
      refs.push({
        kind: 'origin',
        key: item.key,
        publishedAt: new Date(item.at).toISOString(),
        articleId: origin.article.id,
        sourceId: origin.source.id,
        groupId: origin.group.id,
        directPair: origin.directPair ? toPair(origin.directPair, known) : null,
      });
    }
  }
  const groupData: Record<string, StoryGroupData> = {};
  for (const group of groups.values())
    groupData[group.id] = {
      id: group.id,
      sourceId: group.source.id,
      articleIds: group.members.map((m) => m.id),
      tiedFirst: group.tiedFirst,
      pairCount: group.pairs.length,
      pairs: group.pairs
        .slice(0, GROUP_PAIR_LIMIT)
        .map((pair) => toPair(pair, known))
        .filter((pair): pair is SimilarityPair => pair !== null),
    };
  const articleData: Record<string, SimilarityArticle> = {};
  for (const id of needed) {
    const article = known.get(id);
    if (article) articleData[id] = article;
  }
  return { total: items.length, page, pageSize: EVIDENCE_PAGE_SIZE, hiddenSources, items: refs, articles: articleData, groups: groupData };
}

/** Pairs at or above `threshold` involving any of `ids`, hydrated. */
export async function pairsOfArticles(db: Db, ids: number[], threshold: number): Promise<SimilarityPair[]> {
  const stored: StoredPair[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    stored.push(
      ...(await db
        .select({
          aId: similarityPairs.aId,
          bId: similarityPairs.bId,
          aMedia: similarityPairs.aMedia,
          bMedia: similarityPairs.bMedia,
          aPublished: similarityPairs.aPublished,
          bPublished: similarityPairs.bPublished,
          score: similarityPairs.score,
          containment: similarityPairs.containment,
          shared: similarityPairs.shared,
          kind: similarityPairs.kind,
          evidence: similarityPairs.evidence,
        })
        .from(similarityPairs)
        .where(and(or(inArray(similarityPairs.aId, chunk), inArray(similarityPairs.bId, chunk)), gte(similarityPairs.score, threshold)))),
    );
  }
  const unique = new Map(stored.map((p) => [`${p.aId}-${p.bId}`, p]));
  const byId = await loadArticles(
    db,
    [...unique.values()].flatMap((p) => [p.aId, p.bId]),
  );
  return [...unique.values()].map((p) => toPair(p, byId)).filter((p): p is SimilarityPair => p !== null);
}

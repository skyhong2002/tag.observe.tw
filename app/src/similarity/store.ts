// Read side of the similarity index (jobs/similarity-job.ts). Everything here
// reads stored pairs and citations; nothing compares bodies per request.
import { and, between, eq, gte, inArray, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articleCitations, articleSketches, articles, similarityPairs } from '../db/schema.ts';
import { type Attribution, outletIdentity } from './attribution.ts';
import { PAIR_WINDOW_MS, publicArticle } from './compute.ts';
import { classifyRelation, similarityConnection } from './relation.ts';
import type {
  EvidenceRef,
  PairRelationInfo,
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
        crawledAt: articles.crawledAt,
        fetchedAt: articles.fetchedAt,
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
    relation: classifyRelation(a, b),
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

/** Connected components for browsing. Evidence links use only directly measured pairs.
 * The earliest member is a display representative, never an inferred source. */
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
    for (const pair of group.pairs) {
      const a = stubs.get(pair.aId)!,
        b = stubs.get(pair.bId)!;
      const [source, article] = a.at < b.at || (a.at === b.at && a.id < b.id) ? [a, b] : [b, a];
      origins.push({ id: `${group.id}:${pairKey(a.id, b.id)}`, article, source, group, directPair: pair });
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
  articleById?: Map<number, SimilarityArticle>;
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

  const known = await loadArticles(
    db,
    pairs.flatMap((pair) => [pair.aId, pair.bId]),
  );
  const { nodes, edges } = aggregateRelations(pairs, known, analyzed, citations);
  return { from, to, threshold, pairs, groups, origins, citations, analyzed, nodes, edges, articleById: known };
}

/** Direct measured relationships, with chronology independent of source attribution. */
export function aggregateRelations(
  pairs: StoredPair[],
  known: Map<number, SimilarityArticle>,
  analyzed: Map<string, number>,
  citations: CitationRow[],
) {
  const edges = new Map<string, SimilarityEdge>();
  type CountKey = 'similar' | 'earliest' | 'later' | 'sameByline' | 'attributed' | 'unattributed' | 'outgoing' | 'incoming';
  const counts = new Map<string, Record<CountKey, Set<number>>>();
  const count = (media: string) => {
    if (!counts.has(media))
      counts.set(media, {
        similar: new Set(),
        earliest: new Set(),
        later: new Set(),
        sameByline: new Set(),
        attributed: new Set(),
        unattributed: new Set(),
        outgoing: new Set(),
        incoming: new Set(),
      });
    return counts.get(media)!;
  };
  const citationKeys = new Set(citations.map((c) => `${c.articleId}:${c.source}`));
  const sameBylineCredits = new Set<string>();
  for (const stored of pairs) {
    const pair = toPair(stored, known);
    if (!pair || pair.a.media === pair.b.media) continue;
    const { a, b } = pair,
      relation = pair.relation!;
    const category = relation.kind === 'attributed' ? 'attributed' : relation.kind === 'same-byline' ? 'sameByline' : 'unattributed';
    for (const article of [a, b]) {
      count(article.media).similar.add(article.id);
      count(article.media)[category].add(article.id);
    }
    // Matching bylines or source credits are counted separately, never as follow-up reporting.
    if (relation.kind === 'unattributed' && !relation.sharedAuthors.length && ['a-earlier', 'b-earlier'].includes(relation.publication)) {
      const [earlier, later] = relation.publication === 'a-earlier' ? [a, b] : [b, a];
      count(earlier.media).earliest.add(earlier.id);
      count(later.media).later.add(later.id);
    }
    const connection = similarityConnection(a, b, relation);
    if (connection.relation === 'same-byline') {
      sameBylineCredits.add(`${a.id}:${b.media}`);
      sameBylineCredits.add(`${b.id}:${a.media}`);
    }
    // A measured pair with a stored direct credit already has a purple citation edge.
    if (
      connection.relation === 'attributed' &&
      ((relation.aCitesB && citationKeys.has(`${a.id}:${b.media}`)) || (relation.bCitesA && citationKeys.has(`${b.id}:${a.media}`)))
    )
      continue;
    const { source, target } = connection;
    const key = `similarity:${connection.relation}:${connection.directed}:${source}:${target}`;
    const edge = edges.get(key) ?? {
      source,
      target,
      kind: 'similarity' as const,
      relation: connection.relation,
      directed: connection.directed,
      count: 0,
      score: null,
      sameByline: 0,
      attributed: 0,
      unattributed: 0,
    };
    edge.count++;
    edge[category] = (edge[category] ?? 0) + 1;
    edge.score = Math.max(edge.score ?? 0, pair.score);
    edges.set(key, edge);
  }
  for (const citation of citations) {
    count(citation.media).outgoing.add(citation.articleId);
    count(citation.source).incoming.add(citation.articleId);
    if (sameBylineCredits.has(`${citation.articleId}:${citation.source}`)) continue;
    const key = `citation:${citation.media}:${citation.source}`;
    const edge = edges.get(key) ?? {
      source: citation.media,
      target: citation.source,
      kind: 'citation',
      count: 0,
      score: null,
      sameByline: 0,
      attributed: 0,
      unattributed: 0,
    };
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
      sameByline: c?.sameByline.size ?? 0,
      attributed: c?.attributed.size ?? 0,
      unattributed: c?.unattributed.size ?? 0,
      earliest: c?.earliest.size ?? 0,
      later: c?.later.size ?? 0,
      outgoing: c?.outgoing.size ?? 0,
      incoming: c?.incoming.size ?? 0,
    };
  });
  return { nodes, edges: [...edges.values()] };
}

export interface EvidenceFilter {
  mode: 'all' | 'similarity' | 'citation';
  relation?: 'attributed' | 'same-byline' | 'unattributed';
  node?: string;
  edge?: { kind: 'similarity' | 'citation'; source: string; target: string; relation?: PairRelationInfo['kind']; directed?: boolean };
  /** Node evidence direction filters explicit citations; edge direction is selected separately. */
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
  const known = new Map(view.articleById ?? []);
  if ((filter.relation || edge?.relation) && !known.size)
    for (const [id, article] of await loadArticles(
      db,
      view.pairs.flatMap((pair) => [pair.aId, pair.bId]),
    ))
      known.set(id, article);
  if (!filter.relation && filter.mode !== 'similarity' && (!edge || edge.kind === 'citation'))
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
      if (filter.relation && (!origin.directPair || toPair(origin.directPair, known)?.relation?.kind !== filter.relation)) continue;
      if (edge?.relation) {
        const pair = origin.directPair && toPair(origin.directPair, known);
        if (!pair) continue;
        const connection = similarityConnection(pair.a, pair.b, pair.relation);
        if (
          connection.relation !== edge.relation ||
          connection.directed !== edge.directed ||
          connection.source !== edge.source ||
          connection.target !== edge.target
        )
          continue;
      }
      if (!includes(article.media, source.media)) continue;
      if (node) {
        if (article.media !== node && source.media !== node) continue;
      } else if (
        edge &&
        !(
          (article.media === edge.source && source.media === edge.target) ||
          (article.media === edge.target && source.media === edge.source)
        )
      )
        continue;
      items.push({ kind: 'origin', key: `origin:${origin.id}`, at: article.at, origin });
    }
  const hiddenSources = filter.scope
    ? view.origins.filter((o) => filter.scope!.has(o.article.media) && !filter.scope!.has(o.source.media)).length
    : 0;

  const words = filter.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
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
        item.origin.directPair?.evidence ?? '',
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

import { normalizeAuthorCredits } from '../crawl/byline.ts';
import type { Attribution } from './attribution.ts';
import { normalizeAttributions, outletIdentity } from './attribution.ts';
import type { SimilarityArticle } from './types.ts';

export const METHOD = 'body-shingle-v1';
export const MIN_BODY = 200;
export const MIN_SHINGLES = 100;
// Lowest selectable threshold; the index stores every pair at or above it.
export const MIN_THRESHOLD = 0.5;
// Articles published further apart than this are not compared.
export const PAIR_WINDOW_MS = 7 * 86400e3;
export interface ArticleRow {
  id: number;
  media: string;
  title: string;
  url: string;
  publishedAt: Date;
  authors: string[] | null;
  creator: string | null;
  crawledAt?: Date;
  fetchedAt?: Date | null;
  attributions: Attribution[] | null;
  /** Normalized body length. */
  chars: number;
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
export function publicArticle(row: ArticleRow): SimilarityArticle {
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
    datePending: row.fetchedAt === null && row.crawledAt?.getTime() === row.publishedAt.getTime(),
    bodyLength: row.chars,
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
export interface BodyMatch {
  score: number;
  containment: number;
  sharedShingles: number;
  kind: 'identical' | 'high';
  evidence: string;
}
export interface PreparedBody {
  text: string;
  grams: Set<string>;
}
/** Normalized text and shingles, or null when the body is too short to compare. */
export function prepareBody(body: string): PreparedBody | null {
  const text = normalizeBody(body);
  if (text.length < MIN_BODY) return null;
  const grams = shingles(text);
  return grams.size < MIN_SHINGLES ? null : { text, grams };
}
/** body-shingle-v1: Dice over distinct 5-character shingles, with a consecutive matching passage as evidence. */
export function compareBodies(a: PreparedBody, b: PreparedBody, threshold = MIN_THRESHOLD): BodyMatch | null {
  const [small, large] = a.grams.size <= b.grams.size ? [a.grams, b.grams] : [b.grams, a.grams];
  let shared = 0;
  for (const gram of small) if (large.has(gram)) shared++;
  if (shared < MIN_SHINGLES) return null;
  const score = (2 * shared) / (a.grams.size + b.grams.size);
  if (score < threshold) return null;
  const evidence = sharedPassage(a.text, b.text);
  if (!evidence) return null;
  return { score, containment: shared / small.size, sharedShingles: shared, kind: a.text === b.text ? 'identical' : 'high', evidence };
}

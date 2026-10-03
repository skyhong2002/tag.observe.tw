import { API_ORIGIN } from './api';

export type {
  SimilarityArticle,
  SimilarityCoverage,
  SimilarityData,
  SimilarityEdge,
  SimilarityNode,
  SimilarityPair,
} from '../../../app/src/similarity/types';

import type { SimilarityData } from '../../../app/src/similarity/types';

export async function fetchSimilarity(hours: number, threshold: number): Promise<SimilarityData> {
  const response = await fetch(`${API_ORIGIN}/api/v1/similarity?hours=${hours}&threshold=${threshold}`, {
    next: { revalidate: 60 },
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`similarity: ${response.status}`);
  return response.json() as Promise<SimilarityData>;
}

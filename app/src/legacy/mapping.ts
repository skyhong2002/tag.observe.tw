import mapping from '../../data/legacy-media-mapping.json' with { type: 'json' };
import { excludedMedia, sourceByMedia } from '../crawl/registry.ts';
import type { LegacyRow } from './normalize.ts';

export const MIXED_ARTICLE_TABLES = new Set(['tag_news', 'tag_news_2024']);
export const legacyMappingVersion = mapping.version;
const policies = mapping.media as Record<
  string,
  { publisherRoots: string[]; publisherHosts?: string[]; sourceUrl: string; evidence: string }
>;

export function legacyMapping(table: string, row?: LegacyRow) {
  const mixed = MIXED_ARTICLE_TABLES.has(table);
  const media = mixed ? String(row?.media ?? '') : table.startsWith('tag_') ? table.slice(4) : '';
  const canonical = (mapping.aliases as Record<string, string>)[media] ?? media;
  const spec = sourceByMedia(canonical);
  const policy = policies[canonical];
  if (!spec || spec.discovery || excludedMedia.has(media) || excludedMedia.has(canonical) || !policy) return null;
  return { spec, publisherRoots: policy.publisherRoots, publisherHosts: policy.publisherHosts ?? [], mixed, sourceMedia: media };
}

export function legacyTableSupported(table: string) {
  return MIXED_ARTICLE_TABLES.has(table) || legacyMapping(table) !== null;
}

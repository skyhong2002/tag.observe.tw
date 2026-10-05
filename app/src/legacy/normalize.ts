import { createHash } from 'node:crypto';
import type { SourceSpec } from '../crawl/sources.ts';
import { decodeEntities, normalizeTag, stripTags, urlKey } from '../crawl/text.ts';

export type LegacyRow = Record<string, string | number | null>;
export type LegacyContext = {
  source: string;
  table: string;
  generation: string;
  capturedAt: string;
  objects: string[];
  spec: SourceSpec;
  publisherRoots?: string[];
  publisherHosts?: string[];
  mixedTable?: boolean;
  sourceMedia?: string;
};

// This adapter intentionally supports the modern Taiwan UTC+08 period only.
// Earlier dates need an explicit historic timezone policy, not a guessed offset.
export function legacyDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const parts = value.match(/\d+/g)!.map(Number);
  const [year, month, day, hour, minute, second] = parts as [number, number, number, number, number, number];
  if (year < 1990 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (wall.toISOString().slice(0, 19).replace('T', ' ') !== value) return null;
  return new Date(wall.getTime() - 8 * 3600_000).toISOString();
}

export function legacyTags(value: unknown): { tags: string[]; valid: boolean } {
  if (value === null || value === undefined || value === '') return { tags: [], valid: true };
  const text = String(value);
  const tags = [...new Set([...text.matchAll(/\[([^[\]]*)\]/g)].map((m) => normalizeTag(m[1])).filter(Boolean))];
  return { tags, valid: text.replace(/\[[^[\]]*\]/g, '').trim() === '' };
}

export function normalizeLegacyArticle(row: LegacyRow, context: LegacyContext) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const media = context.spec.media;
  const sourceMedia = context.sourceMedia ?? media;
  const reviewedMixed = context.mixedTable && ['tag_news', 'tag_news_2024'].includes(context.table) && row.media === sourceMedia;
  if ((!reviewedMixed && context.table !== `tag_${sourceMedia}`) || context.spec.discovery) reasons.push('unreviewed_table_media_mapping');
  const legacyId = row.newsid === null || row.newsid === undefined ? '' : String(row.newsid);
  if (!/^\d+$/.test(legacyId)) reasons.push('invalid_source_id');
  const sourceKey = `${context.source}/${context.table}/${legacyId}`;
  const publishedAt = legacyDate(row.create_time);
  const crawledAt = legacyDate(row.ctime);
  if (!publishedAt) reasons.push('invalid_publication_time');
  if (!crawledAt) reasons.push('invalid_original_crawl_time');
  if (publishedAt && Date.parse(publishedAt) > Date.parse(context.capturedAt) + 86400_000) reasons.push('future_publication_time');
  const rawUrl = String(row.url ?? '').trim();
  // A network-path reference supplies its own host; do not infer a host for relative paths.
  // Keep the source spelling in raw provenance and record the chosen transport explicitly.
  const networkPath = /^\/\/[^/\\]/.test(rawUrl) && !/[\\\u0000-\u0020]/.test(rawUrl);
  const url = networkPath ? `https:${rawUrl}` : rawUrl;
  if (networkPath) warnings.push('network_path_url_normalized_to_https');
  let key: string | null = null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid URL');
    const host = (s: string) => new URL(s).hostname.toLowerCase().replace(/^www\./, '');
    const publisherHost = host(url);
    // Exact historical hosts do not approve sibling or nested subdomains.
    const exactHostAllowed = context.publisherHosts?.includes(parsed.hostname.toLowerCase()) ?? false;
    const allowed =
      exactHostAllowed ||
      (context.publisherRoots
        ? context.publisherRoots.some((root) => publisherHost === root || publisherHost.endsWith(`.${root}`))
        : context.spec.list.urls.some((item) => {
            try {
              return host(item.url) === publisherHost;
            } catch {
              return false;
            }
          }));
    if (!allowed) reasons.push('unreviewed_url_host');
    key = urlKey(url, context.spec.list.articleId);
  } catch {
    reasons.push('invalid_url');
  }
  const title = decodeEntities(stripTags(String(row.title ?? '')))
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) reasons.push('empty_title');
  const tagFields = Object.fromEntries(['tags', 'tags_cat', 'tags_user'].map((name) => [name, legacyTags(row[name])]));
  for (const [name, value] of Object.entries(tagFields)) {
    if (!value.valid) reasons.push(`invalid_${name}_syntax`);
  }
  for (const [name, value, limit] of [
    ['url', url, 512],
    ['title', title, 512],
    ['image', row.image, 512],
    ['category', row.category, 64],
    ['creator', row.creator, 256],
  ] as const) {
    if (value != null && [...String(value)].length > limit) reasons.push(`${name}_too_long`);
  }
  if (tagFields.tags.tags.some((tag) => [...tag].length > 60)) reasons.push('tag_too_long');
  let image: string | null = null;
  if (row.image) {
    try {
      const parsedImage = new URL(String(row.image));
      if (!['http:', 'https:'].includes(parsedImage.protocol) || parsedImage.username || parsedImage.password)
        throw new Error('Invalid image URL');
      image = String(row.image);
    } catch {
      warnings.push('invalid_image_preserved_only_in_raw');
    }
  }
  if (row.creator) warnings.push('creator_not_assumed_to_be_author');
  if (row.description) warnings.push('description_is_not_fulltext');
  if (publishedAt && Date.parse(context.capturedAt) - Date.parse(publishedAt) > 90 * 86400_000 && row.description) {
    warnings.push('historical_description_requires_verified_archive');
  }
  if (publishedAt && Date.parse(context.capturedAt) - Date.parse(publishedAt) > 14 * 86400_000 && !tagFields.tags.tags.length) {
    warnings.push('historical_untagged_article');
  }
  const rawCanonical = JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
  return {
    version: 1,
    disposition: reasons.length ? 'quarantine' : 'candidate',
    reasons,
    warnings,
    lineage: {
      sourceKey,
      generation: context.generation,
      objects: context.objects,
      capturedAt: context.capturedAt,
      rawSha256: createHash('sha256').update(rawCanonical).digest('hex'),
    },
    raw: row,
    legacyTagFields: tagFields,
    article: {
      media,
      mediaId: null,
      publishedAt,
      crawledAt,
      url,
      urlKey: key,
      title,
      image,
      category: row.category || null,
      creator: row.creator || null,
      tags: tagFields.tags.tags,
      description: row.description || null,
      body: null,
      authors: null,
      fetchedAt: null,
      fetchStatus: null,
      contentFetchedAt: null,
      bodyStatus: null,
      source: 'legacy',
    },
  };
}

import disabledSpec from '../../data/crawl-disabled.json' with { type: 'json' };
import groups from '../../data/crawl-groups.json' with { type: 'json' };
import { addNewsSources } from './news-sources.ts';
import { overrides } from './sources/overrides.ts';
import { loadSources, type SourceSpec } from './sources.ts';

let cached: SourceSpec[] | null = null;
export function allSources(): SourceSpec[] {
  cached ??= addNewsSources(loadSources(overrides, groups as Record<string, 'news' | 'hourly'>));
  return cached;
}
export function sourcesInGroup(group: 'news' | 'hourly'): SourceSpec[] {
  return allSources().filter((s) => s.group === group && !disabled().has(s.media));
}
export function sourceByMedia(media: string): SourceSpec | undefined {
  return allSources().find((s) => s.media === media);
}
// Sources listed in crawl-disabled.json are off; CRAWL_DISABLED=media1,media2
// turns further sources off without a deploy.
export const disabled = () =>
  new Set([
    ...(disabledSpec as { media: string[] }).media,
    ...(process.env.CRAWL_DISABLED ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]);

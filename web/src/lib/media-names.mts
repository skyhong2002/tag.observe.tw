import registry from '../../../app/data/media-names.json' with { type: 'json' };
import { type NewsSource, type ReferenceSource, resolveCatalogSource, selectTrafficSources, type TrafficSource } from './media-traffic.mts';

interface MediaName {
  name: string | null;
  aliases: string[];
  status: string;
  sourceUrl: string | null;
}
export const mediaNames = registry.media as Record<string, MediaName>;

export function trafficDisplayName(row: TrafficSource, sources: NewsSource[]) {
  const source = resolveCatalogSource(row, sources);
  return (source && mediaNames[source.media]?.name) || row.name;
}

// Keep spreadsheet names and numbers intact for identity resolution and audit.
// Search accepts both reviewed names and old aliases; name sort uses what readers see.
export function selectNamedTrafficSources(
  rows: TrafficSource[],
  references: ReferenceSource[],
  sources: NewsSource[],
  options: Parameters<typeof selectTrafficSources>[2],
) {
  const query = options.query.trim().toLocaleLowerCase();
  const candidates = rows.filter((row) => {
    if (!query) return true;
    const source = resolveCatalogSource(row, sources);
    const entry = source && mediaNames[source.media];
    return [row.name, row.domain ?? '', row.category, entry?.name ?? '', ...(entry?.aliases ?? [])].some((name) =>
      name.toLocaleLowerCase().includes(query),
    );
  });
  const selected = selectTrafficSources(candidates, references, { ...options, query: '' });
  if (options.sort === 'name') {
    selected.sort(
      (a, b) =>
        (options.ascending ? 1 : -1) * trafficDisplayName(a, sources).localeCompare(trafficDisplayName(b, sources), 'zh-Hant') ||
        a.row - b.row,
    );
  }
  return selected;
}

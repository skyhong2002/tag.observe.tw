import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import local from '../../data/favicon-local.json' with { type: 'json' };

// Outlet favicons are stored on this site (web/public/favicons, refreshed by
// tools/fetch-favicons.ts) because many original URLs 404, refuse foreign
// requests or are .ico files the image optimizer rejects. Outlets without a
// stored copy fall back to the catalog URL.
export const FAVICON_BASE = 'https://tag.observe.tw/favicons/';
const original = catalog as unknown as Record<string, { icon: string | null }>;
const stored = local as Record<string, unknown>;

export function iconUrl(media: string): string | null {
  if (media in stored) return `${FAVICON_BASE}${media}.png`;
  return original[media]?.icon?.replace(/^http:\/\//, 'https://') ?? null;
}

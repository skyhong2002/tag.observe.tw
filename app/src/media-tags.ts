import catalog from '../data/favicon-catalog.json' with { type: 'json' };

// An outlet's own brand is source metadata, not a reporting topic. Keep other
// outlets' names: they can be the subject of a report.
export function isOwnMediaTag(tag: string, media?: string): boolean {
  const title = media ? (catalog as Record<string, { title: string | null }>)[media]?.title : null;
  return !!title && tag.normalize('NFKC').trim().toLowerCase() === title.normalize('NFKC').trim().toLowerCase();
}

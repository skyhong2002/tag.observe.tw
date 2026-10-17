import { asc, count } from 'drizzle-orm';
import countries from '../data/media-countries.json' with { type: 'json' };
import registry from '../data/media-scope.json' with { type: 'json' };
import type { Db } from './db/client.ts';
import { mediaRoles } from './db/schema.ts';

// What the site actually collects from an outlet: the edition it reads, whom
// that edition serves and the outlet's role. A brand can matter (Reuters) while
// the collected edition still needs saying (a LINE TODAY channel).
interface Entry {
  scope: string;
  language: string;
  roles?: string[];
  coverage?: string;
}
export interface MediaScope {
  scope: string;
  scopeLabel: string;
  language: string;
  languageLabel: string;
  roles: Array<{ role: string; label: string }>;
  coverage: string | null;
}

const entries = registry.media as Record<string, Entry>;
const scopeLabels = registry.scopes as Record<string, string>;
const languageLabels = registry.languages as Record<string, string>;
const roleLabels = registry.roles as Record<string, string>;
const countryOf = (media: string) => (countries.media as Record<string, { countryCode: string }>)[media]?.countryCode;

// Roles (通訊社、平台代刊、新聞合作…) are ticked by admins at /admin/media/,
// so who carries which role lives in the DB (media_roles); the role names stay
// in media-scope.json, and its per-outlet `roles` only seed an empty table.
// Like the media labels, each process keeps a snapshot that
// refreshMediaCategories reloads every minute and after every admin write.
const seedPairs = () => Object.entries(entries).flatMap(([media, e]) => (e.roles ?? []).map((role) => ({ media, role })));
const membersOf = (pairs: Array<{ media: string; role: string }>) => {
  const members = new Map<string, string[]>();
  for (const { media, role } of pairs) if (roleLabels[role]) members.set(media, [...(members.get(media) ?? []), role]);
  return members;
};
let members = membersOf(seedPairs());

export const roleDefs = () => Object.entries(roleLabels).map(([key, label]) => ({ key, label }));
export const rolesOf = (media: string) => {
  const roles = members.get(media) ?? [];
  return Object.keys(roleLabels).filter((role) => roles.includes(role));
};

/** Seeds an empty media_roles from media-scope.json, then reloads the snapshot. */
export async function refreshMediaRoles(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(mediaRoles);
  if (!n) await db.insert(mediaRoles).ignore().values(seedPairs());
  members = membersOf(await db.select({ media: mediaRoles.media, role: mediaRoles.role }).from(mediaRoles).orderBy(asc(mediaRoles.media)));
}

/** Listed outlets elsewhere than Taiwan must be reviewed; Taiwan ones default. */
export function mediaScope(media: string): MediaScope | null {
  const entry = entries[media] ?? (countryOf(media) === 'TW' ? { scope: 'tw', language: 'zh-Hant' } : null);
  if (!entry) return null;
  return {
    scope: entry.scope,
    scopeLabel: scopeLabels[entry.scope] ?? entry.scope,
    language: entry.language,
    languageLabel: languageLabels[entry.language] ?? entry.language,
    roles: rolesOf(media).map((role) => ({ role, label: roleLabels[role] })),
    coverage: entry.coverage ?? null,
  };
}
export const MEDIA_SCOPES = scopeLabels;

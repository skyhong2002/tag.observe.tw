import countries from '../data/media-countries.json' with { type: 'json' };
import registry from '../data/media-scope.json' with { type: 'json' };

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

/** Listed outlets elsewhere than Taiwan must be reviewed; Taiwan ones default. */
export function mediaScope(media: string): MediaScope | null {
  const entry = entries[media] ?? (countryOf(media) === 'TW' ? { scope: 'tw', language: 'zh-Hant' } : null);
  if (!entry) return null;
  return {
    scope: entry.scope,
    scopeLabel: scopeLabels[entry.scope] ?? entry.scope,
    language: entry.language,
    languageLabel: languageLabels[entry.language] ?? entry.language,
    roles: (entry.roles ?? []).map((role) => ({ role, label: roleLabels[role] ?? role })),
    coverage: entry.coverage ?? null,
  };
}
export const MEDIA_SCOPES = scopeLabels;

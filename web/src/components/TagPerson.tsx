import type React from 'react';
import type { TagPerson as Person } from '@/lib/api';

// The person a tag names: a pencil-sketch avatar made from a Wikimedia Commons
// photo, and one line on who they are (docs/tag-avatars.md). The photo's
// license and author are linked, as the licenses require.

/** Current posts first, then party; Wikidata's description when there is neither. */
export function personLine(person: Person) {
  const facts = person.facts;
  const current = facts?.positions.filter((p) => p.current).map((p) => p.label) ?? [];
  // 「民主進步黨主席」 already says the party.
  const party = facts?.parties.find((x) => !current.some((p) => p.includes(x)));
  const parts = [...current.slice(0, 2), ...(party ? [party] : [])];
  return parts.length ? parts.join('・') : person.description;
}

// Commons' short names; government works often only ask for the source.
const LICENSE: Record<string, string> = { Attribution: '須標示來源', 'Public domain': '公有領域' };

/**
 * The sketch is ink on transparent, used as a mask over the site's orange, so
 * there is no frame. Dark pages get the reverse (the person filled, strokes
 * left open) so the drawing does not turn into a negative.
 */
export function TagAvatar({ url, size = 56 }: { url: string; size?: number }) {
  const at = (theme: string) => `url("${url}${url.includes('?') ? '&' : '?'}theme=${theme}")`;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 bg-brand-600 [mask-image:var(--ink-light)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] dark:bg-brand-400 dark:[mask-image:var(--ink-dark)]"
      style={{ width: size, height: size, '--ink-light': at('light'), '--ink-dark': at('dark') } as React.CSSProperties}
    />
  );
}

export default function TagPerson({ person }: { person: Person }) {
  const line = personLine(person);
  const a = person.avatar;
  return (
    <div className="flex items-center gap-3">
      {a && <TagAvatar url={a.url} />}
      <div className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
        {line && <p className="text-zinc-800 dark:text-zinc-200">{line}</p>}
        <p className="text-xs">
          <a href={`https://www.wikidata.org/wiki/${person.wikidataId}`} className="underline" rel="noopener noreferrer" target="_blank">
            Wikidata
          </a>
          {a && (
            <>
              {' · '}素描依
              <a href={a.pageUrl} className="mx-0.5 underline" rel="noopener noreferrer" target="_blank">
                {a.artist ?? 'Wikimedia Commons'}
              </a>
              的照片
              {a.license &&
                (a.licenseUrl ? (
                  <a href={a.licenseUrl} className="ml-1 underline" rel="noopener noreferrer license" target="_blank">
                    {LICENSE[a.license] ?? a.license}
                  </a>
                ) : (
                  <span className="ml-1">{LICENSE[a.license] ?? a.license}</span>
                ))}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

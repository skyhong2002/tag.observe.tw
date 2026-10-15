import type React from 'react';
import type { TagPerson as Person } from '@/lib/api';
import AvatarGuard from './AvatarGuard';

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
export const LICENSE: Record<string, string> = { Attribution: '須標示來源', 'Public domain': '公有領域' };

/**
 * Two masks, no frame: the person's silhouette in white, the sketch's strokes
 * in the site's orange on top, so the person is white paper on light and dark
 * pages alike.
 */
export function TagAvatar({ url, size = 56 }: { url: string; size?: number }) {
  const layer = (name: string) => `url("${url}${url.includes('?') ? '&' : '?'}layer=${name}")`;
  const mask = '[mask-image:var(--layer)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] absolute inset-0';
  return (
    <span aria-hidden="true" className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className={`${mask} bg-white`} style={{ '--layer': layer('fill') } as React.CSSProperties} />
      <span className={`${mask} bg-brand-600`} style={{ '--layer': layer('ink') } as React.CSSProperties} />
    </span>
  );
}

export default function TagPerson({ person }: { person: Person }) {
  const line = personLine(person);
  const a = person.avatar;
  return (
    <div className="flex items-center gap-3">
      {a && (
        <AvatarGuard url={a.url}>
          <TagAvatar url={a.url} />
        </AvatarGuard>
      )}
      <div className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
        {line && <p className="text-zinc-800 dark:text-zinc-200">{line}</p>}
        <p className="text-xs">
          <a href={`https://www.wikidata.org/wiki/${person.wikidataId}`} className="underline" rel="noopener noreferrer" target="_blank">
            Wikidata
          </a>
          {a && !a.pageUrl && <AvatarGuard url={a.url}> · 素描依管理員提供的照片</AvatarGuard>}
          {a?.pageUrl && (
            <AvatarGuard url={a.url}>
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
            </AvatarGuard>
          )}
        </p>
      </div>
    </div>
  );
}

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

export function TagAvatar({ person, size = 56 }: { person: Person; size?: number }) {
  if (!person.avatar) return null;
  return (
    <img
      src={person.avatar.url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:invert"
    />
  );
}

export default function TagPerson({ person }: { person: Person }) {
  const line = personLine(person);
  const a = person.avatar;
  return (
    <div className="flex items-center gap-3">
      <TagAvatar person={person} />
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

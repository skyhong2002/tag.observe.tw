'use client';

import { useEffect, useState } from 'react';
import PageOutline, { type OutlineEntry } from '@/components/PageOutline';

type Group = { id: string; title: string };

// The /method/ page's outline: each group's h2 from the server, then the h3s
// inside it once the page is read. The method blocks are shared with the footer
// and carry no ids, so their h3s are numbered here (#ranking-2 is the ranking
// group's second h3).
export default function MethodToc({ groups }: { groups: Group[] }) {
  const [entries, setEntries] = useState<OutlineEntry[]>(groups);

  useEffect(() => {
    const next = groups.map((group) => {
      const section = document.getElementById(group.id)?.closest('section');
      const children = Array.from(section?.querySelectorAll('h3') ?? []).map((h3, i) => {
        h3.id ||= `${group.id}-${i + 1}`;
        return { id: h3.id, title: h3.textContent ?? '' };
      });
      return { ...group, children };
    });
    setEntries(next);
    // A shared #ranking-2 link lands once the ids exist.
    const target = decodeURIComponent(location.hash.slice(1));
    if (target && next.some((g) => g.children.some((c) => c.id === target))) document.getElementById(target)?.scrollIntoView();
  }, [groups]);

  return <PageOutline entries={entries} />;
}

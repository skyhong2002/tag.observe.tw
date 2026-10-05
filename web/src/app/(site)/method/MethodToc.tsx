'use client';

import { useEffect, useState } from 'react';

type Group = { id: string; title: string };
type Entry = Group & { children: Group[] };

// Headings sit this far below the sticky header once jumped to (scroll-mt-24).
const ACTIVE_OFFSET = 112;

// The /method/ page's side outline: each group's h2 from the server, then the
// h3s inside it once the page is read. The method blocks are shared with the
// footer and carry no ids, so their h3s are numbered here (#ranking-2 is the
// ranking group's second h3). The heading above the reading line is marked.
export default function MethodToc({ groups }: { groups: Group[] }) {
  const [entries, setEntries] = useState<Entry[]>(() => groups.map((g) => ({ ...g, children: [] })));
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings: HTMLElement[] = [];
    const next = groups.map((group) => {
      const h2 = document.getElementById(group.id);
      const section = h2?.closest('section');
      if (h2) headings.push(h2);
      const children = Array.from(section?.querySelectorAll('h3') ?? []).map((h3, i) => {
        h3.id ||= `${group.id}-${i + 1}`;
        headings.push(h3);
        return { id: h3.id, title: h3.textContent ?? '' };
      });
      return { ...group, children };
    });
    setEntries(next);
    // A shared #ranking-2 link lands once the ids exist.
    const target = decodeURIComponent(location.hash.slice(1));
    if (target && headings.some((h) => h.id === target)) document.getElementById(target)?.scrollIntoView();

    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const h of headings) {
        if (h.getBoundingClientRect().top > ACTIVE_OFFSET + 8) break;
        current = h.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [groups]);

  const item = (id: string, nested: boolean) =>
    `-ml-px block border-l py-1 ${nested ? 'pl-6 text-[13px]' : 'pl-3'} ${
      active === id
        ? 'border-brand-600 font-medium text-brand-700 dark:border-brand-400 dark:text-brand-400'
        : 'border-transparent text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100'
    }`;

  return (
    <nav aria-label="本頁大綱" className="text-sm leading-snug">
      <h2 className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">本頁大綱</h2>
      <ol className="border-l border-zinc-200 dark:border-zinc-800">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={item(entry.id, false)} aria-current={active === entry.id ? 'location' : undefined}>
              {entry.title}
            </a>
            {entry.children.length > 0 && (
              <ol>
                {entry.children.map((child) => (
                  <li key={child.id}>
                    <a href={`#${child.id}`} className={item(child.id, true)} aria-current={active === child.id ? 'location' : undefined}>
                      {child.title}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

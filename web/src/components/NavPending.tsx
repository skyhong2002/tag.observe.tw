'use client';

import { useLinkStatus } from 'next/link';
import { createContext, useContext, useEffect } from 'react';

// Header links report their pending navigation here so one loading bar can run
// along the header's bottom edge, even when the link sat in the closed mobile menu.
export const NavPendingContext = createContext<(pending: boolean) => void>(() => {});

// Rendered inside a header <Link>. `data-pending` lets the link style itself with
// `has-data-pending:` while its page loads.
export default function NavPending() {
  const { pending } = useLinkStatus();
  const setPending = useContext(NavPendingContext);
  useEffect(() => {
    if (!pending) return;
    setPending(true);
    return () => setPending(false);
  }, [pending, setPending]);
  return <span hidden data-pending={pending || undefined} />;
}

export function NavProgressBar({ pending }: { pending: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden transition-opacity ${pending ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className="nav-progress block h-full w-2/5 bg-brand-600 dark:bg-brand-400" />
    </span>
  );
}

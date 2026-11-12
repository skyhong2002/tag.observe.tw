'use client';

import ErrorState, { type ErrorProps } from '@/components/ErrorState';
import SiteHeader from '@/components/SiteHeader';

// The home page and anything (site)/error.tsx cannot catch (its own layout) land
// here. Like the root not-found it brings its own header; the footer is a server
// component and cannot render inside this client boundary.
export default function RootError(props: ErrorProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <ErrorState {...props} />
      </main>
    </div>
  );
}

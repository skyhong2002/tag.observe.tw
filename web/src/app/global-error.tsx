'use client';

import { useEffect } from 'react';
import ErrorState, { type ErrorProps } from '@/components/ErrorState';
import './globals.css';

// Only for a failure in the root layout itself, which this replaces: it has to
// bring its own document, styles and theme (the layout's theme script is gone).
export default function GlobalError(props: ErrorProps) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      document.documentElement.dataset.theme =
        saved === 'dark' || saved === 'light' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {}
  }, []);
  return (
    <html lang="zh-Hant">
      <body className="min-h-dvh bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <title>暫時無法載入 · 新文易數</title>
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          <ErrorState {...props} />
        </main>
      </body>
    </html>
  );
}

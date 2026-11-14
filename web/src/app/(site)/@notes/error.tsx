'use client';

// A page's own method notes are extra: if they fail, say so in one line and keep
// the page (the slot would otherwise take (site)'s whole content down with it).
export default function NotesError() {
  return <p className="text-zinc-600 dark:text-zinc-400">本頁補充說明暫時無法載入。</p>;
}

'use client';

import { useEffect } from 'react';
import { prefs, readerFetch } from '@/lib/reader';

// Adds this article to the reader's history, only when they turned the reading
// report on at /my/reading/. Renders nothing.
export default function ReadingRecorder({ articleId }: { articleId: number }) {
  useEffect(() => {
    let live = true;
    prefs
      .get()
      .then((p) => {
        if (live && p?.history) return readerFetch('/auth/me/history', { method: 'POST', body: { articleId } });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [articleId]);
  return null;
}

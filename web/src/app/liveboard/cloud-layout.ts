'use client';

import { type CloudSizes, type CloudTerm, layoutWordCloud, type PlacedWord } from '@/lib/word-cloud.mts';
import type { LayoutRequest } from './cloud-layout.worker';

// layoutWordCloud in a worker (cloud-layout.worker.ts); in the page itself if
// the browser cannot start one.

let worker: Worker | null | undefined;
let serial = 0;
const waiting = new Map<number, (placed: PlacedWord[]) => void>();

function start() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./cloud-layout.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; placed: PlacedWord[] }>) => {
      waiting.get(event.data.id)?.(event.data.placed);
      waiting.delete(event.data.id);
    };
    worker.onerror = () => {
      // Fall back for good, answering whatever was sent.
      worker = null;
      for (const resolve of waiting.values()) resolve([]);
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function layoutCloud(terms: CloudTerm[], width: number, height: number, sizes: CloudSizes): Promise<PlacedWord[]> {
  const w = start();
  if (!w) return Promise.resolve(layoutWordCloud(terms, width, height, sizes));
  const id = ++serial;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    w.postMessage({ id, terms, width, height, sizes } satisfies LayoutRequest);
  });
}

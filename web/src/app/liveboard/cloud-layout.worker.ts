// Lays out the simple board's clouds off the main thread (cloud-layout.ts), so
// packing a few dozen words never stalls the animation that is playing.
import { type CloudSizes, type CloudTerm, layoutWordCloud } from '@/lib/word-cloud.mts';

export interface LayoutRequest {
  id: number;
  terms: CloudTerm[];
  width: number;
  height: number;
  sizes: CloudSizes;
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { id, terms, width, height, sizes } = event.data;
  self.postMessage({ id, placed: layoutWordCloud(terms, width, height, sizes) });
};

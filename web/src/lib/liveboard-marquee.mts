import type { LiveActivity } from './liveboard.mts';

/** Show the latest result for each source/stage, rather than every retry. */
export function crawlMarqueeRows(crawls: LiveActivity['crawls']): LiveActivity['crawls'] {
  const rows = new Map<string, LiveActivity['crawls'][number]>();
  for (const crawl of crawls) {
    const key = `${crawl.media}:${crawl.stage}`;
    const previous = rows.get(key);
    if (!previous || Date.parse(crawl.at) > Date.parse(previous.at)) rows.set(key, crawl);
  }
  return [...rows.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 40);
}

export const MARQUEE_PIXELS_PER_SECOND = 32;

/** One frame chain, with bounded position and no catch-up after a hidden tab. */
export function startMarquee(options: {
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
  width: () => number;
  active: () => boolean;
  draw: (offset: number) => void;
  onCycle: () => void;
}) {
  let frame = 0;
  let stopped = false;
  let previous: number | null = null;
  let offset = 0;
  const tick = (time: number) => {
    if (stopped) return;
    const width = options.width();
    if (!options.active() || width <= 0) previous = null;
    else {
      const elapsed = previous === null ? 0 : Math.max(0, Math.min(100, time - previous));
      previous = time;
      offset += (elapsed * MARQUEE_PIXELS_PER_SECOND) / 1000;
      if (offset >= width) {
        offset = 0;
        options.onCycle();
      }
      options.draw(offset);
    }
    if (!stopped) frame = options.requestFrame(tick);
  };
  frame = options.requestFrame(tick);
  return () => {
    stopped = true;
    options.cancelFrame(frame);
  };
}

import { describe, expect, it } from 'vitest';
import type { LiveActivity } from '../../web/src/lib/liveboard.mts';
import { crawlMarqueeRows, MARQUEE_PIXELS_PER_SECOND, startMarquee } from '../../web/src/lib/liveboard-marquee.mts';

const crawl = (media: string, stage: string, at: string): LiveActivity['crawls'][number] => ({
  media,
  stage,
  at,
  mediaTitle: media,
  running: false,
  inserted: 1,
  failed: false,
});

function frames() {
  let serial = 0;
  const pending = new Map<number, (time: number) => void>();
  return {
    pending,
    requestFrame: (callback: (time: number) => void) => {
      const id = ++serial;
      pending.set(id, callback);
      return id;
    },
    cancelFrame: (id: number) => {
      pending.delete(id);
    },
    step: (time: number) => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(time);
    },
  };
}

describe('long-running crawl marquee', () => {
  it('keeps the newest result per source/stage across repeated and shuffled polls', () => {
    const latest = { ...crawl('cna', 'index', '2026-10-07T08:01:00Z'), failed: true };
    const rows = [latest, crawl('cna', 'article', '2026-10-07T08:00:00Z'), crawl('cna', 'index', '2026-10-07T07:59:00Z')];
    expect(crawlMarqueeRows([...rows, ...rows].reverse())).toEqual([latest, rows[1]]);
    for (let poll = 0; poll < 720; poll++) {
      expect(crawlMarqueeRows([...rows, ...rows, ...rows])).toHaveLength(2);
    }
  });

  it('holds a constant pixel speed and one frame chain through six hours of changing widths', () => {
    const scheduler = frames();
    let width = 1000;
    let offset = 0;
    let loops = 0;
    const stop = startMarquee({
      ...scheduler,
      width: () => width,
      active: () => true,
      draw: (value) => {
        offset = value;
      },
      onCycle: () => {
        width = ++loops % 2 ? 400 : 1000;
      },
    });
    scheduler.step(0);
    let wrongSpeed = false;
    let extraFrames = false;
    for (let time = 100; time <= 6 * 3600 * 1000; time += 100) {
      const previous = offset;
      const lap = loops;
      scheduler.step(time);
      if (lap === loops && Math.abs(offset - previous - MARQUEE_PIXELS_PER_SECOND / 10) > 0.00001) wrongSpeed = true;
      if (scheduler.pending.size !== 1 || offset < 0 || offset >= width) extraFrames = true;
    }
    expect(wrongSpeed).toBe(false);
    expect(extraFrames).toBe(false);
    expect(loops).toBeGreaterThan(900);
    stop();
    expect(scheduler.pending.size).toBe(0);
  });

  it('does not catch up after a hidden tab or accumulate loops on effect remounts', () => {
    const scheduler = frames();
    let active = true;
    let offset = 0;
    const options = {
      ...scheduler,
      width: () => 1000,
      active: () => active,
      draw: (value: number) => {
        offset = value;
      },
      onCycle: () => {},
    };
    const stop = startMarquee(options);
    scheduler.step(0);
    scheduler.step(100);
    expect(offset).toBe(3.2);
    active = false;
    scheduler.step(3600000);
    active = true;
    scheduler.step(3600100);
    expect(offset).toBe(3.2);
    scheduler.step(3600200);
    expect(offset).toBe(6.4);
    // A long frame gap without a visibility event is bounded too.
    scheduler.step(7200000);
    expect(offset).toBeCloseTo(9.6);
    stop();
    const remount = startMarquee(options);
    expect(scheduler.pending.size).toBe(1);
    remount();
    expect(scheduler.pending.size).toBe(0);
  });
});

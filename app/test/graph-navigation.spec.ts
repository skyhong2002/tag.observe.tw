import { describe, expect, it } from 'vitest';
import { clampGraphZoom, wheelZoomFactor } from '../../web/src/lib/graph-navigation.mts';

describe('continuous graph zoom', () => {
  it('keeps small trackpad changes small and equivalent total deltas consistent', () => {
    expect(wheelZoomFactor(-1, 0, 700)).toBeLessThan(1.01);
    expect(wheelZoomFactor(-1, 0, 700) ** 100).toBeCloseTo(wheelZoomFactor(-100, 0, 700), 10);
    expect(wheelZoomFactor(-80, 0, 700) * wheelZoomFactor(80, 0, 700)).toBeCloseTo(1);
    expect(wheelZoomFactor(0, 0, 700)).toBe(1);
  });
  it('normalizes wheel units and bounds the useful camera range', () => {
    expect(wheelZoomFactor(-3, 1, 700)).toBe(wheelZoomFactor(-48, 0, 700));
    expect(wheelZoomFactor(-0.1, 2, 700)).toBe(wheelZoomFactor(-70, 0, 700));
    expect(clampGraphZoom(0.01)).toBe(0.2);
    expect(clampGraphZoom(1000)).toBe(20);
    expect(clampGraphZoom(2.5)).toBe(2.5);
  });
});

// Exercise real gesture handlers without a chart: the camera must follow
// physical finger distance independently of the number of pointer events.
describe('graph touch gestures', () => {
  it('tracks a 2.5x pinch at different event rates and suppresses the following click', async () => {
    const { bindGraphNavigation } = await import('../../web/src/lib/graph-navigation.mts');
    const { vi } = await import('vitest');
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    try {
      for (const steps of [1, 9, 30]) {
        const element = Object.assign(new EventTarget(), {
          clientWidth: 400,
          clientHeight: 600,
          getBoundingClientRect: () => ({ left: 0, top: 0 }),
          setPointerCapture: () => {},
        });
        let zoom = 1;
        const gestures = bindGraphNavigation(element as unknown as HTMLElement, {
          zoom: () => zoom,
          scale: (value) => {
            zoom = value;
          },
          pan: () => {},
          reset: () => {},
          moving: () => {},
          settled: () => {},
        });
        const send = (type: string, id: number, x: number) =>
          element.dispatchEvent(
            Object.assign(new Event(type, { cancelable: true }), {
              pointerId: id,
              button: 0,
              clientX: x,
              clientY: 300,
            }),
          );
        send('pointerdown', 1, 160);
        send('pointerdown', 2, 220);
        for (let step = 1; step <= steps; step++) {
          send('pointermove', 1, 160 - (45 * step) / steps);
          send('pointermove', 2, 220 + (45 * step) / steps);
        }
        send('pointerup', 1, 115);
        send('pointerup', 2, 265);
        expect(zoom).toBeCloseTo(2.5, 10);
        expect(element.dispatchEvent(new Event('click', { cancelable: true }))).toBe(false);
        // A new stationary tap still works after navigating.
        send('pointerdown', 3, 200);
        send('pointerup', 3, 200);
        expect(element.dispatchEvent(new Event('click', { cancelable: true }))).toBe(true);
        gestures.dispose();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

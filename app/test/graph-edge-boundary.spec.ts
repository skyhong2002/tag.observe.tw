import { describe, expect, it } from 'vitest';
import { graphBoundaryDiameter, graphEdgeHasRoom } from '../../web/src/lib/graph-edge-boundary.mts';

describe('invisible logo boundary', () => {
  it('clears the corners of small and large square logos at every angle', () => {
    for (const size of [16, 20, 44, 72]) {
      const radius = graphBoundaryDiameter(size) / 2;
      expect(radius - Math.hypot(size / 2, size / 2)).toBeCloseTo(4);
      for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const x = radius * Math.cos(angle),
          y = radius * Math.sin(angle);
        expect(Math.max(Math.abs(x), Math.abs(y))).toBeGreaterThan(size / 2);
      }
    }
  });
  it('suppresses short edges before zoomed-out logos can reverse or cover their arrows', () => {
    expect(graphEdgeHasRoom(200, 1, 72, 20, 14)).toBe(true);
    expect(graphEdgeHasRoom(200, 0.2, 72, 20, 14)).toBe(false);
    expect(graphEdgeHasRoom(40, 3, 72, 20, 14)).toBe(true);
    expect(graphEdgeHasRoom(0, 20, 16, 16, 0)).toBe(false);
  });
});

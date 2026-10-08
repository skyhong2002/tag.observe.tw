import { describe, expect, it } from 'vitest';
import { eventContinuations } from '../../web/src/lib/event-continuations.mts';

describe('event continuation navigation', () => {
  it('preserves recorded direction without assuming that larger ids are later', () => {
    expect(eventContinuations({ id: 914, combinedFrom: [1000], combinedTo: [900] }, [1000, 900, 777])).toEqual({
      previous: [1000],
      next: [900],
      other: [777],
    });
  });
  it('omits self-links, duplicate links and invalid ids', () => {
    expect(eventContinuations({ id: 914, combinedFrom: [914, 12, 12, -1], combinedTo: [18, 0, 1.5] }, [12, 18, 20, 20])).toEqual({
      previous: [12],
      next: [18],
      other: [20],
    });
  });
  it('supports old responses and events with no recorded continuation', () => {
    expect(eventContinuations({ id: 914 }, [12])).toEqual({ previous: [], next: [], other: [12] });
    expect(eventContinuations({ id: 914 })).toEqual({ previous: [], next: [], other: [] });
  });
});

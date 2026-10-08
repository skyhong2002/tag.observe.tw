import { describe, expect, it } from 'vitest';
import { hourWindow } from '../../web/src/lib/event-hour-window.mts';

const hours = Array.from({ length: 72 }, (_, i) => ({ hourStart: new Date(Date.UTC(2026, 9, 5, i)).toISOString() }));
describe('event hour window', () => {
  it('centers a selected hour with two hours on either side', () => {
    expect(hourWindow(hours, hours[36].hourStart)).toEqual({ start: 34, end: 39, anchor: hours[36].hourStart });
  });
  it('opens the latest hour at the end, without inventing later hours', () => {
    expect(hourWindow(hours)).toEqual({ start: 69, end: 72, anchor: hours[71].hourStart });
    expect(hourWindow(hours, 'invalid')).toEqual(hourWindow(hours));
  });
  it('clamps the first hour and handles empty data', () => {
    expect(hourWindow(hours, hours[0].hourStart)).toEqual({ start: 0, end: 3, anchor: hours[0].hourStart });
    expect(hourWindow([])).toEqual({ start: 0, end: 0, anchor: '' });
  });
  it('does not treat gaps as adjacent clock hours', () => {
    const sparse = [hours[0], hours[12], hours[24]];
    expect(hourWindow(sparse, hours[12].hourStart)).toEqual({ start: 1, end: 2, anchor: hours[12].hourStart });
  });
});

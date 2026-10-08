/** Hours must be sorted oldest first. A missing/invalid anchor opens the latest hour. */
export function hourWindow(hours: readonly { hourStart: string }[], at?: string) {
  if (!hours.length) return { start: 0, end: 0, anchor: '' };
  const requested = Date.parse(at ?? '');
  let index = hours.length - 1;
  if (Number.isFinite(requested)) {
    index = hours.reduce(
      (best, h, i) => (Math.abs(Date.parse(h.hourStart) - requested) < Math.abs(Date.parse(hours[best].hourStart) - requested) ? i : best),
      index,
    );
  }
  const anchor = hours[index].hourStart;
  const center = Date.parse(anchor);
  const radius = 2 * 60 * 60 * 1000;
  let start = index;
  let end = index + 1;
  while (start > 0 && Date.parse(hours[start - 1].hourStart) >= center - radius) start--;
  while (end < hours.length && Date.parse(hours[end].hourStart) <= center + radius) end++;
  return { start, end, anchor };
}

/** Use recorded merge direction, never infer it from event ids or shared tags. */
export function eventContinuations(
  thread: { id: number; combinedFrom?: number[]; combinedTo?: number[] },
  related: readonly number[] = [],
) {
  const clean = (ids: readonly number[]) => [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0 && id !== thread.id);
  const previous = clean(thread.combinedFrom ?? []);
  const next = clean(thread.combinedTo ?? []);
  const directed = new Set([...previous, ...next]);
  return { previous, next, other: clean(related).filter((id) => !directed.has(id)) };
}

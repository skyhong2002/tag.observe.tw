import type { LegacyCandidate } from './import.ts';

/** SQL builds groups with production collations; this review requires binary
 * equality of every article field except original collection time. Raw rows
 * and their independent collection timestamps remain in source provenance. */
export function reviewIdentityGroups(rows: LegacyCandidate[], groups: number[][]) {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (const group of groups) {
    for (const i of group) {
      if (!Number.isInteger(i) || i < 0 || i >= rows.length) throw new Error('Invalid identity group');
      parent[find(i)] = find(group[0]);
    }
  }
  const sets = new Map<number, number[]>();
  for (const i of new Set(groups.flat())) {
    const root = find(i);
    sets.set(root, [...(sets.get(root) ?? []), i]);
  }
  const conflicts = new Set<number>();
  const equivalent = new Map<number, number>();
  const key = (row: LegacyCandidate) =>
    JSON.stringify(Object.fromEntries(Object.entries(row.article).filter(([name]) => name !== 'crawledAt').sort(([a], [b]) => a.localeCompare(b))));
  for (const group of sets.values()) {
    if (group.length < 2) continue;
    if (new Set(group.map((i) => key(rows[i]))).size === 1) {
      const representative = Math.min(...group);
      for (const i of group) equivalent.set(i, representative);
    } else {
      for (const i of group) conflicts.add(i);
    }
  }
  return { conflicts, equivalent };
}

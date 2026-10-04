// 最後更新 of a 議題 / 專題, the order of every topic list (the API sorts by it).

export interface Updatable {
  /** From the API; absent on builds before it was sent. */
  updatedAt?: string | null;
  storyLastAt?: string | null;
  time: string | null;
  backlog?: boolean;
}

/** The newest story on the topic page; otherwise when the site first saw it,
 *  unless it was listed before tracking began (null: unknown). */
export const updatedAtOf = (t: Updatable): string | null =>
  t.updatedAt !== undefined ? t.updatedAt : (t.storyLastAt ?? (t.backlog ? null : t.time));

const DAY = 86400e3;
const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);

export type UpdateGroupKey = 'today' | 'yesterday' | 'week' | 'older' | 'unknown';
export const UPDATE_GROUP_LABELS: Record<UpdateGroupKey, string> = {
  today: '今天更新',
  yesterday: '昨天更新',
  week: '本週更新',
  older: '更早',
  unknown: '更新時間不明（追蹤前已上架）',
};

/** Split an already sorted list by the Taiwan day of its last update (past 7
 *  days = 本週), unknown last; empty groups left out, order kept within each. */
export function groupByUpdate<T extends Updatable>(items: T[], now: Date): Array<{ key: UpdateGroupKey; label: string; items: T[] }> {
  const today = taipeiDay(now.toISOString());
  const yesterday = taipeiDay(new Date(+now - DAY).toISOString());
  const weekAgo = taipeiDay(new Date(+now - 7 * DAY).toISOString());
  const keys: UpdateGroupKey[] = ['today', 'yesterday', 'week', 'older', 'unknown'];
  const groups = keys.map((key) => ({ key, label: UPDATE_GROUP_LABELS[key], items: [] as T[] }));
  for (const t of items) {
    const at = updatedAtOf(t);
    const day = at ? taipeiDay(at) : null;
    const key: UpdateGroupKey = !day
      ? 'unknown'
      : day >= today
        ? 'today'
        : day === yesterday
          ? 'yesterday'
          : day >= weekAgo
            ? 'week'
            : 'older';
    groups[keys.indexOf(key)].items.push(t);
  }
  return groups.filter((g) => g.items.length);
}

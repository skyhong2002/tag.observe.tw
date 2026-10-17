import { count, isNotNull, max } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import type { Db } from '../db/client.ts';
import {
  articleAuthorLog,
  articleTagLog,
  mediaCategoryLog,
  mediaTaiwanShareLog,
  readerHistory,
  readerReports,
  tagGroupDefLog,
  tagGroupMemberLog,
  tagPeopleLog,
  tagPictureVotes,
  tagVisualLog,
  userFollows,
  userRoleLog,
  userSaves,
  users,
  writingPeopleLog,
} from '../db/schema.ts';

// What each signed-in account has done, for the 帳號 tab of /admin/. Readers'
// own use (互動: reading, following, saving) is kept apart from what they gave
// the site (貢獻: reports, votes) and from admin edits, which the logs record by
// email rather than user id. Each metric sums one or more logs.

type Group = 'use' | 'contribute' | 'admin';
type Source = { table: MySqlTable; who: MySqlColumn; at: MySqlColumn; by: 'id' | 'email' };
type Metric = { key: string; label: string; group: Group; sources: Source[] };

const byId = (table: MySqlTable, who: MySqlColumn, at: MySqlColumn): Source => ({ table, who, at, by: 'id' });
const byEmail = (table: MySqlTable, who: MySqlColumn, at: MySqlColumn): Source => ({ table, who, at, by: 'email' });

export const METRICS: Metric[] = [
  { key: 'reads', label: '閱讀', group: 'use', sources: [byId(readerHistory, readerHistory.userId, readerHistory.readAt)] },
  { key: 'follows', label: '追蹤', group: 'use', sources: [byId(userFollows, userFollows.userId, userFollows.createdAt)] },
  { key: 'saves', label: '收藏', group: 'use', sources: [byId(userSaves, userSaves.userId, userSaves.createdAt)] },
  { key: 'reports', label: '回報', group: 'contribute', sources: [byId(readerReports, readerReports.userId, readerReports.createdAt)] },
  { key: 'votes', label: '投票', group: 'contribute', sources: [byId(tagPictureVotes, tagPictureVotes.userId, tagPictureVotes.at)] },
  {
    key: 'media',
    label: '媒體設定',
    group: 'admin',
    sources: [
      byEmail(mediaCategoryLog, mediaCategoryLog.email, mediaCategoryLog.at),
      byEmail(mediaTaiwanShareLog, mediaTaiwanShareLog.email, mediaTaiwanShareLog.at),
    ],
  },
  {
    key: 'articles',
    label: '文章標籤與署名',
    group: 'admin',
    sources: [
      byEmail(articleTagLog, articleTagLog.email, articleTagLog.at),
      byEmail(articleAuthorLog, articleAuthorLog.email, articleAuthorLog.at),
    ],
  },
  {
    key: 'tags',
    label: '標籤分類',
    group: 'admin',
    sources: [
      byEmail(tagGroupMemberLog, tagGroupMemberLog.email, tagGroupMemberLog.at),
      byEmail(tagGroupDefLog, tagGroupDefLog.email, tagGroupDefLog.at),
    ],
  },
  {
    key: 'pictures',
    label: '標籤圖像',
    group: 'admin',
    sources: [byEmail(tagPeopleLog, tagPeopleLog.email, tagPeopleLog.at), byEmail(tagVisualLog, tagVisualLog.email, tagVisualLog.at)],
  },
  { key: 'writing', label: '寫法人物', group: 'admin', sources: [byEmail(writingPeopleLog, writingPeopleLog.email, writingPeopleLog.at)] },
  {
    key: 'resolved',
    label: '處理回報',
    group: 'admin',
    sources: [byEmail(readerReports, readerReports.resolvedBy, readerReports.resolvedAt)],
  },
  { key: 'accounts', label: '帳號權限', group: 'admin', sources: [byEmail(userRoleLog, userRoleLog.email, userRoleLog.at)] },
];

export interface UserActivity {
  counts: Record<string, number>;
  lastActiveAt: string | null;
}

/** Counts per user id for every metric, plus when each account last did any of it. */
export async function userActivity(db: Db) {
  const accounts = await db.select({ id: users.id, email: users.email }).from(users);
  const idOf = new Map(accounts.map((a) => [a.email.toLowerCase(), a.id]));
  const out: Record<number, UserActivity> = Object.fromEntries(accounts.map((a) => [a.id, { counts: {}, lastActiveAt: null }]));
  await Promise.all(
    METRICS.flatMap((metric) =>
      metric.sources.map(async ({ table, who, at, by }) => {
        // max() maps through the column, so DATETIMEs keep the driver's UTC parsing.
        const rows = await db
          .select({ who, n: count(), last: max(at) })
          .from(table)
          .where(isNotNull(who))
          .groupBy(who);
        for (const row of rows) {
          const id = by === 'id' ? Number(row.who) : idOf.get(String(row.who).toLowerCase());
          const user = id === undefined ? undefined : out[id];
          if (!user) continue;
          user.counts[metric.key] = (user.counts[metric.key] ?? 0) + Number(row.n);
          const last = row.last instanceof Date ? row.last.toISOString() : null;
          if (last && (!user.lastActiveAt || last > user.lastActiveAt)) user.lastActiveAt = last;
        }
      }),
    ),
  );
  return { metrics: METRICS.map(({ key, label, group }) => ({ key, label, group })), users: out };
}

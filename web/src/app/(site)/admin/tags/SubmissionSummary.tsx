'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminFetch } from '../AdminGate';

type Summary = {
  relation: { pending: number; approved: number; revoked: number };
  picture: { approved: number; revoked: number };
};

// Readers' last-7-day submissions, decided by their votes; admins can only
// revoke. Silent until it loads (and for non-admins, who get a 401/403).
export default function SubmissionSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    adminFetch<Summary>('/auth/admin/tag-submissions/summary').then(setSummary, () => setSummary(null));
  }, []);
  if (!summary) return null;
  const linkClass = 'text-brand-700 underline dark:text-brand-400';
  return (
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
      近 7 天讀者投稿（由讀者投票決定，管理員可撤下）：
      <Link href="/admin/tags/?view=pictures" className={linkClass}>
        配圖 {summary.picture.approved} 張
      </Link>
      {summary.picture.revoked > 0 && `（已撤下 ${summary.picture.revoked}）`}、
      <Link href="/admin/tags/?view=submissions" className={linkClass}>
        關係 {summary.relation.pending + summary.relation.approved + summary.relation.revoked} 筆
      </Link>
      （投票中 {summary.relation.pending}、已成立 {summary.relation.approved}
      {summary.relation.revoked > 0 && `、已撤下 ${summary.relation.revoked}`}）。
    </p>
  );
}

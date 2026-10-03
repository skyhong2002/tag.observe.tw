import { taipei } from '@/lib/api';
import type { TopicCheck } from '@/lib/pages';

export default function TopicCheckStatus({ check }: { check?: TopicCheck }) {
  const problem = !check || check.stale || check.status === 'failed' || check.status === 'partial';
  const label =
    !check || check.status === 'pending'
      ? '等待首次檢查'
      : check.status === 'running'
        ? '正在更新'
        : check.status === 'partial'
          ? '部分入口未更新'
          : check.status === 'failed'
            ? '本次未能更新，保留先前資料'
            : check.stale
              ? '更新延遲'
              : '更新正常';
  return (
    <span className={problem ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-500'}>
      {label}
      {check?.checkedAt ? ` · ${taipei(check.checkedAt)} 檢查` : ''}
      {check?.status === 'ok' ? ` · ${check.fetched} 個專題` : ''}
    </span>
  );
}

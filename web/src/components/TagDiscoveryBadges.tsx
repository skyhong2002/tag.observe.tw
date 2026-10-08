import { type DiscoverySignals, type FirstCollection, type RankingGate, taipei } from '@/lib/api';

export default function TagDiscoveryBadges({
  isNew,
  signals,
  firstCollection,
  gate = 'early',
  className = '',
}: {
  isNew: boolean;
  signals?: DiscoverySignals;
  firstCollection?: FirstCollection | null;
  gate?: RankingGate;
  className?: string;
}) {
  const jump = gate === 'broad' ? signals?.broadJump : signals?.earlyJump;
  const growth = signals?.growth;
  const badges = [
    ...(isNew
      ? [
          {
            text: '新上榜',
            title: '24 小時前的完整榜單未出現，現在上榜。',
            tone: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
          },
        ]
      : []),
    ...(firstCollection?.recent
      ? [
          {
            text: '首次收錄',
            title: `本站現存收錄紀錄首次見到：${taipei(firstCollection.at)}；沒有更早刊登的已收錄報導。`,
            tone: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
          },
        ]
      : []),
    ...(jump
      ? [
          {
            text: '跳升',
            title: `24 小時前未達${gate === 'broad' ? '多家跟進' : '早期線索'}門檻，現在已達標。`,
            tone: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300',
          },
        ]
      : []),
    ...(growth == null || jump === null
      ? [
          {
            text: '歷史不足',
            title:
              growth == null
                ? '缺少可比較的歷史，無法確認升溫或降溫；不把缺值當成零。'
                : '缺少可比較的 24 小時前媒體資料，無法確認是否跨越門檻。',
            tone: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
          },
        ]
      : []),
  ];
  if (!badges.length) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${className}`}>
      {badges.map((badge) => (
        <span
          key={badge.text}
          title={badge.title}
          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.tone}`}
        >
          {badge.text}
        </span>
      ))}
    </span>
  );
}

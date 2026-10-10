import WordCloud from '@/components/WordCloud';
import { taipeiHour } from '@/lib/api';
import type { TagStat } from '@/lib/event-thread.mts';

// Every tag an event carried, as a word cloud sized by peak score. Hovering
// or focusing a word opens a small card with the numbers the old list showed
// (peak, when, how many hours); clicking goes to the tag page.

const compact = { width: 300, height: 230, sizes: { min: 12, max: 30 } };
const wide = { width: 760, height: 360, sizes: { min: 13, max: 64, budget: 0.7 } };

export default function EventTagCloud({ stats, hours }: { stats: TagStat[]; hours: number }) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <WordCloud
        compact={compact}
        wide={wide}
        label="事件標籤文字雲"
        title="事件標籤文字雲"
        words={stats.map((s) => ({
          label: s.tag,
          // A major tag that never made an hour's top list still belongs in the cloud, at the smallest size.
          count: Math.max(s.peak, 0.5),
          href: `/tag/${encodeURIComponent(s.tag)}/`,
          ariaLabel: `${s.tag}，最高 ${s.peak.toFixed(1)} 分，出現 ${s.hours} 小時`,
          tone: s.major ? 'brand' : 'muted',
          fontWeight: s.major ? 700 : 500,
          card: {
            badge: s.major ? { text: '主要標籤', tone: 'brand' } : { text: '相關標籤', tone: 'muted' },
            rows: [
              ['最高分', s.peak > 0 ? `${s.peak.toFixed(1)}（${taipeiHour(s.peakAt)}）` : '未進入任何小時的前 12 名'],
              ['出現', `${s.hours} / ${hours} 小時`],
            ],
          },
        }))}
      />
    </div>
  );
}
